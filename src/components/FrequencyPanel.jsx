import { useMemo, useState } from 'react';
import Chart from './Chart.jsx';
import EmptyHint from './EmptyHint.jsx';
import { FrontBall, BackBall } from './Ball.jsx';
import { chiSquareTest, frequency, subsetByRange, zoneConfig } from '../lib/stats.js';
import { formatNumber, formatPercent, pad2 } from '../lib/format.js';

const RANGE_OPTIONS = [
  { value: 'all', label: '全部期次' },
  { value: 50, label: '最近 50 期' },
  { value: 100, label: '最近 100 期' },
  { value: 300, label: '最近 300 期' },
  { value: 500, label: '最近 500 期' },
];

/**
 * 格式化 p 值为中文展示文本。
 * @param {number} p p 值
 * @return {string} 展示文本（含比较符）
 */
function formatP(p) {
  if (!Number.isFinite(p)) return '= -';
  if (p < 0.001) return '< 0.001';
  return `= ${p.toFixed(4)}`;
}

/**
 * 频次条形图（横向）。
 * @param {{rows: Array<object>, zone: 'front'|'back'}} props 参数
 * @return {JSX.Element} 图表
 */
function FrequencyChart({ rows, zone }) {
  const option = useMemo(() => {
    const isFront = zone === 'front';
    const expected = rows.length ? rows[0].expected : 0;
    return {
      grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const item = params && params[0];
          if (!item) return '';
          const row = rows[item.dataIndex];
          return [
            `${isFront ? '前区' : '后区'} ${pad2(row.num)}`,
            `出现 ${row.count} 次（${formatPercent(row.rate)}）`,
            `期望 ${formatNumber(row.expected, 1)} 次`,
            `偏差 ${row.deviation >= 0 ? '+' : ''}${formatNumber(row.deviation, 1)}`,
            `z 值 ${formatNumber(row.z, 2)}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: rows.map((row) => pad2(row.num)),
        axisLabel: { fontSize: 9, interval: 0 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '出现次数',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((row) => row.count),
          itemStyle: { color: isFront ? '#dc2626' : '#2563eb', borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 22,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#0f766e', type: 'dashed', width: 1.5 },
            label: {
              formatter: `期望 ${formatNumber(expected, 1)} 次`,
              position: 'insideEndTop',
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
  }, [rows, zone]);

  return <Chart option={option} height={280} ariaLabel={zone === 'front' ? '前区频次柱状图' : '后区频次柱状图'} />;
}

/**
 * 频次表格。
 * @param {{rows: Array<object>, zone: 'front'|'back', maxCount: number}} props 参数
 * @return {JSX.Element} 表格
 */
function FrequencyTable({ rows, zone, maxCount }) {
  const isFront = zone === 'front';
  return (
    <div className="table-wrap max-h-[26rem] overflow-y-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>号码</th>
            <th>次数</th>
            <th>相对频次</th>
            <th>出现率</th>
            <th>理论概率</th>
            <th>偏差</th>
            <th>z 值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${zone}-${row.num}`}>
              <td>{isFront ? <FrontBall n={row.num} size="sm" /> : <BackBall n={row.num} size="sm" />}</td>
              <td className="font-medium text-slate-800">{row.count}</td>
              <td className="w-28">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={isFront ? 'h-full bg-red-500' : 'h-full bg-blue-500'}
                    style={{ width: `${maxCount > 0 ? Math.round((row.count / maxCount) * 100) : 0}%` }}
                  />
                </div>
              </td>
              <td>{formatPercent(row.rate)}</td>
              <td className="text-slate-500">
                {formatPercent(zoneConfig(zone).pick / zoneConfig(zone).count)}
              </td>
              <td className={row.deviation >= 0 ? 'text-red-600' : 'text-blue-600'}>
                {row.deviation >= 0 ? '+' : ''}
                {formatNumber(row.deviation, 1)}
              </td>
              <td className={row.z >= 2 || row.z <= -2 ? 'font-medium text-amber-700' : 'text-slate-600'}>
                {formatNumber(row.z, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 卡方检验结果卡片。
 * @param {{title: string, test: object, note: string}} props 参数
 * @return {JSX.Element} 卡片
 */
function ChiSquareCard({ title, test, note }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-600">
        <span>
          χ² = <strong className="text-slate-800">{formatNumber(test.chi2, 3)}</strong>
        </span>
        <span>
          df = <strong className="text-slate-800">{test.df}</strong>
        </span>
        <span>
          p{' '}
          <strong className={test.significant ? 'text-red-600' : 'text-emerald-600'}>
            {formatP(test.p)}
          </strong>
        </span>
      </div>
      <p className="hint mt-1">{note}</p>
    </div>
  );
}

/**
 * 频率统计面板。
 * @param {{draws: Array<object>}} props 数据
 * @return {JSX.Element} 面板
 */
export default function FrequencyPanel({ draws }) {
  const [range, setRange] = useState('all');

  const scoped = useMemo(() => subsetByRange(draws, range), [draws, range]);
  const frontRows = useMemo(() => frequency(scoped, 'front'), [scoped]);
  const backRows = useMemo(() => frequency(scoped, 'back'), [scoped]);
  const frontChi = useMemo(() => chiSquareTest(scoped, 'front'), [scoped]);
  const backChi = useMemo(() => chiSquareTest(scoped, 'back'), [scoped]);

  const frontMax = useMemo(() => Math.max(1, ...frontRows.map((row) => row.count)), [frontRows]);
  const backMax = useMemo(() => Math.max(1, ...backRows.map((row) => row.count)), [backRows]);

  if (!draws.length) return <EmptyHint />;

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">号码频率统计</h2>
            <p className="hint mt-1">
              统计范围内共 {scoped.length} 期。理论概率：前区 5/35 ≈ 14.29%，后区 2/12 ≈ 16.67%（每期独立抽取）。
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
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

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ChiSquareCard
            title="前区卡方均匀性检验（df = 34）"
            test={frontChi}
            note="p < 0.05 表示与均匀分布存在统计上的偏离。需要注意两点：本检验把每期不放回抽号近似为多项分布；且显著也可能来自数据本身（例如历史规则变化、数据合成或录入偏差）。无论哪种情况，都不构成预测下期的依据。"
          />
          <ChiSquareCard
            title="后区卡方均匀性检验（df = 11）"
            test={backChi}
            note="后区只有 12 个号码，单期样本量小，短期出现较大波动属于正常随机现象；显著与否都不构成选号依据。"
          />
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">前区 01-35 频次</h3>
        <FrequencyChart rows={frontRows} zone="front" />
        <p className="hint mt-1">解读：柱子越高说明该号码在统计范围内出现越多，绿色虚线是理论期望次数；柱子围绕期望线随机波动是正常的。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad min-w-0">
          <h3 className="section-title mb-2">前区频次明细</h3>
          <p className="hint mb-2">z 值 =（实际次数 − 期望次数）/ 二项分布标准差。|z| ≥ 2 用琥珀色标出，但 35 个号码同时比较时出现个别 |z| ≥ 2 属于正常的多重比较现象。</p>
          <FrequencyTable rows={frontRows} zone="front" maxCount={frontMax} />
        </div>

        <div className="card card-pad min-w-0">
          <h3 className="section-title mb-2">后区 01-12 频次</h3>
          <FrequencyChart rows={backRows} zone="back" />
          <div className="mt-2">
            <FrequencyTable rows={backRows} zone="back" maxCount={backMax} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <strong>提醒：</strong>频率统计只描述历史数据，不能改变未来每期的开出概率。大乐透每期独立随机，任何历史偏差都不会被「修正」。
      </div>
    </div>
  );
}
