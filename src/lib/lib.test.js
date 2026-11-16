import { describe, expect, it } from 'vitest';
import {
  drawsToCsv,
  normalizeDate,
  normalizeNo,
  parseDrawFile,
  parseDrawJson,
  parseDrawText,
  validateDraw,
} from './parse.js';
import {
  bigSmallRatio,
  chiSquarePValue,
  chiSquareTest,
  consecutiveInfo,
  frequency,
  hotColdLists,
  oddEvenRatio,
  omissionStats,
  repeatCount,
  spanOf,
  subsetByRange,
  sumOf,
  sumSeries,
  zoneDistribution,
} from './stats.js';
import {
  buildHistoryIndex,
  buildPools,
  constraintsSatisfied,
  generateNumbers,
  mulberry32,
  normalizeSeed,
  weightedSample,
} from './generator.js';
import { clearAll, loadDraws, saveDraws, setSetting, getSetting } from './storage.js';

const DRAWS = [
  { no: '24001', date: '2024-01-01', front: [1, 2, 3, 4, 5], back: [1, 2] },
  { no: '24002', date: '2024-01-03', front: [1, 2, 3, 4, 6], back: [1, 3] },
  { no: '24003', date: '2024-01-05', front: [5, 10, 15, 20, 25], back: [5, 6] },
];

describe('parse: 校验', () => {
  it('接受合法单期数据并排序号码（数字期号自动补零）', () => {
    const result = validateDraw({ no: 7001, date: '2007/5/30', front: [35, 22, 24, 29, 31], back: [11, 4] });
    expect(result.ok).toBe(true);
    expect(result.draw.no).toBe('07001');
    expect(result.draw.date).toBe('2007-05-30');
    expect(result.draw.front).toEqual([22, 24, 29, 31, 35]);
    expect(result.draw.back).toEqual([4, 11]);
  });

  it('拒绝前区重复号码', () => {
    const result = validateDraw({ no: '24001', date: '2024-01-01', front: [1, 1, 3, 4, 5], back: [1, 2] });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('重复');
  });

  it('拒绝越界号码与非法日期', () => {
    expect(validateDraw({ no: '24001', date: '2024-01-01', front: [1, 2, 3, 4, 36], back: [1, 2] }).ok).toBe(false);
    expect(validateDraw({ no: '24001', date: '2024-02-30', front: [1, 2, 3, 4, 5], back: [1, 2] }).ok).toBe(false);
    expect(validateDraw({ no: '2401', date: '2024-01-01', front: [1, 2, 3, 4, 5], back: [1, 2] }).ok).toBe(false);
  });

  it('归一化期号与日期', () => {
    expect(normalizeNo(7001)).toBe('07001');
    expect(normalizeNo(' 26123 ')).toBe('26123');
    expect(normalizeNo('2401')).toBe('2401'); // 字符串期号必须本身 5 位
    expect(normalizeDate('2024/2/29')).toBe('2024-02-29');
    expect(normalizeDate('20230229')).toBe('');
    expect(normalizeDate('2024.3.1')).toBe('2024-03-01');
  });
});

describe('parse: 文本 / JSON 解析', () => {
  it('解析 Tab 分隔的 TXT', () => {
    const text = '07001\t2007-05-30\t22\t24\t29\t31\t35\t04\t11\n# 注释行\n';
    const result = parseDrawText(text);
    expect(result.errors).toHaveLength(0);
    expect(result.draws).toHaveLength(1);
    expect(result.draws[0].front).toEqual([22, 24, 29, 31, 35]);
    expect(result.draws[0].back).toEqual([4, 11]);
  });

  it('解析带表头的 CSV 并报告错误行', () => {
    const text = [
      '期号,开奖日期,前区1,前区2,前区3,前区4,前区5,后区1,后区2',
      '24001,2024-01-01,1,2,3,4,5,1,2',
      '24002,2024-01-03,1,2,3,4,5,1,1',
      '24003,2024-01-05,1,2,3',
    ].join('\n');
    const result = parseDrawText(text);
    expect(result.draws).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].reason).toContain('后区号码存在重复');
  });

  it('解析 JSON（数组与 {draws} 两种结构）', () => {
    expect(parseDrawJson(DRAWS).draws).toHaveLength(3);
    expect(parseDrawJson({ draws: DRAWS }).draws).toHaveLength(3);
    expect(parseDrawJson({ list: [] }).errors).toHaveLength(1);
  });

  it('按扩展名选择解析器', () => {
    expect(parseDrawFile(JSON.stringify(DRAWS), 'a.json').draws).toHaveLength(3);
    expect(parseDrawFile('not json', 'a.json').errors[0].reason).toContain('JSON 解析失败');
    expect(parseDrawFile('24001,2024-01-01,1,2,3,4,5,1,2', 'a.csv').draws).toHaveLength(1);
  });

  it('导出 CSV 含表头且补零', () => {
    const csv = drawsToCsv([{ no: '07001', date: '2007-05-30', front: [22, 24, 29, 31, 35], back: [4, 11] }]);
    expect(csv.split('\n')[0]).toContain('期号');
    expect(csv).toContain('07001,2007-05-30,22,24,29,31,35,04,11');
  });
});

