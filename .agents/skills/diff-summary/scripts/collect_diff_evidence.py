#!/usr/bin/env python3
"""Collect hardened, exactly scoped Git or GitHub diff evidence as JSON."""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import signal
import stat as stat_module
import subprocess
import sys
import tempfile
import threading
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, TypeAlias, Union


JsonValue: TypeAlias = Union[
    None,
    bool,
    int,
    float,
    str,
    list["JsonValue"],
    dict[str, "JsonValue"],
]

GIT_GLOBAL_OPTIONS = (
    "--no-lazy-fetch",
    "--no-replace-objects",
    "-c",
    "core.fsmonitor=false",
    "--no-pager",
)
GIT_ENVIRONMENT = {
    "GIT_NO_LAZY_FETCH": "1",
    "GIT_NO_REPLACE_OBJECTS": "1",
    "GIT_OPTIONAL_LOCKS": "0",
}
GH_ENVIRONMENT = {
    "GH_PAGER": "cat",
    "PAGER": "cat",
    "GH_PROMPT_DISABLED": "1",
    "NO_COLOR": "1",
}
DIFF_FLAGS = (
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    "--default-prefix",
    "--submodule=short",
)
WORKTREE_DIFF_FLAG = "--ignore-submodules=dirty"
TREE_DIFF_FLAG = "--ignore-submodules=none"
MAX_UNTRACKED_SIZE = 256 * 1024
MAX_REQUEST_SIZE = 1024 * 1024
MAX_ADMIN_POINTER_SIZE = 4096
MAX_ADMIN_TREE_ENTRIES = 100_000
MAX_UNTRACKED_PATHS = 100_000
MAX_INCLUDED_UNTRACKED_PATHS = 32
MAX_INCLUDED_UNTRACKED_BYTES = 2 * 1024 * 1024
FILESYSTEM_SCAN_TIMEOUT_SECONDS = 5.0
COMMAND_TIMEOUT_SECONDS = 30.0
MAX_STDOUT_BYTES = 32 * 1024 * 1024
MAX_STDERR_BYTES = 256 * 1024
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
_ASCII_DIGITS_RE = re.compile(r"[0-9]+")
_PUBLIC_ENV_TEMPLATE_BASENAME = ".env.example"
_SENSITIVE_COMPONENTS = {
    ".netrc",
    ".npmrc",
    ".pypirc",
    "credentials",
    "credentials.json",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
    "service-account.json",
}
_SENSITIVE_SUFFIXES = (".cer", ".crt", ".key", ".p12", ".pem", ".pfx")
_REMOVED_GIT_ENVIRONMENT = {
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_CONFIG",
    "GIT_CONFIG_NOSYSTEM",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_SYSTEM",
    "GIT_CONFIG_GLOBAL",
    "GIT_DIR",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM",
    "GIT_EXEC_PATH",
    "GIT_GRAFT_FILE",
    "GIT_IMPLICIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_NAMESPACE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_PREFIX",
    "GIT_QUARANTINE_PATH",
    "GIT_REPLACE_REF_BASE",
    "GIT_SHALLOW_FILE",
    "GIT_WORK_TREE",
}
_REMOVED_GH_ENVIRONMENT = {
    "CLICOLOR_FORCE",
    "FORCE_COLOR",
    "GH_BROWSER",
    "GH_CONFIG_DIR",
    "GH_DEBUG",
    "GH_EDITOR",
    "GH_FORCE_TTY",
    "GH_HOST",
    "GH_PAGER",
    "GH_REPO",
    "GIT_PAGER",
    "LESS",
    "LV",
    "MANPAGER",
    "PAGER",
}


class EvidenceCollectorError(RuntimeError):
    """Base error for bounded evidence-collection failures."""


class EvidenceRequestError(EvidenceCollectorError):
    """Raised when a scope request is invalid or unsafe."""


class EvidenceCommandError(EvidenceCollectorError):
    """Raised when a hardened external command fails."""


class UnsafeRepositoryError(EvidenceCollectorError):
    """Raised when collecting working-tree evidence could execute repository code."""


@dataclass(frozen=True)
class ExecutionContext:
    git: str
    gh: str | None
    path: str


def _repository_boundary_candidate(repository: str | os.PathLike[str]) -> Path:
    """Find the nearest lexical worktree root without invoking repository code."""
    requested = Path(repository).expanduser().resolve(strict=False)
    if requested.is_file():
        requested = requested.parent
    for candidate in (requested, *requested.parents):
        try:
            (candidate / ".git").lstat()
        except OSError:
            continue
        return candidate
    return requested


def _sanitized_executable_path(
    excluded_root: Path | None = None,
) -> str:
    directories: list[str] = []
    for component in os.environ.get("PATH", "").split(os.pathsep):
        if not component or not Path(component).is_absolute():
            continue
        try:
            canonical = Path(component).resolve(strict=True)
        except OSError:
            continue
        if not canonical.is_dir():
            continue
        if excluded_root is not None and (
            canonical == excluded_root or canonical.is_relative_to(excluded_root)
        ):
            continue
        rendered = str(canonical)
        if rendered not in directories:
            directories.append(rendered)
    if not directories:
        raise EvidenceCommandError("PATH contains no trusted absolute directories")
    return os.pathsep.join(directories)


def _resolve_executable(name: str, path: str) -> str:
    found = shutil.which(name, path=path)
    if found is None:
        raise EvidenceCommandError(
            f"required executable not found on sanitized PATH: {name}"
        )
    try:
        executable = Path(found).resolve(strict=True)
        metadata = executable.stat()
    except OSError as error:
        raise EvidenceCommandError(f"could not resolve {name}: {error}") from error
    if not stat_module.S_ISREG(metadata.st_mode) or not os.access(executable, os.X_OK):
        raise EvidenceCommandError(f"resolved {name} is not an executable regular file")
    return str(executable)


def _resolve_execution_context(
    kind: str,
    repository: str | os.PathLike[str],
) -> ExecutionContext:
    excluded_root = _repository_boundary_candidate(repository)
    path = _sanitized_executable_path(excluded_root)
    return ExecutionContext(
        git=_resolve_executable("git", path),
        gh=_resolve_executable("gh", path) if kind == "pr" else None,
        path=path,
    )


def _is_removed_environment_key(key: str) -> bool:
    return (
        key.startswith("GIT_")
        or (key.startswith("GH_") and key not in {"GH_TOKEN", "GH_ENTERPRISE_TOKEN"})
        or key in _REMOVED_GIT_ENVIRONMENT
        or key in _REMOVED_GH_ENVIRONMENT
        or key.startswith("GIT_CONFIG_KEY_")
        or key.startswith("GIT_CONFIG_VALUE_")
        or key == "GIT_CONFIG_COUNT"
    )


def _process_environment(
    overrides: Mapping[str, str],
    *,
    executable_path: str,
) -> dict[str, str]:
    environment = {
        key: value
        for key, value in os.environ.items()
        if not _is_removed_environment_key(key)
    }
    environment["PATH"] = executable_path
    environment.update(overrides)
    return environment


def _recorded_environment(
    overrides: Mapping[str, str],
    execution: ExecutionContext,
) -> dict[str, str]:
    return {**overrides, "PATH": execution.path}


