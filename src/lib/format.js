/**
 * 通用格式化 / 数值工具（纯逻辑，不依赖 React 与 DOM）。
 */

/**
 * 将数字补足两位（用于号码与月份/日期片段显示）。
 * @param {number|string} value 原始值
 * @return {string} 两位字符串，非法输入返回 '00'
 */
export function pad2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '00';
  return String(Math.trunc(n)).padStart(2, '0');
}

/**
 * 小数格式化。
 * @param {number} value 数值
 * @param {number} digits 保留位数
 * @return {string} 格式化结果，非法值返回 '-'
 */
export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

/**
 * 百分比格式化（输入为 0~1 的比例）。
 * @param {number} value 比例
 * @param {number} digits 保留位数
 * @return {string} 例如 '14.29%'
 */
export function formatPercent(value, digits = 2) {
  if (!Number.isFinite(value)) return '-';
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 生成 YYYYMMDD 形式的当日时间戳，用于导出文件名。
 * @return {string} 例如 '20261030'
 */
export function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
}

/**
 * 去重并保持首次出现顺序的数字数组。
 * @param {Array<number|string>} list 原始列表
 * @return {number[]} 去重后的数字
 */
export function uniqueNumbers(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const n = Number(item);
    if (!Number.isFinite(n)) return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

/**
 * 生成闭区间整数序列。
 * @param {number} min 起始（含）
 * @param {number} max 结束（含）
 * @return {number[]} 整数数组
 */
export function numRange(min, max) {
  const out = [];
  const start = Math.trunc(Math.min(min, max));
  const end = Math.trunc(Math.max(min, max));
  for (let n = start; n <= end; n += 1) out.push(n);
  return out;
}

/**
 * 取整并夹在 [min, max] 区间内。
 * @param {number} value 输入
 * @param {number} min 下界
 * @param {number} max 上界
 * @return {number} 处理后的整数
 */
export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * 求平均值。
 * @param {number[]} list 数值列表
 * @return {number} 平均值，空数组返回 0
 */
export function mean(list) {
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + (Number(v) || 0), 0) / arr.length;
}
