/**
 * 选号面板的选项常量与 UI 默认参数。
 *
 * 与 `lib/generator.js` 的 `DEFAULT_PARAMS` 保持字段一致，但额外带上 UI 专有的
 * 自定义号码池与排除号码（lib 层不关心这两项的默认值）。
 */

import { DEFAULT_PARAMS } from '@/lib/generator.js';

/** 前区池策略选项 */
export const POOL_MODE_OPTIONS = [
  { value: 'all', label: '全部号码' },
  { value: 'hot', label: '仅热号（频次 Top N）' },
  { value: 'cold', label: '仅冷号（频次 Bottom N）' },
  { value: 'omission', label: '仅遗漏值最高 N 个' },
  { value: 'custom', label: '自定义号码池' },
];

/** 后区池策略选项 */
export const BACK_POOL_MODE_OPTIONS = [
  { value: 'all', label: '全部号码' },
  { value: 'hot', label: '热号 Top4' },
  { value: 'cold', label: '冷号 Bottom4' },
  { value: 'custom', label: '自定义号码池' },
];

/** 权重模式选项 */
export const WEIGHT_MODE_OPTIONS = [
  { value: 'uniform', label: '等概率随机' },
  { value: 'freq', label: '按历史频率加权' },
  { value: 'omission', label: '按遗漏值加权' },
  { value: 'mix', label: '冷热混合（频率 50% + 遗漏 50%）' },
];

/** UI 侧默认参数（与 lib/generator 的 DEFAULT_PARAMS 字段保持一致） */
export const DEFAULT_UI_PARAMS = {
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
