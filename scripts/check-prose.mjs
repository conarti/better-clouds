import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { parse as parseSingleFileComponent } from 'vue/compiler-sfc'

/**
 * Проверяет тексты для людей (README, документы, тексты UI, заголовки коммитов и PR)
 * на длинное и среднее тире и двойной дефис. Код, блоки кода и стили не проверяются.
 * Без аргументов проверяет файлы репозитория, с флагом --stdin построчно стандартный ввод.
 */

const PROJECT_ROOT_PATH = path.resolve(import.meta.dirname, '..')
const STDIN_FLAG = '--stdin'
const STDIN_SOURCE_NAME = 'stdin'
const UTF8_ENCODING = 'utf8'

const FORBIDDEN_SEQUENCES = [
  { sequence: '\u2014', description: 'длинное тире' },
  { sequence: '\u2013', description: 'среднее тире' },
  { sequence: '--', description: 'двойной дефис' },
]

const MARKDOWN_FILE_PATTERNS = ['README.md', 'tests/fixtures/README.md', 'docs/**/*.md']
const FEATURE_META_FILE_PATTERN = 'src/features/*/meta.ts'
const VUE_FILE_PATTERN = 'src/**/*.vue'
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', '.output', '.wxt'])

const CHECKED_VUE_ATTRIBUTE_NAMES = new Set(['title', 'aria-label', 'placeholder'])
const VUE_ELEMENT_NODE_TYPE = 1
const VUE_TEXT_NODE_TYPE = 2
const VUE_ATTRIBUTE_NODE_TYPE = 6

const MARKDOWN_CODE_FENCE_PATTERN = /^\s*(```|~~~)/
const MARKDOWN_INLINE_CODE_PATTERN = /`[^`]*`/g
const MARKDOWN_LINK_DESTINATION_PATTERN = /\]\([^)]*\)/g
const MARKDOWN_HTML_COMMENT_MARKER_PATTERN = /<!--|-->/g
const MARKDOWN_TABLE_DELIMITER_ROW_PATTERN = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const MARKDOWN_THEMATIC_BREAK_PATTERN = /^\s*([-*_])(\s*\1){2,}\s*$/

/**
 * @typedef {{ sourceName: string, lineNumber: number, description: string }} ProseViolation
 */

/**
 * Находит запрещённые последовательности в тексте, который может занимать несколько строк
 * @param {string} text проверяемый текст
 * @param {string} sourceName имя источника для отчёта
 * @param {number} lineNumber номер первой строки текста в источнике
 * @returns {ProseViolation[]}
 */
function findViolationsInText(text, sourceName, lineNumber) {
  return text
    .split('\n')
    .flatMap((textLine, lineOffset) =>
      FORBIDDEN_SEQUENCES.filter(({ sequence }) => textLine.includes(sequence)).map(
        ({ description }) => ({ sourceName, lineNumber: lineNumber + lineOffset, description }),
      ),
    )
}

/**
 * Находит файлы по glob-шаблонам относительно корня проекта
 * @param {string[]} patterns glob-шаблоны
 * @returns {string[]} относительные пути
 */
function findProjectFiles(patterns) {
  return fs
    .globSync(patterns, {
      cwd: PROJECT_ROOT_PATH,
      exclude: (directoryEntryName) => IGNORED_DIRECTORY_NAMES.has(directoryEntryName),
    })
    .sort()
}

/**
 * Проверяет Markdown вне блоков кода, inline-кода, адресов ссылок и служебной разметки таблиц
 * @param {string} relativeFilePath путь файла
 * @returns {ProseViolation[]}
 */
