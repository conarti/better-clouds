import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { parse as parseSingleFileComponent } from 'vue/compiler-sfc'

/**
 * Проверяет тексты для людей (README, документы, тексты UI, заголовки коммитов и PR)
 * на длинное и среднее тире и двойной дефис. Код, блоки кода и стили не проверяются.
 * Без аргументов проверяет файлы репозитория, с флагом --stdin построчно стандартный ввод,
 * с путями файлов только их: по расширению выбирается разбор Markdown, TypeScript или .vue.
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
/** Тексты для людей в TypeScript: названия и описания функций плюс имя и описание расширения */
const TYPESCRIPT_FILE_PATTERNS = ['src/features/*/meta.ts', 'wxt.config.ts']
const VUE_FILE_PATTERN = 'src/**/*.vue'
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', '.output', '.wxt'])

const MARKDOWN_FILE_EXTENSION = '.md'
const TYPESCRIPT_FILE_EXTENSION = '.ts'
const VUE_FILE_EXTENSION = '.vue'
const FLAG_PREFIX = '--'
const FIRST_LINE_NUMBER = 1

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
 * @param {string} text
 * @param {string} sourceName
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
 * Читает файл: путь относительно корня проекта или абсолютный
 * @param {string} filePath
 * @returns {string}
 */
function readProjectFile(filePath) {
  return fs.readFileSync(path.resolve(PROJECT_ROOT_PATH, filePath), UTF8_ENCODING)
}

/**
 * Находит файлы по glob-шаблонам относительно корня проекта
 * @param {string[]} patterns
 * @returns {string[]} пути относительно корня
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
 * @param {string} relativeFilePath
 * @returns {ProseViolation[]}
 */
function checkMarkdownFile(relativeFilePath) {
  const fileContent = readProjectFile(relativeFilePath)
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
    violations.push(
      ...findViolationsInText(proseText, relativeFilePath, lineIndex + FIRST_LINE_NUMBER),
    )
  })

  return violations
}

/**
 * Проверяет строковые литералы и тексты шаблонных строк в коде на TypeScript
 * @param {string} sourceText
 * @param {string} sourceName
 * @param {number} lineOffset сдвиг строк, если код это фрагмент файла
 * @returns {ProseViolation[]}
 */
function checkTypeScriptSource(sourceText, sourceName, lineOffset = 0) {
  const sourceFile = ts.createSourceFile(sourceName, sourceText, ts.ScriptTarget.Latest, true)
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
      violations.push(
        ...findViolationsInText(node.text, sourceName, line + FIRST_LINE_NUMBER + lineOffset),
      )
    }
    ts.forEachChild(node, visitNode)
  }

  visitNode(sourceFile)
  return violations
}

/**
 * Проверяет строковые литералы файла на TypeScript
 * @param {string} relativeFilePath
 * @returns {ProseViolation[]}
 */
function checkTypeScriptFile(relativeFilePath) {
  return checkTypeScriptSource(readProjectFile(relativeFilePath), relativeFilePath)
}

/**
 * Проверяет шаблон и код компонента .vue: текстовые узлы, статические title, aria-label и
 * placeholder в шаблоне плюс строковые литералы блоков script, где живут тексты интерфейса.
 * Для текста шаблона берётся исходный фрагмент: компилятор схлопывает пробелы и переносы
 * в content, из-за чего номер строки в отчёте был бы неточным.
 * @param {string} relativeFilePath
 * @returns {ProseViolation[]}
 */
function checkVueFile(relativeFilePath) {
  const fileContent = readProjectFile(relativeFilePath)
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
  for (const scriptBlock of [descriptor.script, descriptor.scriptSetup]) {
    if (scriptBlock) {
      violations.push(
        ...checkTypeScriptSource(
          scriptBlock.content,
          relativeFilePath,
          scriptBlock.loc.start.line - FIRST_LINE_NUMBER,
        ),
      )
    }
  }
  return violations
}

/** @returns {ProseViolation[]} */
function checkProjectFiles() {
  return [
    ...findProjectFiles(MARKDOWN_FILE_PATTERNS).flatMap(checkMarkdownFile),
    ...findProjectFiles(TYPESCRIPT_FILE_PATTERNS).flatMap(checkTypeScriptFile),
    ...findProjectFiles([VUE_FILE_PATTERN]).flatMap(checkVueFile),
  ]
}

/**
 * Проверяет один файл, выбирая разбор по расширению
 * @param {string} filePath
 * @returns {ProseViolation[]}
 */
function checkFile(filePath) {
  const fileExtension = path.extname(filePath)
  if (fileExtension === MARKDOWN_FILE_EXTENSION) {
    return checkMarkdownFile(filePath)
  }
  if (fileExtension === VUE_FILE_EXTENSION) {
    return checkVueFile(filePath)
  }
  if (fileExtension === TYPESCRIPT_FILE_EXTENSION) {
    return checkTypeScriptFile(filePath)
  }
  throw new Error(`Неизвестное расширение файла ${filePath}`)
}

/** @returns {ProseViolation[]} */
function checkStandardInput() {
  const standardInputContent = fs.readFileSync(process.stdin.fd, UTF8_ENCODING)
  return standardInputContent
    .split('\n')
    .flatMap((line, lineIndex) =>
      findViolationsInText(line, STDIN_SOURCE_NAME, lineIndex + FIRST_LINE_NUMBER),
    )
}

const filePathArguments = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith(FLAG_PREFIX))

/** @returns {ProseViolation[]} */
function run() {
  if (process.argv.includes(STDIN_FLAG)) {
    return checkStandardInput()
  }
  if (filePathArguments.length > 0) {
    return filePathArguments.flatMap(checkFile)
  }
  return checkProjectFiles()
}

const violations = run()

for (const { sourceName, lineNumber, description } of violations) {
  console.error(`${sourceName}:${lineNumber} ${description}`)
}

process.exitCode = violations.length > 0 ? 1 : 0
