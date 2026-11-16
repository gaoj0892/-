/**
 * QA 独立验收测试（Edward）。
 *
 * 与工程师的 lib.test.js 相互独立：
 *  - 全部断言基于手工计算的小样本或已交叉验证过的全量基准值；
 *  - 重点覆盖边界、错误路径与约束不可行等「容易被漏测」的场景；
 *  - 不修改任何业务源码。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  isRealDate,
  normalizeNo,
  validateDraw,
  parseDrawText,
  parseDrawJson,
  parseDrawFile,
  drawsToCsv,
  sortUnique,
} from '@/lib/parse.js';

import {
  frequency,
  omissionStats,
  sumSeries,
  oddEvenRatio,
  bigSmallRatio,
  zoneDistribution,
  consecutiveInfo,
  repeatCount,
  chiSquarePValue,
  chiSquareTest,
  hotColdLists,
  subsetByRange,
  sortByPeriodAsc,
} from '@/lib/stats.js';

import {
  mulberry32,
  hashSeed,
  weightedSample,
  buildPools,
  constraintsSatisfied,
  generateNumbers,
} from '@/lib/generator.js';

import {
  loadDraws,
  saveDraws,
  loadMeta,
  saveMeta,
  clearAll,
  getSetting,
  setSetting,
  hasLocalStorage,
} from '@/lib/storage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(HERE, '../../src/data/dlt_history.json');
const SEED = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
const SEED_DRAWS = sortByPeriodAsc(SEED.draws);

/** 构造一行 TXT 数据（工具） */
function line(...fields) {
  return fields.join('\t');
}

// ===========================================================================
describe('B. 种子数据完整性（与 Python 独立核对结果对齐）', () => {
  it('期数与期号范围', () => {
    expect(SEED_DRAWS.length).toBe(2941);
    expect(SEED_DRAWS[0].no).toBe('07001');
    expect(SEED_DRAWS[2940].no).toBe('26123');
    expect(new Set(SEED_DRAWS.map((d) => d.no)).size).toBe(2941);
  });

  it('每期号码、日期均合规，且日期严格递增', () => {
    const bad = [];
    SEED_DRAWS.forEach((d) => {
      const frontOk =
        d.front.length === 5 &&
        new Set(d.front).size === 5 &&
        d.front.every((n) => n >= 1 && n <= 35);
      const backOk =
        d.back.length === 2 && new Set(d.back).size === 2 && d.back.every((n) => n >= 1 && n <= 12);
      const dateOk = isRealDate(...d.date.split('-').map(Number));
      if (!frontOk || !backOk || !dateOk || !/^\d{5}$/.test(d.no)) bad.push(d.no);
    });
    expect(bad).toEqual([]);
    const dateSeq = SEED_DRAWS.map((d) => d.date);
    const nonIncreasing = dateSeq.filter((v, i) => i > 0 && !(v > dateSeq[i - 1]));
    expect(nonIncreasing).toEqual([]);
  });

  it('全量基准值：前区合计 14705 次、χ²≈89.35、和值均值≈91.71、连号占比≈49.74%', () => {
    const frontFreq = frequency(SEED_DRAWS, 'front');
    const totalFront = frontFreq.reduce((acc, f) => acc + f.count, 0);
    expect(totalFront).toBe(14705);

    const frontChi = chiSquareTest(SEED_DRAWS, 'front');
    expect(frontChi.df).toBe(34);
    expect(frontChi.chi2).toBeCloseTo(89.35, 1);

    const sumMean = sumSeries(SEED_DRAWS).reduce((acc, s) => acc + s.sum, 0) / SEED_DRAWS.length;
    expect(sumMean).toBeCloseTo(91.71, 1);

    const consecutivePeriods = SEED_DRAWS.filter(
      (d) => consecutiveInfo(d.front).hasConsecutive,
    ).length;
    expect((consecutivePeriods / SEED_DRAWS.length) * 100).toBeCloseTo(49.74, 1);

    const backChi = chiSquareTest(SEED_DRAWS, 'back');
    expect(backChi.df).toBe(11);
    expect(backChi.chi2).toBeCloseTo(10.27, 1);
    expect(backChi.p).toBeCloseTo(0.5063, 3);
  });

  it('最热 / 最冷号码：29 最热（503 次）、16 最冷（358 次）', () => {
    const freq = frequency(SEED_DRAWS, 'front');
    const { hot, cold } = hotColdLists(freq, 1, 1);
    expect(hot[0].num).toBe(29);
    expect(hot[0].count).toBe(503);
    expect(cold[0].num).toBe(16);
    expect(cold[0].count).toBe(358);
  });
});

