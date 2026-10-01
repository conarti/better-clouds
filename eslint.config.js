import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const PROJECT_ROOT_PATH = import.meta.dirname
const FEATURES_DIRECTORY_RELATIVE_PATH = 'src/features'
const LINE_COMMENT_TYPE = 'Line'

const SOURCE_FILE_PATTERNS = ['src/**/*.ts', 'src/**/*.vue']
const FEATURE_FILE_PATTERNS = ['src/features/**/*.ts', 'src/features/**/*.vue']
const POPUP_SAFE_FEATURE_FILE_PATTERNS = ['src/features/*/meta.ts', 'src/features/*/settings.ts']

const NETWORK_ACCESS_MESSAGE = 'Расширение не делает сетевых запросов'
const NETWORK_GLOBAL_NAMES = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']

const PARENT_DIRECTORY_IMPORT_MESSAGE =
  'Функция не импортирует файлы вне своей папки относительным путём, общий код только через @/shared/'
const POPUP_SAFE_IMPORT_MESSAGE =
  'meta.ts и settings.ts безопасны для попапа: без Vue, CSS, DOM, селекторов и API расширения'

const LAYER_BOUNDARY_MESSAGE = 'Нарушена граница слоёв: shared не зависит от features и entrypoints'
const FEATURE_ISOLATION_MESSAGE = 'Функции не импортируют друг друга и агрегаторы функций'
const POPUP_SAFE_ZONE_MESSAGE =
  'meta.ts и settings.ts не импортируют селекторы, настройки, runtime и content-части функций'
const POPUP_ZONE_MESSAGE = 'Попап не импортирует content-части функций, селекторы сайта и runtime'

const featureDirectoryAbsolutePath = path.join(PROJECT_ROOT_PATH, FEATURES_DIRECTORY_RELATIVE_PATH)

/** Список папок функций читается при запуске ESLint, поэтому новая функция не требует правки конфига */
function readFeatureDirectoryNames() {
  if (!fs.existsSync(featureDirectoryAbsolutePath)) {
    return []
  }
  return fs
    .readdirSync(featureDirectoryAbsolutePath, { withFileTypes: true })
    .filter((directoryEntry) => directoryEntry.isDirectory())
    .map((directoryEntry) => directoryEntry.name)
}

/**
 * В import-x зона с `from` из смешанных glob-шаблонов и путей помечает любой импорт как ошибку,
 * поэтому пути и glob-шаблоны разнесены по разным зонам.
 */
const restrictedPathZones = [
  {
    target: './src/shared',
    from: ['./src/features', './src/entrypoints'],
    message: LAYER_BOUNDARY_MESSAGE,
  },
  {
    target: './src/features',
    from: './src/entrypoints',
    message: LAYER_BOUNDARY_MESSAGE,
  },
  ...readFeatureDirectoryNames().map((featureDirectoryName) => ({
    target: `./src/features/${featureDirectoryName}`,
    from: './src/features',
    except: [`./${featureDirectoryName}`],
    message: FEATURE_ISOLATION_MESSAGE,
  })),
  {
    target: POPUP_SAFE_FEATURE_FILE_PATTERNS.map((pattern) => `./${pattern}`),
    from: [
      './src/shared/site',
      './src/shared/settings',
      './src/shared/feature/feature-runtime.ts',
      './src/shared/feature/lifecycle-scope.ts',
      './src/shared/feature/injected-elements.ts',
    ],
    message: POPUP_SAFE_ZONE_MESSAGE,
  },
  {
    target: POPUP_SAFE_FEATURE_FILE_PATTERNS.map((pattern) => `./${pattern}`),
    from: ['./src/features/*/styles.ts', './src/features/*/content.ts'],
    message: POPUP_SAFE_ZONE_MESSAGE,
  },
  {
    target: './src/entrypoints/popup',
    from: [
      './src/features/content-registry.ts',
      './src/shared/site',
      './src/shared/feature/feature-runtime.ts',
      './src/shared/feature/lifecycle-scope.ts',
      './src/shared/feature/injected-elements.ts',
    ],
    message: POPUP_ZONE_MESSAGE,
  },
  {
    target: './src/entrypoints/popup',
    from: ['./src/features/*/content.ts', './src/features/*/styles.ts'],
    message: POPUP_ZONE_MESSAGE,
  },
]

const parentDirectoryImportPattern = {
  group: ['../*'],
  message: PARENT_DIRECTORY_IMPORT_MESSAGE,
}

const noLineCommentsRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Запрещает однострочные комментарии',
    },
    messages: {
      lineComment: 'Однострочные комментарии запрещены, используйте блочный комментарий',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === LINE_COMMENT_TYPE) {
            context.report({ loc: comment.loc, messageId: 'lineComment' })
          }
        }
      },
    }
  },
}

export default defineConfig(
  {
    ignores: ['.output/', '.wxt/', 'coverage/', 'node_modules/'],
  },
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.vue', '**/*.js', '**/*.mjs'],
    plugins: {
      local: {
        rules: {
          'no-line-comments': noLineCommentsRule,
        },
      },
    },
    rules: {
      'local/no-line-comments': 'error',
    },
  },
  {
    files: SOURCE_FILE_PATTERNS,
    plugins: {
      'import-x': importX,
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: PROJECT_ROOT_PATH,
          zones: restrictedPathZones,
        },
      ],
      'no-restricted-globals': [
        'error',
        ...NETWORK_GLOBAL_NAMES.map((globalName) => ({
          name: globalName,
          message: NETWORK_ACCESS_MESSAGE,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: NETWORK_ACCESS_MESSAGE },
      ],
    },
  },
  {
    files: FEATURE_FILE_PATTERNS,
    rules: {
      'no-restricted-imports': ['error', { patterns: [parentDirectoryImportPattern] }],
    },
  },
  {
    files: POPUP_SAFE_FEATURE_FILE_PATTERNS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: POPUP_SAFE_IMPORT_MESSAGE },
            { name: '#imports', message: POPUP_SAFE_IMPORT_MESSAGE },
            { name: 'wxt', message: POPUP_SAFE_IMPORT_MESSAGE },
          ],
          patterns: [
            parentDirectoryImportPattern,
            { group: ['*.vue', '*.css', 'wxt/*'], message: POPUP_SAFE_IMPORT_MESSAGE },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
)
