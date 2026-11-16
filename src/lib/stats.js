/**
 * 统计分析纯函数（不依赖 React 与 DOM）。
 *
 * 术语说明：
 *  - 出现率：该号码在所选期次中出现的次数 / 期数
 *  - 理论概率：前区 5/35 = 14.29%，后区 2/12 = 16.67%（每期独立）
 *  - z 值：(实际次数 - 期望次数) / 二项分布标准差
 *  - 遗漏：连续未出现的期数
 */

import { numRange } from './format.js';

export const ZONES = {
  front: { min: 1, max: 35, pick: 5, count: 35, label: '前区', df: 34 },
  back: { min: 1, max: 12, pick: 2, count: 12, label: '后区', df: 11 },
};

/**
 * 取区间配置。
 * @param {'front'|'back'} zone 区域
 * @return {{min: number, max: number, pick: number, count: number, label: string, df: number}}
 */
export function zoneConfig(zone) {
  return ZONES[zone] || ZONES.front;
}

/**
 * 按期号/日期升序排序（不修改入参）。
 * @param {Array<object>} draws 开奖数据
 * @return {Array<object>} 升序副本
 */
export function sortByPeriodAsc(draws) {
  return [...(draws || [])].sort((a, b) => {
    const dateA = String(a && a.date ? a.date : '');
    const dateB = String(b && b.date ? b.date : '');
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    const noA = String(a && a.no ? a.no : '');
    const noB = String(b && b.no ? b.no : '');
    if (noA === noB) return 0;
    return noA < noB ? -1 : 1;
  });
}

/**
 * 取最近 N 期（升序返回）；range 为 'all' 或非法值时返回全部。
 * @param {Array<object>} draws 开奖数据
 * @param {number|'all'} range 期数范围
 * @return {Array<object>} 子集（升序）
 */
export function subsetByRange(draws, range) {
  const asc = sortByPeriodAsc(draws);
  if (range === 'all' || range === null || range === undefined) return asc;
  const n = Number(range);
  if (!Number.isFinite(n) || n <= 0 || n >= asc.length) return asc;
  return asc.slice(asc.length - n);
}

/**
 * 计算号码频次表。
 * @param {Array<object>} draws 开奖数据
 * @param {'front'|'back'} zone 区域
 * @return {Array<{num: number, count: number, rate: number, expected: number, deviation: number, z: number}>}
 */
export function frequency(draws, zone = 'front') {
  const cfg = zoneConfig(zone);
  const list = Array.isArray(draws) ? draws : [];
  const total = list.length;
  const counts = new Array(cfg.count).fill(0);

  list.forEach((draw) => {
    const nums = Array.isArray(draw && draw[zone]) ? draw[zone] : [];
    nums.forEach((num) => {
      const index = Number(num) - cfg.min;
      if (Number.isInteger(index) && index >= 0 && index < cfg.count) counts[index] += 1;
    });
  });

  const probability = cfg.pick / cfg.count;
  const expected = total * probability;
  const sd = Math.sqrt(Math.max(total * probability * (1 - probability), 0));

  return counts.map((count, index) => {
    const deviation = count - expected;
    return {
      num: index + cfg.min,
      count,
      rate: total > 0 ? count / total : 0,
      expected,
      deviation,
      z: sd > 0 ? deviation / sd : 0,
    };
  });
}

/**
 * 计算遗漏统计。
 *
 * - current：从最新一期往前数连续未出现的期数（最新一期开出则为 0）
 * - max：历史最大遗漏（含首次出现前的遗漏与当前遗漏）
 * - avg：平均遗漏 = (总期数 - 出现次数) / (出现次数 + 1)
 * @param {Array<object>} draws 开奖数据
 * @param {'front'|'back'} zone 区域
 * @return {Array<{num: number, count: number, current: number, max: number, avg: number, lastNo: string, lastDate: string}>}
 */
