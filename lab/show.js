'use strict';

// 라벨링용 뷰어. JSON 구조를 걷어내고 judge가 보는 네 필드만 보여준다.
//
//   node lab/show.js 3       3번 항목 하나
//   node lab/show.js         라벨 안 된 첫 항목
//   node lab/show.js --left  남은 항목 번호 목록
//
// 본문은 번역하지 않는다. judge는 영어 원문을 읽으므로, 사람이 번역본을 보고 판정하면
// 불일치가 판정 차이인지 번역 차이인지 구별할 수 없게 된다. 안내 문구만 한글이다.

const fs = require('node:fs');
const path = require('node:path');
const { assertLabelsWellFormed } = require('./label-schema');

const WIDTH = 78;

function datasetPath(argv) {
  const at = argv.indexOf('--set');
  const set = at === -1 ? 'calibration' : argv[at + 1];
  return { set, file: path.join(__dirname, 'datasets', `${set}.json`) };
}

const CONDITIONS = [
  '조건 1  카메라 프레임이 지나가는가',
  '        센서 → CSI/MIPI → ISP → V4L2 노드 → HAL → 코덱·JPEG·display',
  '조건 2  버전·API·컴포넌트 이름·동작 변경 중 하나가 명시되어 있는가',
  '        [PATCH v6] 같은 제출본 번호는 버전이 아니다',
  '조건 3  이 URL 하나로 근거가 확인되는가',
  '        시리즈 중간 패치는 자립으로 본다',
  '',
  '셋 다 만족해야 yes. 애매하면 no.'
];

function wrap(text, indent) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + word.length + 1 > WIDTH - indent) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.map(l => ' '.repeat(indent) + l).join('\n');
}

function load(file) {
  if (!fs.existsSync(file)) throw new Error(`${path.basename(file)} does not exist yet`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function render(item, index, total, setName) {
  const done = item.human_label !== null;
  const bar = '─'.repeat(WIDTH);

  console.log(`\n${bar}`);
  console.log(` ${index + 1} / ${total}${done ? `   [라벨됨: ${item.human_label}]` : ''}`);
  console.log(bar);

  console.log('\n제목');
  console.log(wrap(item.title, 2));

  console.log('\n출처');
  console.log(`  ${item.source_name}`);

  console.log('\nURL');
  console.log(`  ${item.url}`);

  console.log('\n요약');
  const truncated = item.summary.length === 500;
  console.log(wrap(item.summary, 2));
  if (truncated) {
    console.log('\n  ※ 500자에서 잘렸다. 뒷부분은 judge도 못 본다.');
  }

  console.log(`\n${bar}`);
  for (const line of CONDITIONS) console.log(line ? ` ${line}` : '');
  console.log(bar);
  console.log(`\n  기록할 곳: ${setName}.json 의 ${index + 1}번째 항목`);
  console.log('    "human_label": "yes" 또는 "no"');
  console.log('    "human_note":  망설였다면 그 이유 한 줄\n');
}

function main() {
  const args = process.argv.slice(2);
  const { set, file } = datasetPath(args);
  const data = load(file);
  const items = data.items;
  assertLabelsWellFormed(items, path.basename(file));

  if (args.includes('--left')) {
    const left = items
      .map((item, i) => (item.human_label === null ? i + 1 : null))
      .filter(Boolean);
    console.log(`라벨 완료 ${items.length - left.length} / ${items.length}`);
    console.log(left.length ? `남은 항목: ${left.join(', ')}` : '전부 라벨됨.');
    return;
  }

  const requested = Number(args.find(a => /^\d+$/.test(a)));
  let index;
  if (Number.isInteger(requested) && requested >= 1 && requested <= items.length) {
    index = requested - 1;
  } else {
    index = items.findIndex(item => item.human_label === null);
    if (index === -1) {
      console.log('20건 전부 라벨됐다. 다음: node lab/judge.js');
      return;
    }
  }

  render(items[index], index, items.length, set);
}

main();
