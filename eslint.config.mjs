// Settings for ESLint, the spell-checker for code ("npm run lint"). It points
// out mistakes and messy code before they turn into bugs.
import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig(
  // Don't check downloaded packages or built output.
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  // Use the recommended rule sets for TypeScript and for Vue.
  tseslint.configs.recommended,
  eslintPluginVue.configs['flat/recommended'],
  // How to read .vue files.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser
      }
    }
  },
  // Our own tweaks to the rules.
  {
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      // Don't insist every optional setting on a screen piece has a default.
      'vue/require-default-prop': 'off',
      // Allow one-word screen piece names like "Bee" and "Hexagon".
      'vue/multi-word-component-names': 'off',
      // Every .vue file must be written in TypeScript.
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: 'ts'
          }
        }
      ]
    }
  },
  // Switch off any rules that fight with Prettier (the auto-formatter).
  eslintConfigPrettier
)
