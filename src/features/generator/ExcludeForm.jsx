/**
 * 「排除号码」卡片：前区 / 后区号码的多选排除。
 */

import NumberToggleGrid from './NumberToggleGrid.jsx';

/**
 * 排除号码卡片。
 *
 * @param {object} props 组件属性
 * @param {object} props.params 当前参数（含 excludeFront / excludeBack）
 * @param {(key: string, num: number) => void} props.toggleNumber 切换某个号码
 * @return {JSX.Element} 卡片
 */
export default function ExcludeForm({ params, toggleNumber }) {
  return (
    <div className="card card-pad">
      <h3 className="section-title">排除号码</h3>
      <p className="hint mt-1">
        点击号码即排除（灰色带删除线）。排除只影响本次抽号，不写入历史数据。
      </p>
      <div className="mt-2 space-y-2">
        <div>
          <p className="label">前区排除（{params.excludeFront.length} 个）</p>
          <NumberToggleGrid
            max={35}
            selected={params.excludeFront}
            onToggle={(num) => toggleNumber('excludeFront', num)}
            mode="exclude"
          />
        </div>
        <div>
          <p className="label">后区排除（{params.excludeBack.length} 个）</p>
          <NumberToggleGrid
            max={12}
            selected={params.excludeBack}
            onToggle={(num) => toggleNumber('excludeBack', num)}
            variant="back"
            mode="exclude"
          />
        </div>
      </div>
    </div>
  );
}
