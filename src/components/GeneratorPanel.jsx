import { useMemo, useState } from 'react';
import EmptyHint from './EmptyHint.jsx';
import { ToastBox, useToast } from './Toast.jsx';
import { FrontBall, BackBall } from './Ball.jsx';
import { DEFAULT_PARAMS, buildPools, generateNumbers } from '../lib/generator.js';
import { clamp, numRange, pad2, todayStamp } from '../lib/format.js';

const POOL_MODE_OPTIONS = [
  { value: 'all', label: '全部号码' },
  { value: 'hot', label: '仅热号（频次 Top N）' },
  { value: 'cold', label: '仅冷号（频次 Bottom N）' },
  { value: 'omission', label: '仅遗漏值最高 N 个' },
  { value: 'custom', label: '自定义号码池' },
];

const BACK_POOL_MODE_OPTIONS = [
  { value: 'all', label: '全部号码' },
  { value: 'hot', label: '热号 Top4' },
  { value: 'cold', label: '冷号 Bottom4' },
  { value: 'custom', label: '自定义号码池' },
];

const WEIGHT_MODE_OPTIONS = [
  { value: 'uniform', label: '等概率随机' },
  { value: 'freq', label: '按历史频率加权' },
  { value: 'omission', label: '按遗漏值加权' },
  { value: 'mix', label: '冷热混合（频率 50% + 遗漏 50%）' },
];

/** UI 侧默认参数（与 lib/generator 的 DEFAULT_PARAMS 字段保持一致） */
const DEFAULT_UI_PARAMS = {
  count: DEFAULT_PARAMS.count,
  frontPoolMode: DEFAULT_PARAMS.frontPoolMode,
  frontPoolSize: DEFAULT_PARAMS.frontPoolSize,
  frontCustom: [],
  frontWeightMode: DEFAULT_PARAMS.frontWeightMode,
  backPoolMode: DEFAULT_PARAMS.backPoolMode,
  backPoolSize: DEFAULT_PARAMS.backPoolSize,
  backCustom: [],
  excludeFront: [],
  excludeBack: [],
  constraints: { ...DEFAULT_PARAMS.constraints },
};

/**
 * 触发浏览器下载。
 * @param {string} filename 文件名
 * @param {string} content 内容
 * @param {string} mimeType MIME
 * @return {void}
 */
function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * 号码多选网格。
 * @param {{max: number, selected: number[], onToggle: Function, variant?: 'front'|'back', mode?: 'pool'|'exclude'}} props
 * @return {JSX.Element} 网格
 */
