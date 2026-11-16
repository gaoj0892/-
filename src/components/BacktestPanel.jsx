import { useMemo, useState } from 'react';
import Chart from './Chart.jsx';
import EmptyHint from './EmptyHint.jsx';
import { BallGroup } from './Ball.jsx';
import { PRIZE_LEVELS, TICKET_PRICE, runBacktest } from '../lib/backtest.js';
import { DEFAULT_PARAMS } from '../lib/generator.js';
import { formatNumber, formatPercent, pad2, todayStamp } from '../lib/format.js';
import { downloadText } from '../lib/download.js';

const PERIOD_OPTIONS = [50, 100, 200, 500];
const NOTE_OPTIONS = [1, 3, 5, 10];

/** 可选策略：id / 展示名 / 覆盖的选号参数 */
const STRATEGIES = [
  {
    id: 'uniform',
    label: '等概率随机',
    params: {},
    desc: '不参考任何历史统计，纯随机 —— 这是判断其他策略是否有用的基准。',
  },
  {
    id: 'freq',
    label: '频率加权（追热号）',
    params: { frontWeightMode: 'freq' },
    desc: '历史出现次数越多的号码权重越高。',
  },
  {
    id: 'omission',
    label: '遗漏加权（追冷号）',
    params: { frontWeightMode: 'omission' },
    desc: '当前遗漏期数越长的号码权重越高。',
  },
  {
    id: 'mix',
    label: '冷热混合（各 50%）',
    params: { frontWeightMode: 'mix' },
    desc: '频率权重与遗漏权重各占一半。',
  },
  {
    id: 'hot',
    label: '仅热号池 Top12',
    params: { frontPoolMode: 'hot', frontPoolSize: 12 },
    desc: '只从历史最热的 12 个前区号码里选。',
  },
  {
    id: 'cold',
    label: '仅冷号池 Bottom12',
    params: { frontPoolMode: 'cold', frontPoolSize: 12 },
    desc: '只从历史最冷的 12 个前区号码里选。',
  },
];

/** 前区命中理论均值 5 × 5/35 */
const EXPECTED_FRONT = 25 / 35;
/** 后区命中理论均值 2 × 2/12 */
const EXPECTED_BACK = 4 / 12;

/**
 * 指标卡。
 * @param {{label: string, value: string, sub?: string, tone?: 'default'|'good'|'bad'}} props
 * @return {JSX.Element} 卡片
 */
function Metric({ label, value, sub, tone = 'default' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{sub}</p> : null}
    </div>
  );
}

/**
 * 多期批量回测面板。
 * @param {{draws: Array<object>}} props 历史数据
 * @return {JSX.Element} 面板
 */
