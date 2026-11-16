/**
 * 本地存储封装（纯逻辑，不依赖 React）。
 *
 * 关键要求：在没有 localStorage 的环境（如 vitest / node）下不能抛异常，
 * 因此所有读写都包裹 try/catch，并退化为进程内内存存储。
 */

export const STORAGE_VERSION = 1;
export const DRAWS_KEY = 'dlt_predictor_draws_v1';
export const META_KEY = 'dlt_predictor_meta_v1';

/** 内存兜底存储（测试环境 / 隐私模式下使用） */
const memoryStore = new Map();

/**
 * 取得 localStorage 后端；不可用时返回 null。
 * @return {Storage|null} 存储对象
 */
function getBackend() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // 主动探测一次，某些浏览器隐私模式会在 setItem 时抛错
      const probeKey = '__dlt_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 是否可用的持久化存储。
 * @return {boolean} 是否可用
 */
export function hasLocalStorage() {
  return getBackend() !== null;
}

/**
 * 读取原始字符串。
 * @param {string} key 键名
 * @return {string|null} 值
 */
function readRaw(key) {
  const backend = getBackend();
  if (backend) {
    try {
      const value = backend.getItem(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // 忽略，走内存兜底
    }
  }
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

/**
 * 写入原始字符串。
 * @param {string} key 键名
 * @param {string} value 值
 * @return {{ok: boolean, reason?: string}} 结果
 */
function writeRaw(key, value) {
  memoryStore.set(key, value);
  const backend = getBackend();
  if (!backend) {
    return { ok: false, reason: '当前环境不支持 localStorage，数据仅保存在内存中（刷新后丢失）' };
  }
  try {
    backend.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `写入本地存储失败：${error.message}` };
  }
}

/**
 * 删除原始键。
 * @param {string} key 键名
 * @return {boolean} 是否成功删除
 */
function removeRaw(key) {
  memoryStore.delete(key);
  const backend = getBackend();
  if (!backend) return false;
  try {
    backend.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** 校验单条记录的最小结构（避免读回脏数据导致后续崩溃） */
function isDrawLike(item) {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.no === 'string' &&
    typeof item.date === 'string' &&
    Array.isArray(item.front) &&
    Array.isArray(item.back)
  );
}

/**
 * 读取全部开奖数据。
 * @return {Array<object>|null} 未初始化过返回 null；读取失败也返回 null
 */
export function loadDraws() {
  const raw = readRaw(DRAWS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.draws;
    if (!Array.isArray(list)) return null;
    return list.filter(isDrawLike).map((item) => ({
      no: String(item.no),
      date: String(item.date),
      front: item.front.map(Number).sort((a, b) => a - b),
      back: item.back.map(Number).sort((a, b) => a - b),
    }));
  } catch {
    return null;
  }
}

/**
 * 保存开奖数据。
 * @param {Array<object>} draws 开奖数据
 * @param {object} [meta] 元信息
 * @return {{ok: boolean, reason?: string}} 结果
 */
export function saveDraws(draws, meta) {
  const payload = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    meta: meta && typeof meta === 'object' ? meta : {},
    draws: Array.isArray(draws) ? draws : [],
  };
  try {
    return writeRaw(DRAWS_KEY, JSON.stringify(payload));
  } catch (error) {
    return { ok: false, reason: `序列化失败：${error.message}` };
  }
}

/**
 * 读取元信息。
 * @return {object|null} 元信息
 */
export function loadMeta() {
  const raw = readRaw(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 保存元信息。
 * @param {object} meta 元信息
 * @return {{ok: boolean, reason?: string}} 结果
 */
export function saveMeta(meta) {
  try {
    return writeRaw(META_KEY, JSON.stringify(meta && typeof meta === 'object' ? meta : {}));
  } catch (error) {
    return { ok: false, reason: `序列化失败：${error.message}` };
  }
}

/**
 * 清空全部本地数据（开奖数据 + 元信息）。
 * @return {void}
 */
export function clearAll() {
  removeRaw(DRAWS_KEY);
  removeRaw(META_KEY);
}

/**
 * 读取一个简单的本地配置项（自动 JSON 解析）。
 * @param {string} key 键名
 * @param {*} fallback 默认值
 * @return {*} 配置值
 */
export function getSetting(key, fallback = null) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * 写入一个简单的本地配置项。
 * @param {string} key 键名
 * @param {*} value 值
 * @return {{ok: boolean, reason?: string}} 结果
 */
export function setSetting(key, value) {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch (error) {
    return { ok: false, reason: `写入失败：${error.message}` };
  }
}
