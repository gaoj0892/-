import { useMemo, useState } from 'react';
import Chart from './Chart.jsx';
import EmptyHint from './EmptyHint.jsx';
import { FrontBall, BackBall } from './Ball.jsx';
import { frequency, hotColdLists, omissionStats, subsetByRange } from '../lib/stats.js';
import { formatNumber, pad2 } from '../lib/format.js';

const RANGE_OPTIONS = [
  { value: 'all', label: '全部期次' },
  { value: 50, label: '最近 50 期' },
  { value: 100, label: '最近 100 期' },
  { value: 300, label: '最近 300 期' },
  { value: 500, label: '最近 500 期' },
];

const OMISSION_COLUMNS = [
  { key: 'current', label: '当前遗漏' },
  { key: 'avg', label: '平均遗漏' },
  { key: 'max', label: '最大遗漏' },
  { key: 'count', label: '出现次数' },
];

/**
 * 冷热榜单卡片。
 * @param {{title: string, subtitle: string, items: Array<object>, zone: 'front'|'back', tone: 'hot'|'cold', drawsCount: number}} props
 * @return {JSX.Element} 卡片
 */
function RankCard({ title, subtitle, items, zone, tone, drawsCount }) {
  const isFront = zone === 'front';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className={`text-xs font-semibold ${tone === 'hot' ? 'text-red-600' : 'text-blue-600'}`}>
        {title}
      </p>
      <p className="hint mt-0.5">{subtitle}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item, index) => (
          <li key={`${zone}-${tone}-${item.num}`} className="flex items-center gap-2">
            <span className="w-4 text-right text-[11px] text-slate-400">{index + 1}</span>
            {isFront ? <FrontBall n={item.num} size="sm" /> : <BackBall n={item.num} size="sm" />}
            <span className="text-xs text-slate-600">
              {item.count} 次
              <span className="ml-1 text-slate-400">
                （{(drawsCount > 0 ? (item.count / drawsCount) * 100 : 0).toFixed(1)}%）
              </span>
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-slate-400">暂无数据</li>}
      </ul>
    </div>
  );
}

/**
 * 遗漏 Top10 条形图。
 * @param {{rows: Array<object>}} props 遗漏数据
 * @return {JSX.Element} 图表
 */
function OmissionChart({ rows }) {
  const option = useMemo(() => {
    const top = [...rows].sort((a, b) => b.current - a.current || a.num - b.num).slice(0, 10);
    return {
      grid: { left: 8, right: 32, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const item = params && params[0];
          if (!item) return '';
          const row = top[item.dataIndex];
          return [
            `前区 ${pad2(row.num)}`,
            `当前遗漏 ${row.current} 期`,
            `平均遗漏 ${formatNumber(row.avg, 1)} 期`,
            `最大遗漏 ${row.max} 期`,
            `出现 ${row.count} 次`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'value',
        name: '当前遗漏（期）',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: top.map((row) => pad2(row.num)),
        inverse: true,
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: top.map((row) => row.current),
          barMaxWidth: 16,
          itemStyle: { color: '#f59e0b', borderRadius: [0, 3, 3, 0] },
          label: { show: true, position: 'right', fontSize: 10, color: '#92400e' },
        },
      ],
    };
  }, [rows]);

  return <Chart option={option} height={320} ariaLabel="前区遗漏值前十条形图" />;
}

/**
 * 冷热与遗漏面板。
 * @param {{draws: Array<object>}} props 数据
 * @return {JSX.Element} 面板
 */
