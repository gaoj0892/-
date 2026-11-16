/**
 * 选号策略纯逻辑（不依赖 React 与 DOM）。
 *
 * 设计要点：
 *  1. 使用可注入的 PRNG（mulberry32），相同 seed + 相同参数 ⇒ 完全相同的输出；
 *  2. 前区采用「加权无放回抽样」：按权重逐位抽取并剔除已选号码，而不是先洗牌再顺序取；
 *  3. 约束条件最多重试 200 次，仍失败则放宽为「仅池内随机 + 组间去重」，并在 groups[].relaxed 标注；
 *  4. 组与组之间不重复（前区 + 后区组合相同视为重复）。
 *
 * 免责：本模块输出的是随机号码，与下期开奖结果没有任何因果关系。
 */

import {
  bigSmallRatio,
  consecutiveInfo,
  frequency,
  oddEvenRatio,
  omissionStats,
  repeatCount,
  sortByPeriodAsc,
  spanOf,
  sumOf,
} from './stats.js';
import { clamp, mean, numRange, uniqueNumbers } from './format.js';

/** 默认参数（UI 与逻辑共用同一套字段名） */
export const DEFAULT_PARAMS = {
  count: 5,
  frontPoolMode: 'all', // all | hot | cold | omission | custom
  frontPoolSize: 12,
  frontCustom: [],
  frontWeightMode: 'uniform', // uniform | freq | omission | mix
  backPoolMode: 'all', // all | hot | cold | custom
  backPoolSize: 4,
  backCustom: [],
  excludeFront: [],
  excludeBack: [],
  constraints: {
    enabled: true,
    oddEven: true,
    bigSmall: true,
    sumRange: true,
    sumMin: 60,
    sumMax: 130,
    allowConsecutive: false,
  },
  draws: [],
};

const MAX_CONSTRAINT_TRIES = 200;
const MAX_RELAXED_TRIES = 600;

/**
 * mulberry32 伪随机数生成器，返回 [0, 1) 的浮点数。
 * @param {number} seed 32 位无符号整数种子
 * @return {() => number} 随机数函数
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 把任意字符串哈希成 32 位无符号整数（FNV-1a）。
 * @param {string} input 输入文本
 * @return {number} 32 位无符号整数
 */
export function hashSeed(input) {
  const text = String(input === undefined || input === null ? '' : input);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 归一化种子：数字直接用，字符串走哈希，空值随机生成。
 * @param {number|string|null|undefined} seed 种子
 * @return {number} 32 位无符号整数种子
 */
export function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.trunc(seed)) >>> 0;
  }
  if (seed === undefined || seed === null || String(seed).trim() === '') {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }
  return hashSeed(String(seed).trim());
}

/**
 * 合并默认参数（深合并 constraints）。
 * @param {object} params 用户参数
 * @return {object} 完整参数
 */
function mergeParams(params) {
  const input = params && typeof params === 'object' ? params : {};
  return {
    ...DEFAULT_PARAMS,
    ...input,
    constraints: {
      ...DEFAULT_PARAMS.constraints,
      ...(input.constraints && typeof input.constraints === 'object' ? input.constraints : {}),
    },
  };
}

/**
 * 解析一个区域的号码池。
 * @param {object} cfg 池配置
 * @param {string[]} warnings 警告收集数组
 * @return {number[]} 升序号码池
 */
