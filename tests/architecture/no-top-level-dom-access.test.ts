import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Верхний уровень модулей функций и content script не обращается к document, window и browser:
 * WXT импортирует entrypoint в Node при сборке, а eager glob выполняет верхний уровень всех
 * content.ts и styles.ts. Сборка такое обращение не ловит, поэтому правило проверяется разбором
 * исходников: обращения допустимы только внутри тел функций (main, mount и прочие). Проверяются
 * все модули папок функций, кроме тестов, а не только файлы контракта: вспомогательные модули
 * импортируются из content.ts и выполняются вместе с ним.
 */

const FORBIDDEN_GLOBAL_NAMES = ['document', 'window', 'browser']
const FINDING_SEPARATOR = ': '
const LINE_NUMBER_OFFSET = 1
const CONTENT_SCRIPT_MODULE_PATH = '../../src/entrypoints/content.ts'
/** Скрипт главного мира страницы: такой же content script, правило то же */
const MAIN_WORLD_CONTENT_SCRIPT_MODULE_PATH = '../../src/entrypoints/chat-ids.content.ts'
const FEATURE_MODULE_FILE_NAMES = ['content.ts', 'meta.ts', 'styles.ts']
const FEATURE_DIRECTORY_PATTERN = /src\/features\/([^/]+)\//
const TEST_MODULE_SUFFIX = '.test.ts'

const checkedSourceModules = import.meta.glob<string>(
  [
    '../../src/entrypoints/content.ts',
    '../../src/entrypoints/*.content.ts',
    '../../src/features/*/*.ts',
    '!../../src/features/*/*.test.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
)

const featureDirectoryNames = Object.keys(import.meta.glob('../../src/features/*/meta.ts'))
  .map((modulePath) => FEATURE_DIRECTORY_PATTERN.exec(modulePath)?.[1])
  .filter((directoryName): directoryName is string => directoryName !== undefined)

const SELF_CHECK_SOURCES = {
  topLevelDocument: 'const rootElement = document.documentElement\nexport default rootElement\n',
  topLevelBrowser: 'export const version = browser.runtime.getManifest().version\n',
  insideFunction:
    'export function mount() {\n  return document.querySelector(window.name)\n}\n' +
    'export default { mount() {\n  return browser.runtime.id\n} }\n',
  sameNames:
    'const settings = { document: 1, window: 2 }\n' +
    'export const value = settings.document + settings.window\n' +
    'export type Root = { browser: string }\n',
} as const

function isFunctionLikeNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
}

function isInsideTypePosition(node: ts.Node): boolean {
  for (let ancestor = node.parent; ancestor !== undefined; ancestor = ancestor.parent) {
    if (ts.isTypeNode(ancestor) || ts.isTypeAliasDeclaration(ancestor)) {
      return true
    }
  }
  return false
}

/** Отсекает имена, которые совпадают с глобальными, но обращением к ним не являются */
function isGlobalValueReference(identifier: ts.Identifier): boolean {
  const parentNode = identifier.parent
  if (parentNode === undefined) {
    return true
  }
  if (ts.isPropertyAccessExpression(parentNode) && parentNode.name === identifier) {
    return false
  }
  if (ts.isQualifiedName(parentNode) && parentNode.right === identifier) {
    return false
  }
  if (ts.isPropertyAssignment(parentNode) && parentNode.name === identifier) {
    return false
  }
  if (ts.isPropertySignature(parentNode) && parentNode.name === identifier) {
    return false
  }
  if (ts.isBindingElement(parentNode) && parentNode.propertyName === identifier) {
    return false
  }
  if (ts.isVariableDeclaration(parentNode) && parentNode.name === identifier) {
    return false
  }
  if (ts.isParameter(parentNode) && parentNode.name === identifier) {
    return false
  }
  if (
    ts.isImportSpecifier(parentNode) ||
    ts.isExportSpecifier(parentNode) ||
    ts.isImportClause(parentNode) ||
    ts.isNamespaceImport(parentNode)
  ) {
    return false
  }
  return !isInsideTypePosition(identifier)
}

function findTopLevelGlobalReferences(sourcePath: string, sourceText: string): string[] {
  const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true)
  const findings: string[] = []

  function visitNode(node: ts.Node, isInsideFunction: boolean): void {
    if (
      !isInsideFunction &&
      ts.isIdentifier(node) &&
      FORBIDDEN_GLOBAL_NAMES.includes(node.text) &&
      isGlobalValueReference(node)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      findings.push(
        `${sourcePath}${FINDING_SEPARATOR}${node.text} (строка ${line + LINE_NUMBER_OFFSET})`,
      )
    }
    const isFunctionBodyBelow = isInsideFunction || isFunctionLikeNode(node)
    node.forEachChild((childNode) => {
      visitNode(childNode, isFunctionBodyBelow)
    })
  }

  visitNode(sourceFile, false)
  return findings
}

describe('верхний уровень модулей функций', () => {
  it('проверяются content script и модули каждой функции', () => {
    const checkedModulePaths = Object.keys(checkedSourceModules)
    expect(featureDirectoryNames.length).toBeGreaterThan(0)
    expect(checkedModulePaths).toContain(CONTENT_SCRIPT_MODULE_PATH)
    expect(checkedModulePaths).toContain(MAIN_WORLD_CONTENT_SCRIPT_MODULE_PATH)
    for (const directoryName of featureDirectoryNames) {
      for (const moduleFileName of FEATURE_MODULE_FILE_NAMES) {
        expect(checkedModulePaths).toContain(
          `../../src/features/${directoryName}/${moduleFileName}`,
        )
      }
    }
    expect(
      checkedModulePaths.filter((modulePath) => modulePath.endsWith(TEST_MODULE_SUFFIX)),
    ).toEqual([])
  })

  it('не обращается к document, window и browser', () => {
    const findings = Object.entries(checkedSourceModules).flatMap(([sourcePath, sourceText]) =>
      findTopLevelGlobalReferences(sourcePath, sourceText),
    )
    expect(findings).toEqual([])
  })

  it('самопроверка: обращение к document на верхнем уровне находится', () => {
    expect(
      findTopLevelGlobalReferences('probe-document.ts', SELF_CHECK_SOURCES.topLevelDocument),
    ).toHaveLength(1)
  })

  it('самопроверка: обращение к browser на верхнем уровне находится', () => {
    expect(
      findTopLevelGlobalReferences('probe-browser.ts', SELF_CHECK_SOURCES.topLevelBrowser),
    ).toHaveLength(1)
  })

  it('самопроверка: обращения внутри функций разрешены', () => {
    expect(
      findTopLevelGlobalReferences('probe-function.ts', SELF_CHECK_SOURCES.insideFunction),
    ).toEqual([])
  })

  it('самопроверка: одноимённые свойства и типы находками не считаются', () => {
    expect(findTopLevelGlobalReferences('probe-names.ts', SELF_CHECK_SOURCES.sameNames)).toEqual([])
  })
})
