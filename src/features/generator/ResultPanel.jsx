/**
 * 右侧结果区：免责横幅、生成结果列表、空结果提示与参数说明。
 */

import EmptyHint from '@/components/EmptyHint.jsx';
import GroupCard from './GroupCard.jsx';

/**
 * 结果区。
 *
 * @param {object} props 组件属性
 * @param {object|null} props.result 生成结果（null 表示尚未生成）
 * @param {Array<object>} props.draws 历史开奖数据
 * @param {() => void} props.onCopy 复制全部
 * @param {() => void} props.onExport 导出 TXT
 * @return {JSX.Element} 结果区
 */
export default function ResultPanel({ result, draws, onCopy, onExport }) {
  return (
    <div className="space-y-3 lg:col-span-8">
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        <strong>以下号码由随机算法生成，与下期开奖结果无因果关系。</strong>
        彩票每期独立随机，任何筛选、加权、冷热或遗漏规则都不会提高中奖概率，结果仅供娱乐参考。
      </div>

      {!draws.length && <EmptyHint />}

      {result && result.groups.length > 0 && (
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="section-title">生成结果（{result.groups.length} 组）</h3>
              <p className="hint mt-0.5">
                随机种子：<span className="font-mono text-slate-700">{result.seed}</span>
                {result.groups.some((group) => group.relaxed)
                  ? ' · 部分组合放宽了约束'
                  : ' · 全部组合满足约束'}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-blue btn-xs" onClick={onCopy}>
                复制全部
              </button>
              <button type="button" className="btn-ghost btn-xs" onClick={onExport}>
                导出为 TXT
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {result.groups.map((group, index) => (
              <GroupCard
                key={`${group.front.join('-')}-${group.back.join('-')}`}
                group={group}
                index={index + 1}
                totalDraws={draws.length}
              />
            ))}
          </div>

          <p className="hint mt-3">
            「该组合历史是否开出」统计基于当前本地全部 {draws.length} 期数据。头奖单注命中概率为
            1/21,425,712， 任何组合（包括历史上从未开出的组合）的中奖概率完全相同。
          </p>
        </div>
      )}

      {result && result.groups.length === 0 && (
        <div className="card card-pad">
          <p className="text-sm font-medium text-slate-700">没有生成任何组合</p>
          <ul className="hint mt-1 space-y-0.5">
            {(result.warnings.length ? result.warnings : ['请调整号码池或排除号码后重试。']).map(
              (warning) => (
                <li key={warning}>· {warning}</li>
              ),
            )}
          </ul>
        </div>
      )}

      {!result && draws.length > 0 && (
        <div className="card card-pad">
          <p className="text-sm text-slate-600">
            左侧设置好参数后点击「开始生成」。默认是等概率随机 ——
            这已经是数学上最「公平」的选号方式。
          </p>
          <p className="hint mt-1">
            提示：无论选择哪种权重模式，单注中头奖的概率都是
            1/21,425,712。加权只是让某些号码「更容易被随机到」，不是「更容易开出来」。
          </p>
        </div>
      )}

      <div className="card card-pad">
        <h3 className="section-title">本页参数说明</h3>
        <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600">
          <li>
            · 前区池「仅热号 / 仅冷号 / 遗漏最高」按所选历史数据的频次与当前遗漏排序取前 N
            个；缩小号码池会降低组合覆盖率。
          </li>
          <li>
            ·
            权重模式只改变抽样概率：按历史频率加权会让历史高频号更容易被抽到，但不会让它更容易开出。
          </li>
          <li>
            · 约束条件会做最多 200
            次重试；若号码池太小导致无法满足，会放宽为「仅去重」并在卡片上标注。
          </li>
          <li>· 组与组之间保证不重复（前区 + 后区完全相同视为重复）。</li>
          <li>· 相同随机种子 + 相同参数 + 相同历史数据 ⇒ 完全相同的结果，便于核对与复现。</li>
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500">
        单注 2 元，头奖概率 1/21,425,712（约 0.0000047%）。以每天买 1 注计算，长期平均需要约 5.9
        万年才可能命中一次头奖。 请理性购彩，量力而行；未成年人不得购彩或兑奖。
      </div>
    </div>
  );
}
