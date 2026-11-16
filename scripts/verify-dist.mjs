#!/usr/bin/env node
/**
 * 交付特性断言（本项目核心质量门）。
 *
 * 守护的唯一产品特性：`dist/index.html` 双击（`file://`）可以直接运行。
 * 基线实测：`type="module"` 命中 0、`crossorigin` 命中 0、`app.js` 首字节为
 * `(function(){"use strict";`、`index.html` 引用 `./assets/app.js` 与 `./assets/style.css`。
 *
 * 实现约定：零依赖，只用 node:fs / node:path；任一条失败打印 ❌ 并 exit 1；
 * 全绿打印 ✅。在 GitHub Actions 中额外把结果写成 Markdown 表格追加到
 * $GITHUB_STEP_SUMMARY。
 *
 * 用法：node scripts/verify-dist.mjs [distDir]
 * 背景见 docs/adr/0001-iife-classic-script-delivery.md
 */

import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST_DIR = path.resolve(ROOT, process.argv[2] || 'dist');
const HTML_PATH = path.join(DIST_DIR, 'index.html');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const JS_PATH = path.join(ASSETS_DIR, 'app.js');
const CSS_PATH = path.join(ASSETS_DIR, 'style.css');

/** 断言失败时展示的实际片段长度上限 */
const SNIPPET_LIMIT = 200;

/**
 * 截断长文本，便于错误信息可读。
 *
 * @param {string} text 原始文本
 * @param {number} [limit] 长度上限
 * @return {string} 截断结果（超长时附带省略标记）
 */
