# ADR 0003 · 种子数据用单文件 JSON 内联导入，且每期一行

- 状态：已采纳（Accepted）
- 日期：2026-10-30
- 相关文件：`src/data/dlt_history.json`、`scripts/format-seed-data.mjs`、`src/App.jsx`、`tests/acceptance/qa.test.js`
- 相关记录：[ADR 0001](0001-iife-classic-script-delivery.md)

## Context（背景）

种子数据是 2,941 期开奖记录（2007-05-30 ~ 2026-10-28），约 212KB。它的消费方式有两处：

1. `src/App.jsx`：`import seedJson from './data/dlt_history.json'`，取 `.meta` 与 `.draws`，作为首次打开时的内置数据；
2. `tests/acceptance/qa.test.js`：`readFileSync(SEED_PATH)` + `JSON.parse`，用于 37 个全量基准用例。

原始文件是**单行 212,722 字节**的压缩 JSON。问题：任何一期数据的增删改，在 `git diff` 里都表现为「删 1 行 + 加 1 行 212KB」，既无法审阅，也无法 `git blame`，还让 PR 页面几乎不可用。

同时存在一个隐患：仓库根目录曾有一份同尺寸副本 `data/dlt_history.json`，与 `src/data/` 下的文件构成双份数据源，容易改错。

## Decision（决策）

1. **保持单个 JSON 文件、单个 `import` 语句**，不拆分为 JSONL、不分片、不删 `meta`。原因：`App.jsx` 的单 import 与验收测试的 `readFileSync` 都依赖它；Vite 对 JSON import 的处理也最简单。
2. **格式改为「`meta` 独占首行 + `draws` 每期一行」**，由 `scripts/format-seed-data.mjs` 生成：
   ```json
   {"meta":{...},
   "draws":[
   {"no":"07001","date":"2007-05-30","front":[...],"back":[...]},
   ...
   ]}
   ```
   结果：2,944 行、215,666 字节（+1.4%），且结构不变 —— 脚本每次运行都会比对 `JSON.parse` 前后是否**深度相等**，不等则退出 1 并提示从 `.bak` 恢复。
3. **删除根目录重复副本**，`src/data/dlt_history.json` 成为唯一数据源。
4. **Prettier 排除 `src/data/**/*.json`**：格式化器会把它展开成每字段一行、体积翻数倍且 diff 更难读；逐期一行是脚本产物的约定格式，不是「没格式化」。
5. `.gitattributes` 标记 `linguist-generated=true`，让 GitHub 默认折叠该文件的 diff。

## Consequences（后果）

收益：

- 数据变更的 diff 精确到「哪一期」，`git blame` 可用；
- 只有一份数据源，消除「改错副本」；
- 体积只增加 1.4%，构建产物与 import 写法完全不变。

代价与限制：

- 该文件不是 Prettier 的产物，**禁止手工「美化」**（会破坏逐期一行的约定，也会制造巨型 diff）；
- 若有人用 `JSON.stringify(obj)` 无缩进覆盖，会退化成单行 —— 应改用脚本；
- 字段名 `no` / `date` / `front` / `back` 与结构 `{ meta, draws }` 属于对外契约，改名会同时打断 `App.jsx` 与 37 个验收用例。

## Enforcement（如何被强制）

- `scripts/format-seed-data.mjs` 内建深度相等校验，整形不改变语义；
- `tests/acceptance/qa.test.js` 的 37 个用例含全量基准核对（期数 2941、首末期号 07001 / 26123、每期号码与日期合规、日期严格递增、χ² 与 p 值等），字段或数值错会立即失败；
- `.prettierignore` 显式排除，避免格式化工具误改；
- README「数据更新流程」给出脚本 + 三连验（`vitest` → `build` → `verify:dist`）的操作顺序。
