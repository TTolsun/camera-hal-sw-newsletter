const assert = require('node:assert/strict');

function assertTextInOrder(text, labels) {
  let previous = -1;
  for (const label of labels) {
    const current = text.indexOf(label);
    assert.notEqual(current, -1, `${label} must exist`);
    assert.ok(current > previous, `${label} must appear after previous marker`);
    previous = current;
  }
}

function workflowStep(text, name) {
  const marker = `- name: ${name}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${name} step must exist`);
  const next = text.indexOf('\n      - name:', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function workflowRunCommands(text, scriptName) {
  const commands = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const inlineCommand = match[2].trim();
    if (!/^[|>]/.test(inlineCommand)) {
      if (inlineCommand.includes(scriptName)) commands.push(inlineCommand);
      continue;
    }

    const block = [];
    for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const nextIndent = line.match(/^(\s*)/)[1].length;
      if (line.trim() && nextIndent <= indent) break;
      block.push(line.trim());
      index = lineIndex;
    }
    const command = block.join('\n');
    if (command.includes(scriptName)) commands.push(command);
  }
  return commands;
}

function extractMarkdownSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${heading} section must exist`);
  const next = text.indexOf('\n## ', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

module.exports = {
  assertTextInOrder,
  extractMarkdownSection,
  workflowRunCommands,
  workflowStep
};