function resolvePool(cfg, warnings) {
  const { mode, size, custom, allNumbers, freq, omission, exclude, label } = cfg;
  const keep = (list) => uniqueNumbers(list).filter((n) => !exclude.has(n));

  const sortedByCountDesc = [...freq].sort((a, b) => b.count - a.count || a.num - b.num);
  const sortedByCountAsc = [...freq].sort((a, b) => a.count - b.count || a.num - b.num);
  const sortedByOmissionDesc = [...omission].sort((a, b) => b.current - a.current || a.num - b.num);
  const limit = clamp(size, 1, allNumbers.length);

  let pool = [];
  if (mode === 'custom') {
    pool = keep(custom);
  } else if (mode === 'hot') {
    pool = keep(sortedByCountDesc.slice(0, limit).map((item) => item.num));
  } else if (mode === 'cold') {
    pool = keep(sortedByCountAsc.slice(0, limit).map((item) => item.num));
  } else if (mode === 'omission') {
    pool = keep(sortedByOmissionDesc.slice(0, limit).map((item) => item.num));
  } else {
    pool = keep(allNumbers);
  }

  pool = pool.sort((a, b) => a - b);

  if (!pool.length) {
    pool = keep(allNumbers).sort((a, b) => a - b);
    warnings.push(`${label}号码池为空（选号被排除光了），已自动回退为全部可用号码。`);
  }
  return pool;
}

/**
 * 计算前区权重。
 * @param {number[]} pool 前区号码池
 * @param {'uniform'|'freq'|'omission'|'mix'} mode 权重模式
 * @param {Array<object>} freq 频次表
 * @param {Array<object>} omission 遗漏表
 * @return {number[]} 与 pool 一一对应的权重
 */
function buildFrontWeights(pool, mode, freq, omission) {
  const countMap = new Map(freq.map((item) => [item.num, item.count]));
  const omissionMap = new Map(omission.map((item) => [item.num, item.current]));

  if (mode === 'freq') {
    return pool.map((n) => (countMap.get(n) || 0) + 0.5);
  }
  if (mode === 'omission') {
    return pool.map((n) => (omissionMap.get(n) || 0) + 1);
  }
  if (mode === 'mix') {
    const freqRaw = pool.map((n) => (countMap.get(n) || 0) + 0.5);
    const omissionRaw = pool.map((n) => (omissionMap.get(n) || 0) + 1);
    const freqMean = mean(freqRaw) || 1;
    const omissionMean = mean(omissionRaw) || 1;
    return pool.map(
      (_, index) => 0.5 * (freqRaw[index] / freqMean) + 0.5 * (omissionRaw[index] / omissionMean),
    );
  }
  return pool.map(() => 1);
}

/**
 * 加权无放回抽样。
 * @param {number[]} pool 号码池
 * @param {number[]} weights 权重（与 pool 对齐）
 * @param {number} k 抽取个数
 * @param {() => number} rng 随机数函数
 * @return {number[]} 升序结果
 */
export function weightedSample(pool, weights, k, rng) {
  const items = pool.map((num, index) => ({
    num,
    weight: Math.max(Number(weights[index]) || 0, 1e-9),
  }));
  const picked = [];
  const need = Math.min(Math.max(0, Math.trunc(k)), items.length);

  for (let round = 0; round < need; round += 1) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let target = rng() * totalWeight;
    let index = 0;
    for (; index < items.length; index += 1) {
      target -= items[index].weight;
      if (target <= 0) break;
    }
    if (index >= items.length) index = items.length - 1;
    picked.push(items[index].num);
    items.splice(index, 1);
    if (!items.length) break;
  }

  return picked.sort((a, b) => a - b);
}

/**
 * 构建号码池与统计上下文（UI 也可调用以预览池容量）。
 * @param {object} params 参数（含 draws）
 * @return {{frontPool: number[], backPool: number[], frontFreq: Array<object>, backFreq: Array<object>, frontOmission: Array<object>, backOmission: Array<object>, warnings: string[]}}
 */
