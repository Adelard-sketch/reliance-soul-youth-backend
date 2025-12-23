import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['node_modules']),
  {
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.node,
    },
    extends: [js.configs.recommended],
  },
])
