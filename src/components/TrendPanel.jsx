import { useMemo, useState } from 'react';
import Chart from './Chart.jsx';
import EmptyHint from './EmptyHint.jsx';
import {
  bigSmallRatio,
  FRONT_ZONE_LABELS,
  oddEvenRatio,
  subsetByRange,
  sumSeries,
  zoneDistribution,
} from '../lib/stats.js';
import { formatNumber, pad2 } from '../lib/format.js';

const RANGE_OPTIONS = [
  { value: 30, label: '最近 30 期' },
  { value: 50, label: '最近 50 期' },
  { value: 100, label: '最近 100 期' },
  { value: 300, label: '最近 300 期' },
];

const RATIO_CATEGORIES = ['0:5', '1:4', '2:3', '3:2', '4:1', '5:0'];

/**
 * 统计某一类比例标签的分布。
 * @param {Array<object>} rows 开奖数据（升序）
 * @param {'oddEven'|'bigSmall'} kind 比例类型
 * @return {{labels: string[], counts: number[]}} 分布
 */
function ratioDistribution(rows, kind) {
  const counts = RATIO_CATEGORIES.map(() => 0);
  rows.forEach((row) => {
    const ratio = kind === 'oddEven' ? oddEvenRatio(row.front) : bigSmallRatio(row.front);
    const index = RATIO_CATEGORIES.indexOf(ratio.label);
    if (index >= 0) counts[index] += 1;
  });
  return { labels: RATIO_CATEGORIES, counts };
}

/**
 * 走势图表面板（热力图 / 和值 / 奇偶比 / 大小比 / 区间分布）。
 * @param {{draws: Array<object>}} props 数据
 * @return {JSX.Element} 面板
 */