function snippet(text, limit = SNIPPET_LIMIT) {
  if (typeof text !== 'string') return String(text);
  const flat = text.replace(/\n/g, '\\n');
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…（共 ${flat.length} 字符）`;
}

/**
 * 安全读取文本文件，失败返回 null。
 *
 * @param {string} filePath 绝对路径
 * @return {string|null} 文件内容
 */
function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

const html = readText(HTML_PATH) ?? '';
const js = readText(JS_PATH) ?? '';
const cssExists = existsSync(CSS_PATH);
const htmlSize = existsSync(HTML_PATH) ? statSync(HTML_PATH).size : 0;

/**
 * 断言清单。每项返回 { ok, expected, actual }。
 *
 * @type {Array<{n: number, name: string, run: () => {ok: boolean, expected: string, actual: string}}>}
 */
const assertions = [
  {
    n: 1,
    name: 'dist/index.html 存在且非空',
    run: () => ({
      ok: existsSync(HTML_PATH) && htmlSize > 0,
      expected: `${HTML_PATH} 存在且 size > 0`,
      actual: existsSync(HTML_PATH) ? `size = ${htmlSize} 字节` : '文件不存在',
    }),
  },
  {
    n: 2,
    name: '不含 type="module"',
    run: () => ({
      ok: !html.includes('type="module"'),
      expected: 'HTML 中不出现 type="module"（否则 file:// 下 CORS 拦截 → 白屏）',
      actual: html.includes('type="module"')
        ? snippet(html.slice(html.indexOf('type="module"') - 40))
        : '未出现',
    }),
  },
  {
    n: 3,
    name: '不含 crossorigin 属性',
    run: () => ({
      ok: !html.includes('crossorigin'),
      expected: 'HTML 中不出现 crossorigin（插件正则需剥离该属性）',
      actual: html.includes('crossorigin')
        ? snippet(html.slice(html.indexOf('crossorigin') - 40))
        : '未出现',
    }),
  },
  {
    n: 4,
    name: '脚本标签为 defer 且使用相对路径',
    run: () => {
      const expected = '<script defer src="./assets/app.js"></script>';
      const match = html.match(/<script[^>]*src="[^"]*app\.js"[^>]*><\/script>/);
      return {
        ok: html.includes(expected),
        expected,
        actual: match ? match[0] : '未找到引用 app.js 的脚本标签',
      };
    },
  },
  {
    n: 5,
    name: '全页无绝对资源路径',
    run: () => {
      const bad = html.match(/(src|href)="\/(?!\/)[^"]*"/);
      return {
        ok: bad === null,
        expected: '所有 src / href 均为相对路径（不以单个 / 开头）',
        actual: bad ? bad[0] : '未出现绝对路径',
      };
    },
  },
  {
    n: 6,
    name: 'app.js 以 IIFE 开头',
    run: () => {
      const head = js.slice(0, 64);
      return {
        ok: /^\s*\(function\s*\(/.test(head),
        expected: 'app.js 前 64 字符匹配 /^\\s*\\(function\\s*\\(/（经典脚本形态）',
        actual: js ? snippet(head) : '文件缺失或为空',
      };
    },
  },
  {
    n: 7,
    name: 'app.js 无 ESM 残留',
    run: () => {
      const hasImportMeta = js.includes('import.meta');
      const hasStaticImport = /(^|\n)\s*import\s+[\w{*]/.test(js);
      return {
        ok: !hasImportMeta && !hasStaticImport,
        expected: '不出现 import.meta 且不出现顶层静态 import',
        actual: hasImportMeta
          ? snippet(js.slice(js.indexOf('import.meta') - 40))
          : hasStaticImport
            ? snippet(js.match(/(^|\n)\s*import\s+[\w{*][^\n]*/) ?? '')
            : '未出现',
      };
    },
  },
  {
    n: 8,
    name: '样式为单文件且被相对引用',
    run: () => ({
      ok: cssExists && html.includes('href="./assets/style.css"'),
      expected: 'assets/style.css 存在，且 index.html 含 href="./assets/style.css"',
      actual: cssExists
        ? html.includes('href="./assets/style.css"')
          ? '已引用'
          : 'style.css 存在但未被引用'
        : 'assets/style.css 不存在',
    }),
  },
];

/**
 * 观察项（默认不失败）：assets 目录文件数 ≤3。
 *
 * @return {{count: number, files: string[]}} 统计结果
 */
function observeAssets() {
  if (!existsSync(ASSETS_DIR)) return { count: 0, files: [] };
  const files = readdirSync(ASSETS_DIR);
  return { count: files.length, files };
}

const results = assertions.map((assertion) => {
  const outcome = assertion.run();
  return { n: assertion.n, name: assertion.name, ...outcome };
});

const failures = results.filter((row) => !row.ok);
const assets = observeAssets();

const summaryLines = [
  '',
  '| # | 断言 | 结果 |',
  '|---|---|---|',
  ...results.map((row) => `| ${row.n} | ${row.name} | ${row.ok ? '✅' : '❌'} |`),
  '',
  `产物：\`dist/index.html\` ${htmlSize} 字节 · \`assets/app.js\` ${
    existsSync(JS_PATH) ? statSync(JS_PATH).size : 0
  } 字节 · \`assets/style.css\` ${cssExists ? statSync(CSS_PATH).size : 0} 字节`,
  `assets 目录文件数：${assets.count}（${assets.files.join(', ')}）— 建议观察项，默认不失败`,
  '',
];

for (const line of summaryLines) console.log(line);

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## 交付特性断言（verify-dist）\n${summaryLines.join('\n')}\n`,
      'utf8',
    );
  } catch {
    console.log('（提示：写入 GITHUB_STEP_SUMMARY 失败，已忽略）');
  }
}

if (assets.count > 3) {
  console.log(`⚠️  观察项：assets 下有 ${assets.count} 个文件，建议确认是否有意外产物。`);
}

if (failures.length > 0) {
  console.error(`\n❌ ${failures.length}/${results.length} 条断言失败：`);
  for (const row of failures) {
    console.error(`   [#${row.n}] ${row.name}`);
    console.error(`      期望：${row.expected}`);
    console.error(`      实际：${row.actual}`);
  }
  console.error('\n   → 产物已不具备「双击 dist/index.html 可运行」特性，禁止合并与发版。');
  console.error(
    '   → 排查顺序见 docs/adr/0001-iife-classic-script-delivery.md 的 Enforcement 节。',
  );
  process.exit(1);
}

console.log(
  `✅ ${results.length}/${results.length} 交付特性断言通过（dist/index.html 可直接双击运行）`,
);