export default function HotColdPanel({ draws }) {
  const [range, setRange] = useState('all');
  const [sortKey, setSortKey] = useState('current');
  const [sortDesc, setSortDesc] = useState(true);

  const scoped = useMemo(() => subsetByRange(draws, range), [draws, range]);
  const frontFreq = useMemo(() => frequency(scoped, 'front'), [scoped]);
  const backFreq = useMemo(() => frequency(scoped, 'back'), [scoped]);
  const frontOmission = useMemo(() => omissionStats(draws, 'front'), [draws]);
  const backOmission = useMemo(() => omissionStats(draws, 'back'), [draws]);

  const frontLists = useMemo(() => hotColdLists(frontFreq, 5, 5), [frontFreq]);
  const backLists = useMemo(() => hotColdLists(backFreq, 2, 2), [backFreq]);

  const sortedOmission = useMemo(() => {
    const list = [...frontOmission];
    list.sort((a, b) => {
      const diff = Number(a[sortKey]) - Number(b[sortKey]);
      if (diff !== 0) return sortDesc ? -diff : diff;
      return a.num - b.num;
    });
    return list;
  }, [frontOmission, sortKey, sortDesc]);

  const backSortedOmission = useMemo(() => {
    const list = [...backOmission];
    list.sort((a, b) => b.current - a.current || a.num - b.num);
    return list;
  }, [backOmission]);

  if (!draws.length) return <EmptyHint />;

  /**
   * 切换排序字段。
   * @param {string} key 字段名
   * @return {void}
   */
  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">冷热与遗漏</h2>
            <p className="hint mt-1">
              冷热榜基于 {scoped.length} 期数据；遗漏统计基于全部 {draws.length}{' '}
              期（当前遗漏以最新一期为起点）。
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

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RankCard
            title="前区热号 Top5"
            subtitle="出现次数最多"
            items={frontLists.hot}
            zone="front"
            tone="hot"
            drawsCount={scoped.length}
          />
          <RankCard
            title="前区冷号 Bottom5"
            subtitle="出现次数最少"
            items={frontLists.cold}
            zone="front"
            tone="cold"
            drawsCount={scoped.length}
          />
          <RankCard
            title="后区热号 Top2"
            subtitle="出现次数最多"
            items={backLists.hot}
            zone="back"
            tone="hot"
            drawsCount={scoped.length}
          />
          <RankCard
            title="后区冷号 Bottom2"
            subtitle="出现次数最少"
            items={backLists.cold}
            zone="back"
            tone="cold"
            drawsCount={scoped.length}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad min-w-0">
          <h3 className="section-title">前区遗漏 Top10</h3>
          <p className="hint mb-1">
            遗漏值 = 从最新一期往前数，连续未开出的期数（最新一期开出则为 0）。
          </p>
          <OmissionChart rows={frontOmission} />
        </div>

        <div className="card card-pad min-w-0">
          <h3 className="section-title">后区当前遗漏</h3>
          <p className="hint mb-2">后区共 12 个号码，下面按当前遗漏从高到低排列。</p>
          <div className="table-wrap max-h-[20rem] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>号码</th>
                  <th>当前遗漏</th>
                  <th>平均遗漏</th>
                  <th>最大遗漏</th>
                  <th>出现次数</th>
                  <th>最近出现</th>
                </tr>
              </thead>
              <tbody>
                {backSortedOmission.map((row) => (
                  <tr key={`back-omission-${row.num}`}>
                    <td>
                      <BackBall n={row.num} size="sm" />
                    </td>
                    <td className="font-medium text-slate-800">{row.current}</td>
                    <td>{formatNumber(row.avg, 1)}</td>
                    <td>{row.max}</td>
                    <td>{row.count}</td>
                    <td className="text-slate-500">{row.lastNo || '从未开出'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">前区遗漏与出现明细（可点击表头排序）</h3>
        <p className="hint mt-1">
          平均遗漏 =（总期数 − 出现次数）/（出现次数 + 1）；最大遗漏包含首次出现前的连续未开期数。
        </p>
        <div className="table-wrap mt-2 max-h-[28rem] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>号码</th>
                {OMISSION_COLUMNS.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.label}
                      {sortKey === column.key ? (sortDesc ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                ))}
                <th>最近出现</th>
              </tr>
            </thead>
            <tbody>
              {sortedOmission.map((row) => (
                <tr key={`front-omission-${row.num}`}>
                  <td>
                    <FrontBall n={row.num} size="sm" />
                  </td>
                  <td className="font-medium text-slate-800">{row.current}</td>
                  <td>{formatNumber(row.avg, 1)}</td>
                  <td>{row.max}</td>
                  <td>{row.count}</td>
                  <td className="text-slate-500">
                    {row.lastNo ? `${row.lastNo}（${row.lastDate}）` : '从未开出'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <strong>赌徒谬误提醒：</strong>
        遗漏值高不代表「该出了」。每一期开奖都是独立事件，上一期结果不会影响下一期。把遗漏当成「欠账」是一种常见的认知偏差，长期看不会提高任何号码的出现概率。
      </div>
    </div>
  );
}
