/**
 * 多期批量回测纯逻辑（不依赖 React 与 DOM，可被 vitest 直接 import）。
 *
 * 设计要点：
 *  1. **无未来函数**：回测第 i 期时，只把 `draws[0..i-1]` 交给选号策略，
 *     目标期本身的开奖号码绝不参与选号；频次/遗漏均在该窗口内重新计算。
 *  2. **确定性**：每期的随机种子 = hash(总种子:期号)，同一总种子 + 同一参数 ⇒ 完全相同的回测结果。
 *  3. **对照基准**：同期用「纯等概率随机」生成同样注数，跑多轮取均值，
 *     用两样本 z 检验判断策略命中率与随机是否存在可区分差异。
 *  4. 1 等奖、2 等奖为浮动奖金，回测只统计命中注数、不计金额；
 *     固定奖金额按官方规则：3 等 10000、4 等 3000、5 等 300、6 等 200、7 等 100、8 等 15、9 等 5 元。
 *
 * 免责：回测只描述历史，不预测未来。任何策略在历史上跑出的数字都不代表下一期。
 */

import { generateNumbers, hashSeed, mulberry32, normalizeSeed } from './generator.js';
import { sortByPeriodAsc } from './stats.js';
import { clamp } from './format.js';

/** 单注投注金额（元） */
export const TICKET_PRICE = 2;

/** 奖级定义（fixed 为 null 表示浮动奖金，回测不计金额） */
export const PRIZE_LEVELS = [
  { level: 1, name: '一等奖', condition: '5+2', fixed: null },
  { level: 2, name: '二等奖', condition: '5+1', fixed: null },
  { level: 3, name: '三等奖', condition: '5+0', fixed: 10000 },
  { level: 4, name: '四等奖', condition: '4+2', fixed: 3000 },
  { level: 5, name: '五等奖', condition: '4+1', fixed: 300 },
  { level: 6, name: '六等奖', condition: '3+2', fixed: 200 },
  { level: 7, name: '七等奖', condition: '4+0', fixed: 100 },
  { level: 8, name: '八等奖', condition: '3+1 / 2+2', fixed: 15 },
  { level: 9, name: '九等奖', condition: '3+0 / 2+1 / 1+2 / 0+2', fixed: 5 },
];

/** 命中组合 → 奖级 的索引表 */
const LEVEL_MAP = new Map([
  ['5+2', 1],
  ['5+1', 2],
  ['5+0', 3],
  ['4+2', 4],
  ['4+1', 5],
  ['3+2', 6],
  ['4+0', 7],
  ['3+1', 8],
  ['2+2', 8],
  ['3+0', 9],
  ['2+1', 9],
  ['1+2', 9],
  ['0+2', 9],
]);

/** 奖级编号 → 定义 */
const LEVEL_INFO = new Map(PRIZE_LEVELS.map((item) => [item.level, item]));

/**
 * 根据前区/后区命中个数判定奖级。
 * @param {number} frontHits 前区命中个数（0-5）
 * @param {number} backHits 后区命中个数（0-2）
 * @return {number} 奖级 1-9；未中奖返回 0
 */
export function matchLevel(frontHits, backHits) {
  const f = Number(frontHits);
  const b = Number(backHits);
  if (!Number.isFinite(f) || !Number.isFinite(b)) return 0;
  return LEVEL_MAP.get(`${f}+${b}`) || 0;
}

/**
 * 计算一注号码对某一期的命中情况。
 * @param {{front: number[], back: number[]}} note 号码
 * @param {{front: number[], back: number[]}} draw 开奖号码
 * @return {{frontHits: number, backHits: number, level: number, prize: number}} 命中结果
 */
export function countHits(note, draw) {
  const frontSet = new Set((draw && draw.front) || []);
  const backSet = new Set((draw && draw.back) || []);
  const frontHits = ((note && note.front) || []).filter((n) => frontSet.has(Number(n))).length;
  const backHits = ((note && note.back) || []).filter((n) => backSet.has(Number(n))).length;
  const level = matchLevel(frontHits, backHits);
  const info = LEVEL_INFO.get(level);
  return { frontHits, backHits, level, prize: info && info.fixed ? info.fixed : 0 };
}

