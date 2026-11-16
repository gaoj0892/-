import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * ESLint 9 flat config。
 *
 * 规则集选型：js.configs.recommended + eslint-plugin-react recommended
 * + rules-of-hooks（error）+ exhaustive-deps（首版 warn，见 A1b）。
 * 不使用 airbnb（需 ESLint 8 peer 且 prop-types 噪音大）、不使用 xo/standard
 * （无法对 vite.config.js 做 node globals 豁免）。
 */
export default [
  {
    // dist 是 1.4MB 单行压缩产物，必须忽略，否则极慢甚至 OOM
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'qa_shots/**',
      '**/*.min.js',
      '**/*.zip',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      // React 18 现代写法：JSX 自动运行时，无需显式 import React / 声明 propTypes
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // hooks 顺序错误是白屏级风险，必须 error
      'react-hooks/rules-of-hooks': 'error',
      // A1b：warn 统计已清零，提级为 error，配合 --max-warnings 0 生效
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    // 构建配置与 Node 脚本：走 node globals，允许 console 输出
    files: [
      'vite.config.js',
      'eslint.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'scripts/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    // 测试文件：node 环境（读取种子文件、path 等）
    files: ['tests/**/*.{js,jsx}', 'src/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // 必须放最后：关闭所有与 prettier 冲突的格式类规则
  eslintConfigPrettier,
];
