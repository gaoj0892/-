/**
 * 「号码池概览 + 随机种子 + 生成按钮」卡片。
 */

/**
 * 生成控制卡片。
 *
 * @param {object} props 组件属性
 * @param {object} props.pools 号码池与提示（buildPools 结果）
 * @param {string} props.seedInput 种子输入框内容
 * @param {(value: string) => void} props.setSeedInput 种子输入框变更
 * @param {number|string|null} props.lastSeed 上一次实际使用的种子
 * @param {() => void} props.onGenerate 生成回调
 * @param {() => void} props.onReset 重置回调
 * @return {JSX.Element} 卡片
 */
export default function RunCard({ pools, seedInput, setSeedInput, lastSeed, onGenerate, onReset }) {
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip">前区可用 {pools.frontPool.length} 个</span>
        <span className="chip">后区可用 {pools.backPool.length} 个</span>
        {pools.warnings.length > 0 && (
          <span className="chip border-amber-300 bg-amber-50 text-amber-800">池设置有提示</span>
        )}
      </div>
      {pools.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-700">
          {pools.warnings.map((warning) => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <label className="label" htmlFor="gen-seed">
          随机种子（留空则每次随机；填入相同数字可复现结果）
        </label>
        <div className="flex items-center gap-2">
          <input
            id="gen-seed"
            className="input w-full"
            value={seedInput}
            placeholder="例如 123456789"
            onChange={(event) => setSeedInput(event.target.value)}
          />
          {lastSeed !== null && (
            <button
              type="button"
              className="btn-ghost btn-xs shrink-0"
              onClick={() => setSeedInput(String(lastSeed))}
            >
              填入本次种子
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary flex-1" onClick={onGenerate}>
          开始生成
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>
          重置参数
        </button>
      </div>
    </div>
  );
}
