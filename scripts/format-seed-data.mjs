#!/usr/bin/env node
/**
 * 把种子数据 `src/data/dlt_history.json` 从「单行压缩」整形成「每期一行」。
 *
 * 目的：单行 200KB 的 JSON 任何改动都表现为「删 1 行 + 加 1 行」，diff 不可审、
 * `git blame` 不可用。整形后每期占一行，数据变更可精确定位到期号。
 *
 * 结构不变量（硬约束）：整形后 `JSON.parse` 的结果必须与整形前**深度相等**，
 * 即只允许改变空白与换行，不允许增删改任何字段或数值。
 * 脚本先在 `src/data/dlt_history.json.bak` 留一份原始备份（仅首次备份，不覆盖）。
 *
 * 用法：node scripts/format-seed-data.mjs
 */

import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SEED_PATH = path.join(ROOT, 'src', 'data', 'dlt_history.json');
const BACKUP_PATH = `${SEED_PATH}.bak`;

/**
 * 递归判断两个 JSON 值是否深度相等。
 * 对象比较键集合后逐键递归；数组按顺序逐项递归；其余用 Object.is 比较。
 *
 * @param {unknown} a 左值
 * @param {unknown} b 右值
 * @return {boolean} 是否深度相等
 */
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]),
  );
}

/**
 * 统计文件行数（换行符个数，与 `wc -l` 口径一致）。
 *
 * @param {string} text 文件内容
 * @return {number} 行数
 */
function countLines(text) {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

if (!existsSync(SEED_PATH)) {
  console.error(`❌ 找不到种子数据：${SEED_PATH}`);
  process.exit(1);
}

// 1) 备份（仅首次；已有备份说明原始单行版已保存，不再覆盖）
if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SEED_PATH, BACKUP_PATH);
  console.log(`已备份原始文件 → ${path.relative(ROOT, BACKUP_PATH)}`);
}

const beforeText = readFileSync(SEED_PATH, 'utf8');
const beforeBytes = statSync(SEED_PATH).size;
const beforeData = JSON.parse(beforeText);

if (!beforeData || typeof beforeData !== 'object' || !Array.isArray(beforeData.draws)) {
  console.error('❌ 种子数据结构异常：期望顶层为含 meta / draws 数组的对象。');
  process.exit(1);
}

// 2) 整形：meta 独占首行，draws 每期一行
const metaLine = `{"meta":${JSON.stringify(beforeData.meta ?? {})},`;
const drawLines = beforeData.draws.map((draw) => JSON.stringify(draw));
const afterText = `${[metaLine, '"draws":[', drawLines.join(',\n'), ']}'].join('\n')}\n`;

writeFileSync(SEED_PATH, afterText, 'utf8');

// 3) 结构不变量校验：重新解析后与整形前深度相等
const afterBytes = statSync(SEED_PATH).size;
const afterData = JSON.parse(readFileSync(SEED_PATH, 'utf8'));

if (!deepEqual(beforeData, afterData)) {
  console.error('❌ 结构不变量被破坏：整形后的 JSON 与原始内容不深度相等，请从 .bak 恢复。');
  process.exit(1);
}

const deltaBytes = afterBytes - beforeBytes;
const deltaPct = beforeBytes > 0 ? ((deltaBytes / beforeBytes) * 100).toFixed(2) : '0.00';

console.log('✅ 种子数据整形完成，结构不变量校验通过（JSON.parse 后深度相等）');
console.log(`   期数：${beforeData.draws.length}`);
console.log(
  `   字节：${beforeBytes} → ${afterBytes}（${deltaBytes >= 0 ? '+' : ''}${deltaBytes}，${deltaPct}%）`,
);
console.log(`   行数：${countLines(beforeText)} → ${countLines(afterText)}`);