export function omissionStats(draws, zone = 'front') {
  const cfg = zoneConfig(zone);
  const asc = sortByPeriodAsc(draws);
  const total = asc.length;

  return numRange(cfg.min, cfg.max).map((num) => {
    const positions = [];
    asc.forEach((draw, index) => {
      const nums = Array.isArray(draw && draw[zone]) ? draw[zone] : [];
      if (nums.map(Number).includes(num)) positions.push(index);
    });

    const count = positions.length;
    if (!count) {
      return {
        num,
        count: 0,
        current: total,
        max: total,
        avg: total,
        lastNo: '',
        lastDate: '',
      };
    }

    const lastIndex = positions[count - 1];
    const current = total - 1 - lastIndex;

    const gaps = [positions[0]];
    for (let i = 1; i < count; i += 1) gaps.push(positions[i] - positions[i - 1] - 1);
    gaps.push(current);

    return {
      num,
      count,
      current,
      max: Math.max(...gaps),
      avg: (total - count) / (count + 1),
      lastNo: asc[lastIndex].no,
      lastDate: asc[lastIndex].date,
    };
  });
}

/**
 * 前区和值序列。
 * @param {Array<object>} draws 开奖数据
 * @return {Array<{no: string, date: string, sum: number}>} 升序序列
 */
export function sumSeries(draws) {
  return sortByPeriodAsc(draws).map((draw) => {
    const front = Array.isArray(draw && draw.front) ? draw.front : [];
    return {
      no: draw.no,
      date: draw.date,
      sum: front.reduce((acc, n) => acc + (Number(n) || 0), 0),
    };
  });
}

/**
 * 和值。
 * @param {number[]} front 前区号码
 * @return {number} 和值
 */
export function sumOf(front) {
  return (Array.isArray(front) ? front : []).reduce((acc, n) => acc + (Number(n) || 0), 0);
}

/**
 * 跨度（最大号 - 最小号）。
 * @param {number[]} front 前区号码
 * @return {number} 跨度，空数组返回 0
 */
export function spanOf(front) {
  const list = Array.isArray(front) ? front.filter((n) => Number.isFinite(Number(n))) : [];
  if (!list.length) return 0;
  const nums = list.map(Number);
  return Math.max(...nums) - Math.min(...nums);
}

/**
 * 奇偶比。
 * @param {number[]} front 前区号码
 * @return {{odd: number, even: number, label: string}}
 */
export function oddEvenRatio(front) {
  const nums = (Array.isArray(front) ? front : []).map(Number);
  const odd = nums.filter((n) => n % 2 === 1).length;
  const even = nums.length - odd;
  return { odd, even, label: `${odd}:${even}` };
}

/**
 * 大小比（小：01-17，大：18-35）。
 * @param {number[]} front 前区号码
 * @return {{small: number, big: number, label: string}} label 形如 'small:big'
 */
export function bigSmallRatio(front) {
  const nums = (Array.isArray(front) ? front : []).map(Number);
  const small = nums.filter((n) => n <= 17).length;
  const big = nums.length - small;
  return { small, big, label: `${small}:${big}` };
}

export const FRONT_ZONE_BOUNDS = [
  [1, 7],
  [8, 14],
  [15, 21],
  [22, 28],
  [29, 35],
];

export const FRONT_ZONE_LABELS = ['一区 01-07', '二区 08-14', '三区 15-21', '四区 22-28', '五区 29-35'];

/**
 * 五区间分布（1-7 / 8-14 / 15-21 / 22-28 / 29-35）。
 * @param {number[]} front 前区号码
 * @return {number[]} 长度 5 的计数数组
 */
export function zoneDistribution(front) {
  const counts = [0, 0, 0, 0, 0];
  (Array.isArray(front) ? front : []).forEach((raw) => {
    const n = Number(raw);
    FRONT_ZONE_BOUNDS.forEach(([min, max], index) => {
      if (n >= min && n <= max) counts[index] += 1;
    });
  });
  return counts;
}

/**
 * 连号信息。
 * @param {number[]} front 前区号码
 * @return {{hasConsecutive: boolean, pairs: Array<number[]>, maxRun: number, count: number}}
 */
export function consecutiveInfo(front) {
  const nums = [...new Set((Array.isArray(front) ? front : []).map(Number))].sort((a, b) => a - b);
  const pairs = [];
  let maxRun = nums.length > 0 ? 1 : 0;
  let run = nums.length > 0 ? 1 : 0;

  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] - nums[i - 1] === 1) {
      pairs.push([nums[i - 1], nums[i]]);
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }

  return { hasConsecutive: pairs.length > 0, pairs, maxRun, count: pairs.length };
}

/**
 * 与上一期的重号个数。
 * @param {number[]} prevFront 上一期前区
 * @param {number[]} front 本期前区
 * @return {number} 重号个数
 */