def _run_process(
    argv: Sequence[str],
    *,
    cwd: Path,
    environment: Mapping[str, str],
    executable_path: str,
    input_bytes: bytes | None = None,
) -> subprocess.CompletedProcess[bytes]:
    input_stream = None
    try:
        if input_bytes is not None:
            input_stream = tempfile.TemporaryFile()
            input_stream.write(input_bytes)
            input_stream.seek(0)
        process = subprocess.Popen(
            list(argv),
            cwd=cwd,
            env=_process_environment(
                environment,
                executable_path=executable_path,
            ),
            stdin=input_stream if input_stream is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            start_new_session=(os.name == "posix"),
        )
    except OSError as error:
        raise EvidenceCommandError(f"could not execute {argv[0]}: {error}") from error
    finally:
        if input_stream is not None and "process" not in locals():
            input_stream.close()

    stdout = bytearray()
    stderr = bytearray()
    assert process.stdout is not None
    assert process.stderr is not None
    deadline = time.monotonic() + COMMAND_TIMEOUT_SECONDS
    state_changed = threading.Event()
    overflows: list[tuple[str, int]] = []
    reader_errors: list[tuple[str, OSError]] = []

    def terminate() -> None:
        if process.poll() is not None:
            return
        try:
            if os.name == "posix":
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
        except OSError:
            try:
                process.kill()
            except OSError:
                pass
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass

    def drain(stream_name: str, stream, buffer: bytearray, limit: int) -> None:
        try:
            while True:
                chunk = stream.read(65536)
                if not chunk:
                    return
                remaining = limit - len(buffer)
                buffer.extend(chunk[: max(0, remaining) + 1])
                if len(chunk) > remaining:
                    overflows.append((stream_name, limit))
                    return
        except OSError as error:
            reader_errors.append((stream_name, error))
        finally:
            state_changed.set()

    readers = [
        threading.Thread(
            target=drain,
            args=("stdout", process.stdout, stdout, MAX_STDOUT_BYTES),
            daemon=True,
        ),
        threading.Thread(
            target=drain,
            args=("stderr", process.stderr, stderr, MAX_STDERR_BYTES),
            daemon=True,
        ),
    ]
    for reader in readers:
        reader.start()

    try:

        def raise_reader_failure() -> None:
            if overflows:
                stream_name, limit = overflows[0]
                terminate()
                raise EvidenceCommandError(
                    f"command {stream_name} limit of {limit} bytes exceeded: "
                    f"{shlex.join(list(argv))}"
                )
            if reader_errors:
                stream_name, error = reader_errors[0]
                terminate()
                raise EvidenceCommandError(
                    f"could not read command {stream_name}: {error}"
                ) from error

        while True:
            raise_reader_failure()
            if process.poll() is not None and all(
                not reader.is_alive() for reader in readers
            ):
                # A reader can publish a failure after the check at the top of
                # this iteration but before both reader threads become dead.
                raise_reader_failure()
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                terminate()
                raise EvidenceCommandError(
                    f"command timed out after {COMMAND_TIMEOUT_SECONDS:g} seconds: "
                    f"{shlex.join(list(argv))}"
                )
            state_changed.wait(min(remaining, 0.05))
            state_changed.clear()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            terminate()
            raise EvidenceCommandError(
                f"command timed out after {COMMAND_TIMEOUT_SECONDS:g} seconds: "
                f"{shlex.join(list(argv))}"
            )
        returncode = process.wait(timeout=remaining)
        # Both reader threads are now dead, so their failure lists are stable.
        # Keep this guard next to result construction: truncated evidence must
        # never be returned as a successful CompletedProcess.
        raise_reader_failure()
        return subprocess.CompletedProcess(
            list(argv),
            returncode,
            bytes(stdout),
            bytes(stderr),
        )
    except subprocess.TimeoutExpired as error:
        terminate()
        raise EvidenceCommandError(
            f"command timed out after {COMMAND_TIMEOUT_SECONDS:g} seconds: "
            f"{shlex.join(list(argv))}"
        ) from error
    finally:
        if process.stdout is not None and not process.stdout.closed:
            process.stdout.close()
        if process.stderr is not None and not process.stderr.closed:
            process.stderr.close()
        for reader in readers:
            reader.join(timeout=0.2)
        if input_stream is not None:
            input_stream.close()


def _bounded_error(value: bytes, limit: int = 1000) -> str:
    decoded = value.decode("utf-8", errors="backslashreplace")
    escaped = "".join(
        character
        if character >= " " and character != "\x7f"
        else f"\\x{ord(character):02x}"
        for character in decoded
    )
    return escaped[:limit] or "command returned no error detail"


def _require_success(
    result: subprocess.CompletedProcess[bytes],
    argv: Sequence[str],
) -> subprocess.CompletedProcess[bytes]:
    if result.returncode != 0:
        raise EvidenceCommandError(
            f"command failed with exit {result.returncode}: "
            f"{shlex.join(list(argv))}: {_bounded_error(result.stderr)}"
        )
    return result


def _run_git(
    execution: ExecutionContext,
    repository: Path,
    *arguments: str,
    input_bytes: bytes | None = None,
) -> subprocess.CompletedProcess[bytes]:
    argv = (execution.git, *GIT_GLOBAL_OPTIONS, *arguments)
    return _require_success(
        _run_process(
            argv,
            cwd=repository,
            environment=GIT_ENVIRONMENT,
            executable_path=execution.path,
            input_bytes=input_bytes,
        ),
        argv,
    )


def _run_git_unchecked(
    execution: ExecutionContext,
    repository: Path,
    *arguments: str,
    input_bytes: bytes | None = None,
) -> subprocess.CompletedProcess[bytes]:
    argv = (execution.git, *GIT_GLOBAL_OPTIONS, *arguments)
    return _run_process(
        argv,
        cwd=repository,
        environment=GIT_ENVIRONMENT,
        executable_path=execution.path,
        input_bytes=input_bytes,
    )


def _run_gh(
    execution: ExecutionContext,
    repository: Path,
    *arguments: str,
) -> subprocess.CompletedProcess[bytes]:
    if execution.gh is None:
        raise EvidenceCommandError("gh executable was not resolved")
    argv = (execution.gh, *arguments)
    return _require_success(
        _run_process(
            argv,
            cwd=repository,
            environment=GH_ENVIRONMENT,
            executable_path=execution.path,
        ),
        argv,
    )


def _decode_output(value: bytes) -> str:
    return value.decode("utf-8", errors="surrogateescape")


def _strip_one_line_ending(value: bytes) -> bytes:
    if value.endswith(b"\r\n"):
        return value[:-2]
    if value.endswith(b"\n"):
        return value[:-1]
    return value


def _read_admin_pointer(path: Path, label: str) -> bytes:
    try:
        metadata = path.lstat()
    except OSError as error:
        raise UnsafeRepositoryError(f"{label} is unavailable: {error}") from error
    if not stat_module.S_ISREG(metadata.st_mode):
        raise UnsafeRepositoryError(f"{label} must be a real regular file")
    if metadata.st_size > MAX_ADMIN_POINTER_SIZE:
        raise UnsafeRepositoryError(f"{label} exceeds {MAX_ADMIN_POINTER_SIZE} bytes")
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags)
        try:
            opened_metadata = os.fstat(descriptor)
            if not stat_module.S_ISREG(opened_metadata.st_mode):
                raise UnsafeRepositoryError(f"{label} must be a real regular file")
            value = os.read(descriptor, MAX_ADMIN_POINTER_SIZE + 1)
        finally:
            os.close(descriptor)
    except UnsafeRepositoryError:
        raise
    except OSError as error:
        raise UnsafeRepositoryError(f"{label} could not be read: {error}") from error
    if len(value) > MAX_ADMIN_POINTER_SIZE:
        raise UnsafeRepositoryError(f"{label} exceeds {MAX_ADMIN_POINTER_SIZE} bytes")
    value = _strip_one_line_ending(value)
    if not value or b"\0" in value or b"\n" in value or b"\r" in value:
        raise UnsafeRepositoryError(f"{label} must contain exactly one path")
    return value


def _canonical_directory(path: Path, label: str) -> Path:
    try:
        metadata = path.lstat()
        canonical = path.resolve(strict=True)
    except OSError as error:
        raise UnsafeRepositoryError(f"{label} is unavailable: {error}") from error
    if not stat_module.S_ISDIR(metadata.st_mode) or path.absolute() != canonical:
        raise UnsafeRepositoryError(
            f"{label} must be a real directory without symlinks"
        )
    return canonical