/**
 * 标准正态分布的双侧 p 值（Abramowitz-Stegun 7.1.26 erf 近似）。
 * @param {number} z z 统计量
 * @return {number} 双侧 p 值
 */
export function normalTwoSidedP(z) {
  const value = Number(z);
  if (!Number.isFinite(value)) return 1;
  // 双侧 p = 1 - erf(|z| / √2)，注意必须除以 √2（单侧 Φ(z) 的自变量是 z/√2）
  const ax = Math.abs(value) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-ax * ax);
  // 注意：不能复用 format.clamp，它对输入做了整数截断，会把 0<p<1 的 p 值压成 0
  return Math.min(1, Math.max(0, 1 - erf));
}

/**
 * 等概率随机抽取 k 个互不重复的号码（1..max）。
 * @param {number} max 号码上界
 * @param {number} k 抽取个数
 * @param {() => number} rng 随机数函数
 * @return {number[]} 升序号码
 */
function pickUniform(max, k, rng) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  const need = Math.min(k, max);
  for (let i = 0; i < need; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, need).sort((a, b) => a - b);
}

/**
 * 计算样本均值与样本标准差。
 * @param {number} sum 总和
 * @param {number} sqSum 平方和
 * @param {number} n 样本量
 * @return {{mean: number, sd: number}} 统计量
 */
function meanSd(sum, sqSum, n) {
  if (!n) return { mean: 0, sd: 0 };
  const mean = sum / n;
  const variance = n > 1 ? Math.max(0, (sqSum - n * mean * mean) / (n - 1)) : 0;
  return { mean, sd: Math.sqrt(variance) };
}

/**
 * 纯随机基准：同期、同注数、等概率选号，跑多轮取均值。
 * @param {Array<object>} draws 升序开奖数据
 * @param {number} startIndex 起始下标（含）
 * @param {number} notesPerDraw 每期注数
 * @param {number} runs 轮数
 * @param {number} seed 基础种子
 * @return {object} 基准指标
 */
export function runUniformBaseline(draws, startIndex, notesPerDraw, runs, seed) {
  const totalNotes = Math.max(0, (draws.length - startIndex) * notesPerDraw);
  if (!runs || totalNotes === 0) {
    return {
      runs: 0,
      totalNotes: 0,
      avgFrontHits: 0,
      avgBackHits: 0,
      winNotes: 0,
      cost: 0,
      prize: 0,
      roi: 0,
      perRunFront: [],
    };
  }

  const perRunFront = [];
  let frontSum = 0;
  let frontSqSum = 0;
  let backSum = 0;
  let backSqSum = 0;
  let winNotes = 0;
  let prize = 0;
  let noteCount = 0;

  for (let run = 0; run < runs; run += 1) {
    const rng = mulberry32((seed + run * 7919) >>> 0);
    let runFront = 0;
    let runNotes = 0;

    for (let i = startIndex; i < draws.length; i += 1) {
      const draw = draws[i];
      for (let k = 0; k < notesPerDraw; k += 1) {
        const note = { front: pickUniform(35, 5, rng), back: pickUniform(12, 2, rng) };
        const hit = countHits(note, draw);
        frontSum += hit.frontHits;
        frontSqSum += hit.frontHits * hit.frontHits;
        backSum += hit.backHits;
        backSqSum += hit.backHits * hit.backHits;
        if (hit.level >= 1) winNotes += 1;
        prize += hit.prize;
        noteCount += 1;
        runFront += hit.frontHits;
        runNotes += 1;
      }
    }
    if (runNotes) perRunFront.push(runFront / runNotes);
  }

  const front = meanSd(frontSum, frontSqSum, noteCount);
  const back = meanSd(backSum, backSqSum, noteCount);

  return {
    runs,
    totalNotes: noteCount,
    avgFrontHits: front.mean,
    avgBackHits: back.mean,
    winNotes,
    cost: noteCount * TICKET_PRICE,
    prize,
    roi: noteCount ? prize / (noteCount * TICKET_PRICE) : 0,
    perRunFront,
  };
}

