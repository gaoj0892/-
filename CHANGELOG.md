# 更新日志

本项目的所有重要变更都会记录在此文件。

格式参考 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-11-16

本次为工程化交付，**无算法口径变更、无功能增删、无视觉改版**，因此为 minor 版本。

> 版本对照：`v1.0.0` 对应首个功能完整版本，即 commit `330508f`（仓库初始导入，功能已完整、尚未做工程化）。
> 若下方 compare 链接暂时 404，说明 `v1.0.0` tag 尚未推送，属预期。

### Added

- ESLint 9 flat config（`eslint.config.js`），规则集含 `js recommended` + `eslint-plugin-react recommended` + `rules-of-hooks`（error）+ `exhaustive-deps`（error）
- Prettier 3 统一格式（`.prettierrc.json` / `.prettierignore`），`src/data/**/*.json` 与 `package-lock.json` 明确排除
- husky 9 + lint-staged 15 预提交钩子，暂存文件自动 lint + format
- `scripts/check-file-size.mjs`：业务文件 ≤300 行、测试文件 ≤400 行，接入 `npm run lint`
- `scripts/verify-dist.mjs`：8 条产物断言，守护「双击 `dist/index.html` 可运行」这条交付特性
- `scripts/format-seed-data.mjs`：种子数据整形为逐期一行，并在每次运行时校验结构不变量
- `jsconfig.json` + `npm run typecheck`：仅对 `src/lib` 开启 `checkJs`，把 188 处 JSDoc 变成可执行契约
- 测试目录重组为 `tests/unit/`（48 用例）与 `tests/acceptance/`（37 用例），`@` 别名指向 `src`
- GitHub Actions：`ci.yml`（lint / test matrix / verify-dist）与 `release.yml`（tag 触发构建 + 断言 + 打包上传）
- Issue 模板（bug / feature / config）、PR 模板、CODEOWNERS、dependabot 配置
- 文档全套：CONTRIBUTING、CHANGELOG、LICENSE（MIT）、NOTICE、SECURITY、ADR 0001–0003、README 补节
- `docs/screenshots/` 精选 4 张验收截图

### Changed

- `src/components/GeneratorPanel.jsx`（715 行）拆分为 `src/features/generator/` 下 11 个文件，最大单文件 207 行
- 三处重复的 `downloadText` 提取为 `src/lib/download.js`
- `package.json` 增加 `engines`（node ≥20 / npm ≥10）与 7 条新脚本；新增 `.nvmrc`（22）
- `src/data/dlt_history.json` 由单行 212,722 字节整形为 2,944 行 215,666 字节（结构深度相等）
- 删除根目录 `data/` 重复副本，`src/data/` 成为唯一数据源

### Fixed

- `backtest.js` 中从未被读取的 `drawFront` / `drawBack` 累加（无行为影响，属清理）
- `storage.js` 6 处未使用的 `catch` 绑定改为可选 catch 绑定
- `lint-staged` 匹配范围漏掉 `.mjs`，导致构建脚本绕过预提交检查

### Internal

- 仓库首次纳入版本控制；`.gitignore` 排除 `node_modules` / `dist` / `qa_shots` / `*.zip`
- 首次 clone 体积由「直接 `git add .` 约 122MB」降到 2MB 量级

## [1.0.0] - 2026-10-30

首个可运行版本，交付以下功能：

### Added

- 历史数据：内置 2,941 期种子数据（2007-05-30 ~ 2026-10-28，期号 07001 ~ 26123）；TXT / CSV / JSON 导入与逐行校验；搜索、日期区间筛选、分页、排序；导出 JSON / CSV；恢复种子 / 清空本地数据
- 频率统计：出现次数、出现率、理论概率、偏差、z 值；频次柱状图含期望线；卡方均匀性检验（χ² 与 p 值）；统计范围切换（全部 / 最近 50·100·300·500 期）
- 冷热与遗漏：前后区冷热号 Top / Bottom、当前遗漏、平均遗漏、最大遗漏、上次出现期号、遗漏排行图
- 走势图表：号码分布热力图、和值走势（含理论均值 90 参考线）、奇偶比与大小比分布、五区间分布
- 选号策略：号码池（全部 / 热号 / 冷号 / 高遗漏 / 自定义）、权重模式（等概率 / 频率加权 / 遗漏加权 / 冷热混合）、约束条件（奇偶比 / 大小比 / 和值区间 / 连号）、排除号；加权无放回抽样、同种子可复现、标注组合历史是否开出
- 多期回测：滚动窗口（无未来函数）、奖级判定、随机基准对照、两样本 z 检验、逐期明细与 CSV 导出
- 说明与免责：玩法规则、数据来源、统计学局限说明、完整免责条款；首次进入的免责确认弹窗与常驻免责横幅
- 交付形态：构建产物为 IIFE 单文件 + 相对路径，支持 `file://` 双击直接运行
- 85 个测试用例（lib 30 / backtest 18 / acceptance 37）

[1.1.0]: ../../compare/v1.0.0...v1.1.0