def _pointer_path(value: bytes, *, relative_to: Path, label: str) -> Path:
    decoded = os.fsdecode(value)
    candidate = Path(decoded)
    if not candidate.is_absolute():
        candidate = relative_to / candidate
    try:
        return candidate.resolve(strict=True)
    except OSError as error:
        raise UnsafeRepositoryError(
            f"{label} target is unavailable: {error}"
        ) from error


def _reported_admin_path(value: bytes, *, relative_to: Path, label: str) -> Path:
    stripped = _strip_one_line_ending(value)
    if not stripped or b"\0" in stripped or b"\n" in stripped or b"\r" in stripped:
        raise UnsafeRepositoryError(f"git returned an invalid {label}")
    return _pointer_path(stripped, relative_to=relative_to, label=label)


def _validate_admin_file(path: Path, label: str, *, required: bool = False) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        if required:
            raise UnsafeRepositoryError(f"required {label} is unavailable")
        return
    except OSError as error:
        raise UnsafeRepositoryError(f"{label} is unavailable: {error}") from error
    if not stat_module.S_ISREG(metadata.st_mode):
        raise UnsafeRepositoryError(f"{label} must be a real regular file")


def _validate_admin_tree(root: Path, label: str) -> None:
    try:
        root_metadata = root.lstat()
    except OSError as error:
        raise UnsafeRepositoryError(f"{label} is unavailable: {error}") from error
    if not stat_module.S_ISDIR(root_metadata.st_mode):
        raise UnsafeRepositoryError(f"{label} must be a real directory")
    pending = [root]
    entries_seen = 0
    deadline = time.monotonic() + FILESYSTEM_SCAN_TIMEOUT_SECONDS
    while pending:
        if time.monotonic() >= deadline:
            raise UnsafeRepositoryError(
                f"{label} exceeded the filesystem scan deadline"
            )
        directory = pending.pop()
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    if time.monotonic() >= deadline:
                        raise UnsafeRepositoryError(
                            f"{label} exceeded the filesystem scan deadline"
                        )
                    entries_seen += 1
                    if entries_seen > MAX_ADMIN_TREE_ENTRIES:
                        raise UnsafeRepositoryError(
                            f"{label} exceeds the administrative scan limit"
                        )
                    metadata = entry.stat(follow_symlinks=False)
                    entry_path = Path(entry.path)
                    if stat_module.S_ISLNK(metadata.st_mode):
                        raise UnsafeRepositoryError(
                            f"{label} contains a symlink: {entry_path}"
                        )
                    if stat_module.S_ISDIR(metadata.st_mode):
                        pending.append(entry_path)
                    elif not stat_module.S_ISREG(metadata.st_mode):
                        raise UnsafeRepositoryError(
                            f"{label} contains a non-regular entry: {entry_path}"
                        )
        except UnsafeRepositoryError:
            raise
        except OSError as error:
            raise UnsafeRepositoryError(
                f"could not inspect {label}: {error}"
            ) from error


def _validate_matching_admin_files(directory: Path, prefix: str, label: str) -> None:
    """Validate prefix-matched admin files with bounded root enumeration."""
    entries_seen = 0
    deadline = time.monotonic() + FILESYSTEM_SCAN_TIMEOUT_SECONDS
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                if time.monotonic() >= deadline:
                    raise UnsafeRepositoryError(
                        f"{label} enumeration exceeded the filesystem scan deadline"
                    )
                entries_seen += 1
                if entries_seen > MAX_ADMIN_TREE_ENTRIES:
                    raise UnsafeRepositoryError(
                        f"{label} enumeration exceeds the administrative scan limit"
                    )
                if entry.name.startswith(prefix):
                    _validate_admin_file(Path(entry.path), label)
    except UnsafeRepositoryError:
        raise
    except OSError as error:
        raise UnsafeRepositoryError(f"could not enumerate {label}: {error}") from error


def _validate_admin_read_paths(git_directory: Path, common_directory: Path) -> None:
    _validate_admin_tree(common_directory / "objects", "Git objects tree")
    _validate_admin_tree(common_directory / "refs", "Git refs tree")
    _validate_admin_file(git_directory / "HEAD", "Git HEAD", required=True)
    _validate_admin_file(git_directory / "index", "Git index")
    _validate_admin_file(git_directory / "config.worktree", "Git worktree config")
    _validate_admin_file(common_directory / "config", "Git config", required=True)
    _validate_admin_file(common_directory / "packed-refs", "Git packed refs")
    _validate_admin_file(common_directory / "shallow", "Git shallow boundary")
    grafts = common_directory / "info" / "grafts"
    _validate_admin_file(grafts, "Git legacy grafts")
    try:
        if grafts.lstat().st_size > 0:
            raise UnsafeRepositoryError(
                "nonempty Git legacy grafts file is not allowed"
            )
    except FileNotFoundError:
        pass
    except UnsafeRepositoryError:
        raise
    except OSError as error:
        raise UnsafeRepositoryError(
            f"Git legacy grafts file is unavailable: {error}"
        ) from error
    _validate_admin_file(
        common_directory / "info" / "attributes",
        "Git info attributes",
    )
    _validate_admin_file(common_directory / "info" / "exclude", "Git info exclude")
    _validate_matching_admin_files(
        git_directory,
        "sharedindex.",
        "Git shared index",
    )
    for alternates_name in ("alternates", "http-alternates"):
        alternates = common_directory / "objects" / "info" / alternates_name
        _validate_admin_file(alternates, f"Git object {alternates_name}")
        try:
            if alternates.lstat().st_size > 0:
                raise UnsafeRepositoryError(
                    f"nonempty Git object {alternates_name} is not allowed"
                )
        except FileNotFoundError:
            pass
        except UnsafeRepositoryError:
            raise
        except OSError as error:
            raise UnsafeRepositoryError(
                f"Git object {alternates_name} is unavailable: {error}"
            ) from error


