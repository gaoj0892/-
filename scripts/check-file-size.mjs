#!/usr/bin/env node
/**
 * 文件规模守门脚本（G5 的可执行约束）。
 *
 * 规则：
 *  - `src/**\/*.{js,jsx,css}`：业务文件上限 300 行
 *  - `tests/**\/*.{js,jsx}`：测试文件上限 400 行
 *  - `.json` 不统计（`src/data/dlt_history.json` 是 2944 行脚本产物，与复杂度无关）
 *
 * 白名单是「已知待还的技术债」清单，成员必须带理由；拆分完成后应同步删除对应条目，
 * 否则等于把阈值悄悄放宽。默认退出码 0，发现超限文件打印清单并退出 1。
 *
 * 用法：node scripts/check-file-size.mjs [--list]
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/** 业务文件行数上限 */
const BUSINESS_LIMIT = 300;
/** 测试文件行数上限 */
const TEST_LIMIT = 400;
/** 参与统计的扩展名 */
const EXTENSIONS = new Set(['.js', '.jsx', '.css']);

/**
 * 白名单：二期（A6）待拆分文件的豁免清单。
 * 每一条都对应架构方案 §2.2 的拆分计划，拆完即删。
 */
const WHITELIST = new Set([
  // A6（P2）待拆分测试：全量基准用例集中在一个文件，拆分收益低于回归风险
  'tests/acceptance/qa.test.js',
  'tests/unit/lib.test.js',
  // A6（P2）待拆分：
  'src/components/BacktestPanel.jsx', // 453 行 → features/backtest/
  'src/components/DataManager.jsx', // 451 行 → features/data/
  'src/components/TrendPanel.jsx', // 356 行 → features/trend/
  'src/components/HotColdPanel.jsx', // 313 行 → features/hotcold/
  'src/lib/generator.js', // 463 行：加权抽样核心，拆分收益低于回归风险，暂缓
  'src/lib/stats.js', // 419 行 → stats/{frequency,omission,chiSquare}.js
  'src/lib/parse.js', // 410 行 → parse/{text,json,validate}.js
  'src/lib/backtest.js', // 394 行 → backtest/{run,prize,benchmark}.js
]);

/**
 * 递归收集目录下所有需要统计的文件（posix 相对路径）。
 *
 * @param {string} dir 绝对目录
 * @return {string[]} 相对仓库根的文件路径
 */
function collect(dir) {
  const out = [];
  const absolute = path.join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    // 目录不存在（如 tests/ 迁移前）时跳过
    return out;
  }
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(rel));
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) out.push(rel);
  }
  return out;
}

/**
 * 统计行数（与 `wc -l` 口径一致：换行符个数，末尾无换行时补 1）。
 *
 * @param {string} file 绝对路径
 * @return {number} 行数
 */
function countLines(file) {
  const text = readFileSync(file, 'utf8');
  let newlines = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) newlines += 1;
  }
  if (text.length > 0 && text.charCodeAt(text.length - 1) !== 10) newlines += 1;
  return newlines;
}

const files = [...collect('src'), ...collect('tests')];
const rows = files.map((rel) => {
  const limit = rel.startsWith('tests/') ? TEST_LIMIT : BUSINESS_LIMIT;
  return { rel, lines: countLines(path.join(ROOT, rel)), limit };
});

const violations = rows
  .filter((row) => row.lines > row.limit && !WHITELIST.has(row.rel))
  .sort((a, b) => b.lines - a.lines);

const whitelisted = rows
  .filter((row) => row.lines > row.limit && WHITELIST.has(row.rel))
  .sort((a, b) => b.lines - a.lines);

// 白名单里已不存在或已不超限的条目（提示清理，不失败）
const staleWhitelist = [...WHITELIST].filter(
  (rel) => !rows.some((row) => row.rel === rel && row.lines > row.limit),
);

if (process.argv.includes('--list')) {
  console.log('文件规模清单（按行数降序）：');
  for (const row of [...rows].sort((a, b) => b.lines - a.lines)) {
    const mark = row.lines > row.limit ? (WHITELIST.has(row.rel) ? '豁免' : '超限') : '  ok';
    console.log(`  ${String(row.lines).padStart(5)} / ${row.limit}  ${mark}  ${row.rel}`);
  }
  console.log('');
}

if (staleWhitelist.length > 0) {
  console.log('提示：以下白名单条目已不再超限，请从 WHITELIST 删除以收紧约束：');
  for (const rel of staleWhitelist) console.log(`  · ${rel}`);
  console.log('');
}

if (violations.length > 0) {
  console.error(`❌ 文件规模守门失败：${violations.length} 个文件超出阈值`);
  for (const row of violations) {
    console.error(`   ${row.rel}: ${row.lines} (阈值 ${row.limit})`);
  }
  console.error('   → 请拆分文件，或在 scripts/check-file-size.mjs 的 WHITELIST 登记待还债务。');
  process.exit(1);
}

const maxRow = [...rows].sort((a, b) => b.lines - a.lines)[0];
const maxText = maxRow ? `${maxRow.rel} ${maxRow.lines} 行` : '无文件';
console.log(
  `✅ 文件规模守门通过：扫描 ${rows.length} 个文件（业务 ≤${BUSINESS_LIMIT} / 测试 ≤${TEST_LIMIT}），` +
    `白名单豁免 ${whitelisted.length} 个，最大 ${maxText}`,
);
