/**
 * 选号策略面板（核心功能）：只负责组合各子块，逻辑在 `useGeneratorParams`。
 *
 * 拆分来源：原 `src/components/GeneratorPanel.jsx`（715 行）。
 */

import { ToastBox } from '@/components/Toast.jsx';
import ConstraintsForm from './ConstraintsForm.jsx';
import ExcludeForm from './ExcludeForm.jsx';
import ParamsForm from './ParamsForm.jsx';
import ResultPanel from './ResultPanel.jsx';
import RunCard from './RunCard.jsx';
import useGeneratorParams from './useGeneratorParams.js';

/**
 * 选号策略面板（核心功能）。
 *
 * @param {{draws: Array<object>}} props 历史数据
 * @return {JSX.Element} 面板
 */
export default function GeneratorPanel({ draws }) {
  const {
    params,
    seedInput,
    setSeedInput,
    result,
    lastSeed,
    pools,
    toast,
    closeToast,
    updateParam,
    updateConstraints,
    toggleNumber,
    handleGenerate,
    handleReset,
    handleCopy,
    handleExport,
  } = useGeneratorParams(draws);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-4">
        <ParamsForm params={params} updateParam={updateParam} toggleNumber={toggleNumber} />
        <ConstraintsForm constraints={params.constraints} updateConstraints={updateConstraints} />
        <ExcludeForm params={params} toggleNumber={toggleNumber} />
        <RunCard
          pools={pools}
          seedInput={seedInput}
          setSeedInput={setSeedInput}
          lastSeed={lastSeed}
          onGenerate={handleGenerate}
          onReset={handleReset}
        />
      </div>

      <ResultPanel result={result} draws={draws} onCopy={handleCopy} onExport={handleExport} />

      <ToastBox toast={toast} onClose={closeToast} />
    </div>
  );
}