// ===========================================================================
describe('C-5. parse：分隔符 / 表头 / 错误隔离 / 前导零 / 去重', () => {
  it('Tab、逗号、分号、多空格四种分隔符均可解析', () => {
    const cases = [
      line('07001', '2007-05-30', '22', '24', '29', '31', '35', '04', '11'),
      '07002,2007-06-02,01,02,03,04,05,06,07',
      '07003;2007-06-04;11;12;13;14;15;08;09',
      '07004    2007-06-06    21 22 23 24 25  10 11',
    ];
    cases.forEach((text, index) => {
      const { draws, errors } = parseDrawText(text);
      expect(errors, `case ${index} errors: ${JSON.stringify(errors)}`).toEqual([]);
      expect(draws).toHaveLength(1);
      expect(draws[0].no).toBe(`0700${index + 1}`);
      expect(draws[0].front).toHaveLength(5);
      expect(draws[0].back).toHaveLength(2);
      expect(draws[0].front).toEqual([...draws[0].front].sort((a, b) => a - b));
    });
  });

  it('带表头行时自动跳过表头、不产生错误', () => {
    const text = [
      line('期号', '开奖日期', '前区1', '前区2', '前区3', '前区4', '前区5', '后区1', '后区2'),
      line('07001', '2007-05-30', '22', '24', '29', '31', '35', '04', '11'),
      '# 这是注释行，应被忽略',
      line('07002', '2007-06-02', '01', '02', '03', '04', '05', '06', '07'),
    ].join('\n');
    const { draws, errors } = parseDrawText(text);
    expect(errors).toEqual([]);
    expect(draws.map((d) => d.no)).toEqual(['07001', '07002']);
  });

  it('错误行被隔离，不影响其余有效行', () => {
    const text = [
      line('07001', '2007-05-30', '22', '24', '29', '31', '35', '04', '11'), // 有效
      '07002,2007-06-02,01,01,03,04,05,06,07', // 前区重复
      '07003,2007-06-04,11,12,13,14,15,08,13', // 后区 13 越界
      '07005,2020-02-30,01,02,03,04,05,06,07', // 日期不存在
      line('07006', '2007-06-12', '21', '22', '23', '24', '25', '10', '11'), // 有效
    ].join('\n');
    const { draws, errors } = parseDrawText(text);
    expect(draws.map((d) => d.no)).toEqual(['07001', '07006']);
    expect(errors).toHaveLength(3);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(errors[0].reason).toContain('重复');
    expect(errors[1].reason).toContain('后区');
    expect(errors[2].reason).toContain('日期');
  });

  it('前导零：number 7001 补零为 07001；4 位字符串期号按「不静默修正」策略报错；26123 不变', () => {
    const okRaw = {
      date: '2007-05-30',
      front: [22, 24, 29, 31, 35],
      back: [4, 11],
    };
    expect(normalizeNo(7001)).toBe('07001');
    const asNumber = validateDraw({ ...okRaw, no: 7001 });
    expect(asNumber.ok).toBe(true);
    expect(asNumber.draw.no).toBe('07001');

    expect(normalizeNo('7001')).toBe('7001'); // 字符串不补零
    const asShortString = validateDraw({ ...okRaw, no: '7001' });
    expect(asShortString.ok).toBe(false);
    expect(asShortString.reason).toContain('5 位');

    expect(normalizeNo('26123')).toBe('26123');
    expect(validateDraw({ ...okRaw, no: '26123' }).draw.no).toBe('26123');

    // TXT 行里的 4 位期号（Excel 丢前导零场景）会被补零接受
    const parsed = parseDrawText('7001,2007-05-30,22,24,29,31,35,04,11');
    expect(parsed.draws).toHaveLength(1);
    expect(parsed.draws[0].no).toBe('07001');
  });

  it('sortUnique 对数字去重并升序', () => {
    expect(sortUnique([3, 1, 2, 3, 1, 35, 4])).toEqual([1, 2, 3, 4, 35]);
    expect(sortUnique([])).toEqual([]);
  });

  it('期号去重（保留首条）：TXT 与 JSON 两条路径都保留第一条', () => {
    const text = [
      line('07001', '2007-05-30', '22', '24', '29', '31', '35', '04', '11'),
      line('07001', '2007-05-31', '01', '02', '03', '04', '05', '06', '07'),
    ].join('\n');
    const txt = parseDrawText(text);
    expect(txt.draws).toHaveLength(1);
    expect(txt.draws[0].date).toBe('2007-05-30');
    expect(txt.errors).toHaveLength(1);
    expect(txt.errors[0].reason).toContain('重复');

    const json = parseDrawJson([
      { no: '07001', date: '2007-05-30', front: [22, 24, 29, 31, 35], back: [4, 11] },
      { no: '07001', date: '2007-05-31', front: [1, 2, 3, 4, 5], back: [6, 7] },
    ]);
    expect(json.draws).toHaveLength(1);
    expect(json.draws[0].date).toBe('2007-05-30');
    expect(json.errors).toHaveLength(1);
  });

  it('JSON / 空文本 / 坏 JSON 的降级行为', () => {
    expect(parseDrawText('')).toEqual({
      draws: [],
      errors: [{ line: 0, raw: '', reason: '文件内容为空或无法读取' }],
    });
    expect(parseDrawJson({ foo: 1 }).errors).toHaveLength(1);
    const broken = parseDrawFile('{oops', 'x.json');
    expect(broken.draws).toEqual([]);
    expect(broken.errors[0].reason).toContain('JSON 解析失败');
  });

  it('drawsToCsv 保留表头与两位补零', () => {
    const csv = drawsToCsv([
      { no: '07001', date: '2007-05-30', front: [1, 2, 3, 4, 35], back: [4, 11] },
    ]);
    const rows = csv.split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('期号');
    expect(rows[1]).toBe('07001,2007-05-30,01,02,03,04,35,04,11');
  });
});

