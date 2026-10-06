import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // server/ is a separate Node.js project (its own package.json, its own
  // runtime globals) and isn't part of this Vite/React app — it shouldn't
  // be linted with browser-oriented React rules.
  globalIgnores(['dist', 'server']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // This rule (from react-hooks' newer React Compiler-oriented rule
      // set) flags any setState call inside a useEffect, including the
      // standard "fetch data on mount" and "sync form state from a prop"
      // patterns used throughout this app's pages and dialogs. Those are
      // legitimate, idiomatic uses of useEffect, not bugs — so this rule
      // is disabled rather than restructured around.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
