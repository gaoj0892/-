/**
 * 通用「触发浏览器下载」工具（纯逻辑，不依赖 React）。
 *
 * 从 GeneratorPanel / DataManager / BacktestPanel 三处重复实现中提取，
 * 行为与原实现完全一致：Blob → objectURL → 临时 a[download] → click → 延迟 revoke。
 */

/**
 * 触发浏览器下载。
 *
 * @param {string} filename 文件名
 * @param {string} content 文件内容
 * @param {string} mimeType MIME 类型
 * @return {void}
 */
export function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
