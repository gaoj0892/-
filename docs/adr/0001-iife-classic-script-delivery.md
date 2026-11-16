# ADR 0001 · 用 IIFE + 经典脚本交付，保证 `file://` 双击可运行

- 状态：已采纳（Accepted）
- 日期：2026-10-30
- 相关文件：`vite.config.js`、`scripts/verify-dist.mjs`、`index.html`
- 相关记录：[ADR 0003](0003-seed-data-inline-import-and-one-draw-per-line.md)

## Context（背景）

产品的核心交付形态是「用户拿到一个文件夹，双击 `index.html` 就能用」：不需要安装 Node、不需要起本地服务器、不需要联网。

Vite 默认产出的入口是 `<script type="module" crossorigin src="/assets/index-xxxx.js">`，直接双击会**白屏**，原因有两层：

1. **`file://` 下 module 脚本受 CORS 限制**：`file://` 页面的 origin 是 `null`，浏览器按 CORS 规则拒绝加载 `type="module"` 脚本（`Access to script at 'file:///...' from origin 'null' has been blocked by CORS policy`）。
2. **绝对路径在 `file://` 下解析到磁盘根**：`src="/assets/..."` 会被解析成 `file:///assets/...`（磁盘根目录），必然 404。

此外，只要代码里出现顶层 `import`、动态 `import()`、`import.meta`，浏览器就要求 module 上下文，仍然回落到第 1 条问题。

## Decision（决策）

构建产物固定为**单个 IIFE 经典脚本 + 相对路径 + 剥离 module 相关属性**，由 `vite.config.js` 的三组配置共同保证：

| 配置                                                                            | 作用                                                                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `base: './'`                                                                    | 所有资源引用改为相对路径，规避 `file://` 下绝对路径解析到磁盘根                                                                          |
| `rollupOptions.output.format: 'iife'` + `inlineDynamicImports: true`            | 产物是经典脚本，动态导入被内联，不产生顶层 `import` / `import.meta`                                                                      |
| `cssCodeSplit: false`                                                           | 只产出一个 `assets/style.css`，避免多文件注入顺序不确定                                                                                  |
| `classicScriptPlugin`（`enforce: 'post'` + `transformIndexHtml.order: 'post'`） | 把 `<script type="module" crossorigin>` 改写为 `<script defer>` 并去掉 `crossorigin`；必须后置执行，才能改写到 react 插件注入之后的 HTML |

`defer` 而非同步脚本，是为了保证 `#root` 已被解析后再执行。

## Consequences（后果）

必须接受的代价：

1. **不能做代码分割**：产物是 1.4MB 单文件（gzip 约 460KB）。`inlineDynamicImports: true` 与 chunk 分离互斥，故 `chunkSizeWarningLimit: 1600` 是豁免而非掩盖缺陷。
2. **不能出现 ESM 语法**：任何新增依赖若在其 ESM 入口用到 `import.meta`，构建产物会破功。
3. **不能改回 `type="module"`**：哪怕本地 `http://` 预览完全正常 —— 开发模式不受影响，问题只在使用者那边出现，属于最难发现的回归。
4. **`cssCodeSplit` 必须保持关闭**：多 CSS 文件在 `file://` 下的加载顺序与 `<link>` 注入时机不可控。

## Enforcement（如何被强制）

四重防线，缺一不可：

1. **自动化断言**：`scripts/verify-dist.mjs` 每次构建后校验 8 条（无 `type="module"`、无 `crossorigin`、脚本为 `defer` 且相对路径、全页无绝对资源路径、`app.js` 以 `(function` 开头、无 ESM 残留、`style.css` 单文件且被相对引用、`index.html` 非空）。CI 的 `verify-dist` job 与 `release.yml` 都会跑，任一失败即阻断合并与发版。
2. **本 ADR**：说明「为什么不能改」，避免后人当成冗余代码清理。
3. **CODEOWNERS**：`/vite.config.js` 指派给仓库 owner，改动需审阅。
4. **PR 模板**：改动构建形态者必须附「双击 `dist/index.html` 通过」的截图。

失效症状速查：如果构建成功但用户双击白屏，按顺序检查 —— ① `dist/index.html` 是否又出现 `type="module"`；② 是否出现 `crossorigin`；③ `app.js` 是否以 `(function(){` 开头；④ 资源路径是否变成 `/assets/...`。
