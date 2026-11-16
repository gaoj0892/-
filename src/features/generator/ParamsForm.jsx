/**
 * 「选号参数」卡片：组数、前区池策略与权重、后区池策略。
 */

import { clamp } from '@/lib/format.js';
import NumberToggleGrid from './NumberToggleGrid.jsx';
import { BACK_POOL_MODE_OPTIONS, POOL_MODE_OPTIONS, WEIGHT_MODE_OPTIONS } from './constants.js';

/**
 * 选号参数卡片。
 *
 * @param {object} props 组件属性
 * @param {object} props.params 当前参数
 * @param {(patch: object) => void} props.updateParam 合并更新顶层参数
 * @param {(key: string, num: number) => void} props.toggleNumber 切换自定义池/排除号
 * @return {JSX.Element} 卡片
 */
export default function ParamsForm({ params, updateParam, toggleNumber }) {
  return (
    <div className="card card-pad">
      <h2 className="section-title">选号参数</h2>
      <p className="hint mt-1">
        所有参数只影响「随机抽取时的权重与筛选」，不会改变任何号码的真实开出概率。
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor="gen-count">
            生成组数（1-20）
          </label>
          <input
            id="gen-count"
            type="number"
            min={1}
            max={20}
            className="input w-24"
            value={params.count}
            onChange={(event) => updateParam({ count: clamp(event.target.value, 1, 20) })}
          />
        </div>

        <div>
          <label className="label" htmlFor="gen-front-pool">
            前区池策略
          </label>
          <select
            id="gen-front-pool"
            className="input w-full"
            value={params.frontPoolMode}
            onChange={(event) => updateParam({ frontPoolMode: event.target.value })}
          >
            {POOL_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(params.frontPoolMode === 'hot' ||
            params.frontPoolMode === 'cold' ||
            params.frontPoolMode === 'omission') && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-slate-500">N =</span>
              <input
                type="number"
                min={5}
                max={35}
                className="input-sm w-20"
                value={params.frontPoolSize}
                onChange={(event) =>
                  updateParam({ frontPoolSize: clamp(event.target.value, 5, 35) })
                }
              />
              <span className="text-xs text-slate-400">（5-35，需 ≥ 5 才能抽出 5 个前区号）</span>
            </div>
          )}
          {params.frontPoolMode === 'custom' && (
            <div className="mt-2 rounded-lg border border-slate-200 p-2">
              <p className="hint mb-1">
                点击号码加入自定义前区池（已选 {params.frontCustom.length} 个，至少 5 个）
              </p>
              <NumberToggleGrid
                max={35}
                selected={params.frontCustom}
                onToggle={(num) => toggleNumber('frontCustom', num)}
                variant="front"
              />
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="gen-front-weight">
            前区权重模式
          </label>
          <select
            id="gen-front-weight"
            className="input w-full"
            value={params.frontWeightMode}
            onChange={(event) => updateParam({ frontWeightMode: event.target.value })}
          >
            {WEIGHT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="hint mt-1">
            加权无放回抽样：按权重逐位抽取，抽中后立即从池中移除，因此不会出现同一组内重复号码。
          </p>
        </div>

        <div>
          <label className="label" htmlFor="gen-back-pool">
            后区池策略
          </label>
          <select
            id="gen-back-pool"
            className="input w-full"
            value={params.backPoolMode}
            onChange={(event) => updateParam({ backPoolMode: event.target.value })}
          >
            {BACK_POOL_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(params.backPoolMode === 'hot' || params.backPoolMode === 'cold') && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-slate-500">N =</span>
              <input
                type="number"
                min={2}
                max={12}
                className="input-sm w-20"
                value={params.backPoolSize}
                onChange={(event) =>
                  updateParam({ backPoolSize: clamp(event.target.value, 2, 12) })
                }
              />
            </div>
          )}
          {params.backPoolMode === 'custom' && (
            <div className="mt-2 rounded-lg border border-slate-200 p-2">
              <p className="hint mb-1">
                点击号码加入自定义后区池（已选 {params.backCustom.length} 个，至少 2 个）
              </p>
              <NumberToggleGrid
                max={12}
                selected={params.backCustom}
                onToggle={(num) => toggleNumber('backCustom', num)}
                variant="back"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
