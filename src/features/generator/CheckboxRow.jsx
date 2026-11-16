/**
 * 带可选提示文案的复选框行。
 */

/**
 * 复选框行。
 *
 * @param {object} props 组件属性
 * @param {boolean} props.checked 是否选中
 * @param {(checked: boolean) => void} props.onChange 变更回调
 * @param {string} props.label 主文案
 * @param {string} [props.hint] 补充说明
 * @return {JSX.Element} 复选项
 */
export default function CheckboxRow({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 accent-red-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        {hint ? <span className="ml-1 text-slate-400">{hint}</span> : null}
      </span>
    </label>
  );
}
