# ADR 0002 · 用 JavaScript + JSDoc 做类型检查，不迁移 TypeScript

- 状态：已采纳（Accepted）
- 日期：2026-10-30
- 相关文件：`jsconfig.json`、`src/lib/*.js`、`package.json`（`npm run typecheck`）
- 相关记录：[ADR 0001](0001-iife-classic-script-delivery.md)

## Context（背景）

项目规模约 6,400 行，其中：

- `src/lib/` 是纯逻辑层（parse / stats / generator / backtest / storage / format），6 个文件、约 1,900 行，**已有 188 处 `@param` / `@return` JSDoc**（stats 51 / generator 38 / backtest 29 / parse 27 / storage 23 / format 20）；
- `src/components/` 与 `src/features/` 是 React 面板，无类型标注。

类型相关的实际痛点集中在纯逻辑层：函数参数是「对象 + 数组」，返回值结构复杂（例如 `omissionStats` 返回逐号对象、`runBacktest` 返回多层汇总）。面板层的问题主要是 hooks 使用与 props 传递，这类问题 ESLint 的 `rules-of-hooks` / `exhaustive-deps` 已经能覆盖大部分。

## Decision（决策）

**不迁移 TypeScript**，改为：

1. 新增 `jsconfig.json`，只对 `src/lib/**/*.js` 开启 `checkJs`，`strict: false`；
2. `npm run typecheck` = `tsc -p jsconfig.json`，要求 0 error；
3. React 侧完全不参与类型检查，保持 `.jsx` 源码；
4. 现有 188 处 JSDoc 视为「契约」，改动签名必须同步改注释。

## Consequences（后果）

收益：

- 纯逻辑层拿到大部分类型收益，且**零迁移风险**：不引入 `.ts` 构建链、不改 import 后缀、不动 `vite.config.js` 的 IIFE 产物形态（见 ADR 0001）。
- 类型信息留在原地，`Ctrl+点击` 与 IDE 提示直接可用，不需要 `d.ts` 同步维护。
- `strict: false` 起步，避免一次性引入数百条 `noImplicitAny` 噪音而阻塞交付。

代价与限制：

- JSDoc 的表达式能力弱于 TS（复杂泛型、条件类型写不出来）；
- 面板层的 props 结构错误仍然只能靠运行时发现；
- `checkJs` 不会因为你「忘了写 JSDoc」而报错 —— 它只在注释存在时校验其正确性，所以**覆盖率靠 review 而非工具保证**。

后续演进：可以逐文件打开 `noImplicitAny` / `strictNullChecks`（在 `jsconfig.json` 里按 `files` 分组），或对 `src/lib` 单独引入 `.d.ts`。若要整体迁移 TS，需另立 ADR 并评估对构建形态的影响。

## Enforcement（如何被强制）

- CI 的 `lint` job 与本地 `npm run lint` 之外的 `npm run typecheck` 保证 0 error；
- 修改 `src/lib` 函数签名而不改 JSDoc 会被 `tsc` 抓到（参数个数、返回类型不匹配）；
- `jsconfig.json` 的 `include` 明确限定 `src/lib/**/*.js`，避免面板层噪音进入。
