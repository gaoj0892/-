import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '@/lib/download.js';

/**
 * 伪造浏览器下载所需的全局对象（node 环境下没有 document / URL / window）。
 *
 * 只替换 downloadText 真正用到的成员：`document.createElement` / `document.body`
 * / `URL.createObjectURL` / `URL.revokeObjectURL` / `window.setTimeout`。
 * `Blob` 用 Node 自带的实现，以便断言其真实文本内容。
 *
 * @return {object} 记录全部副作用的探针对象
 */
function setupBrowser() {
  const state = {
    /** createElement 收到的标签名 */
    tagName: '',
    /** createElement 返回的伪 a 元素 */
    link: { href: '', download: '', click: vi.fn() },
    /** appendChild / removeChild 的调用记录 */
    appended: [],
    removed: [],
    /** createObjectURL 收到的 Blob */
    blob: null,
    /** 已创建的 objectURL 列表 */
    createdUrls: [],
    /** revokeObjectURL 收到的 URL 列表 */
    revoked: [],
    /** window.setTimeout 收到的延迟毫秒数 */
    timers: [],
  };

  vi.stubGlobal('document', {
    /**
     * 记录标签名并返回伪 a 元素。
     *
     * @param {string} tagName 标签名
     * @return {object} 伪元素
     */
    createElement: (tagName) => {
      state.tagName = tagName;
      return state.link;
    },
    body: {
      /**
       * @param {object} node 被挂载的节点
       * @return {object} 同一节点
       */
      appendChild: (node) => {
        state.appended.push(node);
        return node;
      },
      /**
       * @param {object} node 被移除的节点
       * @return {object} 同一节点
       */
      removeChild: (node) => {
        state.removed.push(node);
        return node;
      },
    },
  });

  vi.stubGlobal('URL', {
    /**
     * 记录 Blob 并返回自增的假 URL。
     *
     * @param {Blob} blob 待下载内容
     * @return {string} 假 objectURL
     */
    createObjectURL: (blob) => {
      state.blob = blob;
      const url = `blob:stub-${state.createdUrls.length + 1}`;
      state.createdUrls.push(url);
      return url;
    },
    /**
     * @param {string} url 被释放的 URL
     * @return {void}
     */
    revokeObjectURL: (url) => {
      state.revoked.push(url);
    },
  });

  vi.stubGlobal('window', {
    /**
     * 立即执行回调，并记录延迟毫秒数（避免测试真的等待 1.5 秒）。
     *
     * @param {Function} handler 回调
     * @param {number} delay 延迟毫秒
     * @return {number} 假 timer id
     */
    setTimeout: (handler, delay) => {
      state.timers.push(delay);
      handler();
      return 1;
    },
  });

  return state;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('download.js：触发浏览器下载', () => {
  it('① 用 a[download] 承载传入的文件名，href 指向创建出的 objectURL', () => {
    const state = setupBrowser();

    downloadText('dlt_picks_20261116.txt', '前区 01 02 03 04 05', 'text/plain;charset=utf-8');

    expect(state.tagName).toBe('a');
    expect(state.link.download).toBe('dlt_picks_20261116.txt');
    expect(state.link.href).toBe('blob:stub-1');
    // 触发一次点击，且节点挂载后被移除（不在 body 里留垃圾）
    expect(state.link.click).toHaveBeenCalledTimes(1);
    expect(state.appended).toEqual([state.link]);
    expect(state.removed).toEqual([state.link]);
  });

  it('② 传给 createObjectURL 的 Blob 文本与 MIME 与入参一致', async () => {
    const state = setupBrowser();

    downloadText('picks.txt', '前区 01 02 03 04 05', 'text/plain;charset=utf-8');

    expect(state.blob).toBeInstanceOf(Blob);
    expect(state.blob.type).toBe('text/plain;charset=utf-8');
    await expect(state.blob.text()).resolves.toBe('前区 01 02 03 04 05');
  });

  it('③ 结束后延迟 1500ms 调用 revokeObjectURL 释放 URL', () => {
    const state = setupBrowser();

    downloadText('picks.txt', 'x', 'text/plain');

    expect(state.timers).toEqual([1500]);
    expect(state.revoked).toEqual(['blob:stub-1']);
  });

  it('连续两次调用各自创建并释放独立的 objectURL', async () => {
    const state = setupBrowser();

    downloadText('a.txt', 'first', 'text/plain');
    const firstBlob = state.blob;
    downloadText('b.csv', 'second', 'text/csv');

    expect(state.createdUrls).toEqual(['blob:stub-1', 'blob:stub-2']);
    expect(state.revoked).toEqual(['blob:stub-1', 'blob:stub-2']);
    expect(state.link.download).toBe('b.csv');
    // 第二次的 Blob 是独立对象，不会复用上一次的内容
    expect(state.blob).not.toBe(firstBlob);
    await expect(firstBlob.text()).resolves.toBe('first');
    await expect(state.blob.text()).resolves.toBe('second');
    expect(state.link.click).toHaveBeenCalledTimes(2);
  });
});
