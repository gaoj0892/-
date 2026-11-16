import { useEffect, useMemo, useRef, useState } from 'react';
import { FrontBall, BackBall } from './Ball.jsx';
import { ToastBox, useToast } from './Toast.jsx';
import { drawsToCsv, parseDrawFile } from '../lib/parse.js';
import { sortByPeriodAsc, sumOf } from '../lib/stats.js';
import { todayStamp } from '../lib/format.js';
import { hasLocalStorage } from '../lib/storage.js';

const PAGE_SIZES = [20, 50, 100];

/**
 * 触发浏览器下载（Blob + a[download]）。
 * @param {string} filename 文件名
 * @param {string} content 文件内容
 * @param {string} mimeType MIME 类型
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
 * 小统计卡片。
 * @param {{label: string, value: string, hint?: string}} props 卡片内容
 * @return {JSX.Element} 统计卡片
 */
function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

/**
 * 历史开奖数据管理面板。
 * @param {{draws: Array<object>, onChangeDraws: Function, onResetSeed: Function, meta: object}} props
 * @return {JSX.Element} 面板
 */
export default function DataManager({ draws, onChangeDraws, onResetSeed, meta }) {
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const { toast, showToast, closeToast } = useToast();

  const ordered = useMemo(() => sortByPeriodAsc(draws), [draws]);

  const summary = useMemo(() => {
    const first = ordered[0] || null;
    const last = ordered.length ? ordered[ordered.length - 1] : null;
    return {
      count: ordered.length,
      firstNo: first ? first.no : '-',
      firstDate: first ? first.date : '',
      lastNo: last ? last.no : '-',
      lastDate: last ? last.date : '',
    };
  }, [ordered]);

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    const list = ordered.filter((draw) => {
      if (kw && !String(draw.no).includes(kw)) return false;
      if (startDate && String(draw.date) < startDate) return false;
      if (endDate && String(draw.date) > endDate) return false;
      return true;
    });
    const ascending = sortDesc ? [...list].reverse() : list;
    return ascending;
  }, [ordered, keyword, startDate, endDate, sortDesc]);

  useEffect(() => {
    setPage(1);
  }, [keyword, startDate, endDate, sortDesc, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /**
   * 处理文件导入。
   * @param {Event} event input change 事件
   * @return {void}
   */
  const handleImport = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const hasBrokenChar = text.includes('\uFFFD');

        const parsed = parseDrawFile(text, file.name);
        const existing = new Set(ordered.map((draw) => draw.no));
        const added = [];
        const skipped = [];

        parsed.draws.forEach((draw) => {
          if (existing.has(draw.no)) {
            skipped.push(draw.no);
            return;
          }
          existing.add(draw.no);
          added.push(draw);
        });

        if (added.length > 0) {
          onChangeDraws(sortByPeriodAsc([...ordered, ...added]));
        }

        const lines = [
          `新增 ${added.length} 期 / 跳过重复 ${skipped.length} 期 / 格式错误 ${parsed.errors.length} 行`,
        ];
        parsed.errors.slice(0, 5).forEach((error) => {
          const raw = error.raw ? `（${String(error.raw).slice(0, 40)}）` : '';
          lines.push(`第 ${error.line} 行：${error.reason}${raw}`);
        });
        if (parsed.errors.length > 5) {
          lines.push(`……另有 ${parsed.errors.length - 5} 行错误未列出`);
        }
        if (hasBrokenChar) {
          lines.push('检测到替换字符（\uFFFD），文件可能不是 UTF-8 编码，请另存为 UTF-8 后重试。');
        }
        if (!added.length && !parsed.errors.length) {
          lines.push('文件中没有可用的数据行。');
        }

        const hasError = parsed.errors.length > 0 || hasBrokenChar;
        showToast('导入完成', lines, hasError ? 'error' : 'ok');
      } catch (error) {
        showToast('导入失败', [error.message], 'error');
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
      showToast(
        '读取失败',
        ['浏览器无法读取该文件，请确认文件未损坏且格式为 txt / csv / json。'],
        'error',
      );
    };

    reader.readAsText(file, 'UTF-8');
  };

  /**
   * 导出 JSON。
   * @return {void}
   */
  const exportJson = () => {
    if (!ordered.length) {
      showToast('没有可导出的数据', ['当前本地数据为空。'], 'warn');
      return;
    }
    const payload = {
      meta: {
        ...(meta || {}),
        count: ordered.length,
        first_no: summary.firstNo,
        last_no: summary.lastNo,
        first_date: summary.firstDate,
        last_date: summary.lastDate,
        exported_at: new Date().toISOString(),
      },
      draws: ordered,
    };
    try {
      downloadText(
        `dlt_history_${todayStamp()}.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      showToast('导出成功', [`共 ${ordered.length} 期，已下载 JSON 文件。`], 'ok');
    } catch (error) {
      showToast('导出失败', [error.message], 'error');
    }
  };

  /**
   * 导出 CSV。
   * @return {void}
   */
  const exportCsv = () => {
    if (!ordered.length) {
      showToast('没有可导出的数据', ['当前本地数据为空。'], 'warn');
      return;
    }
    try {
      downloadText(
        `dlt_history_${todayStamp()}.csv`,
        `\uFEFF${drawsToCsv(ordered)}`,
        'text/csv;charset=utf-8',
      );
      showToast(
        '导出成功',
        [`共 ${ordered.length} 期，已下载 CSV 文件（含 BOM，可直接用 Excel 打开）。`],
        'ok',
      );
    } catch (error) {
      showToast('导出失败', [error.message], 'error');
    }
  };

  /**
   * 恢复内置种子数据（二次确认）。
   * @return {void}
   */
  const handleResetSeed = () => {
    if (!window.confirm('恢复为内置种子数据？当前本地独有的期次会被丢弃。')) return;
    if (!window.confirm('再次确认：此操作不可撤销，确定恢复为内置种子数据吗？')) return;
    onResetSeed();
    showToast('已恢复内置种子数据', ['统计数据与选号将基于内置历史开奖记录。'], 'ok');
  };

  /**
   * 清空全部本地数据（二次确认 + 警告）。
   * @return {void}
   */
  const handleClear = () => {
    if (!window.confirm('清空全部本地开奖数据？清空后所有分析与选号功能将不可用。')) return;
    if (!window.confirm('再次确认：本地数据将被删除（之后可通过「恢复内置种子数据」重新载入）。'))
      return;
    onChangeDraws([]);
    showToast('已清空本地数据', ['可随时点击「恢复内置种子数据」重新载入。'], 'warn');
  };

  /**
   * 重置筛选条件。
   * @return {void}
   */
  const resetFilters = () => {
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setSortDesc(true);
    setPageSize(20);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="当前总期数"
          value={`${summary.count} 期`}
          hint={hasLocalStorage() ? '存储：浏览器 localStorage' : '存储：内存（刷新即丢失）'}
        />
        <StatCard label="最早期号" value={summary.firstNo} hint={summary.firstDate || '—'} />
        <StatCard label="最新期号" value={summary.lastNo} hint={summary.lastDate || '—'} />
        <StatCard
          label="数据来源"
          value="体彩官方历史开奖"
          hint={meta && meta.count > 0 ? '内置种子 + 本地导入' : '暂无数据'}
        />
      </div>

      <div className="card card-pad">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9rem] flex-1">
            <label className="label" htmlFor="dlt-keyword">
              期号搜索
            </label>
            <input
              id="dlt-keyword"
              className="input w-full"
              value={keyword}
              placeholder="如 26123 或 123"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="min-w-[8.5rem] flex-1">
            <label className="label" htmlFor="dlt-start">
              起始日期
            </label>
            <input
              id="dlt-start"
              type="date"
              className="input w-full"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="min-w-[8.5rem] flex-1">
            <label className="label" htmlFor="dlt-end">
              结束日期
            </label>
            <input
              id="dlt-end"
              type="date"
              className="input w-full"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <button type="button" className="btn-ghost" onClick={resetFilters}>
            重置筛选
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="chip">共 {filtered.length} 期符合条件</span>
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={() => setSortDesc((prev) => !prev)}
          >
            {sortDesc ? '期号：新 → 旧' : '期号：旧 → 新'}
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            每页
            <select
              className="input-sm"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            条
          </label>

          <span className="ml-auto flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.json"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              className="btn-primary btn-xs"
              onClick={() => fileRef.current && fileRef.current.click()}
              disabled={importing}
            >
              {importing ? '导入中…' : '导入数据'}
            </button>
            <button type="button" className="btn-ghost btn-xs" onClick={exportJson}>
              导出 JSON
            </button>
            <button type="button" className="btn-ghost btn-xs" onClick={exportCsv}>
              导出 CSV
            </button>
            <button type="button" className="btn-ghost btn-xs" onClick={handleResetSeed}>
              恢复种子数据
            </button>
            <button type="button" className="btn-danger btn-xs" onClick={handleClear}>
              清空本地数据
            </button>
          </span>
        </div>

        <p className="hint mt-2">
          导入支持 .txt / .csv / .json，编码需为
          UTF-8。合并策略：按期号去重，已存在的期号跳过不覆盖。 txt/csv 每行格式示例：
          <code className="rounded bg-slate-100 px-1">07001,2007-05-30,22,24,29,31,35,04,11</code>
        </p>
      </div>

      <div className="card card-pad">
        <div className="table-wrap max-h-[32rem] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>期号</th>
                <th>开奖日期</th>
                <th>前区（5 个）</th>
                <th>后区（2 个）</th>
                <th>和值</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((draw) => (
                <tr key={`${draw.no}-${draw.date}`}>
                  <td className="font-medium text-slate-800">{draw.no}</td>
                  <td className="text-slate-500">{draw.date}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {(draw.front || []).map((n) => (
                        <FrontBall key={`f-${draw.no}-${n}`} n={n} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {(draw.back || []).map((n) => (
                        <BackBall key={`b-${draw.no}-${n}`} n={n} size="sm" />
                      ))}
                    </div>
                  </td>
                  <td>{sumOf(draw.front)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-500">
                    没有符合条件的记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
            >
              首页
            </button>
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              上一页
            </button>
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              下一页
            </button>
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              末页
            </button>
          </span>
        </div>
      </div>

      <ToastBox toast={toast} onClose={closeToast} />
    </div>
  );
}