function NumberToggleGrid({ max, selected, onToggle, variant = 'front', mode = 'pool' }) {
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
            title={mode === 'exclude' ? `点击${active ? '取消排除' : '排除'} ${pad2(n)}` : `点击${active ? '移除' : '加入'} ${pad2(n)}`}
          >
            {pad2(n)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 复选框行。
 * @param {{checked: boolean, onChange: Function, label: string, hint?: string}} props
 * @return {JSX.Element} 复选项
 */
function CheckboxRow({ checked, onChange, label, hint }) {
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

/**
 * 单个选号结果卡片。
 * @param {{group: object, index: number, totalDraws: number}} props
 * @return {JSX.Element} 卡片
 */
function GroupCard({ group, index, totalDraws }) {
  const historyText =
    group.historyCount > 0
      ? `该组合历史曾开出 ${group.historyCount} 次（共 ${totalDraws} 期）`
      : `该组合在 ${totalDraws} 期历史中从未开出`;

  const metrics = [
    { label: '和值', value: group.sum },
    { label: '奇偶比', value: group.oddEven.label },
    { label: '大小比', value: group.bigSmall.label },
    { label: '跨度', value: group.span },
    { label: `与 ${group.latestNo || '最新期'} 重号`, value: `${group.repeatWithLatest} 个` },
    { label: '命中历史热号', value: `${group.hitHotCount} / 5` },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-slate-400">#{index}</span>
          {(group.front || []).map((n) => (
            <FrontBall key={`gf-${n}`} n={n} size="md" />
          ))}
          <span className="mx-0.5 text-xs text-slate-400">+</span>
          {(group.back || []).map((n) => (
            <BackBall key={`gb-${n}`} n={n} size="md" />
          ))}
        </div>
        {group.relaxed && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            部分约束未满足
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex justify-between gap-1 border-b border-dashed border-slate-100 pb-0.5">
            <dt className="truncate">{metric.label}</dt>
            <dd className="font-medium text-slate-700">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{historyText}</p>
      {group.consecutive.hasConsecutive && (
        <p className="mt-1 text-[11px] text-slate-400">
          含连号：{group.consecutive.pairs.map((pair) => pair.join('-')).join('、')}
        </p>
      )}
    </div>
  );
}

/**
 * 选号策略面板（核心功能）。
 * @param {{draws: Array<object>}} props 历史数据
 * @return {JSX.Element} 面板
 */
export default function GeneratorPanel({ draws }) {
  const [params, setParams] = useState(DEFAULT_UI_PARAMS);
  const [seedInput, setSeedInput] = useState('');
  const [result, setResult] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const { toast, showToast, closeToast } = useToast();

  const generatorParams = useMemo(() => ({ ...params, draws }), [params, draws]);
  const pools = useMemo(() => buildPools(generatorParams), [generatorParams]);

  const updateParam = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  const updateConstraints = (patch) =>
    setParams((prev) => ({ ...prev, constraints: { ...prev.constraints, ...patch } }));

  /**
   * 切换某个数组型参数中的号码。
   * @param {'frontCustom'|'backCustom'|'excludeFront'|'excludeBack'} key 字段名
   * @param {number} num 号码
   * @return {void}
   */
  const toggleNumber = (key, num) =>
    setParams((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const next = list.includes(num)
        ? list.filter((item) => item !== num)
        : [...list, num].sort((a, b) => a - b);
      return { ...prev, [key]: next };
    });

  /**
   * 执行生成。
   * @return {void}
   */
  const handleGenerate = () => {
    if (pools.frontPool.length < 5) {
      showToast('无法生成', ['前区可用号码少于 5 个，请检查号码池与排除号码设置。'], 'error');
      return;
    }
    if (pools.backPool.length < 2) {
      showToast('无法生成', ['后区可用号码少于 2 个，请检查号码池与排除号码设置。'], 'error');
      return;
    }

    const rawSeed = seedInput.trim();
    const seed =
      rawSeed === ''
        ? Math.floor(Math.random() * 4294967296)
        : /^\d+$/.test(rawSeed)
          ? Number(rawSeed)
          : rawSeed;

    const output = generateNumbers(generatorParams, seed);
    setResult(output);
    setLastSeed(output.seed);

    if (!output.groups.length) {
      showToast('生成失败', output.warnings.length ? output.warnings : ['未生成任何组合。'], 'error');
      return;
    }
    if (output.warnings.length) {
      showToast('已完成生成（含提示）', output.warnings, 'warn');
    } else {
      showToast('生成完成', [`共 ${output.groups.length} 组，随机种子 ${output.seed}。`], 'ok');
    }
  };

  /**
   * 重置全部参数。
   * @return {void}
   */
  const handleReset = () => {
    setParams(DEFAULT_UI_PARAMS);
    setSeedInput('');
    setResult(null);
    setLastSeed(null);
    showToast('已重置参数', ['所有条件恢复为默认值。'], 'ok');
  };

  /**
   * 复制全部结果到剪贴板。
   * @return {void}
   */
  const handleCopy = async () => {
    if (!result || !result.groups.length) {
      showToast('没有可复制的结果', ['请先生成号码。'], 'warn');
      return;
    }
    const text = result.groups
      .map((group) => `${group.front.map(pad2).join(' ')} + ${group.back.map(pad2).join(' ')}`)
      .join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      showToast('已复制', [`共 ${result.groups.length} 组已写入剪贴板。`], 'ok');
    } catch (error) {
      showToast('复制失败', [`浏览器拒绝了剪贴板写入：${error.message}`, '可改用「导出 TXT」。'], 'error');
    }
  };

  /**
   * 导出 TXT。
   * @return {void}
   */
  const handleExport = () => {
    if (!result || !result.groups.length) {
      showToast('没有可导出的结果', ['请先生成号码。'], 'warn');
      return;
    }
    const lines = [
      '超级大乐透 · 随机选号结果',
      `导出时间：${new Date().toLocaleString('zh-CN')}`,
      `随机种子：${result.seed}（相同种子 + 相同参数可复现同一组结果）`,
      '前区池：' + result.frontPool.map(pad2).join(' '),
      '后区池：' + result.backPool.map(pad2).join(' '),
      '',
      '重要提示：彩票开奖具有随机性，每期独立。以下号码由随机算法生成，与下期开奖结果无因果关系，仅供娱乐参考，不构成任何购彩依据。',
      '',
      ...result.groups.map(
        (group, index) =>
          `${String(index + 1).padStart(2, '0')}. ${group.front.map(pad2).join(' ')} + ${group.back
            .map(pad2)
            .join(' ')}    和值${group.sum} 奇偶${group.oddEven.label} 大小${group.bigSmall.label}${
            group.historyCount > 0 ? ` 历史开出${group.historyCount}次` : ' 历史从未开出'
          }`,
      ),
      '',
      '理性购彩，量力而行。未成年人不得购彩或兑奖。',
    ];

    try {
      downloadText(`dlt_picks_${todayStamp()}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
      showToast('导出成功', ['结果已保存为 TXT 文件。'], 'ok');
    } catch (error) {
      showToast('导出失败', [error.message], 'error');
    }
  };

  const frontPoolCount = pools.frontPool.length;
  const backPoolCount = pools.backPool.length;
  const sumMin = Number(params.constraints.sumMin);
  const sumMax = Number(params.constraints.sumMax);
  const sumInvalid = Number.isFinite(sumMin) && Number.isFinite(sumMax) && sumMin > sumMax;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-4">
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
                    onChange={(event) => updateParam({ backPoolSize: clamp(event.target.value, 2, 12) })}
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

        <div className="card card-pad">
          <h3 className="section-title">约束条件</h3>
          <div className="mt-2 space-y-2">
            <CheckboxRow
              checked={params.constraints.enabled}
              onChange={(checked) => updateConstraints({ enabled: checked })}
              label="启用约束（关闭后仅做池内随机 + 组间去重）"
            />
            <div className={params.constraints.enabled ? 'space-y-2 pl-5' : 'space-y-2 pl-5 opacity-50'}>
              <CheckboxRow
                checked={params.constraints.oddEven}
                onChange={(checked) => updateConstraints({ oddEven: checked })}
                label="奇偶比限定为 2:3 / 3:2 / 4:1 / 1:4"
              />
              <CheckboxRow
                checked={params.constraints.bigSmall}
                onChange={(checked) => updateConstraints({ bigSmall: checked })}
                label="大小比限定为 2:3 / 3:2"
                hint="小号 01-17"
              />
              <div>
                <CheckboxRow
                  checked={params.constraints.sumRange}
                  onChange={(checked) => updateConstraints({ sumRange: checked })}
                  label="和值区间"
                />
                <div className="mt-1 flex items-center gap-1.5 pl-5">
                  <input
                    type="number"
                    className="input-sm w-20"
                    value={params.constraints.sumMin}
                    disabled={!params.constraints.sumRange}
                    onChange={(event) => updateConstraints({ sumMin: clamp(event.target.value, 15, 175) })}
                    aria-label="和值下限"
                  />
                  <span className="text-xs text-slate-400">~</span>
                  <input
                    type="number"
                    className="input-sm w-20"
                    value={params.constraints.sumMax}
                    disabled={!params.constraints.sumRange}
                    onChange={(event) => updateConstraints({ sumMax: clamp(event.target.value, 15, 175) })}
                    aria-label="和值上限"
                  />
                </div>
                {sumInvalid && (
                  <p className="mt-1 pl-5 text-[11px] text-red-600">和值下限大于上限，生成时会自动对调。</p>
                )}
              </div>
              <CheckboxRow
                checked={params.constraints.allowConsecutive}
                onChange={(checked) => updateConstraints({ allowConsecutive: checked })}
                label="允许连号"
              />
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="section-title">排除号码</h3>
          <p className="hint mt-1">点击号码即排除（灰色带删除线）。排除只影响本次抽号，不写入历史数据。</p>
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

        <div className="card card-pad">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">前区可用 {frontPoolCount} 个</span>
            <span className="chip">后区可用 {backPoolCount} 个</span>
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
            <button type="button" className="btn-primary flex-1" onClick={handleGenerate}>
              开始生成
            </button>
            <button type="button" className="btn-ghost" onClick={handleReset}>
              重置参数
            </button>
          </div>
        </div>
      </div>

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
                  {result.groups.some((group) => group.relaxed) ? ' · 部分组合放宽了约束' : ' · 全部组合满足约束'}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-blue btn-xs" onClick={handleCopy}>
                  复制全部
                </button>
                <button type="button" className="btn-ghost btn-xs" onClick={handleExport}>
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
              「该组合历史是否开出」统计基于当前本地全部 {draws.length} 期数据。头奖单注命中概率为 1/21,425,712，
              任何组合（包括历史上从未开出的组合）的中奖概率完全相同。
            </p>
          </div>
        )}

        {result && result.groups.length === 0 && (
          <div className="card card-pad">
            <p className="text-sm font-medium text-slate-700">没有生成任何组合</p>
            <ul className="hint mt-1 space-y-0.5">
              {(result.warnings.length ? result.warnings : ['请调整号码池或排除号码后重试。']).map((warning) => (
                <li key={warning}>· {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {!result && draws.length > 0 && (
          <div className="card card-pad">
            <p className="text-sm text-slate-600">
              左侧设置好参数后点击「开始生成」。默认是等概率随机 —— 这已经是数学上最「公平」的选号方式。
            </p>
            <p className="hint mt-1">
              提示：无论选择哪种权重模式，单注中头奖的概率都是 1/21,425,712。加权只是让某些号码「更容易被随机到」，不是「更容易开出来」。
            </p>
          </div>
        )}

        <div className="card card-pad">
          <h3 className="section-title">本页参数说明</h3>
          <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600">
            <li>
              · 前区池「仅热号 / 仅冷号 / 遗漏最高」按所选历史数据的频次与当前遗漏排序取前 N 个；缩小号码池会降低组合覆盖率。
            </li>
            <li>· 权重模式只改变抽样概率：按历史频率加权会让历史高频号更容易被抽到，但不会让它更容易开出。</li>
            <li>· 约束条件会做最多 200 次重试；若号码池太小导致无法满足，会放宽为「仅去重」并在卡片上标注。</li>
            <li>· 组与组之间保证不重复（前区 + 后区完全相同视为重复）。</li>
            <li>· 相同随机种子 + 相同参数 + 相同历史数据 ⇒ 完全相同的结果，便于核对与复现。</li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500">
          单注 2 元，头奖概率 1/21,425,712（约 0.0000047%）。以每天买 1 注计算，长期平均需要约 5.9 万年才可能命中一次头奖。
          请理性购彩，量力而行；未成年人不得购彩或兑奖。
        </div>
      </div>

      <ToastBox toast={toast} onClose={closeToast} />
    </div>
  );
}