export function buildPools(params) {
  const p = mergeParams(params);
  const draws = Array.isArray(p.draws) ? p.draws : [];
  const asc = sortByPeriodAsc(draws);
  const warnings = [];

  const frontFreq = frequency(asc, 'front');
  const backFreq = frequency(asc, 'back');
  const frontOmission = omissionStats(asc, 'front');
  const backOmission = omissionStats(asc, 'back');

  const excludeFront = new Set(uniqueNumbers(p.excludeFront));
  const excludeBack = new Set(uniqueNumbers(p.excludeBack));

  let frontPool = resolvePool(
    {
      mode: p.frontPoolMode,
      size: p.frontPoolSize,
      custom: p.frontCustom,
      allNumbers: numRange(1, 35),
      freq: frontFreq,
      omission: frontOmission,
      exclude: excludeFront,
      label: '前区',
    },
    warnings,
  );

  let backPool = resolvePool(
    {
      mode: p.backPoolMode,
      size: p.backPoolSize,
      custom: p.backCustom,
      allNumbers: numRange(1, 12),
      freq: backFreq,
      omission: backOmission,
      exclude: excludeBack,
      label: '后区',
    },
    warnings,
  );

  if (frontPool.length < 5) {
    frontPool = numRange(1, 35).filter((n) => !excludeFront.has(n));
    warnings.push('前区可用号码不足 5 个，已自动扩大为全部未被排除的号码。');
  }
  if (backPool.length < 2) {
    backPool = numRange(1, 12).filter((n) => !excludeBack.has(n));
    warnings.push('后区可用号码不足 2 个，已自动扩大为全部未被排除的号码。');
  }

  if (!frontPool.length || !backPool.length) {
    warnings.push('当前排除条件把所有号码都排除了，无法生成号码，请减少排除号码。');
  }

  return {
    frontPool,
    backPool,
    frontFreq,
    backFreq,
    frontOmission,
    backOmission,
    warnings,
  };
}

/**
 * 判断一组号码是否满足约束。
 * @param {{front: number[], back: number[], sum: number}} group 号码组
 * @param {object} constraints 约束配置
 * @return {boolean} 是否满足
 */
export function constraintsSatisfied(group, constraints) {
  const cfg = constraints || {};
  if (cfg.enabled === false) return true;

  if (cfg.oddEven) {
    const label = oddEvenRatio(group.front).label;
    if (!['2:3', '3:2', '4:1', '1:4'].includes(label)) return false;
  }
  if (cfg.bigSmall) {
    const label = bigSmallRatio(group.front).label;
    if (!['2:3', '3:2'].includes(label)) return false;
  }
  if (cfg.sumRange) {
    const min = Math.min(Number(cfg.sumMin), Number(cfg.sumMax));
    const max = Math.max(Number(cfg.sumMin), Number(cfg.sumMax));
    if (Number.isFinite(min) && Number.isFinite(max)) {
      if (group.sum < min || group.sum > max) return false;
    }
  }
  if (cfg.allowConsecutive === false && consecutiveInfo(group.front).hasConsecutive) {
    return false;
  }
  return true;
}

/**
 * 组合键，用于组间去重 / 历史命中查询。
 * @param {number[]} front 前区
 * @param {number[]} back 后区
 * @return {string} 组合键
 */
export function comboKey(front, back) {
  const f = [...(front || [])].map(Number).sort((a, b) => a - b);
  const b = [...(back || [])].map(Number).sort((a, b) => a - b);
  return `${f.join(',')}|${b.join(',')}`;
}

/**
 * 构建历史组合索引（用于判断「该组合历史是否开过」）。
 * @param {Array<object>} draws 开奖数据
 * @return {Map<string, number>} 组合键 -> 出现次数
 */
export function buildHistoryIndex(draws) {
  const index = new Map();
  (Array.isArray(draws) ? draws : []).forEach((draw) => {
    const key = comboKey(draw.front, draw.back);
    index.set(key, (index.get(key) || 0) + 1);
  });
  return index;
}

/**
 * 装饰一组号码，补充展示所需的派生信息。
 * @param {{front: number[], back: number[], relaxed: boolean}} candidate 待装饰组合
 * @param {object} ctx 上下文
 * @return {object} 完整结果组
 */
function decorate(candidate, ctx) {
  const front = [...candidate.front].sort((a, b) => a - b);
  const back = [...candidate.back].sort((a, b) => a - b);
  const key = comboKey(front, back);

  return {
    front,
    back,
    sum: sumOf(front),
    span: spanOf(front),
    oddEven: oddEvenRatio(front),
    bigSmall: bigSmallRatio(front),
    consecutive: consecutiveInfo(front),
    repeatWithLatest: ctx.latest ? repeatCount(ctx.latest.front, front) : 0,
    latestNo: ctx.latest ? ctx.latest.no : '',
    hitHotCount: front.filter((n) => ctx.hotFrontSet.has(n)).length,
    historyCount: ctx.historyIndex.get(key) || 0,
    relaxed: Boolean(candidate.relaxed),
  };
}

