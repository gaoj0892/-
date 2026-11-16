import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 项目根目录（ESM 下没有 __dirname） */
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * 把 Vite 默认的 ES module 产物改写成经典脚本（classic script）。
 *
 * 原因：浏览器对 file:// 协议下的 `<script type="module">` 有 CORS 限制
 * （origin 为 null），直接双击 dist/index.html 会白屏。
 * 这里配合 rollup 的 iife 输出 + 去掉 module / crossorigin 属性，
 * 使产物既能在 http 下使用，也能通过 file:// 直接打开。
 *
 * @return {import('vite').Plugin} Vite 插件
 */
function classicScriptPlugin() {
  return {
    name: 'dlt-classic-script',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      /**
       * @param {string} html 原始 HTML
       * @return {string} 处理后的 HTML
       */
      handler(html) {
        // 1) 去掉 type="module" / crossorigin；2) 加上 defer，保证 #root 已解析后再执行
        return html
          .replace(/<script type="module"\s+crossorigin\s+/g, '<script defer ')
          .replace(/<script type="module"\s+/g, '<script defer ')
          .replace(/\scrossorigin(?=[\s>])/g, '');
      },
    },
  };
}

// base: './' 让构建产物可以通过 file:// 直接打开（资源全部使用相对路径）
export default defineConfig({
  base: './',
  plugins: [react(), classicScriptPlugin()],
  resolve: {
    // 测试与业务代码统一用 @/lib/... 引入，避免为新增目录反复调整 ../ 深度
    alias: {
      '@': path.resolve(ROOT_DIR, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2018',
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    // 覆盖率只统计纯逻辑层（src/lib）：React 面板无单元测试，纳入会稀释指标
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/**/*.test.js'],
      // 基线实测（2026-10，85 用例）：lines 94.77 / statements 94.77 / functions 96.05 / branches 77.71
      // 阈值取基线下方留 2~5 个百分点，避免浮动即红
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 92,
        branches: 72,
      },
    },
  },
});