describe('stats: 频次与遗漏', () => {
  it('统计前区频次并给出期望与 z 值', () => {
    const freq = frequency(DRAWS, 'front');
    expect(freq).toHaveLength(35);
    expect(freq[0].num).toBe(1);
    expect(freq[0].count).toBe(2);
    expect(freq[0].expected).toBeCloseTo((3 * 5) / 35, 10);
    expect(freq[0].deviation).toBeCloseTo(2 - (15 / 35), 10);
    expect(Number.isFinite(freq[0].z)).toBe(true);
  });

  it('统计后区频次', () => {
    const freq = frequency(DRAWS, 'back');
    expect(freq).toHaveLength(12);
    expect(freq[0].count).toBe(2); // 后区 1 出现 2 次
    expect(freq[1].count).toBe(1); // 后区 2 出现 1 次
  });

  it('计算当前遗漏 / 最大遗漏 / 平均遗漏', () => {
    const omission = omissionStats(DRAWS, 'front');
    const num1 = omission.find((row) => row.num === 1);
    const num5 = omission.find((row) => row.num === 5);
    const num35 = omission.find((row) => row.num === 35);

    expect(num1.current).toBe(1); // 24003 未出现，24002 出现
    expect(num5.current).toBe(0); // 最新一期开出
    expect(num35.current).toBe(3); // 从未开出
    expect(num35.count).toBe(0);
    expect(num5.max).toBe(1); // 只在第 1、3 期出现，中间遗漏 1 期
    expect(Number.isFinite(num1.avg)).toBe(true);
  });

  it('和值序列与基础派生指标', () => {
    const series = sumSeries(DRAWS);
    expect(series.map((row) => row.sum)).toEqual([15, 16, 75]);
    expect(sumOf([1, 2, 3, 4, 5])).toBe(15);
    expect(spanOf([5, 10, 15, 20, 25])).toBe(20);
  });

  it('奇偶比 / 大小比 / 区间分布 / 连号 / 重号', () => {
    expect(oddEvenRatio([1, 2, 3, 4, 5])).toEqual({ odd: 3, even: 2, label: '3:2' });
    expect(bigSmallRatio([1, 2, 3, 4, 5])).toEqual({ small: 5, big: 0, label: '5:0' });
    expect(bigSmallRatio([18, 19, 20, 21, 22]).label).toBe('0:5');
    expect(zoneDistribution([1, 7, 8, 14, 15])).toEqual([2, 2, 1, 0, 0]);
    const consecutive = consecutiveInfo([1, 2, 3, 10, 11]);
    expect(consecutive.hasConsecutive).toBe(true);
    expect(consecutive.count).toBe(3); // (1,2) (2,3) (10,11)
    expect(consecutive.maxRun).toBe(3);
    expect(repeatCount([1, 2, 3, 4, 5], [3, 4, 9, 10, 11])).toBe(2);
  });

  it('按范围取最近 N 期', () => {
    expect(subsetByRange(DRAWS, 2).map((row) => row.no)).toEqual(['24002', '24003']);
    expect(subsetByRange(DRAWS, 'all')).toHaveLength(3);
    expect(subsetByRange(DRAWS, 999)).toHaveLength(3);
  });

  it('冷热榜取 Top / Bottom', () => {
    const lists = hotColdLists(frequency(DRAWS, 'front'), 3, 3);
    expect(lists.hot).toHaveLength(3);
    expect(lists.cold).toHaveLength(3);
    expect(lists.hot[0].count).toBeGreaterThanOrEqual(lists.hot[1].count);
    expect(lists.cold[0].count).toBeLessThanOrEqual(lists.cold[1].count);
  });
});

