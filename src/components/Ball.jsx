import { pad2 } from '../lib/format.js';

const SIZE_CLASS = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

const BASE = 'ball shrink-0';

/**
 * 前区（红球）球体。
 * @param {{n: number, size?: 'xs'|'sm'|'md'|'lg', muted?: boolean, selected?: boolean, onClick?: Function, title?: string}} props
 * @return {JSX.Element} 号码球
 */
export function FrontBall({ n, size = 'md', muted = false, selected = false, onClick, title }) {
  const classes = [
    BASE,
    SIZE_CLASS[size] || SIZE_CLASS.md,
    muted ? 'bg-slate-200 text-slate-500' : 'bg-red-600 text-white',
    selected ? 'ring-2 ring-red-300 ring-offset-1' : '',
    onClick ? 'cursor-pointer transition hover:brightness-110 active:scale-95' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        title={title || `前区 ${pad2(n)}`}
      >
        {pad2(n)}
      </button>
    );
  }
  return (
    <span className={classes} title={title || `前区 ${pad2(n)}`}>
      {pad2(n)}
    </span>
  );
}

/**
 * 后区（蓝球）球体。
 * @param {{n: number, size?: 'xs'|'sm'|'md'|'lg', muted?: boolean, selected?: boolean, onClick?: Function, title?: string}} props
 * @return {JSX.Element} 号码球
 */
export function BackBall({ n, size = 'md', muted = false, selected = false, onClick, title }) {
  const classes = [
    BASE,
    SIZE_CLASS[size] || SIZE_CLASS.md,
    muted ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white',
    selected ? 'ring-2 ring-blue-300 ring-offset-1' : '',
    onClick ? 'cursor-pointer transition hover:brightness-110 active:scale-95' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        title={title || `后区 ${pad2(n)}`}
      >
        {pad2(n)}
      </button>
    );
  }
  return (
    <span className={classes} title={title || `后区 ${pad2(n)}`}>
      {pad2(n)}
    </span>
  );
}

/**
 * 一组号码（5 红 + 2 蓝）。
 * @param {{front: number[], back: number[], size?: string, className?: string}} props
 * @return {JSX.Element} 号码组
 */
export function BallGroup({ front, back, size = 'md', className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {(front || []).map((n) => (
        <FrontBall key={`f-${n}`} n={n} size={size} />
      ))}
      <span className="mx-0.5 text-xs text-slate-400">+</span>
      {(back || []).map((n) => (
        <BackBall key={`b-${n}`} n={n} size={size} />
      ))}
    </div>
  );
}