/**
 * 生成号码。
 *
 * @param {object} params 参数（见 DEFAULT_PARAMS；必须传入 draws 才能做频率/遗漏加权）
 * @param {number|string} [seed] 随机种子；不传则随机生成，传同一值可复现
 * @return {{groups: Array<object>, warnings: string[], seed: number, frontPool: number[], backPool: number[]}}
 */
export function generateNumbers(params, seed) {
  const p = mergeParams(params);
  const draws = Array.isArray(p.draws) ? p.draws : [];
  const warnings = [];
  const usedSeed = normalizeSeed(seed);
  const rng = mulberry32(usedSeed);

  const pools = buildPools(p);
  pools.warnings.forEach((message) => warnings.push(message));

  const { frontPool, backPool } = pools;
  if (!frontPool.length || !backPool.length) {
    return { groups: [], warnings, seed: usedSeed, frontPool, backPool };
  }

  if (!draws.length) {
    warnings.push('当前没有历史数据，频率/遗漏加权退化为等概率随机。');
  }

  const frontWeights = buildFrontWeights(
    frontPool,
    p.frontWeightMode,
    pools.frontFreq,
    pools.frontOmission,
  );
  const backWeights = backPool.map(() => 1);

  const asc = sortByPeriodAsc(draws);
  const latest = asc.length ? asc[asc.length - 1] : null;
  const historyIndex = buildHistoryIndex(asc);
  const hotFrontSet = new Set(
    [...pools.frontFreq]
      .sort((a, b) => b.count - a.count || a.num - b.num)
      .slice(0, 12)
      .map((item) => item.num),
  );

  const target = clamp(p.count, 1, 20);
  const groups = [];
  const usedKeys = new Set();
  let relaxedCount = 0;

  /**
   * 抽取一个候选组合。
   * @return {{front: number[], back: number[], sum: number} | null} 候选组合
   */
  const sampleCandidate = () => {
    const front = weightedSample(frontPool, frontWeights, 5, rng);
    const back = weightedSample(backPool, backWeights, 2, rng);
    if (front.length < 5 || back.length < 2) return null;
    return { front, back, sum: sumOf(front) };
  };

  for (let i = 0; i < target; i += 1) {
    let chosen = null;

    for (let attempt = 0; attempt < MAX_CONSTRAINT_TRIES; attempt += 1) {
      const candidate = sampleCandidate();
      if (!candidate) break;
      if (usedKeys.has(comboKey(candidate.front, candidate.back))) continue;
      if (!constraintsSatisfied(candidate, p.constraints)) continue;
      chosen = { ...candidate, relaxed: false };
      break;
    }

    if (!chosen) {
      for (let attempt = 0; attempt < MAX_RELAXED_TRIES; attempt += 1) {
        const candidate = sampleCandidate();
        if (!candidate) break;
        if (usedKeys.has(comboKey(candidate.front, candidate.back))) continue;
        chosen = { ...candidate, relaxed: true };
        break;
      }
    }

    if (!chosen) {
      warnings.push('号码池容量不足以生成更多互不重复的组合，已提前结束生成。');
      break;
    }

    if (chosen.relaxed) relaxedCount += 1;
    usedKeys.add(comboKey(chosen.front, chosen.back));
    groups.push(decorate(chosen, { latest, historyIndex, hotFrontSet }));
  }

  if (relaxedCount > 0) {
    warnings.push(
      `${relaxedCount} 组在 ${MAX_CONSTRAINT_TRIES} 次尝试内无法满足全部约束，已放宽为「池内随机 + 组间去重」，对应结果卡片已标注。`,
    );
  }

  return { groups, warnings, seed: usedSeed, frontPool, backPool };
}