def _validate_repository_admin_boundary(
    repository: Path,
    *,
    reported_git_directory: bytes,
    reported_common_directory: bytes,
    reported_core_worktree: bytes | None = None,
) -> None:
    dot_git = repository / ".git"
    try:
        dot_git_metadata = dot_git.lstat()
    except OSError as error:
        raise UnsafeRepositoryError(
            f"repository .git is unavailable: {error}"
        ) from error
    git_directory = _reported_admin_path(
        reported_git_directory,
        relative_to=repository,
        label="Git directory",
    )
    common_directory = _reported_admin_path(
        reported_common_directory,
        relative_to=repository,
        label="Git common directory",
    )

    if stat_module.S_ISDIR(dot_git_metadata.st_mode):
        ordinary_git_directory = _canonical_directory(dot_git, "repository .git")
        if (
            git_directory != ordinary_git_directory
            or common_directory != ordinary_git_directory
        ):
            raise UnsafeRepositoryError(
                "repository administration is routed outside its real .git directory"
            )
        _validate_admin_read_paths(git_directory, common_directory)
        return
    if not stat_module.S_ISREG(dot_git_metadata.st_mode):
        raise UnsafeRepositoryError(
            "repository .git must be a real directory or linked-worktree file"
        )

    pointer = _read_admin_pointer(dot_git, "linked-worktree .git")
    prefix = b"gitdir: "
    if not pointer.startswith(prefix) or len(pointer) == len(prefix):
        raise UnsafeRepositoryError(
            "linked-worktree .git has an invalid gitdir pointer"
        )
    pointer_target = _pointer_path(
        pointer[len(prefix) :],
        relative_to=repository,
        label="linked-worktree gitdir",
    )
    admin_directory = _canonical_directory(
        pointer_target,
        "linked-worktree gitdir",
    )
    if git_directory != admin_directory:
        raise UnsafeRepositoryError("linked-worktree gitdir does not match Git")

    commondir_path = admin_directory / "commondir"
    if not commondir_path.exists():
        if common_directory != admin_directory:
            raise UnsafeRepositoryError(
                "gitfile repository has no commondir but Git reported a different common directory"
            )
        modules_root = next(
            (
                ancestor
                for ancestor in admin_directory.parents
                if ancestor.name == "modules" and ancestor.parent.name == ".git"
            ),
            None,
        )
        if modules_root is None:
            raise UnsafeRepositoryError(
                "gitfile repository is neither a linked worktree nor an absorbed submodule"
            )
        super_git_directory = _canonical_directory(
            modules_root.parent,
            "superproject .git directory",
        )
        try:
            admin_directory.relative_to(modules_root)
            repository.relative_to(super_git_directory.parent)
        except ValueError as error:
            raise UnsafeRepositoryError(
                "absorbed submodule administration is outside its superproject"
            ) from error
        if reported_core_worktree is None:
            raise UnsafeRepositoryError(
                "absorbed submodule core.worktree is unavailable"
            )
        configured_worktree = _reported_admin_path(
            reported_core_worktree,
            relative_to=admin_directory,
            label="absorbed submodule core.worktree",
        )
        if configured_worktree != repository:
            raise UnsafeRepositoryError(
                "absorbed submodule core.worktree does not match this root"
            )
        _validate_admin_read_paths(admin_directory, admin_directory)
        return

    backlink = _pointer_path(
        _read_admin_pointer(admin_directory / "gitdir", "linked-worktree backlink"),
        relative_to=admin_directory,
        label="linked-worktree backlink",
    )
    if backlink != dot_git:
        raise UnsafeRepositoryError("linked-worktree backlink does not match this root")

    common_pointer = _read_admin_pointer(
        admin_directory / "commondir",
        "linked-worktree commondir",
    )
    pointer_common_directory = _pointer_path(
        common_pointer,
        relative_to=admin_directory,
        label="linked-worktree commondir",
    )
    canonical_common_directory = _canonical_directory(
        pointer_common_directory,
        "linked-worktree common directory",
    )
    if common_directory != canonical_common_directory:
        raise UnsafeRepositoryError("linked-worktree commondir does not match Git")
    if admin_directory.parent != canonical_common_directory / "worktrees":
        raise UnsafeRepositoryError(
            "linked-worktree gitdir is outside its common worktrees directory"
        )
    _validate_admin_read_paths(admin_directory, canonical_common_directory)


def _repository_context(
    execution: ExecutionContext,
    repository: str | os.PathLike[str],
    *,
    allow_unborn: bool = False,
) -> tuple[Path, str]:
    requested = Path(repository).expanduser().absolute()
    root_result = _run_git(execution, requested, "rev-parse", "--show-toplevel")
    root_bytes = _strip_one_line_ending(root_result.stdout)
    if not root_bytes:
        raise EvidenceCommandError("git rev-parse returned an empty repository root")
    root = Path(os.fsdecode(root_bytes)).resolve()
    git_directory_result = _run_git(
        execution,
        root,
        "rev-parse",
        "--absolute-git-dir",
    )
    common_directory_result = _run_git(
        execution,
        root,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
    )
    core_worktree: bytes | None = None
    try:
        dot_git_metadata = (root / ".git").lstat()
    except OSError as error:
        raise UnsafeRepositoryError(
            f"repository .git is unavailable: {error}"
        ) from error
    if stat_module.S_ISREG(dot_git_metadata.st_mode) and _strip_one_line_ending(
        git_directory_result.stdout
    ) == _strip_one_line_ending(common_directory_result.stdout):
        core_worktree_result = _run_git_unchecked(
            execution,
            root,
            "config",
            "--local",
            "--no-includes",
            "--path",
            "--get",
            "core.worktree",
        )
        if core_worktree_result.returncode not in (0, 1):
            raise EvidenceCommandError(
                "could not read local core.worktree: "
                f"{_bounded_error(core_worktree_result.stderr)}"
            )
        if core_worktree_result.returncode == 0:
            core_worktree = core_worktree_result.stdout
    _validate_repository_admin_boundary(
        root,
        reported_git_directory=git_directory_result.stdout,
        reported_common_directory=common_directory_result.stdout,
        reported_core_worktree=core_worktree,
    )
    head_arguments = (
        "rev-parse",
        "--verify",
        "--end-of-options",
        "HEAD^{commit}",
    )
    head_result = _run_git_unchecked(
        execution,
        root,
        *head_arguments,
    )
    if head_result.returncode != 0:
        if not allow_unborn:
            _require_success(
                head_result,
                (execution.git, *GIT_GLOBAL_OPTIONS, *head_arguments),
            )
        symbolic_ref = _run_git(
            execution,
            root,
            "symbolic-ref",
            "--quiet",
            "HEAD",
        )
        ref_name = _strip_one_line_ending(symbolic_ref.stdout)
        if not ref_name:
            raise EvidenceCommandError("unborn HEAD symbolic ref is empty")
        ref_result = _run_git_unchecked(
            execution,
            root,
            "show-ref",
            "--verify",
            "--quiet",
            os.fsdecode(ref_name),
        )
        if ref_result.returncode == 1:
            return root, "(unborn)"
        raise EvidenceCommandError(
            "HEAD does not resolve to a commit but its branch ref exists"
        )
    head = _strip_one_line_ending(head_result.stdout).decode("ascii", errors="strict")
    if not head:
        raise EvidenceCommandError("git rev-parse returned an empty HEAD")
    return root, head


def _validate_revision(value: object, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise EvidenceRequestError(f"{label} must be a non-empty string")
    if value.startswith("-"):
        raise EvidenceRequestError(f"{label} must not begin with '-'")
    if _CONTROL_RE.search(value):
        raise EvidenceRequestError(f"{label} must not contain control characters")
    return value


def _verify_commit(
    execution: ExecutionContext,
    repository: Path,
    revision: str,
    label: str,
) -> None:
    try:
        _run_git(
            execution,
            repository,
            "rev-parse",
            "--verify",
            "--end-of-options",
            f"{revision}^{{commit}}",
        )
    except EvidenceCommandError as error:
        raise EvidenceRequestError(f"invalid {label}: {revision}: {error}") from error


def _empty_tree_oid(execution: ExecutionContext, repository: Path) -> str:
    """Compute the empty-tree object ID in the repository's object format."""
    result = _run_git(
        execution,
        repository,
        "hash-object",
        "-t",
        "tree",
        "--stdin",
        input_bytes=b"",
    )
    oid = _strip_one_line_ending(result.stdout)
    if re.fullmatch(rb"(?:[0-9a-f]{40}|[0-9a-f]{64})", oid) is None:
        raise EvidenceCommandError("git hash-object returned an invalid empty-tree ID")
    return oid.decode("ascii")


def _validate_range(
    execution: ExecutionContext,
    repository: Path,
    value: object,
) -> str:
    scope = _validate_revision(value, "range")
    delimiter = "..." if "..." in scope else ".." if ".." in scope else None
    if delimiter is None:
        raise EvidenceRequestError("range must contain '..' or '...'")
    endpoints = scope.split(delimiter)
    if len(endpoints) != 2 or not all(endpoints):
        raise EvidenceRequestError("range must contain exactly two non-empty endpoints")
    for index, endpoint in enumerate(endpoints, start=1):
        validated = _validate_revision(endpoint, f"range endpoint {index}")
        _verify_commit(
            execution,
            repository,
            validated,
            f"range endpoint {index}",
        )
    return scope


def _positive_integer(value: object, label: str) -> int:
    if isinstance(value, bool):
        raise EvidenceRequestError(f"{label} must be a positive decimal integer")
    if isinstance(value, int):
        number = value
    elif (
        isinstance(value, str) and len(value) <= 9 and _ASCII_DIGITS_RE.fullmatch(value)
    ):
        number = int(value)
    else:
        raise EvidenceRequestError(f"{label} must be a positive decimal integer")
    if number <= 0 or number > 1_000_000:
        raise EvidenceRequestError(f"{label} must be between 1 and 1000000")
    return number


def _validate_include_untracked(
    scope_request: Mapping[str, object],
    kind: str,
) -> tuple[str, ...]:
    value = scope_request.get("include_untracked")
    if value is None:
        return ()
    if not isinstance(value, list):
        raise EvidenceRequestError("include_untracked must be a JSON array of paths")
    if len(value) > MAX_INCLUDED_UNTRACKED_PATHS:
        raise EvidenceRequestError(
            f"include_untracked exceeds the {MAX_INCLUDED_UNTRACKED_PATHS} path limit"
        )
    paths: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str) or not item:
            raise EvidenceRequestError(
                "include_untracked entries must be non-empty strings"
            )
        if _CONTROL_RE.search(item):
            raise EvidenceRequestError(
                "include_untracked entries must not contain control characters"
            )
        pure_path = PurePosixPath(item)
        if pure_path.is_absolute() or ".." in pure_path.parts:
            raise EvidenceRequestError(
                "include_untracked entries must remain inside the repository"
            )
        if item in seen:
            raise EvidenceRequestError("include_untracked entries must be unique")
        seen.add(item)
        paths.append(item)
    if paths and kind not in {"current", "unstaged"}:
        raise EvidenceRequestError(
            "include_untracked is available only for current or unstaged scope"
        )
    return tuple(paths)