export default function BacktestPanel({ draws }) {
  const [periods, setPeriods] = useState(100);
  const [notes, setNotes] = useState(5);
  const [strategyId, setStrategyId] = useState('freq');
  const [useConstraints, setUseConstraints] = useState(false);
  const [seed, setSeed] = useState('dlt-backtest');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const strategy = STRATEGIES.find((item) => item.id === strategyId) || STRATEGIES[0];

  /**
   * 执行回测（放到下一个事件循环，先让"计算中"渲染出来）。
   * @return {void}
   */
  const handleRun = () => {
    if (!draws || draws.length < 2) return;
    setRunning(true);
    setError('');
    window.setTimeout(() => {
      try {
        const params = {
          ...DEFAULT_PARAMS,
          ...strategy.params,
          count: notes,
          draws,
          constraints: useConstraints
            ? { ...DEFAULT_PARAMS.constraints, enabled: true }
            : { ...DEFAULT_PARAMS.constraints, enabled: false },
        };
        const next = runBacktest(params, { periods, notes, seed, baselineRuns: 10 });
        setResult(next);
      } catch (err) {
        setResult(null);
        setError(err && err.message ? err.message : '回测执行失败，请缩短回测期数后重试。');
      } finally {
        setRunning(false);
      }
    }, 30);
  };

  const lossOption = useMemo(() => {
    if (!result || !result.rows.length) return null;
    const rows = result.rows;
    const step = Math.max(1, Math.ceil(rows.length / 12));
    return {
      grid: { left: 58, right: 20, top: 34, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        formatter: (items) => {
          const row = rows[items[0].dataIndex];
          return `${row.no}（${row.date}）<br/>累计投入 ¥${row.cumCost}<br/>累计回收 ¥${row.cumPrize}<br/>累计盈亏 ¥${row.profit}`;
        },
      },
      legend: { top: 4, right: 8, itemWidth: 10, itemHeight: 8, textStyle: { fontSize: 10 } },
      xAxis: {
        type: 'category',
        data: rows.map((row) => row.no),
        axisLabel: { fontSize: 9, interval: step - 1 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '元',
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 9 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          name: '累计投入',
          type: 'line',
          data: rows.map((row) => row.cumCost),
          symbol: 'none',
          lineStyle: { width: 2, color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
        },
        {
          name: '累计回收（固定奖）',
          type: 'line',
          data: rows.map((row) => row.cumPrize),
          symbol: 'none',
          lineStyle: { width: 2, color: '#0ea5e9' },
          itemStyle: { color: '#0ea5e9' },
          areaStyle: { color: 'rgba(14,165,233,0.12)' },
        },
      ],
    };
  }, [result]);

  const levelOption = useMemo(() => {
    if (!result) return null;
    return {
      grid: { left: 46, right: 18, top: 24, bottom: 34 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: PRIZE_LEVELS.map((item) => item.name.replace('等奖', '')),
        axisLabel: { fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        name: '注',
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 9 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          type: 'bar',
          data: result.levelCounts.map((item) => item.count),
          barMaxWidth: 26,
          itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
          label: { show: true, position: 'top', fontSize: 10, color: '#64748b' },
        },
      ],
    };
  }, [result]);

  /**
   * 导出回测明细 CSV。
   * @return {void}
   */
  const handleExport = () => {
    if (!result) return;
    const head = [
      '期号',
      '开奖日期',
      '前区1',
      '前区2',
      '前区3',
      '前区4',
      '前区5',
      '后区1',
      '后区2',
      '最佳注前区',
      '最佳注后区',
      '前区命中',
      '后区命中',
      '奖级',
      '当期固定奖',
      '累计投入',
      '累计回收',
    ];
    const lines = [head.join(',')];
    result.rows.forEach((row) => {
      lines.push(
        [
          row.no,
          row.date,
          ...row.actual.front.map(pad2),
          ...row.actual.back.map(pad2),
          row.bestNote ? row.bestNote.front.map(pad2).join(' ') : '',
          row.bestNote ? row.bestNote.back.map(pad2).join(' ') : '',
          row.bestFrontHits,
          row.bestBackHits,
          row.bestLevelName || '未中奖',
          row.prize,
          row.cumCost,
          row.cumPrize,
        ].join(','),
      );
    });
    downloadText(
      `回测明细_${todayStamp()}.csv`,
      `\uFEFF${lines.join('\r\n')}`,
      'text/csv;charset=utf-8',
    );
  };

  if (!draws || draws.length < 2) return <EmptyHint />;

  const detailRows = result ? [...result.rows].reverse().slice(0, 30) : [];

  return (
    <div className="space-y-4">
      <section className="card card-pad">
        <h2 className="section-title">多期批量回测</h2>
        <p className="hint mt-1">
          用滚动窗口逐期检验「如果按某个策略买，历史上会中多少」：回测第 i 期时只使用第 i
          期之前的数据选号，
          目标期的号码不参与选号（不存在未来函数）。每期注数、期数、种子都可固定复现。
        </p>
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs leading-relaxed text-amber-900">
            回测只回答「过去会怎样」，<strong>不能预测下一期</strong>
            。彩票每期独立随机，任何策略的历史成绩都不代表未来；
            若回测显示某策略优于随机，几乎都来自样本内挑选或随机波动。
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label">回测期数</span>
            <select
              className="input w-full"
              value={periods}
              onChange={(event) => setPeriods(Number(event.target.value))}
            >
              {PERIOD_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  最近 {value} 期
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">每期注数</span>
            <select
              className="input w-full"
              value={notes}
              onChange={(event) => setNotes(Number(event.target.value))}
            >
              {NOTE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} 注（{value * TICKET_PRICE} 元/期）
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">选号策略</span>
            <select
              className="input w-full"
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
            >
              {STRATEGIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">随机种子（同种子可复现）</span>
            <input
              className="input w-full"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="留空则随机"
            />
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-red-600"
              checked={useConstraints}
              onChange={(event) => setUseConstraints(event.target.checked)}
            />
            启用奇偶/大小/和值约束（默认关闭，避免约束本身干扰对策略的判断）
          </label>
          <span className="hint">{strategy.desc}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={handleRun} disabled={running}>
            {running ? '计算中…' : '开始回测'}
          </button>
          {result ? (
            <button type="button" className="btn-ghost btn-xs" onClick={handleExport}>
              导出明细 CSV
            </button>
          ) : null}
          {result ? (
            <span className="chip">
              种子 {result.seed} · 耗时 {result.elapsedMs} ms
            </span>
          ) : null}
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      </section>

      {!result ? (
        <section className="card card-pad">
          <p className="text-sm text-slate-600">
            设置好参数后点击「开始回测」。建议先用默认的「频率加权 + 最近 100
            期」跑一次，再与「等概率随机」对比。
          </p>
        </section>
      ) : (
        <>
          <section className="card card-pad">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title">回测汇总</h2>
              <p className="hint">
                {result.rows[0].no} ~ {result.rows[result.rows.length - 1].no} · 共 {result.periods}{' '}
                期 · 每期 {result.notesPerDraw} 注 · 策略「{strategy.label}」
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Metric
                label="总注数"
                value={`${result.totalNotes} 注`}
                sub={`${result.periods} 期 × ${result.notesPerDraw} 注`}
              />
              <Metric label="总投入" value={`¥${result.cost}`} sub={`每注 ${TICKET_PRICE} 元`} />
              <Metric
                label="固定奖回收"
                value={`¥${result.fixedPrize}`}
                sub="不含一、二等奖（浮动）"
                tone={result.fixedPrize > 0 ? 'good' : 'default'}
              />
              <Metric
                label="固定奖回收率"
                value={formatPercent(result.roi)}
                sub="回收 ÷ 投入"
                tone={result.roi >= 0.5 ? 'default' : 'bad'}
              />
              <Metric
                label="前区平均命中"
                value={formatNumber(result.avgFrontHits)}
                sub={`理论 ${formatNumber(EXPECTED_FRONT)}`}
              />
              <Metric
                label="后区平均命中"
                value={formatNumber(result.avgBackHits)}
                sub={`理论 ${formatNumber(EXPECTED_BACK)}`}
              />
            </div>

            <p className="hint mt-3">
              中奖注数（九等奖及以上）共{' '}
              <strong className="text-slate-700">{result.winNotes}</strong> 注， 占{' '}
              {formatPercent(result.totalNotes ? result.winNotes / result.totalNotes : 0)}。
              返奖率固定约 51%，长期回收率必然低于投入——这是规则决定的，不是选号技术能扭转的。
            </p>
          </section>

          <section className="card card-pad">
            <h2 className="section-title">策略 vs 纯随机基准</h2>
            <div className="table-wrap mt-2">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>对比项</th>
                    <th>本策略</th>
                    <th>纯随机基准（10 轮均值）</th>
                    <th>差值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>前区平均命中</td>
                    <td className="font-medium">{formatNumber(result.avgFrontHits, 4)}</td>
                    <td>{formatNumber(result.baseline.avgFrontHits, 4)}</td>
                    <td>{formatNumber(result.avgFrontHits - result.baseline.avgFrontHits, 4)}</td>
                  </tr>
                  <tr>
                    <td>后区平均命中</td>
                    <td className="font-medium">{formatNumber(result.avgBackHits, 4)}</td>
                    <td>{formatNumber(result.baseline.avgBackHits, 4)}</td>
                    <td>{formatNumber(result.avgBackHits - result.baseline.avgBackHits, 4)}</td>
                  </tr>
                  <tr>
                    <td>中奖注数</td>
                    <td className="font-medium">{result.winNotes}</td>
                    <td>
                      {result.baseline.winNotes}（{result.baseline.runs} 轮合计）
                    </td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td>固定奖回收率</td>
                    <td className="font-medium">{formatPercent(result.roi)}</td>
                    <td>{formatPercent(result.baseline.roi)}</td>
                    <td>{formatPercent(result.roi - result.baseline.roi)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-700">
                {result.comparison.conclusion}
              </p>
              <p className="hint mt-1">
                检验口径：两样本 z 检验（策略 {result.totalNotes} 注 vs 基准{' '}
                {result.baseline.totalNotes} 注，α=0.05）。
                注数越多，越容易检出微小差异——但差异再显著，也不足以改变 1/21,425,712 的量级。
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card card-pad min-w-0">
              <h2 className="section-title">累计投入 vs 累计回收</h2>
              <Chart option={lossOption} height={280} ariaLabel="累计投入与累计回收折线图" />
              <p className="hint mt-1">
                两线开口随时间单调扩大，就是负期望的直观表现：买得越久，固定奖回收越追不上投入。
              </p>
            </div>
            <div className="card card-pad min-w-0">
              <h2 className="section-title">各奖级命中注数</h2>
              <Chart option={levelOption} height={280} ariaLabel="各奖级命中注数柱状图" />
              <p className="hint mt-1">
                一、二等奖为浮动奖金，这里只统计注数、不计金额；九等奖门槛最低（如 0+2），出现最多。
              </p>
            </div>
          </section>

          <section className="card card-pad">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title">逐期明细（最近 30 期）</h2>
              <p className="hint">「最佳注」为当期命中奖级最高的一注</p>
            </div>
            <div className="table-wrap mt-2">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>期号</th>
                    <th>开奖日期</th>
                    <th>当期开奖号码</th>
                    <th>最佳注</th>
                    <th>命中</th>
                    <th>奖级</th>
                    <th>固定奖</th>
                    <th>累计盈亏</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row) => (
                    <tr key={row.no}>
                      <td>{row.no}</td>
                      <td>{row.date}</td>
                      <td>
                        <BallGroup front={row.actual.front} back={row.actual.back} size="xs" />
                      </td>
                      <td>
                        {row.bestNote ? (
                          <BallGroup
                            front={row.bestNote.front}
                            back={row.bestNote.back}
                            size="xs"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {row.bestFrontHits}+{row.bestBackHits}
                      </td>
                      <td
                        className={
                          row.bestLevel ? 'font-medium text-emerald-600' : 'text-slate-400'
                        }
                      >
                        {row.bestLevelName || '未中奖'}
                      </td>
                      <td>¥{row.prize}</td>
                      <td className={row.profit < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {row.profit > 0 ? '+' : ''}
                        {row.profit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint mt-2">
              明细共 {result.rows.length} 期，表格仅展示最近 30 期；完整数据可用上方「导出明细
              CSV」下载。
            </p>
          </section>
        </>
      )}
    </div>
  );
}
