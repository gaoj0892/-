/**
 * 开奖数据的解析与校验（纯逻辑，可直接被 vitest import，不依赖 React 与 DOM）。
 *
 * 支持格式：
 *  1) TXT：期号 <Tab|逗号|分号|空格> 日期 <分隔符> 5 个前区号 <分隔符> 2 个后区号
 *     例：07001	2007-05-30	22	24	29	31	35	04	11
 *  2) CSV：同上，允许字段被双引号包裹，也允许「22 24 29 31 35」写在同一个字段里
 *  3) JSON：{ meta, draws: [...] } 或直接是数组，元素形如
 *     { no: '07001', date: '2007-05-30', front: [22,24,29,31,35], back: [4,11] }
 */

import { pad2, uniqueNumbers } from './format.js';

const DATE_SPLIT_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const DATE_PACKED_RE = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * 判断是否为真实存在的公历日期（含闰年判断）。
 * @param {number} year 年
 * @param {number} month 月（1-12）
 * @param {number} day 日
 * @return {boolean} 是否合法
 */
export function isRealDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * 归一化期号为 5 位字符串。
 *
 * 规则：
 *  - 数字类型（如 JSON 里的 7001）会补零成 '07001'，因为 JSON 数字无法保留前导零；
 *  - 字符串类型必须本身是 5 位数字，否则原样返回并由 validateDraw 报错（避免把 4 位的错误期号静默"修正"）。
 * @param {*} value 原始期号
 * @return {string} 5 位期号；无法归一化时返回清理后的字符串
 */
export function normalizeNo(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const num = Math.trunc(value);
    if (num < 0) return '';
    return String(num).padStart(5, '0');
  }
  return String(value).trim().replace(/^["']/, '').replace(/["']$/, '').trim();
}

/**
 * 归一化为 YYYY-MM-DD；支持 YYYY-M-D、YYYY/M/D、YYYY.M.D、YYYYMMDD。
 * @param {*} value 原始日期
 * @return {string} 归一化日期，非法时返回空字符串
 */
export function normalizeDate(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim().replace(/^["']/, '').replace(/["']$/, '').trim();

  let year = 0;
  let month = 0;
  let day = 0;

  const splitMatch = DATE_SPLIT_RE.exec(text);
  if (splitMatch) {
    year = Number(splitMatch[1]);
    month = Number(splitMatch[2]);
    day = Number(splitMatch[3]);
  } else {
    const packedMatch = DATE_PACKED_RE.exec(text);
    if (!packedMatch) return '';
    year = Number(packedMatch[1]);
    month = Number(packedMatch[2]);
    day = Number(packedMatch[3]);
  }

  if (!isRealDate(year, month, day)) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * 把号码字段解析为数字数组（支持数组、数字、以及 '1 2 3' / '1,2,3' / '01-02-03' 等字符串）。
 * @param {*} value 原始字段
 * @return {number[]} 数字数组
 */
function toNumberList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(String(item).trim())).filter((n) => Number.isFinite(n));
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? [value] : [];
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,;|/、]+/)
      .filter((part) => part.length > 0)
      .map((part) => Number(part))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

/**
 * 校验单期数据，并返回排序后的规范对象。
 * @param {*} raw 原始数据（对象形式）
 * @return {{ok: boolean, draw?: {no: string, date: string, front: number[], back: number[]}, reason?: string}}
 */
export function validateDraw(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: '不是一个有效的对象' };
  }

  const no = normalizeNo(raw.no !== undefined ? raw.no : raw.period);
  if (!/^\d{5}$/.test(no)) {
    return { ok: false, reason: '期号必须是 5 位数字' };
  }

  const date = normalizeDate(raw.date);
  if (!date) {
    return { ok: false, reason: '日期不是合法的 YYYY-MM-DD' };
  }

  const front = toNumberList(raw.front);
  if (front.length !== 5) {
    return { ok: false, reason: `前区必须是 5 个号码（当前 ${front.length} 个）` };
  }
  if (front.some((n) => !Number.isInteger(n) || n < 1 || n > 35)) {
    return { ok: false, reason: '前区号码必须落在 01-35' };
  }
  if (new Set(front).size !== front.length) {
    return { ok: false, reason: '前区号码存在重复' };
  }

  const back = toNumberList(raw.back);
  if (back.length !== 2) {
    return { ok: false, reason: `后区必须是 2 个号码（当前 ${back.length} 个）` };
  }
  if (back.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) {
    return { ok: false, reason: '后区号码必须落在 01-12' };
  }
  if (new Set(back).size !== back.length) {
    return { ok: false, reason: '后区号码存在重复' };
  }

  return {
    ok: true,
    draw: {
      no,
      date,
      front: [...front].sort((a, b) => a - b),
      back: [...back].sort((a, b) => a - b),
    },
  };
}

/**
 * 按 CSV 规则切分一行（支持双引号包裹与转义），空格分隔时退化为空白切分。
 * @param {string} line 单行文本
 * @return {string[]} 字段数组
 */
function splitFields(line) {
  const separator = line.includes('\t')
    ? '\t'
    : line.includes(',')
      ? ','
      : line.includes(';')
        ? ';'
        : '';

  if (!separator) {
    return line.split(/\s+/).filter((part) => part.length > 0);
  }

  const fields = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === separator && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields.filter((part) => part.length > 0 || inQuote);
}

/**
 * 解析一行数据。
 * @param {string} line 单行文本（已 trim）
 * @return {{isHeader?: boolean, ok?: boolean, draw?: object, reason?: string}}
 */
