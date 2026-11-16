# 贡献指南

感谢参与。本项目是**纯前端离线单页工具**：无后端、无账号、无数据库，所有数据只存在使用者自己的浏览器里。改动前请先理解下面三条最高优先级约束。

## 三条不可破坏的约束

1. **构建产物必须能在 `file://` 下双击运行。** 即 `dist/index.html` 双击打开后界面完整可用。为此 `vite.config.js` 的 `classicScriptPlugin`、`base: './'`、`format: 'iife'`、`inlineDynamicImports: true`、`cssCodeSplit: false`、`enforce: 'post'`、`transformIndexHtml.order: 'post'` 全部不可删改语义。改动前必读 [ADR 0001](docs/adr/0001-iife-classic-script-delivery.md)。
2. **85 个测试用例必须全绿，数量不得减少。** 修改统计或选号算法须说明口径变化并补充用例。
3. **免责表述不得弱化。** 任何 UI 改动都不得移除或弱化「随机性」「不构成购彩依据」「1/21,425,712」等表述。

## 环境

- Node.js ≥ 20（推荐 22，见 `.nvmrc`）
- npm ≥ 10
- 安装：`npm ci`（严格按 `package-lock.json`，不要用 `npm install` 覆盖锁文件）

## 常用脚本

| 命令                                            | 说明                                        |
| ----------------------------------------------- | ------------------------------------------- |
| `npm run dev`                                   | 开发服务器                                  |
| `npm run lint`                                  | 文件规模守门 + ESLint（`--max-warnings 0`） |
| `npm run format`                                | Prettier 写入                               |
| `npm run test` / `test:watch` / `test:coverage` | 测试                                        |
| `npm run typecheck`                             | `src/lib` 的 JSDoc 类型检查                 |
| `npm run build`                                 | 构建                                        |
| `npm run verify:dist`                           | 8 条交付特性断言（构建后必须跑）            |

提交前钩子会自动对暂存文件跑 ESLint + Prettier。**紧急绕过仅限 CI 本身故障**：`git commit --no-verify`。

## 分支与提交

采用 trunk-based lite：

- `main` 常绿，受保护；日常改动走短生命周期分支 `feat/*`、`fix/*`、`chore/*`、`docs/*`、`refactor/*`、`test/*`，合并后即删。
- 以下四类文件**必须走 PR**：`vite.config.js`、`index.html`、`package.json`、`.github/**`。

提交信息遵循 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/zh-hans/)：

- type 白名单：`feat` `fix` `chore` `docs` `refactor` `test` `build` `ci` `perf`
- scope 建议：`generator` `data` `backtest` `trend` `stats` `ci` `deps`
- 允许中文 subject，例如：`feat(generator): 拆分选号面板为 11 个文件`

## 代码风格

- 格式由 Prettier 决定（`singleQuote`、`printWidth: 100`、`trailingComma: all`），不要手工对齐。
- 静态检查由 ESLint 决定，**不接受 `eslint-disable` 之外的消音方式**；使用 `eslint-disable` 必须写明原因。
- 业务代码必须在 `src/` 之下，扩展名限 `.js` / `.jsx`。`tailwind.config.js` 的 `content` 是 `./src/**/*.{js,jsx}`，移出 `src/` 或改成 `.tsx` 会让样式**静默丢失**。
- 单文件行数上限：业务 300 行、测试 400 行，由 `scripts/check-file-size.mjs` 强制。确需例外时登记到该脚本的 `WHITELIST` 并写理由。
- **禁止手工修改 `src/data/dlt_history.json` 的结构。** 新增数据请按 README「数据更新流程」用脚本整形，并跑 `npx vitest run` 验证全量基准。

## 新增逻辑请带用例

- 纯逻辑放 `src/lib/`，用例放 `tests/unit/`；验收级用例放 `tests/acceptance/`。
- 测试环境固定为 `environment: 'node'`，不要改成 `jsdom`。
- 覆盖率仅统计 `src/lib`（基线 lines 94.77%），阈值在 `vite.config.js` 中，只能升不能降。

## PR 要求

PR 模板含检查清单，其中两条为硬门：

- 改动 `vite.config.js` / `index.html` / `package.json` / 构建相关配置者，**必须附「双击 `dist/index.html` 通过」的截图**。
- 改动涉及统计口径者，**必须说明变化并附新增用例**。

## 合规红线

本项目只做「历史数据的统计展示 + 随机选号辅助」，不做任何效果承诺。全仓库（含 README、LICENSE、NOTICE、Issue 模板、代码注释）禁止出现下列表述：

- 「预测」「预报」「提高中奖率」「必中」「稳赚」「推荐号码」「中奖秘籍」「提升概率」
- 任何暗示可以影响开奖结果的措辞

可用表述：出现次数、出现率、理论概率、偏差、遗漏、回测回收率。所有涉及概率的说明必须保留「单注头奖概率 1/21,425,712，任何选号方法都无法提高这一概率」这一事实句。

项目不提供投注、代购、兑奖服务，也不收集任何个人信息。