def _parse_filter_triples(value: bytes) -> list[tuple[bytes, bytes]]:
    if not value:
        return []
    if not value.endswith(b"\0"):
        raise UnsafeRepositoryError("clean-filter preflight returned unterminated data")
    fields = value[:-1].split(b"\0")
    if len(fields) % 3:
        raise UnsafeRepositoryError("clean-filter preflight returned malformed triples")
    return [
        (path, attribute_value)
        for path, attribute, attribute_value in zip(
            fields[0::3], fields[1::3], fields[2::3], strict=True
        )
        if attribute == b"filter"
    ]


def _escaped_identifier(value: bytes, limit: int = 160) -> str:
    rendered = "".join(
        chr(byte) if 0x20 <= byte < 0x7F else f"\\x{byte:02x}" for byte in value
    )
    return rendered[:limit]


def _clean_filter_preflight(
    execution: ExecutionContext,
    repository: Path,
) -> None:
    tracked = _run_git(execution, repository, "ls-files", "-z")
    attributes = _run_git(
        execution,
        repository,
        "check-attr",
        "--stdin",
        "-z",
        "--all",
        input_bytes=tracked.stdout,
    )
    filters = _parse_filter_triples(attributes.stdout)
    if not filters:
        return
    samples = ", ".join(_escaped_identifier(path) for path, _ in filters[:3])
    raise UnsafeRepositoryError(
        f"working-tree evidence blocked: {len(filters)} tracked path(s) have a "
        f"filter attribute; sample: {samples}"
    )


def _command_display(environment: Mapping[str, str], argv: Sequence[str]) -> str:
    prefix = " ".join(
        f"{key}={shlex.quote(value)}" for key, value in environment.items()
    )
    return f"{prefix} {shlex.join(list(argv))}"


def _command_record(
    environment: Mapping[str, str], argv: Sequence[str]
) -> dict[str, JsonValue]:
    return {
        "command": _command_display(environment, argv),
        "command_argv": list(argv),
        "command_environment": dict(environment),
    }


def _git_diff_argv(
    execution: ExecutionContext,
    *,
    output_option: str | None,
    terminal_arguments: Sequence[str],
    reads_worktree: bool,
    nul_terminated: bool = False,
    detect_renames: bool = True,
    raw_patch: bool = False,
) -> tuple[str, ...]:
    arguments: list[str] = [execution.git, *GIT_GLOBAL_OPTIONS, "diff", *DIFF_FLAGS]
    arguments.append(WORKTREE_DIFF_FLAG if reads_worktree else TREE_DIFF_FLAG)
    if not detect_renames:
        arguments.append("--no-renames")
    if raw_patch:
        if output_option is not None or nul_terminated:
            raise ValueError("raw_patch cannot be combined with another output option")
        arguments.extend(("--raw", "-z", "--patch"))
    if output_option is not None:
        arguments.append(output_option)
    if nul_terminated:
        arguments.append("-z")
    arguments.extend(terminal_arguments)
    return tuple(arguments)


def _git_show_argv(
    execution: ExecutionContext,
    commit: str,
    output_option: str | None,
    *,
    nul_terminated: bool = False,
    detect_renames: bool = True,
    raw_patch: bool = False,
) -> tuple[str, ...]:
    format_option = (
        "--format=fuller" if output_option is None and not raw_patch else "--format="
    )
    arguments = [execution.git, *GIT_GLOBAL_OPTIONS, "show", *DIFF_FLAGS, format_option]
    arguments.append(TREE_DIFF_FLAG)
    if not detect_renames:
        arguments.append("--no-renames")
    if raw_patch:
        if output_option is not None or nul_terminated:
            raise ValueError("raw_patch cannot be combined with another output option")
        arguments.extend(("--raw", "-z", "--patch"))
    if output_option is not None:
        arguments.append(output_option)
    if nul_terminated:
        arguments.append("-z")
    arguments.extend(("--end-of-options", commit))
    return tuple(arguments)


def _git_show_metadata_argv(
    execution: ExecutionContext,
    commit: str,
) -> tuple[str, ...]:
    return (
        execution.git,
        *GIT_GLOBAL_OPTIONS,
        "show",
        "--no-patch",
        "--format=fuller",
        "--end-of-options",
        commit,
    )


def _run_recorded_git(
    execution: ExecutionContext,
    repository: Path,
    argv: Sequence[str],
) -> str:
    result = _require_success(
        _run_process(
            argv,
            cwd=repository,
            environment=GIT_ENVIRONMENT,
            executable_path=execution.path,
        ),
        argv,
    )
    return _decode_output(result.stdout)


def _run_recorded_git_bytes(
    execution: ExecutionContext,
    repository: Path,
    argv: Sequence[str],
) -> bytes:
    result = _require_success(
        _run_process(
            argv,
            cwd=repository,
            environment=GIT_ENVIRONMENT,
            executable_path=execution.path,
        ),
        argv,
    )
    return result.stdout