function parseLine(line) {
  if (/期号|开奖日期|前区|后区|draw_?no|drawNo|\bperiod\b/i.test(line)) {
    return { isHeader: true };
  }

  const fields = splitFields(line);
  let no = '';
  let date = '';
  const numbers = [];

  fields.forEach((field) => {
    const cleaned = field.replace(/^"/, '').replace(/"$/, '').trim();

    if (!date) {
      const parsedDate = normalizeDate(cleaned);
      if (parsedDate) {
        date = parsedDate;
        return;
      }
    }

    // 期号：优先识别 5 位数字；4 位数字常见于 Excel 丢失前导零，补零后继续校验
    if (!no && /^\d{5}$/.test(cleaned)) {
      no = cleaned;
      return;
    }
    if (!no && /^\d{4}$/.test(cleaned)) {
      no = cleaned.padStart(5, '0');
      return;
    }

    const parts = cleaned.split(/[\s,;|/、]+/).filter((part) => part.length > 0);
    parts.forEach((part) => {
      if (/^\d{1,2}$/.test(part)) numbers.push(Number(part));
    });
  });

  if (numbers.length !== 7) {
    return {
      ok: false,
      reason: `号码数量不是 7 个（识别到 ${numbers.length} 个，需 5 个前区 + 2 个后区）`,
    };
  }

  const result = validateDraw({
    no,
    date,
    front: numbers.slice(0, 5),
    back: numbers.slice(5, 7),
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return { ok: true, draw: result.draw };
}

/**
 * 解析 TXT / CSV 文本。
 * @param {string} text 文件文本内容
 * @return {{draws: Array<object>, errors: Array<{line: number, raw: string, reason: string}>}}
 */
export function parseDrawText(text) {
  const draws = [];
  const errors = [];
  if (typeof text !== 'string' || text.trim() === '') {
    return { draws, errors: [{ line: 0, raw: '', reason: '文件内容为空或无法读取' }] };
  }

  const seen = new Set();
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/^\uFEFF/, '')
    .split('\n');

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#')) return;

    const parsed = parseLine(trimmed);
    if (parsed.isHeader) return;

    if (!parsed.ok) {
      errors.push({ line: lineNo, raw: trimmed, reason: parsed.reason });
      return;
    }

    if (seen.has(parsed.draw.no)) {
      errors.push({ line: lineNo, raw: trimmed, reason: `文件内期号 ${parsed.draw.no} 重复` });
      return;
    }
    seen.add(parsed.draw.no);
    draws.push(parsed.draw);
  });

  if (!draws.length && !errors.length) {
    errors.push({ line: 0, raw: '', reason: '未识别到任何数据行' });
  }
  return { draws, errors };
}

/**
 * 解析 JSON 结构（数组或 { draws: [...] }）。
 * @param {*} obj 已 JSON.parse 的对象
 * @return {{draws: Array<object>, errors: Array<{line: number, raw: string, reason: string}>}}
 */
export function parseDrawJson(obj) {
  const draws = [];
  const errors = [];
  let list = [];

  if (Array.isArray(obj)) {
    list = obj;
  } else if (obj && typeof obj === 'object' && Array.isArray(obj.draws)) {
    list = obj.draws;
  } else {
    return {
      draws,
      errors: [{ line: 0, raw: '', reason: 'JSON 结构不符合要求（需要数组或 { draws: [...] }）' }],
    };
  }

  const seen = new Set();
  list.forEach((item, index) => {
    const result = validateDraw(item);
    if (!result.ok) {
      errors.push({
        line: index + 1,
        raw: JSON.stringify(item).slice(0, 120),
        reason: result.reason,
      });
      return;
    }
    if (seen.has(result.draw.no)) {
      errors.push({
        line: index + 1,
        raw: result.draw.no,
        reason: `文件内期号 ${result.draw.no} 重复`,
      });
      return;
    }
    seen.add(result.draw.no);
    draws.push(result.draw);
  });

  return { draws, errors };
}

/**
 * 按文件扩展名自动选择解析方式。
 * @param {string} text 文件文本
 * @param {string} fileName 文件名（用于判断扩展名）
 * @return {{draws: Array<object>, errors: Array<{line: number, raw: string, reason: string}>}}
 */
export function parseDrawFile(text, fileName = '') {
  const isJson = /\.json$/i.test(String(fileName));
  if (!isJson) return parseDrawText(text);

  try {
    const parsed = JSON.parse(String(text).replace(/^\uFEFF/, ''));
    return parseDrawJson(parsed);
  } catch (error) {
    return {
      draws: [],
      errors: [{ line: 0, raw: '', reason: `JSON 解析失败：${error.message}` }],
    };
  }
}

/**
 * 把开奖数据序列化为 CSV 文本（含表头，可直接用 Excel 打开）。
 * @param {Array<object>} draws 开奖数据
 * @return {string} CSV 文本
 */
export function drawsToCsv(draws) {
  const header = [
    '期号',
    '开奖日期',
    '前区1',
    '前区2',
    '前区3',
    '前区4',
    '前区5',
    '后区1',
    '后区2',
  ];
  const rows = (draws || []).map((draw) => {
    const front = Array.isArray(draw.front) ? draw.front : [];
    const back = Array.isArray(draw.back) ? draw.back : [];
    const cells = [draw.no, draw.date];
    for (let i = 0; i < 5; i += 1) cells.push(front[i] !== undefined ? pad2(front[i]) : '');
    for (let i = 0; i < 2; i += 1) cells.push(back[i] !== undefined ? pad2(back[i]) : '');
    return cells.join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

/**
 * 生成去重后的号码集合（工具函数）。
 * @param {number[]} list 号码列表
 * @return {number[]} 去重并升序的号码
 */
export function sortUnique(list) {
  return uniqueNumbers(list).sort((a, b) => a - b);
}
