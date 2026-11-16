/**
 * 「约束条件」卡片：奇偶比、大小比、和值区间、连号开关。
 */

import { clamp } from '@/lib/format.js';
import CheckboxRow from './CheckboxRow.jsx';

/**
 * 约束条件卡片。
 *
 * @param {object} props 组件属性
 * @param {object} props.constraints 约束条件对象
 * @param {(patch: object) => void} props.updateConstraints 合并更新约束条件
 * @return {JSX.Element} 卡片
 */
export default function ConstraintsForm({ constraints, updateConstraints }) {
  const sumMin = Number(constraints.sumMin);
  const sumMax = Number(constraints.sumMax);
  const sumInvalid = Number.isFinite(sumMin) && Number.isFinite(sumMax) && sumMin > sumMax;

  return (
    <div className="card card-pad">
      <h3 className="section-title">约束条件</h3>
      <div className="mt-2 space-y-2">
        <CheckboxRow
          checked={constraints.enabled}
          onChange={(checked) => updateConstraints({ enabled: checked })}
          label="启用约束（关闭后仅做池内随机 + 组间去重）"
        />
        <div className={constraints.enabled ? 'space-y-2 pl-5' : 'space-y-2 pl-5 opacity-50'}>
          <CheckboxRow
            checked={constraints.oddEven}
            onChange={(checked) => updateConstraints({ oddEven: checked })}
            label="奇偶比限定为 2:3 / 3:2 / 4:1 / 1:4"
          />
          <CheckboxRow
            checked={constraints.bigSmall}
            onChange={(checked) => updateConstraints({ bigSmall: checked })}
            label="大小比限定为 2:3 / 3:2"
            hint="小号 01-17"
          />
          <div>
            <CheckboxRow
              checked={constraints.sumRange}
              onChange={(checked) => updateConstraints({ sumRange: checked })}
              label="和值区间"
            />
            <div className="mt-1 flex items-center gap-1.5 pl-5">
              <input
                type="number"
                className="input-sm w-20"
                value={constraints.sumMin}
                disabled={!constraints.sumRange}
                onChange={(event) =>
                  updateConstraints({ sumMin: clamp(event.target.value, 15, 175) })
                }
                aria-label="和值下限"
              />
              <span className="text-xs text-slate-400">~</span>
              <input
                type="number"
                className="input-sm w-20"
                value={constraints.sumMax}
                disabled={!constraints.sumRange}
                onChange={(event) =>
                  updateConstraints({ sumMax: clamp(event.target.value, 15, 175) })
                }
                aria-label="和值上限"
              />
            </div>
            {sumInvalid && (
              <p className="mt-1 pl-5 text-[11px] text-red-600">
                和值下限大于上限，生成时会自动对调。
              </p>
            )}
          </div>
          <CheckboxRow
            checked={constraints.allowConsecutive}
            onChange={(checked) => updateConstraints({ allowConsecutive: checked })}
            label="允许连号"
          />
        </div>
      </div>
    </div>
  );
}