// ===========================================================================
describe('C-6. stats：手工小样本逐值断言', () => {
  // 3 期固定数据（日期必须递增，函数内部按日期排序）
  const DRAWS = [
    { no: '19001', date: '2019-01-01', front: [1, 2, 3, 4, 5], back: [1, 2] },
    { no: '19002', date: '2019-01-03', front: [6, 7, 8, 9, 10], back: [3, 4] },
    { no: '19003', date: '2019-01-05', front: [1, 11, 12, 13, 14], back: [1, 5] },
  ];

  it('frequency：逐号频次与理论期望', () => {
    const freq = frequency(DRAWS, 'front');
    expect(freq).toHaveLength(35);
    expect(freq[0]).toMatchObject({ num: 1, count: 2 });
    expect(freq[1].count).toBe(1); // 2
    expect(freq[13].count).toBe(1); // 14
    expect(freq[14].count).toBe(0); // 15 未出现
    expect(freq[34].count).toBe(0); // 35 未出现
    expect(freq[0].expected).toBeCloseTo((3 * 5) / 35, 10);
    expect(freq.reduce((a, f) => a + f.count, 0)).toBe(15);
  });

  it('omissionStats：当前遗漏 / 最大遗漏 逐值断言', () => {
    const om = omissionStats(DRAWS, 'front');
    const byNum = new Map(om.map((o) => [o.num, o]));
    expect(byNum.get(1)).toMatchObject({ count: 2, current: 0, max: 1 });
    expect(byNum.get(2)).toMatchObject({ count: 1, current: 2, max: 2 });
    expect(byNum.get(5)).toMatchObject({ count: 1, current: 2, max: 2 });
    // 11 只在最后一期出现：当前遗漏 0，但首次出现前已连续遗漏 2 期
    expect(byNum.get(11)).toMatchObject({ count: 1, current: 0, max: 2 });
    expect(byNum.get(15)).toMatchObject({ count: 0, current: 3, max: 3 });
    expect(byNum.get(1).lastNo).toBe('19003');
  });

  it('sumSeries：和值序列', () => {
    expect(sumSeries(DRAWS).map((s) => s.sum)).toEqual([15, 40, 51]);
  });

  it('chiSquarePValue(34, 34)≈0.47；随 x 单调递减；x=0 返回 1', () => {
    const p = chiSquarePValue(34, 34);
    expect(p).toBeGreaterThan(0.37);
    expect(p).toBeLessThan(0.57);

    // x 极小时 p 被夹在 1 上界（饱和），从 x=2 起应严格单调递减
    expect(chiSquarePValue(0.5, 34)).toBe(1);
    expect(chiSquarePValue(1, 34)).toBe(1);
    const xs = [2, 4, 5, 8, 10, 20, 34, 50, 80, 120, 200, 400, 800];
    const ps = xs.map((x) => chiSquarePValue(x, 34));
    ps.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
    for (let i = 1; i < ps.length; i += 1) {
      expect(ps[i], `x=${xs[i]} p=${ps[i]} 应小于 x=${xs[i - 1]} p=${ps[i - 1]}`).toBeLessThan(
        ps[i - 1],
      );
    }

    expect(chiSquarePValue(0, 34)).toBe(1);
    expect(chiSquarePValue(-5, 34)).toBe(1);
    expect(chiSquarePValue(34, 0)).toBe(1);
    expect(chiSquarePValue(Number.NaN, 34)).toBe(1);
  });

  it('consecutiveInfo / repeatCount', () => {
    const info = consecutiveInfo([1, 2, 3, 10, 11]);
    expect(info.hasConsecutive).toBe(true);
    expect(info.pairs).toEqual([
      [1, 2],
      [2, 3],
      [10, 11],
    ]);
    expect(info.maxRun).toBe(3);
    expect(info.count).toBe(3);

    expect(consecutiveInfo([1, 3, 5, 7, 9]).hasConsecutive).toBe(false);
    expect(consecutiveInfo([1, 3, 5, 7, 9]).maxRun).toBe(1);
    expect(consecutiveInfo([])).toMatchObject({ hasConsecutive: false, maxRun: 0, count: 0 });

    expect(repeatCount([1, 2, 3, 4, 5], [5, 6, 7, 8, 9])).toBe(1);
    expect(repeatCount([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBe(5);
    expect(repeatCount([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])).toBe(0);
    // 含重复元素时只计一次（Set 语义）
    expect(repeatCount([5, 5, 5, 5, 5], [5, 6, 7, 8, 9])).toBe(1);
  });

  it('oddEvenRatio / bigSmallRatio / zoneDistribution 合计均为 5', () => {
    const fronts = [
      [1, 2, 3, 4, 5],
      [7, 14, 21, 28, 35],
      [18, 19, 20, 34, 33],
      [2, 8, 15, 22, 29],
    ];
    fronts.forEach((front) => {
      const oddEven = oddEvenRatio(front);
      expect(oddEven.odd + oddEven.even).toBe(5);
      expect(oddEven.label).toBe(`${oddEven.odd}:${oddEven.even}`);

      const bigSmall = bigSmallRatio(front);
      expect(bigSmall.small + bigSmall.big).toBe(5);
      expect(bigSmall.label).toBe(`${bigSmall.small}:${bigSmall.big}`);

      const zones = zoneDistribution(front);
      expect(zones).toHaveLength(5);
      expect(zones.reduce((a, b) => a + b, 0)).toBe(5);
    });

    expect(oddEvenRatio([1, 3, 5, 7, 9])).toMatchObject({ odd: 5, even: 0 });
    expect(bigSmallRatio([1, 17, 18, 34, 35])).toMatchObject({ small: 2, big: 3 });
    expect(zoneDistribution([1, 7, 8, 29, 35])).toEqual([2, 1, 0, 0, 2]);
  });

  it('subsetByRange：按期数取最近 N 期（升序返回）', () => {
    expect(subsetByRange(DRAWS, 2).map((d) => d.no)).toEqual(['19002', '19003']);
    expect(subsetByRange(DRAWS, 'all')).toHaveLength(3);
    expect(subsetByRange(DRAWS, 99)).toHaveLength(3);
    expect(subsetByRange(DRAWS, 0)).toHaveLength(3);
    // 入参倒序也能正确排序
    expect(subsetByRange([...DRAWS].reverse(), 1).map((d) => d.no)).toEqual(['19003']);
  });
});

// ===========================================================================
describe('C-7. generator：可复现性 / 合法性 / 约束压力 / 权重', () => {
  const baseParams = { draws: SEED_DRAWS, count: 5 };

  it('同 seed + 同参数 ⇒ 完全一致（连跑 3 次）', () => {
    const a = JSON.stringify(generateNumbers(baseParams, 'seed-alpha'));
    const b = JSON.stringify(generateNumbers(baseParams, 'seed-alpha'));
    const c = JSON.stringify(generateNumbers(baseParams, 'seed-alpha'));
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(JSON.parse(a).groups).toHaveLength(5);
  });

  it('不同 seed ⇒ 结果应有差异（20 个 seed 至少 15 个不同）', () => {
    const keys = new Set();
    for (let s = 0; s < 20; s += 1) {
      const res = generateNumbers(baseParams, s * 7919 + 1);
      keys.add(res.groups.map((g) => `${g.front.join(',')}/${g.back.join(',')}`).join(';'));
    }
    expect(keys.size).toBeGreaterThanOrEqual(15);
  });

  it('组间不得完全重复，且每注号码合法', () => {
    for (const seed of ['x', 'y', 'z', 1, 2, 3]) {
      const { groups, frontPool, backPool } = generateNumbers({ ...baseParams, count: 20 }, seed);
      expect(groups).toHaveLength(20);
      const comboKeys = groups.map((g) => `${g.front.join(',')}|${g.back.join(',')}`);
      expect(new Set(comboKeys).size).toBe(comboKeys.length);

      const frontSet = new Set(frontPool);
      const backSet = new Set(backPool);
      groups.forEach((g) => {
        expect(g.front).toHaveLength(5);
        expect(new Set(g.front).size).toBe(5);
        g.front.forEach((n) => {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(35);
          expect(frontSet.has(n)).toBe(true);
        });
        expect(g.back).toHaveLength(2);
        expect(new Set(g.back).size).toBe(2);
        g.back.forEach((n) => {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(12);
          expect(backSet.has(n)).toBe(true);
        });
        expect(g.sum).toBe(g.front.reduce((a, b) => a + b, 0));
      });
    }
  });

  it('排除号绝不出现（前区排除 5 个数、后区排除 2 个数）', () => {
    const excludeFront = [1, 2, 3, 4, 5];
    const excludeBack = [12, 11];
    const { groups } = generateNumbers(
      { ...baseParams, count: 20, excludeFront, excludeBack },
      2024,
    );
    expect(groups).toHaveLength(20);
    groups.forEach((g) => {
      excludeFront.forEach((n) => expect(g.front).not.toContain(n));
      excludeBack.forEach((n) => expect(g.back).not.toContain(n));
    });
  });

  it('可行约束下 relaxed 均为 false 且确实满足约束', () => {
    const { groups, warnings } = generateNumbers(baseParams, 4321);
    groups.forEach((g) => {
      expect(g.relaxed).toBe(false);
      expect(['2:3', '3:2', '4:1', '1:4']).toContain(g.oddEven.label);
      expect(['2:3', '3:2']).toContain(g.bigSmall.label);
      expect(g.sum).toBeGreaterThanOrEqual(60);
      expect(g.sum).toBeLessThanOrEqual(130);
      expect(g.consecutive.hasConsecutive).toBe(false);
    });
    expect(warnings.filter((w) => w.includes('放宽'))).toEqual([]);
  });

  it('约束不可行（前区池仅 1-5、和值要求 100-110）：不挂死、不抛异常、5 秒内返回并标注 relaxed', () => {
    const started = Date.now();
    const res = generateNumbers(
      {
        draws: [],
        count: 5,
        frontPoolMode: 'custom',
        frontCustom: [1, 2, 3, 4, 5],
        constraints: {
          enabled: true,
          oddEven: true,
          bigSmall: true,
          sumRange: true,
          sumMin: 100,
          sumMax: 110,
          allowConsecutive: false,
        },
      },
      7,
    );
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(5000);
    expect(res.groups).toHaveLength(5);
    res.groups.forEach((g) => expect(g.relaxed).toBe(true));
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.join(' ')).toContain('放宽');
    // 放宽后仍必须是池内号码
    res.groups.forEach((g) => expect(g.front.every((n) => n >= 1 && n <= 5)).toBe(true));
  });

  it('池子不足（前区仅 4 个号）：不挂死，给出警告并回退到全池', () => {
    const started = Date.now();
    const res = generateNumbers(
      { draws: [], count: 5, frontPoolMode: 'custom', frontCustom: [1, 2, 3, 4] },
      9,
    );
    expect(Date.now() - started).toBeLessThan(5000);
    expect(res.warnings.join(' ')).toContain('不足 5 个');
    expect(res.frontPool.length).toBeGreaterThanOrEqual(5);
    expect(res.groups).toHaveLength(5);
    res.groups.forEach((g) => {
      expect(g.front).toHaveLength(5);
      expect(new Set(g.front).size).toBe(5);
    });
  });

  it('全部前区被排除：返回空结果 + 提示，不抛异常', () => {
    const res = generateNumbers(
      {
        draws: [],
        count: 5,
        excludeFront: Array.from({ length: 35 }, (_, i) => i + 1),
      },
      11,
    );
    expect(res.groups).toEqual([]);
    expect(res.warnings.join(' ')).toContain('无法生成号码');
  });

  it('weightedSample：权重机制真实生效（极端权重 1000:1）', () => {
    const rng = mulberry32(42);
    let hitHigh = 0;
    const rounds = 2000;
    for (let i = 0; i < rounds; i += 1) {
      if (weightedSample([1, 2], [1000, 1], 1, rng)[0] === 1) hitHigh += 1;
    }
    expect(hitHigh).toBeGreaterThan(rounds * 0.95);
  });

  it('frequency 加权：历史最热 29 的出现率显著高于最冷 16', () => {
    let hot = 0;
    let cold = 0;
    for (let s = 0; s < 20; s += 1) {
      const { groups } = generateNumbers(
        { ...baseParams, count: 20, frontWeightMode: 'freq' },
        `weight-${s}`,
      );
      groups.forEach((g) => {
        if (g.front.includes(29)) hot += 1;
        if (g.front.includes(16)) cold += 1;
      });
    }
    // 400 组 × 5 个前区号；加权应让热号明显更常出现
    expect(hot).toBeGreaterThan(cold);
    expect(hot).toBeGreaterThanOrEqual(Math.round(cold * 1.15));
  });

  it('constraintsSatisfied 连号 / 和值 / 关闭开关的行为', () => {
    const group = { front: [1, 2, 3, 10, 11], back: [1, 2], sum: 27 };
    expect(constraintsSatisfied(group, { enabled: false })).toBe(true);
    expect(
      constraintsSatisfied(group, {
        enabled: true,
        allowConsecutive: false,
        oddEven: false,
        bigSmall: false,
        sumRange: false,
      }),
    ).toBe(false);
    expect(
      constraintsSatisfied(group, {
        enabled: true,
        allowConsecutive: true,
        oddEven: false,
        bigSmall: false,
        sumRange: false,
      }),
    ).toBe(true);
    expect(
      constraintsSatisfied(group, {
        enabled: true,
        allowConsecutive: true,
        oddEven: false,
        bigSmall: false,
        sumRange: true,
        sumMin: 100,
        sumMax: 110,
      }),
    ).toBe(false);
    // sumMin > sumMax 时应自动交换上下界，而不是恒假
    expect(
      constraintsSatisfied(group, {
        enabled: true,
        allowConsecutive: true,
        oddEven: false,
        bigSmall: false,
        sumRange: true,
        sumMin: 110,
        sumMax: 100,
      }),
    ).toBe(false);
    expect(
      constraintsSatisfied(
        { front: [1, 2, 3, 10, 11], back: [1, 2], sum: 105 },
        {
          enabled: true,
          allowConsecutive: true,
          oddEven: false,
          bigSmall: false,
          sumRange: true,
          sumMin: 110,
          sumMax: 100,
        },
      ),
    ).toBe(true);
  });

  it('buildPools：hot 模式取到真实热号，且 size 生效', () => {
    const pools = buildPools({ draws: SEED_DRAWS, frontPoolMode: 'hot', frontPoolSize: 5 });
    expect(pools.frontPool).toHaveLength(5);
    expect(pools.frontPool).toContain(29);
    expect(pools.frontPool).not.toContain(16);

    const cold = buildPools({ draws: SEED_DRAWS, frontPoolMode: 'cold', frontPoolSize: 5 });
    expect(cold.frontPool).toContain(16);
    expect(cold.frontPool).not.toContain(29);
  });

  it('无历史数据时给出退化警告但仍能生成', () => {
    const res = generateNumbers({ count: 3 }, 5);
    expect(res.groups).toHaveLength(3);
    expect(res.warnings.join(' ')).toContain('退化为等概率随机');
  });

  it('count 越界被夹在 1..20', () => {
    expect(generateNumbers({ draws: [], count: 0 }, 1).groups).toHaveLength(1);
    expect(generateNumbers({ draws: [], count: 999 }, 1).groups).toHaveLength(20);
  });

  it('hashSeed / normalizeSeed 的确定性', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    expect(hashSeed('')).toBe(hashSeed(''));
  });
});

// ===========================================================================
describe('C-8. storage：无 localStorage 环境必须降级不抛异常', () => {
  it('node 环境下 hasLocalStorage() 为 false', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(hasLocalStorage()).toBe(false);
  });

  it('全部 API 调用均不抛异常，并降级为内存存储', () => {
    expect(() => {
      clearAll();
      const empty = loadDraws();
      expect(empty).toBeNull();
      expect(loadMeta()).toBeNull();
      expect(getSetting('nope', 'fallback')).toBe('fallback');
    }).not.toThrow();

    const draws = [{ no: '07001', date: '2007-05-30', front: [22, 24, 29, 31, 35], back: [4, 11] }];
    const saved = saveDraws(draws, { count: 1 });
    expect(saved.ok).toBe(false);
    expect(saved.reason).toContain('localStorage');

    const loaded = loadDraws();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].no).toBe('07001');
    expect(loaded[0].front).toEqual([22, 24, 29, 31, 35]);

    expect(saveMeta({ a: 1 }).ok).toBe(false);
    expect(loadMeta()).toEqual({ a: 1 });

    expect(setSetting('k', { v: 2 }).ok).toBe(false);
    expect(getSetting('k')).toEqual({ v: 2 });

    expect(() => clearAll()).not.toThrow();
    expect(loadDraws()).toBeNull();
  });

  it('脏数据不会导致崩溃', () => {
    // 结构不合法的行会被过滤掉，而不是让后续统计崩溃
    saveDraws(
      [
        { no: '07001', date: '2007-05-30', front: [22, 24, 29, 31, 35], back: [4, 11] },
        { no: 1 },
        null,
        'x',
      ],
      {},
    );
    const loaded = loadDraws();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].no).toBe('07001');

    // 号码数组内的字符串数字会被归一化为 number 并升序
    saveDraws(
      [{ no: '07002', date: '2007-06-02', front: ['7', 3, 11, 5, 9], back: ['12', 2] }],
      {},
    );
    const normalized = loadDraws();
    expect(normalized[0].front).toEqual([3, 5, 7, 9, 11]);
    expect(normalized[0].back).toEqual([2, 12]);

    clearAll();
    expect(loadDraws()).toBeNull();
    expect(loadMeta()).toBeNull();
  });
});