def _is_sensitive_path(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    components = [component for component in normalized.split("/") if component]
    component_pairs = set(zip(components, components[1:]))
    if (".docker", "config.json") in component_pairs:
        return True
    if (".kube", "config") in component_pairs:
        return True
    for index, component in enumerate(components):
        is_public_env_template = (
            component == _PUBLIC_ENV_TEMPLATE_BASENAME
            and index == len(components) - 1
        )
        if component.startswith(".env") and not is_public_env_template:
            return True
        if component in _SENSITIVE_COMPONENTS:
            return True
        if component.endswith(_SENSITIVE_SUFFIXES):
            return True
        if component.endswith(
            (".tfstate", ".tfstate.backup", ".tfvars", ".tfvars.json")
        ):
            return True
        if any(
            token in component
            for token in ("credential", "private-key", "secret", "token")
        ):
            return True
    return False


def _split_raw_patch(output: bytes) -> tuple[list[str], str]:
    """Split `--raw -z --patch` output and recover its exact pathname bytes."""
    if not output:
        return [], ""
    paths: list[str] = []
    position = 0
    while position < len(output):
        if output[position] == 0:
            return paths, _decode_output(output[position + 1 :])
        if output[position] != ord(":"):
            raise EvidenceCommandError("captured raw diff has an invalid record prefix")
        header_end = output.find(b"\0", position)
        if header_end < 0:
            raise EvidenceCommandError("captured raw diff record is not NUL terminated")
        header = output[position:header_end]
        try:
            status = header.rsplit(b" ", 1)[1]
        except IndexError as error:
            raise EvidenceCommandError(
                "captured raw diff has an invalid status"
            ) from error
        if not status or status[:1] not in b"ACDMRTUXB":
            raise EvidenceCommandError("captured raw diff has an invalid status")
        path_count = 2 if status[:1] in b"RC" else 1
        position = header_end + 1
        for _ in range(path_count):
            path_end = output.find(b"\0", position)
            if path_end < 0:
                raise EvidenceCommandError(
                    "captured raw diff path is not NUL terminated"
                )
            raw_path = output[position:path_end]
            if not raw_path:
                raise EvidenceCommandError("captured raw diff contains an empty path")
            paths.append(os.fsdecode(raw_path))
            position = path_end + 1
    raise EvidenceCommandError("captured raw diff is missing its patch separator")


def _decode_git_c_path(value: bytes) -> bytes:
    if not value.startswith(b'"'):
        return value.rstrip(b"\t")
    decoded = bytearray()
    index = 1
    escapes = {
        ord("a"): 7,
        ord("b"): 8,
        ord("f"): 12,
        ord("n"): 10,
        ord("r"): 13,
        ord("t"): 9,
        ord("v"): 11,
        ord("\\"): 92,
        ord('"'): 34,
    }
    while index < len(value):
        byte = value[index]
        if byte == ord('"'):
            if value[index + 1 :].rstrip(b"\t"):
                raise EvidenceCommandError("captured patch path has trailing data")
            return bytes(decoded)
        if byte != ord("\\"):
            if byte < 32 or byte == 127:
                raise EvidenceCommandError("captured patch path has a raw control byte")
            decoded.append(byte)
            index += 1
            continue
        index += 1
        if index >= len(value):
            raise EvidenceCommandError("captured patch path has a truncated escape")
        escaped = value[index]
        if escaped in escapes:
            decoded.append(escapes[escaped])
            index += 1
            continue
        if ord("0") <= escaped <= ord("7"):
            end = index
            while (
                end < len(value)
                and end < index + 3
                and ord("0") <= value[end] <= ord("7")
            ):
                end += 1
            octet = int(value[index:end], 8)
            if octet > 0xFF:
                raise EvidenceCommandError(
                    "captured patch path has an invalid octal escape"
                )
            decoded.append(octet)
            index = end
            continue
        raise EvidenceCommandError("captured patch path has an unknown escape")
    raise EvidenceCommandError("captured patch path has an unterminated quote")


def _pr_patch_paths(patch: bytes) -> list[str]:
    """Extract path-bearing PR patch fields, including rename sources."""
    paths: list[bytes] = []
    for line in patch.splitlines():
        if line.startswith(b"diff --git "):
            header = line[len(b"diff --git ") :]
            candidates: list[tuple[bytes, bytes]] = []
            for index, byte in enumerate(header):
                if byte != ord(" "):
                    continue
                old_path = header[:index]
                new_path = header[index + 1 :]
                if old_path.startswith((b"a/", b'"a/')) and new_path.startswith(
                    (b"b/", b'"b/')
                ):
                    candidates.append((old_path, new_path))
            if not candidates:
                raise EvidenceCommandError(
                    "captured PR patch has an invalid diff header"
                )
            for old_path, new_path in candidates:
                for value, expected_prefix in ((old_path, b"a/"), (new_path, b"b/")):
                    decoded = _decode_git_c_path(value)
                    if not decoded.startswith(expected_prefix) or len(decoded) == len(
                        expected_prefix
                    ):
                        raise EvidenceCommandError(
                            "captured PR patch has an unexpected diff header path"
                        )
                    paths.append(decoded[len(expected_prefix) :])
            continue
        for prefix, expected_prefix in (
            (b"--- ", b"a/"),
            (b"+++ ", b"b/"),
            (b"rename from ", b""),
            (b"rename to ", b""),
            (b"copy from ", b""),
            (b"copy to ", b""),
        ):
            if not line.startswith(prefix):
                continue
            value = _decode_git_c_path(line[len(prefix) :])
            if value == b"/dev/null":
                break
            if expected_prefix:
                if not value.startswith(expected_prefix) or len(value) == len(
                    expected_prefix
                ):
                    raise EvidenceCommandError(
                        "captured PR patch has an unexpected path prefix"
                    )
                value = value[len(expected_prefix) :]
            if not value:
                raise EvidenceCommandError("captured PR patch contains an empty path")
            paths.append(value)
            break
    return [os.fsdecode(path) for path in paths]


def _reject_sensitive_paths(paths: Sequence[str], label: str) -> None:
    sensitive_paths = [path for path in paths if _is_sensitive_path(path)]
    if not sensitive_paths:
        return
    samples = ", ".join(
        _escaped_identifier(os.fsencode(path)) for path in sensitive_paths[:3]
    )
    raise UnsafeRepositoryError(
        f"{label} blocked: {len(sensitive_paths)} path(s) are "
        f"sensitive; sample: {samples}"
    )


def _skipped_untracked(
    path: str, reason: str, size: int | None = None
) -> dict[str, JsonValue]:
    result: dict[str, JsonValue] = {
        "path": path,
        "status": "skipped",
        "reason": reason,
    }
    if size is not None:
        result["size"] = size
    return result


def _inspect_untracked_path(
    repository: Path,
    raw_path: bytes,
    *,
    remaining_content_bytes: int = MAX_INCLUDED_UNTRACKED_BYTES,
) -> dict[str, JsonValue]:
    display_path = os.fsdecode(raw_path)
    pure_path = PurePosixPath(display_path)
    if pure_path.is_absolute() or ".." in pure_path.parts:
        return _skipped_untracked(display_path, "path escapes repository")
    if _is_sensitive_path(display_path):
        return _skipped_untracked(display_path, "sensitive path")

    lexical_path = repository.joinpath(*pure_path.parts)
    try:
        metadata = lexical_path.lstat()
    except OSError:
        return _skipped_untracked(display_path, "path is unavailable")
    if stat_module.S_ISLNK(metadata.st_mode):
        return _skipped_untracked(display_path, "symlink", metadata.st_size)
    if not stat_module.S_ISREG(metadata.st_mode):
        return _skipped_untracked(display_path, "not a regular file", metadata.st_size)
    if metadata.st_size > MAX_UNTRACKED_SIZE:
        return _skipped_untracked(
            display_path, "file exceeds 256 KiB", metadata.st_size
        )
    if metadata.st_size > remaining_content_bytes:
        raise UnsafeRepositoryError(
            "requested untracked content exceeds the aggregate byte limit"
        )
    try:
        resolved_path = lexical_path.resolve(strict=True)
        resolved_path.relative_to(repository)
    except (OSError, ValueError):
        return _skipped_untracked(
            display_path, "path escapes repository", metadata.st_size
        )

    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(resolved_path, flags)
        try:
            opened_metadata = os.fstat(descriptor)
            if not stat_module.S_ISREG(opened_metadata.st_mode):
                return _skipped_untracked(
                    display_path, "not a regular file", opened_metadata.st_size
                )
            if opened_metadata.st_size > MAX_UNTRACKED_SIZE:
                return _skipped_untracked(
                    display_path,
                    "file exceeds 256 KiB",
                    opened_metadata.st_size,
                )
            if opened_metadata.st_size > remaining_content_bytes:
                raise UnsafeRepositoryError(
                    "requested untracked content exceeds the aggregate byte limit"
                )
            content = os.read(descriptor, MAX_UNTRACKED_SIZE + 1)
        finally:
            os.close(descriptor)
    except OSError:
        return _skipped_untracked(
            display_path, "file could not be read", metadata.st_size
        )

    if len(content) > MAX_UNTRACKED_SIZE:
        return _skipped_untracked(display_path, "file exceeds 256 KiB", len(content))
    if len(content) > remaining_content_bytes:
        raise UnsafeRepositoryError(
            "requested untracked content exceeds the aggregate byte limit"
        )
    if b"\0" in content[:8192]:
        return _skipped_untracked(display_path, "binary content", len(content))
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError:
        return _skipped_untracked(display_path, "non-UTF-8 content", len(content))
    return {
        "path": display_path,
        "size": len(content),
        "status": "included",
        "content": decoded,
    }


def _collect_untracked(
    execution: ExecutionContext,
    repository: Path,
    include_paths: Sequence[str],
) -> list[dict[str, JsonValue]]:
    result = _run_git(
        execution,
        repository,
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
    )
    if not result.stdout:
        return []
    if not result.stdout.endswith(b"\0"):
        raise EvidenceCommandError("untracked path list was not NUL terminated")
    paths = result.stdout[:-1].split(b"\0")
    if len(paths) > MAX_UNTRACKED_PATHS:
        raise UnsafeRepositoryError(
            f"untracked path list exceeds the {MAX_UNTRACKED_PATHS} path limit"
        )
    deadline = time.monotonic() + FILESYSTEM_SCAN_TIMEOUT_SECONDS
    present = {os.fsdecode(path) for path in paths if path}
    missing = [path for path in include_paths if path not in present]
    if missing:
        raise EvidenceRequestError(
            "include_untracked path is not present as an untracked, non-ignored path: "
            f"{missing[0]}"
        )
    requested = set(include_paths)
    entries: list[dict[str, JsonValue]] = []
    included_content_bytes = 0
    for raw_path in paths:
        if time.monotonic() >= deadline:
            raise UnsafeRepositoryError(
                "untracked path inspection exceeded the filesystem scan deadline"
            )
        if not raw_path:
            continue
        display_path = os.fsdecode(raw_path)
        if display_path in requested:
            entry = _inspect_untracked_path(
                repository,
                raw_path,
                remaining_content_bytes=(
                    MAX_INCLUDED_UNTRACKED_BYTES - included_content_bytes
                ),
            )
            if entry.get("status") == "included":
                size = entry.get("size")
                if not isinstance(size, int):
                    raise UnsafeRepositoryError(
                        "included untracked content has an invalid size"
                    )
                included_content_bytes += size
            entries.append(entry)
            continue
        lexical_path = repository.joinpath(*PurePosixPath(display_path).parts)
        try:
            size: int | None = lexical_path.lstat().st_size
            status = "listed"
        except OSError:
            size = None
            status = "unavailable"
        entries.append({"path": display_path, "size": size, "status": status})
    return entries


def _collect_git_scope(
    *,
    execution: ExecutionContext,
    repository: Path,
    head: str,
    scope: str,
    terminal_arguments: Sequence[str],
    reads_worktree: bool,
    include_untracked: Sequence[str] = (),
    use_show: bool = False,
) -> dict[str, JsonValue]:
    if reads_worktree:
        _clean_filter_preflight(execution, repository)
    changed_paths_argv = (
        _git_show_argv(
            execution,
            terminal_arguments[-1],
            "--name-only",
            nul_terminated=True,
            detect_renames=False,
        )
        if use_show
        else _git_diff_argv(
            execution,
            output_option="--name-only",
            terminal_arguments=terminal_arguments,
            reads_worktree=reads_worktree,
            nul_terminated=True,
            detect_renames=False,
        )
    )
    changed_paths_output = _run_recorded_git(
        execution,
        repository,
        changed_paths_argv,
    )
    if changed_paths_output and not changed_paths_output.endswith("\0"):
        raise EvidenceCommandError("changed path scan was not NUL terminated")
    changed_paths = [path for path in changed_paths_output.split("\0") if path]
    _reject_sensitive_paths(changed_paths, "content diff")
    options = {
        "stat": "--stat",
        "numstat": "--numstat",
        "name_status": "--name-status",
    }
    commands: dict[str, tuple[str, ...]] = {}
    commands["changed_paths"] = changed_paths_argv
    outputs: dict[str, str] = {}
    raw_patch_argv = (
        _git_show_argv(
            execution,
            terminal_arguments[-1],
            None,
            raw_patch=True,
        )
        if use_show
        else _git_diff_argv(
            execution,
            output_option=None,
            terminal_arguments=terminal_arguments,
            reads_worktree=reads_worktree,
            raw_patch=True,
        )
    )
    commands["diff"] = raw_patch_argv
    exact_paths, patch = _split_raw_patch(
        _run_recorded_git_bytes(execution, repository, raw_patch_argv)
    )
    _reject_sensitive_paths(exact_paths, "content diff")
    if use_show:
        metadata_argv = _git_show_metadata_argv(
            execution,
            terminal_arguments[-1],
        )
        commands["commit_metadata"] = metadata_argv
        metadata = _run_recorded_git(execution, repository, metadata_argv).rstrip(
            "\r\n"
        )
        outputs["diff"] = f"{metadata}\n\n{patch}" if patch else f"{metadata}\n"
    else:
        outputs["diff"] = patch

    for name, option in options.items():
        argv = (
            _git_show_argv(execution, terminal_arguments[-1], option)
            if use_show
            else _git_diff_argv(
                execution,
                output_option=option,
                terminal_arguments=terminal_arguments,
                reads_worktree=reads_worktree,
            )
        )
        commands[name] = argv
        outputs[name] = _run_recorded_git(execution, repository, argv)

    primary = commands["diff"]
    recorded_environment = _recorded_environment(GIT_ENVIRONMENT, execution)
    record = _command_record(recorded_environment, primary)
    return {
        "kind": "commit" if use_show else "git-diff",
        "scope": scope,
        "repository_root": str(repository),
        "head": head,
        **record,
        "commands": {
            name: _command_record(recorded_environment, argv)
            for name, argv in commands.items()
        },
        **outputs,
        "untracked": (
            _collect_untracked(execution, repository, include_untracked)
            if reads_worktree
            else []
        ),
    }


def _normalize_pr_files(metadata: object) -> list[dict[str, Any]]:
    if not isinstance(metadata, dict):
        return []
    files = metadata.get("files")
    return (
        [item for item in files if isinstance(item, dict)]
        if isinstance(files, list)
        else []
    )


def _collect_pr_scope(
    *,
    execution: ExecutionContext,
    repository: Path,
    head: str,
    value: object,
) -> dict[str, JsonValue]:
    if isinstance(value, bool):
        raise EvidenceRequestError("PR number must contain ASCII digits only")
    pr_number = str(value)
    if len(pr_number) > 20 or _ASCII_DIGITS_RE.fullmatch(pr_number) is None:
        raise EvidenceRequestError("PR number must contain ASCII digits only")
    if execution.gh is None:
        raise EvidenceCommandError("gh executable was not resolved")
    changed_paths_argv = (
        execution.gh,
        "pr",
        "diff",
        pr_number,
        "--name-only",
        "--color",
        "never",
    )
    changed_paths_result = _require_success(
        _run_process(
            changed_paths_argv,
            cwd=repository,
            environment=GH_ENVIRONMENT,
            executable_path=execution.path,
        ),
        changed_paths_argv,
    )
    changed_paths_text = _decode_output(changed_paths_result.stdout)
    if "\0" in changed_paths_text:
        raise EvidenceCommandError("PR changed path scan contained a NUL byte")
    changed_paths = changed_paths_text.splitlines()
    sensitive_paths = [path for path in changed_paths if _is_sensitive_path(path)]
    if sensitive_paths:
        samples = ", ".join(
            _escaped_identifier(os.fsencode(path)) for path in sensitive_paths[:3]
        )
        raise UnsafeRepositoryError(
            f"PR content diff blocked: {len(sensitive_paths)} changed path(s) are "
            f"sensitive; sample: {samples}"
        )
    diff_argv = (execution.gh, "pr", "diff", pr_number, "--color", "never")
    diff_result = _require_success(
        _run_process(
            diff_argv,
            cwd=repository,
            environment=GH_ENVIRONMENT,
            executable_path=execution.path,
        ),
        diff_argv,
    )
    _reject_sensitive_paths(
        _pr_patch_paths(diff_result.stdout),
        "PR content diff",
    )
    diff_text = _decode_output(diff_result.stdout)
    view_argv = (
        execution.gh,
        "pr",
        "view",
        pr_number,
        "--json",
        "number,title,body,baseRefName,headRefName,author,files,additions,deletions",
    )
    view_result = _run_process(
        view_argv,
        cwd=repository,
        environment=GH_ENVIRONMENT,
        executable_path=execution.path,
    )
    metadata: object = None
    limitations: list[str] = []
    if view_result.returncode != 0:
        limitations.append(
            f"PR metadata unavailable: gh pr view exited with "
            f"{view_result.returncode}: {_bounded_error(view_result.stderr)}"
        )
    else:
        try:
            metadata = json.loads(view_result.stdout)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            limitations.append(f"PR metadata unavailable: invalid gh JSON: {error}")
        if metadata is not None and not isinstance(metadata, dict):
            limitations.append("PR metadata unavailable: gh JSON was not an object")
            metadata = None
    files = _normalize_pr_files(metadata)
    additions = metadata.get("additions", 0) if isinstance(metadata, dict) else 0
    deletions = metadata.get("deletions", 0) if isinstance(metadata, dict) else 0
    numstat_lines: list[str] = []
    status_lines: list[str] = []
    status_map = {
        "ADDED": "A",
        "DELETED": "D",
        "MODIFIED": "M",
        "RENAMED": "R",
    }
    for item in files:
        path = item.get("path")
        if not isinstance(path, str):
            continue
        added = item.get("additions", 0)
        removed = item.get("deletions", 0)
        numstat_lines.append(f"{added}\t{removed}\t{path}")
        status = status_map.get(str(item.get("status", "MODIFIED")).upper(), "M")
        status_lines.append(f"{status}\t{path}")
    stat_text = (
        f"{len(files)} files changed, {additions} insertions(+), "
        f"{deletions} deletions(-)"
        if metadata is not None
        else ""
    )
    recorded_environment = _recorded_environment(GH_ENVIRONMENT, execution)
    record = _command_record(recorded_environment, diff_argv)
    return {
        "kind": "pr",
        "scope": f"PR #{pr_number}",
        "repository_root": str(repository),
        "head": head,
        **record,
        "commands": {
            "changed_paths": _command_record(
                recorded_environment,
                changed_paths_argv,
            ),
            "diff": _command_record(recorded_environment, diff_argv),
            "metadata": _command_record(recorded_environment, view_argv),
        },
        "diff": diff_text,
        "stat": stat_text,
        "numstat": "\n".join(numstat_lines) + ("\n" if numstat_lines else ""),
        "name_status": "\n".join(status_lines) + ("\n" if status_lines else ""),
        "untracked": [],
        "pr_metadata": metadata,
        "limitations": limitations,
    }


def collect_evidence(
    scope_request: Mapping[str, object],
    *,
    repository: str | os.PathLike[str] = ".",
) -> dict[str, JsonValue]:
    """Collect one exact scope using hardened subprocess argv arrays."""
    if not isinstance(scope_request, Mapping):
        raise EvidenceRequestError("scope request must be a JSON object")
    kind_value = scope_request.get("kind")
    if not isinstance(kind_value, str):
        raise EvidenceRequestError("scope request requires a string kind")
    kind = kind_value.strip().lower().replace("-", "_")
    supported_kinds = {
        "current",
        "staged",
        "unstaged",
        "last_commit",
        "last_n",
        "range",
        "commit",
        "pr",
    }
    if kind not in supported_kinds:
        raise EvidenceRequestError(
            "unsupported scope kind; expected current, staged, unstaged, "
            "last_commit, last_n, range, commit, or pr"
        )
    include_untracked = _validate_include_untracked(scope_request, kind)
    execution = _resolve_execution_context(kind, repository)
    root, head = _repository_context(
        execution,
        repository,
        allow_unborn=kind in {"current", "staged", "unstaged"},
    )

    if kind == "current":
        baseline = _empty_tree_oid(execution, root) if head == "(unborn)" else "HEAD"
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope="working",
            terminal_arguments=(baseline,),
            reads_worktree=True,
            include_untracked=include_untracked,
        )
    if kind == "staged":
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope="staged",
            terminal_arguments=("--staged",),
            reads_worktree=False,
        )
    if kind == "unstaged":
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope="unstaged",
            terminal_arguments=(),
            reads_worktree=True,
            include_untracked=include_untracked,
        )
    if kind == "last_commit":
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope="HEAD~1..HEAD",
            terminal_arguments=("HEAD~1..HEAD",),
            reads_worktree=False,
        )
    if kind == "last_n":
        count = _positive_integer(scope_request.get("value"), "last_n value")
        scope = f"HEAD~{count}..HEAD"
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope=scope,
            terminal_arguments=(scope,),
            reads_worktree=False,
        )
    if kind == "range":
        scope = _validate_range(execution, root, scope_request.get("value"))
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope=scope,
            terminal_arguments=("--end-of-options", scope),
            reads_worktree=False,
        )
    if kind == "commit":
        commit = _validate_revision(scope_request.get("value"), "commit")
        _verify_commit(execution, root, commit, "commit")
        return _collect_git_scope(
            execution=execution,
            repository=root,
            head=head,
            scope=commit,
            terminal_arguments=(commit,),
            reads_worktree=False,
            use_show=True,
        )
    if kind == "pr":
        return _collect_pr_scope(
            execution=execution,
            repository=root,
            head=head,
            value=scope_request.get("value"),
        )
    raise AssertionError("validated scope kind was not handled")


