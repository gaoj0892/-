import { describe, expect, it } from 'vitest';
import {
  TICKET_PRICE,
  countHits,
  matchLevel,
  normalTwoSidedP,
  runBacktest,
  runUniformBaseline,
} from './backtest.js';

/**
 * 构造 n 期合法的合成开奖数据（升序，号码互不重复）。
 * @param {number} n 期数
 * @return {Array<object>} 开奖数据
 */
function makeDraws(n) {
  const draws = [];
  for (let i = 1; i <= n; i += 1) {
    const offset = (i - 1) * 3;
    const front = [0, 1, 2, 3, 4].map((k) => ((offset + k * 2) % 35) + 1);
    const back = [((i - 1) % 12) + 1, (((i - 1) % 12) + 7) % 12 + 1];
    // 日期必须单调递增：sortByPeriodAsc 先按 date 排序，日期乱序会把数组顺序打乱
    const day = new Date(Date.UTC(2020, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    draws.push({
      no: String(i).padStart(5, '0'),
      date: day,
      front,
      back,
    });
  }
  return draws;
}

/** 基础参数 */
const BASE_PARAMS = {
  count: 3,
  frontPoolMode: 'all',
  frontWeightMode: 'uniform',
  backPoolMode: 'all',
  excludeFront: [],
  excludeBack: [],
  constraints: { enabled: false },
};

describe('matchLevel 奖级判定', () => {
  it('覆盖全部 9 个奖级与未中奖', () => {
    expect(matchLevel(5, 2)).toBe(1);
    expect(matchLevel(5, 1)).toBe(2);
    expect(matchLevel(5, 0)).toBe(3);
    expect(matchLevel(4, 2)).toBe(4);
    expect(matchLevel(4, 1)).toBe(5);
    expect(matchLevel(3, 2)).toBe(6);
    expect(matchLevel(4, 0)).toBe(7);
    expect(matchLevel(3, 1)).toBe(8);
    expect(matchLevel(2, 2)).toBe(8);
    expect(matchLevel(3, 0)).toBe(9);
    expect(matchLevel(2, 1)).toBe(9);
    expect(matchLevel(1, 2)).toBe(9);
    expect(matchLevel(0, 2)).toBe(9);
  });

  it('未中奖与非法输入返回 0', () => {
    expect(matchLevel(2, 0)).toBe(0);
    expect(matchLevel(0, 0)).toBe(0);
    expect(matchLevel(NaN, 2)).toBe(0);
    expect(matchLevel(undefined, undefined)).toBe(0);
  });
});

describe('countHits 命中计算', () => {
  it('逐个数正确', () => {
    const hit = countHits({ front: [1, 2, 3, 4, 5], back: [1, 2] }, { front: [1, 2, 3, 10, 11], back: [1, 5] });
    expect(hit.frontHits).toBe(3);
    expect(hit.backHits).toBe(1);
    expect(hit.level).toBe(8);
    expect(hit.prize).toBe(15);
  });

  it('全中为一等奖且浮动奖金不计金额', () => {
    const hit = countHits({ front: [1, 2, 3, 4, 5], back: [1, 2] }, { front: [1, 2, 3, 4, 5], back: [1, 2] });
    expect(hit.level).toBe(1);
    expect(hit.prize).toBe(0);
  });

  it('容错空值', () => {
    expect(countHits({}, {}).frontHits).toBe(0);
    expect(countHits(null, null).level).toBe(0);
  });
});

describe('normalTwoSidedP', () => {
  it('0 处为 1，1.96 处约 0.05，大值趋于 0', () => {
    expect(normalTwoSidedP(0)).toBeCloseTo(1, 6);
    expect(normalTwoSidedP(1.96)).toBeGreaterThan(0.045);
    expect(normalTwoSidedP(1.96)).toBeLessThan(0.055);
    expect(normalTwoSidedP(6)).toBeLessThan(1e-6);
  });

  it('单调递减且对称', () => {
    expect(normalTwoSidedP(1)).toBeGreaterThan(normalTwoSidedP(2));
    expect(normalTwoSidedP(-2)).toBeCloseTo(normalTwoSidedP(2), 12);
  });
});

describe('runBacktest 回测主流程', () => {
  const draws = makeDraws(30);

  it('回测期数、注数、成本计算正确', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 10, notes: 3, seed: 'unit', baselineRuns: 2 });
    expect(result.periods).toBe(10);
    expect(result.notesPerDraw).toBe(3);
    expect(result.rows).toHaveLength(10);
    expect(result.totalNotes).toBe(30);
    expect(result.cost).toBe(30 * TICKET_PRICE);
    expect(result.baseline.totalNotes).toBe(10 * 3 * 2);
  });

  it('无未来函数：首个回测期从 data.length - periods 开始，且只使用此前数据', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 10, notes: 2, seed: 'no-lookahead', baselineRuns: 0 });
    expect(result.rows[0].no).toBe(draws[20].no);
    expect(result.rows[9].no).toBe(draws[29].no);
    // 同一期内，使用不同历史窗口会得到不同号码，说明历史切片确实参与了选号
    const withFull = runBacktest({ ...BASE_PARAMS, draws }, { periods: 1, notes: 1, seed: 'x', baselineRuns: 0 });
    expect(withFull.rows).toHaveLength(1);
    expect(withFull.rows[0].no).toBe(draws[29].no);
  });

  it('同种子可复现，不同种子结果不同', () => {
    const a = runBacktest({ ...BASE_PARAMS, draws }, { periods: 8, notes: 3, seed: 'same', baselineRuns: 0 });
    const b = runBacktest({ ...BASE_PARAMS, draws }, { periods: 8, notes: 3, seed: 'same', baselineRuns: 0 });
    const c = runBacktest({ ...BASE_PARAMS, draws }, { periods: 8, notes: 3, seed: 'other', baselineRuns: 0 });
    const keyOf = (r) => r.rows.map((row) => row.bestNote.front.join(',')).join('|');
    expect(keyOf(a)).toBe(keyOf(b));
    expect(keyOf(a)).not.toBe(keyOf(c));
    expect(a.avgFrontHits).toBe(b.avgFrontHits);
  });

  it('累计成本与累计奖金单调，末项等于汇总值', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 6, notes: 2, seed: 'cum', baselineRuns: 0 });
    let prevCost = 0;
    result.rows.forEach((row) => {
      expect(row.cumCost).toBeGreaterThan(prevCost);
      expect(row.cumPrize).toBeGreaterThanOrEqual(0);
      prevCost = row.cumCost;
    });
    expect(result.rows[result.rows.length - 1].cumCost).toBe(result.cost);
    expect(result.rows[result.rows.length - 1].cumPrize).toBe(result.fixedPrize);
  });

  it('奖级统计与明细一致', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 6, notes: 5, seed: 'levels', baselineRuns: 0 });
    const countSum = result.levelCounts.reduce((sum, item) => sum + item.count, 0);
    expect(countSum).toBe(result.winNotes);
    const amountSum = result.levelCounts.reduce((sum, item) => sum + item.amount, 0);
    expect(amountSum).toBe(result.fixedPrize);
  });

  it('期数超界会被夹取，注数超界会被夹取', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 999, notes: 99, seed: 'clamp', baselineRuns: 0 });
    expect(result.periods).toBe(29);
    expect(result.notesPerDraw).toBe(10);
    expect(result.rows).toHaveLength(29);
  });

  it('数据不足 2 期时给出警告且不抛异常', () => {
    const empty = runBacktest({ ...BASE_PARAMS, draws: [] }, { periods: 10, notes: 3 });
    expect(empty.rows).toHaveLength(0);
    expect(empty.totalNotes).toBe(0);
    expect(empty.cost).toBe(0);
    expect(empty.warnings.length).toBeGreaterThan(0);

    const one = runBacktest({ ...BASE_PARAMS, draws: makeDraws(1) }, { periods: 10, notes: 3 });
    expect(one.rows).toHaveLength(0);
    expect(one.warnings.length).toBeGreaterThan(0);
  });

  it('排除号码在整个回测中绝不出现', () => {
    const params = { ...BASE_PARAMS, draws, excludeFront: [1, 2, 3, 4, 5, 6], excludeBack: [1, 2] };
    const result = runBacktest(params, { periods: 10, notes: 3, seed: 'exclude', baselineRuns: 0 });
    result.rows.forEach((row) => {
      row.bestNote.front.forEach((n) => expect(params.excludeFront).not.toContain(n));
      row.bestNote.back.forEach((n) => expect(params.excludeBack).not.toContain(n));
    });
  });

  it('对比结论字段完整且 p 值在 [0,1]', () => {
    const result = runBacktest({ ...BASE_PARAMS, draws }, { periods: 10, notes: 3, seed: 'cmp', baselineRuns: 5 });
    expect(result.comparison.pFront).toBeGreaterThanOrEqual(0);
    expect(result.comparison.pFront).toBeLessThanOrEqual(1);
    expect(typeof result.comparison.conclusion).toBe('string');
    expect(result.comparison.conclusion.length).toBeGreaterThan(10);
    expect(result.baseline.avgFrontHits).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

describe('runUniformBaseline', () => {
  it('注数与成本规模正确，且命中均值接近理论值 0.714', () => {
    const draws = makeDraws(50);
    const baseline = runUniformBaseline(draws, 30, 10, 20, 12345);
    expect(baseline.totalNotes).toBe(20 * 10 * 20);
    expect(baseline.cost).toBe(baseline.totalNotes * TICKET_PRICE);
    // 20 轮 × 200 注，均值应落在理论值附近（宽松区间，避免偶然失败）
    expect(baseline.avgFrontHits).toBeGreaterThan(0.5);
    expect(baseline.avgFrontHits).toBeLessThan(0.95);
    expect(baseline.perRunFront).toHaveLength(20);
  });

  it('runs=0 时返回全零', () => {
    const baseline = runUniformBaseline(makeDraws(10), 5, 5, 0, 1);
    expect(baseline.runs).toBe(0);
    expect(baseline.totalNotes).toBe(0);
    expect(baseline.roi).toBe(0);
  });
});