export function repeatCount(prevFront, front) {
  const prev = new Set((Array.isArray(prevFront) ? prevFront : []).map(Number));
  return (Array.isArray(front) ? front : []).filter((n) => prev.has(Number(n))).length;
}

/**
 * Lanczos 近似的对数伽马函数。
 * @param {number} x 自变量（> 0）
 * @return {number} ln Γ(x)
 */
function gammaln(x) {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x;
  const tmpBase = x + 5.5;
  const tmp = tmpBase - (x + 0.5) * Math.log(tmpBase);
  let series = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    series += coefficients[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

/**
 * 正则化下不完全伽马函数 P(a, x) 的级数展开形式。
 * @param {number} a 参数 a
 * @param {number} x 自变量
 * @return {number} P(a, x)
 */
function gammaSeries(a, x) {
  const maxIter = 300;
  const eps = 1e-14;
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= maxIter; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * eps) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
}

/**
 * 正则化上不完全伽马函数 Q(a, x) 的连分式形式。
 * @param {number} a 参数 a
 * @param {number} x 自变量
 * @return {number} Q(a, x)
 */
function gammaContinuedFraction(a, x) {
  const maxIter = 300;
  const eps = 1e-14;
  const fpMin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpMin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= maxIter; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = b + an / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

/**
 * 正则化上不完全伽马函数 Q(a, x) = 1 - P(a, x)。
 * @param {number} a 参数 a
 * @param {number} x 自变量
 * @return {number} Q(a, x)，取值 [0, 1]
 */
export function gammaQ(a, x) {
  if (!Number.isFinite(a) || !Number.isFinite(x)) return 1;
  if (x <= 0) return 1;
  if (a <= 0) return 0;
  if (x < a + 1) return 1 - gammaSeries(a, x);
  return gammaContinuedFraction(a, x);
}

/**
 * 卡方分布上尾概率（p 值），自实现，不依赖 jstat。
 * @param {number} chi2 卡方统计量
 * @param {number} df 自由度
 * @return {number} p 值，取值 [0, 1]
 */
export function chiSquarePValue(chi2, df) {
  const stat = Number(chi2);
  const degrees = Number(df);
  if (!Number.isFinite(stat) || !Number.isFinite(degrees) || degrees <= 0) return 1;
  if (stat <= 0) return 1;
  const p = gammaQ(degrees / 2, stat / 2);
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

/**
 * 卡方均匀性检验（近似）。
 *
 * 注意：每期是从号码池中不放回抽 5 个（或 2 个），严格来说各号码计数并非独立多项分布，
 * 因此这里给出的是近似拟合优度检验，仅用于观察整体是否有明显偏离均匀。
 * @param {Array<object>} draws 开奖数据
 * @param {'front'|'back'} zone 区域
 * @return {{chi2: number, df: number, p: number, expected: number, total: number, significant: boolean}}
 */
export function chiSquareTest(draws, zone = 'front') {
  const cfg = zoneConfig(zone);
  const list = Array.isArray(draws) ? draws : [];
  const total = list.length;
  const df = cfg.count - 1;

  if (!total) {
    return { chi2: 0, df, p: 1, expected: 0, total: 0, significant: false };
  }

  const freq = frequency(list, zone);
  const expected = freq[0].expected;
  const chi2 = freq.reduce((acc, item) => {
    if (expected <= 0) return acc;
    const diff = item.count - item.expected;
    return acc + (diff * diff) / item.expected;
  }, 0);
  const p = chiSquarePValue(chi2, df);

  return { chi2, df, p, expected, total, significant: p < 0.05 };
}

/**
 * 在频次表中取最热 / 最冷的号码。
 * @param {Array<{num: number, count: number}>} freq 频次表
 * @param {number} hotN 热号数量
 * @param {number} coldN 冷号数量
 * @return {{hot: Array<object>, cold: Array<object>}}
 */
export function hotColdLists(freq, hotN, coldN) {
  const list = Array.isArray(freq) ? freq : [];
  const hot = [...list].sort((a, b) => b.count - a.count || a.num - b.num).slice(0, hotN);
  const cold = [...list].sort((a, b) => a.count - b.count || a.num - b.num).slice(0, coldN);
  return { hot, cold };
}
