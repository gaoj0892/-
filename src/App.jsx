import { useEffect, useMemo, useState } from 'react';
import seedJson from './data/dlt_history.json';
import DataManager from './components/DataManager.jsx';
import FrequencyPanel from './components/FrequencyPanel.jsx';
import HotColdPanel from './components/HotColdPanel.jsx';
import TrendPanel from './components/TrendPanel.jsx';
import GeneratorPanel from './components/GeneratorPanel.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import AboutPanel from './components/AboutPanel.jsx';
import { sortByPeriodAsc } from './lib/stats.js';
import { getSetting, hasLocalStorage, loadDraws, saveDraws, setSetting } from './lib/storage.js';

/** 内置种子数据（升序） */
const SEED_DRAWS = sortByPeriodAsc(seedJson.draws || []);
/** 内置种子数据的原始元信息 */
const SEED_META = { ...(seedJson.meta || {}) };

const DISCLAIMER_KEY = 'dlt_disclaimer_acked';

const TABS = [
  { id: 'data', label: '历史数据' },
  { id: 'frequency', label: '频率统计' },
  { id: 'hotcold', label: '冷热与遗漏' },
  { id: 'trend', label: '走势图表' },
  { id: 'generator', label: '选号策略' },
  { id: 'backtest', label: '多期回测' },
  { id: 'about', label: '说明与免责' },
];

/**
 * 首次进入时的免责确认弹窗。
 * @param {{onConfirm: Function}} props 确认回调
 * @return {JSX.Element} 弹窗
 */
function DisclaimerModal({ onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
      >
        <h2 id="disclaimer-title" className="text-base font-semibold text-slate-900">
          使用前请阅读：随机性与免责
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>
            彩票开奖具有随机性，每一期结果相互独立。历史统计、冷热与遗漏分析都
            <strong className="text-red-600">无法</strong>提高下一期的中奖概率。
          </p>
          <p>
            本软件提供的是「统计与选号辅助」：所有图表描述历史数据，所有选号结果均由随机算法生成，
            <strong>仅供参考娱乐，不构成任何购彩依据</strong>。
          </p>
          <p>
            大乐透单注头奖概率为 1/21,425,712。请理性购彩、量力而行；未成年人不得购彩或兑奖。
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={onConfirm}>
            我已阅读并理解
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 应用根组件：负责 Tab 状态、数据加载/持久化与全局免责信息。
 * @return {JSX.Element} 应用
 */
export default function App() {
  const [draws, setDraws] = useState(() => {
    const stored = loadDraws();
    return stored === null ? SEED_DRAWS : stored;
  });
  const [activeTab, setActiveTab] = useState('data');
  const [acked, setAcked] = useState(() => getSetting(DISCLAIMER_KEY, false) === true);
  const [storageWarning, setStorageWarning] = useState('');

  const currentMeta = useMemo(() => {
    const ordered = sortByPeriodAsc(draws);
    return {
      ...SEED_META,
      count: ordered.length,
      first_no: ordered.length ? ordered[0].no : '',
      last_no: ordered.length ? ordered[ordered.length - 1].no : '',
      first_date: ordered.length ? ordered[0].date : '',
      last_date: ordered.length ? ordered[ordered.length - 1].date : '',
    };
  }, [draws]);

  // 数据变更后写入本地存储（首次运行时同时完成种子数据初始化）
  useEffect(() => {
    const result = saveDraws(draws, currentMeta);
    if (result && result.ok === false) setStorageWarning(result.reason || '');
  }, [draws, currentMeta]);

  useEffect(() => {
    if (!hasLocalStorage()) {
      setStorageWarning('当前浏览器环境不支持 localStorage，数据与免责确认状态仅保存在内存中，刷新后会重置。');
    }
  }, []);

  /**
   * 确认免责声明。
   * @return {void}
   */
  const handleAck = () => {
    setSetting(DISCLAIMER_KEY, true);
    setAcked(true);
  };

  /**
   * 恢复内置种子数据。
   * @return {void}
   */
  const handleResetSeed = () => setDraws(SEED_DRAWS);

  const activePanel = (() => {
    switch (activeTab) {
      case 'frequency':
        return <FrequencyPanel draws={draws} />;
      case 'hotcold':
        return <HotColdPanel draws={draws} />;
      case 'trend':
        return <TrendPanel draws={draws} />;
      case 'generator':
        return <GeneratorPanel draws={draws} />;
      case 'backtest':
        return <BacktestPanel draws={draws} />;
      case 'about':
        return <AboutPanel meta={SEED_META} drawsCount={SEED_DRAWS.length} />;
      case 'data':
      default:
        return (
          <DataManager
            draws={draws}
            onChangeDraws={setDraws}
            onResetSeed={handleResetSeed}
            meta={currentMeta}
          />
        );
    }
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      {!acked && <DisclaimerModal onConfirm={handleAck} />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-3 pb-3 pt-4 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              超级大乐透 · 数据分析与选号辅助
            </h1>
            <p className="text-xs text-slate-500">
              内置 {currentMeta.count} 期数据（{currentMeta.first_no || '—'} ~ {currentMeta.last_no || '—'}，
              {currentMeta.first_date || '—'} ~ {currentMeta.last_date || '—'}）
            </p>
          </div>

          <nav className="tab-scroll mt-3" aria-label="功能导航">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-red-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 常驻免责横幅 */}
      <div className="border-b border-amber-300 bg-amber-100">
        <div className="mx-auto flex max-w-6xl items-start gap-2 px-3 py-2 sm:px-5">
          <span className="mt-0.5 shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
            重要提示
          </span>
          <p className="text-xs leading-relaxed text-amber-900 sm:text-[13px]">
            彩票开奖具有随机性，每期独立，历史数据与统计结果无法提高中奖概率。本软件所有统计与选号结果
            <strong>仅供参考娱乐，不构成任何购彩依据</strong>；单注头奖概率 1/21,425,712。请理性购彩，未成年人不得购彩或兑奖。
          </p>
        </div>
      </div>

      {storageWarning && (
        <div className="mx-auto mt-2 max-w-6xl px-3 sm:px-5">
          <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
            存储提示：{storageWarning}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5">{activePanel}</main>

      <footer className="mt-6 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl space-y-1.5 px-3 py-4 text-xs leading-relaxed text-slate-500 sm:px-5">
          <p className="font-medium text-slate-700">理性购彩提示</p>
          <p>
            彩票开奖具有随机性，每期独立；本工具仅为统计展示与随机选号辅助，不构成任何购彩依据，也不提供任何投注、代购或兑奖服务。
            请通过中国体育彩票官方渠道购买，量力而行，切勿沉迷；未成年人不得购彩或兑奖。
          </p>
          <p>
            数据来源：中国体彩网官方开奖数据接口 webapi.sporttery.cn（gameNo = 85）· 当前共收录{' '}
            {currentMeta.count} 期 · 数据以官方公布结果为准 · 所有数据仅保存在本地浏览器。
          </p>
        </div>
      </footer>
    </div>
  );
}
