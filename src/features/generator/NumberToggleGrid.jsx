/**
 * 号码多选网格（前区/后区 × 号码池/排除 两种模式）。
 */

import { numRange, pad2 } from '@/lib/format.js';

/**
 * 号码多选网格。
 *
 * @param {object} props 组件属性
 * @param {number} props.max 号码上限（前区 35 / 后区 12）
 * @param {number[]} props.selected 已选号码
 * @param {(n: number) => void} props.onToggle 点击号码回调
 * @param {'front'|'back'} [props.variant] 前区红色 / 后区蓝色
 * @param {'pool'|'exclude'} [props.mode] 加入号码池 / 排除号码
 * @return {JSX.Element} 网格
 */
export default function NumberToggleGrid({
  max,
  selected,
  onToggle,
  variant = 'front',
  mode = 'pool',
}) {
  const chosen = new Set(selected);
  return (
    <div className="flex flex-wrap gap-1">
      {numRange(1, max).map((n) => {
        const active = chosen.has(n);
        const base =
          'h-7 w-7 rounded-full border text-[11px] font-semibold transition select-none focus:outline-none focus:ring-2 focus:ring-offset-1';
        let tone = '';
        if (mode === 'exclude') {
          tone = active
            ? 'border-slate-400 bg-slate-400 text-white line-through focus:ring-slate-300'
            : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400';
        } else if (variant === 'front') {
          tone = active
            ? 'border-red-600 bg-red-600 text-white focus:ring-red-200'
            : 'border-slate-300 bg-white text-slate-500 hover:border-red-400';
        } else {
          tone = active
            ? 'border-blue-600 bg-blue-600 text-white focus:ring-blue-200'
            : 'border-slate-300 bg-white text-slate-500 hover:border-blue-400';
        }
        return (
          <button
            key={`${variant}-${mode}-${n}`}
            type="button"
            aria-pressed={active}
            className={`${base} ${tone}`}
            onClick={() => onToggle(n)}
            title={
              mode === 'exclude'
                ? `点击${active ? '取消排除' : '排除'} ${pad2(n)}`
                : `点击${active ? '移除' : '加入'} ${pad2(n)}`
            }
          >
            {pad2(n)}
          </button>
        );
      })}
    </div>
  );
}
