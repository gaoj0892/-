import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 极简 Toast 状态管理。
 * @return {{toast: object|null, showToast: Function, closeToast: Function}} Toast 状态与控制函数
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((title, lines = [], type = 'ok') => {
    const normalized = Array.isArray(lines) ? lines : [String(lines)];
    setToast({ title, lines: normalized.filter((line) => Boolean(line)), type, at: Date.now() });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  return { toast, showToast, closeToast };
}

const TYPE_CLASS = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-slate-300 bg-white text-slate-800',
};

/**
 * Toast 展示组件（固定在右下角）。
 * @param {{toast: object|null, onClose: Function}} props
 * @return {JSX.Element|null} Toast 节点
 */
export function ToastBox({ toast, onClose }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!toast) return undefined;
    const lifetime = toast.type === 'error' ? 10000 : 7000;
    timerRef.current = window.setTimeout(() => {
      onClose();
    }, lifetime);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[26rem]">
      <div
        className={`rounded-xl border p-3 shadow-lg ${TYPE_CLASS[toast.type] || TYPE_CLASS.info}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{toast.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-1 text-xs text-slate-500 hover:bg-black/5"
            aria-label="关闭提示"
          >
            关闭
          </button>
        </div>
        {toast.lines.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs leading-relaxed">
            {toast.lines.map((line, index) => (
              <li key={`${index}-${line}`} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
