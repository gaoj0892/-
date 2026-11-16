/**
 * 兼容转发层（拆分过渡用）。
 *
 * 实现已迁至 `src/features/generator/`。本文件仅保留 re-export，
 * 使既有 `import GeneratorPanel from './GeneratorPanel.jsx'` 不变；
 * 下一个提交会删除本文件并直接指向新路径。
 */

export { default } from '../features/generator/index.jsx';
