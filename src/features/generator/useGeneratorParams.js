/**
 * 选号面板的状态与全部交互逻辑（参数、号码池、生成、重置、复制、导出）。
 *
 * 抽成 hook 的目的：让 `index.jsx` 只负责布局，逻辑可独立演进与测试。
 */

import { useMemo, useState } from 'react';
import { buildPools, generateNumbers } from '@/lib/generator.js';
import { pad2, todayStamp } from '@/lib/format.js';
import { downloadText } from '@/lib/download.js';
import { useToast } from '@/components/Toast.jsx';
import { DEFAULT_UI_PARAMS } from './constants.js';

/**
 * 选号参数与结果状态。
 *
 * @param {Array<object>} draws 历史开奖数据
 * @return {object} 状态、派生值与事件处理器
 */
export default function useGeneratorParams(draws) {
  const [params, setParams] = useState(DEFAULT_UI_PARAMS);
  const [seedInput, setSeedInput] = useState('');
  const [result, setResult] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const { toast, showToast, closeToast } = useToast();

  const generatorParams = useMemo(() => ({ ...params, draws }), [params, draws]);
  const pools = useMemo(() => buildPools(generatorParams), [generatorParams]);

  /**
   * 合并更新顶层参数。
   *
   * @param {object} patch 待更新字段
   * @return {void}
   */
  const updateParam = (patch) => setParams((prev) => ({ ...prev, ...patch }));

  /**
   * 合并更新约束条件。
   *
   * @param {object} patch 待更新字段
   * @return {void}
   */
  const updateConstraints = (patch) =>
    setParams((prev) => ({ ...prev, constraints: { ...prev.constraints, ...patch } }));

  /**
   * 切换某个数组型参数中的号码。
   *
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
   *
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
      showToast(
        '生成失败',
        output.warnings.length ? output.warnings : ['未生成任何组合。'],
        'error',
      );
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
   *
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
   *
   * @return {Promise<void>} 无返回值的异步流程
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
      showToast(
        '复制失败',
        [`浏览器拒绝了剪贴板写入：${error.message}`, '可改用「导出 TXT」。'],
        'error',
      );
    }
  };

  /**
   * 导出 TXT。
   *
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

  return {
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
  };
}