function checkMarkdownFile(relativeFilePath) {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT_PATH, relativeFilePath), UTF8_ENCODING)
  const violations = []
  let isInsideCodeFence = false

  fileContent.split('\n').forEach((line, lineIndex) => {
    if (MARKDOWN_CODE_FENCE_PATTERN.test(line)) {
      isInsideCodeFence = !isInsideCodeFence
      return
    }
    if (
      isInsideCodeFence ||
      MARKDOWN_TABLE_DELIMITER_ROW_PATTERN.test(line) ||
      MARKDOWN_THEMATIC_BREAK_PATTERN.test(line)
    ) {
      return
    }
    const proseText = line
      .replace(MARKDOWN_INLINE_CODE_PATTERN, '')
      .replace(MARKDOWN_LINK_DESTINATION_PATTERN, ']')
      .replace(MARKDOWN_HTML_COMMENT_MARKER_PATTERN, '')
    violations.push(...findViolationsInText(proseText, relativeFilePath, lineIndex + 1))
  })

  return violations
}

/**
 * Проверяет строковые литералы и тексты шаблонных строк в meta.ts функции
 * @param {string} relativeFilePath путь файла
 * @returns {ProseViolation[]}
 */
function checkFeatureMetaFile(relativeFilePath) {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT_PATH, relativeFilePath), UTF8_ENCODING)
  const sourceFile = ts.createSourceFile(
    relativeFilePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  )
  const violations = []

  /** @param {ts.Node} node */
  function visitNode(node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      violations.push(...findViolationsInText(node.text, relativeFilePath, line + 1))
    }
    ts.forEachChild(node, visitNode)
  }

  visitNode(sourceFile)
  return violations
}

/**
 * Проверяет текстовые узлы и статические title, aria-label, placeholder в шаблоне .vue
 * Для текста берётся исходный фрагмент: компилятор схлопывает пробелы и переносы в content,
 * из-за чего номер строки в отчёте был бы неточным.
 * @param {string} relativeFilePath путь файла
 * @returns {ProseViolation[]}
 */
function checkVueFile(relativeFilePath) {
  const fileContent = fs.readFileSync(path.join(PROJECT_ROOT_PATH, relativeFilePath), UTF8_ENCODING)
  const { descriptor } = parseSingleFileComponent(fileContent, { filename: relativeFilePath })
  const violations = []

  function visitTemplateNode(templateNode) {
    if (templateNode.type === VUE_TEXT_NODE_TYPE) {
      violations.push(
        ...findViolationsInText(
          templateNode.loc.source,
          relativeFilePath,
          templateNode.loc.start.line,
        ),
      )
    }
    if (templateNode.type === VUE_ELEMENT_NODE_TYPE) {
      for (const property of templateNode.props) {
        if (
          property.type === VUE_ATTRIBUTE_NODE_TYPE &&
          CHECKED_VUE_ATTRIBUTE_NAMES.has(property.name) &&
          property.value
        ) {
          violations.push(
            ...findViolationsInText(
              property.value.content,
              relativeFilePath,
              property.value.loc.start.line,
            ),
          )
        }
      }
    }
    for (const childNode of templateNode.children ?? []) {
      visitTemplateNode(childNode)
    }
  }

  if (descriptor.template?.ast) {
    visitTemplateNode(descriptor.template.ast)
  }
  return violations
}

/** @returns {ProseViolation[]} */
function checkProjectFiles() {
  return [
    ...findProjectFiles(MARKDOWN_FILE_PATTERNS).flatMap(checkMarkdownFile),
    ...findProjectFiles([FEATURE_META_FILE_PATTERN]).flatMap(checkFeatureMetaFile),
    ...findProjectFiles([VUE_FILE_PATTERN]).flatMap(checkVueFile),
  ]
}

/** @returns {ProseViolation[]} */
function checkStandardInput() {
  const standardInputContent = fs.readFileSync(process.stdin.fd, UTF8_ENCODING)
  return standardInputContent
    .split('\n')
    .flatMap((line, lineIndex) => findViolationsInText(line, STDIN_SOURCE_NAME, lineIndex + 1))
}

const violations = process.argv.includes(STDIN_FLAG) ? checkStandardInput() : checkProjectFiles()

for (const { sourceName, lineNumber, description } of violations) {
  console.error(`${sourceName}:${lineNumber} ${description}`)
}

process.exitCode = violations.length > 0 ? 1 : 0