describe('stats: 卡方检验', () => {
  it('p 值边界正确', () => {
    expect(chiSquarePValue(0, 5)).toBe(1);
    expect(chiSquarePValue(-1, 5)).toBe(1);
    const high = chiSquarePValue(100, 5);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThan(0.001);
  });

  it('已知值：χ²=34, df=34 的 p 值约为 0.47', () => {
    const p = chiSquarePValue(34, 34);
    expect(p).toBeGreaterThan(0.35);
    expect(p).toBeLessThan(0.6);
  });

  it('p 值随统计量单调递减', () => {
    const values = [10, 20, 30, 40, 60].map((chi2) => chiSquarePValue(chi2, 34));
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  it('chiSquareTest 返回自由度与前区/后区配置一致', () => {
    expect(chiSquareTest(DRAWS, 'front').df).toBe(34);
    expect(chiSquareTest(DRAWS, 'back').df).toBe(11);
    expect(chiSquareTest([], 'front').p).toBe(1);
  });
});

describe('generator: 随机性、可复现与约束', () => {
  it('mulberry32 同种子产生同序列', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('normalizeSeed 对同字符串稳定', () => {
    expect(normalizeSeed('abc')).toBe(normalizeSeed('abc'));
    expect(normalizeSeed(123)).toBe(123);
  });

  it('加权无放回抽样不重复且数量正确', () => {
    const rng = mulberry32(7);
    const pool = Array.from({ length: 10 }, (_, index) => index + 1);
    const picked = weightedSample(pool, pool.map((n) => n), 5, rng);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
  });

  it('相同种子 + 相同参数 ⇒ 完全相同的结果', () => {
    const params = {
      count: 5,
      frontPoolMode: 'all',
      frontWeightMode: 'mix',
      backPoolMode: 'all',
      constraints: { enabled: true, oddEven: true, bigSmall: true, sumRange: true, sumMin: 60, sumMax: 130, allowConsecutive: false },
      draws: DRAWS,
    };
    const first = generateNumbers(params, 20240101);
    const second = generateNumbers(params, 20240101);
    expect(first.seed).toBe(second.seed);
    expect(first.groups.map((group) => [...group.front, ...group.back])).toEqual(
      second.groups.map((group) => [...group.front, ...group.back]),
    );
  });

  it('组间不重复且约束被满足', () => {
    const params = {
      count: 8,
      frontWeightMode: 'freq',
      constraints: { enabled: true, oddEven: true, bigSmall: true, sumRange: true, sumMin: 60, sumMax: 120, allowConsecutive: false },
      draws: [
        { no: '24001', date: '2024-01-01', front: [3, 8, 14, 22, 31], back: [2, 9] },
        { no: '24002', date: '2024-01-03', front: [5, 11, 18, 26, 33], back: [4, 7] },
        { no: '24003', date: '2024-01-05', front: [1, 9, 16, 24, 35], back: [1, 12] },
      ],
    };
    const result = generateNumbers(params, 99);
    expect(result.groups.length).toBe(8);

    const keys = new Set(
      result.groups.map((group) => `${group.front.join(',')}|${group.back.join(',')}`),
    );
    expect(keys.size).toBe(result.groups.length);

    result.groups.forEach((group) => {
      expect(group.front).toHaveLength(5);
      expect(group.back).toHaveLength(2);
      expect(new Set(group.front).size).toBe(5);
      expect(group.front.every((n) => n >= 1 && n <= 35)).toBe(true);
      expect(group.back.every((n) => n >= 1 && n <= 12)).toBe(true);
      if (!group.relaxed) {
        expect(['2:3', '3:2', '4:1', '1:4']).toContain(group.oddEven.label);
        expect(['2:3', '3:2']).toContain(group.bigSmall.label);
        expect(group.sum).toBeGreaterThanOrEqual(60);
        expect(group.sum).toBeLessThanOrEqual(120);
        expect(group.consecutive.hasConsecutive).toBe(false);
      }
    });
  });

  it('可查历史命中次数，并在无法满足约束时标注 relaxed', () => {
    const historyIndex = buildHistoryIndex(DRAWS);
    expect(historyIndex.get('1,2,3,4,5|1,2')).toBe(1);

    const exact = generateNumbers(
      {
        count: 1,
        frontPoolMode: 'custom',
        frontCustom: [1, 2, 3, 4, 5],
        backPoolMode: 'custom',
        backCustom: [1, 2],
        constraints: { enabled: false },
        draws: DRAWS,
      },
      1,
    );
    expect(exact.groups).toHaveLength(1);
    expect(exact.groups[0].front).toEqual([1, 2, 3, 4, 5]);
    expect(exact.groups[0].back).toEqual([1, 2]);
    expect(exact.groups[0].historyCount).toBe(1);
    expect(exact.groups[0].repeatWithLatest).toBe(1); // 最新一期 24003 含 5

    const impossible = generateNumbers(
      {
        count: 1,
        frontPoolMode: 'custom',
        frontCustom: [1, 2, 3, 4, 5],
        backPoolMode: 'custom',
        backCustom: [1, 2],
        constraints: { enabled: true, sumRange: true, sumMin: 170, sumMax: 175 },
        draws: DRAWS,
      },
      5,
    );
    expect(impossible.groups).toHaveLength(1);
    expect(impossible.groups[0].relaxed).toBe(true);
    expect(impossible.warnings.some((warning) => warning.includes('放宽'))).toBe(true);
  });

  it('号码池按冷热 / 遗漏 / 自定义正确收缩', () => {
    const pools = buildPools({
      frontPoolMode: 'hot',
      frontPoolSize: 5,
      backPoolMode: 'cold',
      backPoolSize: 3,
      draws: DRAWS,
    });
    expect(pools.frontPool).toHaveLength(5);
    expect(pools.backPool).toHaveLength(3);
    expect(pools.frontPool).toContain(1); // 前区 1 出现 2 次，是最热号码

    const custom = buildPools({
      frontPoolMode: 'custom',
      frontCustom: [1, 2, 3, 4, 5, 6],
      excludeFront: [6],
      draws: DRAWS,
    });
    expect(custom.frontPool).toEqual([1, 2, 3, 4, 5]);
  });

  it('constraintsSatisfied 对关闭约束始终返回 true', () => {
    expect(constraintsSatisfied({ front: [1, 2, 3, 4, 5], sum: 15 }, { enabled: false })).toBe(true);
    expect(constraintsSatisfied({ front: [1, 2, 3, 4, 5], sum: 15 }, { enabled: true, sumRange: true, sumMin: 60, sumMax: 130 })).toBe(false);
  });

  it('排除号码后不会出现在结果中', () => {
    const result = generateNumbers(
      { count: 3, excludeFront: [1, 2, 3, 4, 5, 6, 7], excludeBack: [1, 2], constraints: { enabled: false }, draws: DRAWS },
      12345,
    );
    result.groups.forEach((group) => {
      group.front.forEach((n) => expect(n).toBeGreaterThan(7));
      group.back.forEach((n) => expect(n).toBeGreaterThan(2));
    });
  });
});

describe('storage: 无 localStorage 环境不抛异常', () => {
  it('读写与清空都不抛异常', () => {
    clearAll();
    expect(loadDraws()).toBeNull();

    const saveResult = saveDraws(DRAWS, { source: 'test' });
    expect(typeof saveResult.ok).toBe('boolean');

    const loaded = loadDraws();
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveLength(3);
    expect(loaded[0].front).toEqual([1, 2, 3, 4, 5]);

    setSetting('dlt_test_flag', true);
    expect(getSetting('dlt_test_flag', false)).toBe(true);
    expect(getSetting('dlt_missing_flag', 'fallback')).toBe('fallback');

    clearAll();
    expect(loadDraws()).toBeNull();
  });
});