export default function TrendPanel({ draws }) {
  const [range, setRange] = useState(100);

  const rows = useMemo(() => subsetByRange(draws, range), [draws, range]);
  const sumRows = useMemo(() => sumSeries(rows), [rows]);
  const oddEvenDist = useMemo(() => ratioDistribution(rows, 'oddEven'), [rows]);
  const bigSmallDist = useMemo(() => ratioDistribution(rows, 'bigSmall'), [rows]);

  const zoneCounts = useMemo(() => {
    const totals = [0, 0, 0, 0, 0];
    rows.forEach((row) => {
      zoneDistribution(row.front).forEach((count, index) => {
        totals[index] += count;
      });
    });
    return totals;
  }, [rows]);

  const heatOption = useMemo(() => {
    const data = [];
    rows.forEach((row, yIndex) => {
      (row.front || []).forEach((num, position) => {
        data.push([Number(num) - 1, yIndex, position + 1]);
      });
    });

    return {
      grid: { left: 54, right: 18, top: 16, bottom: 58 },
      tooltip: {
        formatter: (info) => {
          const [x, y, value] = info.data;
          const row = rows[y];
          return `${row.no}（${row.date}）<br/>号码 ${pad2(x + 1)}：第 ${value} 位开出`;
        },
      },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 35 }, (_, index) => pad2(index + 1)),
        splitArea: { show: true },
        axisLabel: { fontSize: 9, interval: 0 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category',
        data: rows.map((row) => row.no),
        inverse: true,
        axisLabel: { fontSize: 9 },
        axisTick: { show: false },
      },
      visualMap: {
        min: 1,
        max: 5,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 90,
        text: ['第5位', '第1位'],
        textStyle: { fontSize: 10 },
        inRange: { color: ['#fecaca', '#f87171', '#dc2626', '#991b1b', '#7f1d1d'] },
      },
      series: [
        {
          type: 'heatmap',
          data,
          itemStyle: { borderColor: '#ffffff', borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: '#1e293b', borderWidth: 1 } },
        },
      ],
    };
  }, [rows]);

  const sumOption = useMemo(() => {
    const expected = 90; // 前区和值理论均值：5 × (1 + 35) / 2 = 90
    return {
      grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const item = params && params[0];
          if (!item) return '';
          const row = sumRows[item.dataIndex];
          return `${row.no}（${row.date}）<br/>前区和值 ${row.sum}`;
        },
      },
      xAxis: {
        type: 'category',
        data: sumRows.map((row) => row.no),
        axisLabel: { fontSize: 9, interval: Math.max(0, Math.floor(sumRows.length / 12) - 1) },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '和值',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          data: sumRows.map((row) => row.sum),
          smooth: false,
          showSymbol: sumRows.length <= 60,
          symbolSize: 5,
          lineStyle: { width: 1.6, color: '#dc2626' },
          itemStyle: { color: '#dc2626' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#0f766e', type: 'dashed', width: 1.5 },
            label: {
              formatter: `理论均值 ${expected}`,
              position: 'insideStartTop',
              fontSize: 10,
              color: '#0f766e',
              backgroundColor: 'rgba(255,255,255,0.88)',
              padding: [2, 4],
              borderRadius: 2,
            },
            data: [{ yAxis: expected }],
          },
        },
      ],
    };
  }, [sumRows]);

  /**
   * 构建比例分布柱状图配置。
   * @param {string[]} labels 类别
   * @param {number[]} counts 计数
   * @param {string} name 系列名
   * @param {string} color 颜色
   * @param {string} axisHint 类别含义说明
   * @return {object} ECharts option
   */
  const buildRatioOption = (labels, counts, name, color, axisHint) => ({
    grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = params && params[0];
        if (!item) return '';
        const total = counts.reduce((sum, value) => sum + value, 0) || 1;
        return `${name} ${labels[item.dataIndex]}<br/>${item.value} 期（${((item.value / total) * 100).toFixed(1)}%）<br/>${axisHint}`;
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '期数',
      nameTextStyle: { fontSize: 10, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        type: 'bar',
        name,
        data: counts,
        barMaxWidth: 28,
        itemStyle: { color, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 10, color: '#475569' },
      },
    ],
  });

  const oddEvenOption = useMemo(
    () =>
      buildRatioOption(
        oddEvenDist.labels,
        oddEvenDist.counts,
        '奇偶比',
        '#dc2626',
        '标签含义：奇数个数:偶数个数',
      ),
    [oddEvenDist],
  );

  const bigSmallOption = useMemo(
    () =>
      buildRatioOption(
        bigSmallDist.labels,
        bigSmallDist.counts,
        '大小比',
        '#2563eb',
        '标签含义：小号(01-17)个数:大号(18-35)个数',
      ),
    [bigSmallDist],
  );

  const zoneOption = useMemo(() => {
    const expectedTotal = rows.length; // 每个区间理论期望 5 × 7/35 = 1 个/期
    return {
      grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const item = params && params[0];
          if (!item) return '';
          const perDraw = rows.length ? zoneCounts[item.dataIndex] / rows.length : 0;
          return `${FRONT_ZONE_LABELS[item.dataIndex]}<br/>累计 ${item.value} 个<br/>平均每期 ${formatNumber(perDraw, 3)} 个（期望 1 个）`;
        },
      },
      xAxis: {
        type: 'category',
        data: FRONT_ZONE_LABELS,
        axisLabel: { fontSize: 9, interval: 0 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '累计个数',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: zoneCounts,
          barMaxWidth: 44,
          itemStyle: { color: '#7c3aed', borderRadius: [3, 3, 0, 0] },
          label: { show: true, position: 'top', fontSize: 10, color: '#475569' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#0f766e', type: 'dashed', width: 1.5 },
            label: { show: false },
            data: [{ yAxis: expectedTotal }],
          },
        },
      ],
    };
  }, [zoneCounts, rows.length]);

  if (!draws.length) return <EmptyHint />;

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">走势图表</h2>
            <p className="hint mt-1">当前展示最近 {rows.length} 期（{rows.length ? `${rows[0].no} ~ ${rows[rows.length - 1].no}` : '—'}）。</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`btn btn-xs ${
                  range === option.value
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">1. 前区号码分布热力图</h3>
        <p className="hint mb-1">横轴为号码 01-35，纵轴为最近期次（上方为最新）。颜色越深表示该号码在当期开奖中的排序位置越靠后。</p>
        <Chart option={heatOption} height={Math.min(640, Math.max(320, rows.length * 13))} ariaLabel="前区号码分布热力图" />
        <p className="hint mt-1">解读：每期固定有 5 个格子被点亮。若热力图看起来杂乱无规律，这本身就是随机性的直观表现。</p>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">2. 前区和值走势</h3>
        <Chart option={sumOption} height={300} ariaLabel="前区和值走势折线图" />
        <p className="hint mt-1">解读：前区 5 个号的和值理论均值为 90（绿色虚线）。实际和值围绕 90 上下波动，短期偏离属于正常随机波动。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad min-w-0">
          <h3 className="section-title">3a. 奇偶比分布</h3>
          <Chart option={oddEvenOption} height={280} ariaLabel="奇偶比分布柱状图" />
          <p className="hint mt-1">解读：2:3 与 3:2 是 5 个号码中最常见的奇偶组合，因为组合数量最多；出现次数少不代表「该出现了」。</p>
        </div>

        <div className="card card-pad min-w-0">
          <h3 className="section-title">3b. 大小比分布</h3>
          <Chart option={bigSmallOption} height={280} ariaLabel="大小比分布柱状图" />
          <p className="hint mt-1">解读：小号 01-17、大号 18-35。极端比例（如 0:5）组合数最少，因此历史上出现次数自然偏少。</p>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">4. 前区五区间分布</h3>
        <Chart option={zoneOption} height={300} ariaLabel="前区五区间分布柱状图" />
        <p className="hint mt-1">
          解读：五个区间的理论期望相同（每期每区 1 个，绿色虚线 = 所选期数 × 1）。柱子高度不一致属于抽样波动，不能作为「某区将要回补」的依据。
        </p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <strong>提醒：</strong>走势图是历史记录的可视化，不是未来走势的外推。图表中任何「规律」若只依赖肉眼观察，都属于事后归纳。
      </div>
    </div>
  );
}