/**
 * 执行多期批量回测。
 *
 * @param {object} params 选号参数（与 generateNumbers 同构，必须含 draws）
 * @param {object} [options] 回测选项
 * @param {number} [options.periods=100] 回测期数（从最新一期往前）
 * @param {number} [options.notes=5] 每期注数
 * @param {number|string} [options.seed='dlt-backtest'] 随机种子
 * @param {number} [options.baselineRuns=10] 随机基准轮数，0 表示不算
 * @return {object} 回测结果
 */
export function runBacktest(params, options = {}) {
  const startAt = Date.now();
  const draws = sortByPeriodAsc((params && params.draws) || []);
  const total = draws.length;

  const base = {
    drawCount: total,
    periods: 0,
    notesPerDraw: 0,
    totalNotes: 0,
    cost: 0,
    fixedPrize: 0,
    roi: 0,
    avgFrontHits: 0,
    avgBackHits: 0,
    winNotes: 0,
    levelCounts: PRIZE_LEVELS.map((item) => ({ ...item, count: 0, amount: 0 })),
    rows: [],
    baseline: {
      runs: 0,
      totalNotes: 0,
      avgFrontHits: 0,
      avgBackHits: 0,
      winNotes: 0,
      cost: 0,
      prize: 0,
      roi: 0,
      perRunFront: [],
    },
    comparison: { zFront: 0, pFront: 1, zBack: 0, pBack: 1, significant: false, conclusion: '' },
    seed: normalizeSeed(options.seed === undefined ? 'dlt-backtest' : options.seed),
    elapsedMs: 0,
    warnings: [],
  };

  if (total < 2) {
    return {
      ...base,
      warnings: ['历史数据不足 2 期，无法回测（第 1 期没有可用的历史窗口）。'],
      elapsedMs: Date.now() - startAt,
    };
  }

  const maxPeriods = total - 1;
  const periods = clamp(Math.trunc(Number(options.periods) || 100), 1, maxPeriods);
  const notesPerDraw = clamp(Math.trunc(Number(options.notes) || 5), 1, 10);
  const baselineRuns = clamp(Math.trunc(Number(options.baselineRuns ?? 10)), 0, 20);
  const startIndex = total - periods;

  const levelCounts = PRIZE_LEVELS.map((item) => ({ ...item, count: 0, amount: 0 }));
  const rows = [];
  const warnings = [];

  let totalNotes = 0;
  let fixedPrize = 0;
  let winNotes = 0;
  let frontSum = 0;
  let frontSqSum = 0;
  let backSum = 0;
  let backSqSum = 0;
  let cumCost = 0;
  let cumPrize = 0;
  let seedBudgetShort = 0;

  for (let i = startIndex; i < total; i += 1) {
    const draw = draws[i];
    const history = draws.slice(0, i);
    const drawSeed = hashSeed(`${base.seed}:${draw.no}`);

    const generated = generateNumbers({ ...params, draws: history, count: notesPerDraw }, drawSeed);

    let drawPrize = 0;
    let best = { level: 0, frontHits: 0, backHits: 0, note: null };
    let drawFront = 0;
    let drawBack = 0;
    let drawNotes = 0;

    generated.groups.forEach((group) => {
      const hit = countHits(group, draw);
      drawFront += hit.frontHits;
      drawBack += hit.backHits;
      drawPrize += hit.prize;
      frontSum += hit.frontHits;
      frontSqSum += hit.frontHits * hit.frontHits;
      backSum += hit.backHits;
      backSqSum += hit.backHits * hit.backHits;
      totalNotes += 1;
      drawNotes += 1;
      if (hit.level >= 1) {
        winNotes += 1;
        levelCounts[hit.level - 1].count += 1;
        levelCounts[hit.level - 1].amount += hit.prize;
      }
      if (hit.level > 0 && hit.level < (best.level || 99)) {
        best = { ...hit, note: { front: group.front, back: group.back } };
      } else if (!best.note) {
        best = { ...hit, note: { front: group.front, back: group.back } };
      }
    });

    if (drawNotes < notesPerDraw) seedBudgetShort += 1;

    cumCost += drawNotes * TICKET_PRICE;
    cumPrize += drawPrize;
    fixedPrize += drawPrize;

    rows.push({
      no: draw.no,
      date: draw.date,
      actual: { front: draw.front, back: draw.back },
      notes: drawNotes,
      bestLevel: best.level,
      bestLevelName: best.level ? LEVEL_INFO.get(best.level).name : '',
      bestFrontHits: best.frontHits,
      bestBackHits: best.backHits,
      bestNote: best.note,
      prize: drawPrize,
      cumCost,
      cumPrize,
      profit: cumPrize - cumCost,
    });
  }

  if (seedBudgetShort > 0) {
    warnings.push(
      `有 ${seedBudgetShort} 期未能按设定注数生成足量号码（号码池容量不足），这些期按实际注数计入。`,
    );
  }

  const front = meanSd(frontSum, frontSqSum, totalNotes);
  const back = meanSd(backSum, backSqSum, totalNotes);

  const baseline = baselineRuns
    ? runUniformBaseline(draws, startIndex, notesPerDraw, baselineRuns, base.seed)
    : base.baseline;

  let comparison = base.comparison;
  if (baseline.totalNotes > 0 && totalNotes > 0) {
    // 策略侧：单注前区命中的标准误
    const seFront = front.sd / Math.sqrt(totalNotes);
    // 基准方差由逐注数据不可得，改用每轮均值估计：sd(perRunFront)/sqrt(runs) 为轮均值标准误，
    // 再折算为单注口径（除以 sqrt(每期注数)）与策略单注标准误合并。
    const perRun = baseline.perRunFront;
    const runMean = perRun.length ? perRun.reduce((a, b) => a + b, 0) / perRun.length : 0;
    const runVar =
      perRun.length > 1
        ? perRun.reduce((a, b) => a + (b - runMean) * (b - runMean), 0) / (perRun.length - 1)
        : 0;
    const baselineNoteSe = perRun.length
      ? Math.sqrt(runVar / perRun.length) / Math.sqrt(notesPerDraw)
      : 0;
    const zFront =
      baselineNoteSe + seFront > 0
        ? (front.mean - baseline.avgFrontHits) /
          Math.sqrt(seFront * seFront + baselineNoteSe * baselineNoteSe)
        : 0;

    // 后区命中均值固定为 2*2/12=0.333，用策略侧单注标准误做单样本检验即可
    const expectedBack = (2 * 2) / 12;
    const seBack = back.sd / Math.sqrt(totalNotes);
    const zBack = seBack > 0 ? (back.mean - expectedBack) / seBack : 0;

    const pFront = normalTwoSidedP(zFront);
    const pBack = normalTwoSidedP(zBack);
    const significant = pFront < 0.05;

    comparison = {
      zFront,
      pFront,
      zBack,
      pBack,
      significant,
      conclusion: significant
        ? `前区平均命中与纯随机基准的差异达到统计显著（z=${zFront.toFixed(2)}，p=${pFront.toFixed(4)}）。注意：这通常来自多重比较或样本内挑选，换一段时期很可能消失，不能据此认为策略有效。`
        : `前区平均命中与纯随机基准无显著差异（z=${zFront.toFixed(2)}，p=${pFront.toFixed(4)}）。这与"每期独立随机"的理论预期一致——策略并不能提高命中率。`,
    };
  }

  return {
    drawCount: total,
    periods,
    notesPerDraw,
    totalNotes,
    cost: totalNotes * TICKET_PRICE,
    fixedPrize,
    roi: totalNotes ? fixedPrize / (totalNotes * TICKET_PRICE) : 0,
    avgFrontHits: front.mean,
    avgBackHits: back.mean,
    winNotes,
    levelCounts,
    rows,
    baseline,
    comparison,
    seed: base.seed,
    elapsedMs: Date.now() - startAt,
    warnings,
  };
}