def _read_cli_request() -> tuple[Mapping[str, object], str | os.PathLike[str]]:
    raw = sys.stdin.buffer.read(MAX_REQUEST_SIZE + 1)
    if len(raw) > MAX_REQUEST_SIZE:
        raise EvidenceRequestError("JSON request exceeds 1 MiB")
    try:
        request = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise EvidenceRequestError(f"invalid JSON request: {error}") from error
    if not isinstance(request, dict):
        raise EvidenceRequestError("JSON request must be an object")
    scope = request.get("scope")
    if not isinstance(scope, dict):
        raise EvidenceRequestError("JSON request requires a scope object")
    repository = request.get("repository", ".")
    if not isinstance(repository, str) or not repository:
        raise EvidenceRequestError("repository must be a non-empty string")
    return scope, repository


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect hardened diff-summary evidence from a JSON stdin request."
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="indent the JSON response for manual inspection",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    try:
        scope, repository = _read_cli_request()
        evidence = collect_evidence(scope, repository=repository)
    except EvidenceCollectorError as error:
        json.dump(
            {"error": str(error), "error_type": type(error).__name__},
            sys.stderr,
            ensure_ascii=True,
            separators=(",", ":"),
        )
        sys.stderr.write("\n")
        return 1
    json.dump(
        evidence,
        sys.stdout,
        ensure_ascii=True,
        indent=2 if arguments.pretty else None,
        separators=None if arguments.pretty else (",", ":"),
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
