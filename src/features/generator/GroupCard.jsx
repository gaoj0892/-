/**
 * 单个选号结果卡片：号码、指标、历史开出标注与连号提示。
 */

import { BackBall, FrontBall } from '@/components/Ball.jsx';

/**
 * 单个选号结果卡片。
 *
 * @param {object} props 组件属性
 * @param {object} props.group 一组选号结果
 * @param {number} props.index 序号（从 1 开始）
 * @param {number} props.totalDraws 历史总期数（用于「历史是否开出」措辞）
 * @return {JSX.Element} 卡片
 */
export default function GroupCard({ group, index, totalDraws }) {
  const historyText =
    group.historyCount > 0
      ? `该组合历史曾开出 ${group.historyCount} 次（共 ${totalDraws} 期）`
      : `该组合在 ${totalDraws} 期历史中从未开出`;

  const metrics = [
    { label: '和值', value: group.sum },
    { label: '奇偶比', value: group.oddEven.label },
    { label: '大小比', value: group.bigSmall.label },
    { label: '跨度', value: group.span },
    { label: `与 ${group.latestNo || '最新期'} 重号`, value: `${group.repeatWithLatest} 个` },
    { label: '命中历史热号', value: `${group.hitHotCount} / 5` },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-slate-400">#{index}</span>
          {(group.front || []).map((n) => (
            <FrontBall key={`gf-${n}`} n={n} size="md" />
          ))}
          <span className="mx-0.5 text-xs text-slate-400">+</span>
          {(group.back || []).map((n) => (
            <BackBall key={`gb-${n}`} n={n} size="md" />
          ))}
        </div>
        {group.relaxed && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            部分约束未满足
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex justify-between gap-1 border-b border-dashed border-slate-100 pb-0.5"
          >
            <dt className="truncate">{metric.label}</dt>
            <dd className="font-medium text-slate-700">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{historyText}</p>
      {group.consecutive.hasConsecutive && (
        <p className="mt-1 text-[11px] text-slate-400">
          含连号：{group.consecutive.pairs.map((pair) => pair.join('-')).join('、')}
        </p>
      )}
    </div>
  );
}
