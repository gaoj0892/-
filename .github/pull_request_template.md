# 变更说明

<!-- 一句话说清这个 PR 做了什么 -->

## 关联 issue

Closes #

## 变更类型

- [ ] 缺陷修复（fix）
- [ ] 新功能（feat）
- [ ] 重构（refactor）
- [ ] 文档（docs）
- [ ] 构建 / 工具链 / CI（build / ci）
- [ ] 性能（perf）
- [ ] 测试（test）

## 检查清单（合并前必须全部勾选）

- [ ] `npm run lint` 通过（含文件规模守门 + ESLint `--max-warnings 0`）
- [ ] `npx vitest run` 全绿，**85 个基线用例一个不少**（改动测试需说明）
- [ ] `npm run build` 成功，且 `node scripts/verify-dist.mjs` 8/8 通过
- [ ] **已人工双击 `dist/index.html` 验证界面完整可用**（改动 `vite.config.js` / `index.html` / `package.json` / 依赖者**必须**附截图）
- [ ] 免责表述未被弱化（随机性、不构成购彩依据、1/21,425,712 等原句仍在位）

## 统计口径

- [ ] 本 PR 不改变任何统计量的计算方式
- [ ] 本 PR 改变了统计口径 → 已在下方说明变化、原因与新增用例

<details>
<summary>若改变统计口径，展开填写</summary>

- 原口径：
- 新口径：
- 变化原因：
- 新增/修改的用例：

</details>

## 截图 / 录屏

<!-- UI 变更必填；交付形态变更必附「双击 dist/index.html」的截图 -->

## 补充说明

<!-- 设计取舍、已知限制、后续计划 -->
