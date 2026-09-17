import { describe, expect, it } from 'vitest'
import { clientFixturesByFileName } from '../helpers/load-fixture'

/**
 * Имена DOM сайта живут только в src/shared/site/selectors.ts. Тест собирает имена классов и
 * атрибутов из обезличенных фрагментов разметки и ищет их во всех остальных исходниках.
 */

const SELECTORS_MODULE_PATH_SUFFIX = 'src/shared/site/selectors.ts'
const HTML_MEDIA_TYPE = 'text/html'
const MINIMUM_FIXTURE_CLASS_COUNT = 20
const DATA_ATTRIBUTE_PREFIX = 'data-'
const FINDING_SEPARATOR = ': '

/**
 * Атрибуты сайта без префикса data-: в разметке их не отличить от стандартных, поэтому
 * список задан явно по результатам разведки D3, D4, D6 и D13.
 */
const SITE_ATTRIBUTE_NAMES_WITHOUT_DATA_PREFIX = ['theme', 'reduced_animations', 'aria-selected']

/** Теги, после которых класс в селекторе не отличить от обращения к свойству объекта */
const TAG_NAMES_BEFORE_CLASS =
  'html|body|div|span|nav|button|a|input|ul|li|svg|section|header|aside|main|label|img|p'

const fixtureSources = [...clientFixturesByFileName.values()]

const typeScriptSourceModules = import.meta.glob<string>('../../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const vueSourceModules = import.meta.glob<string>('../../src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const checkedSources: Record<string, string> = Object.fromEntries(
  Object.entries({ ...typeScriptSourceModules, ...vueSourceModules }).filter(
    ([modulePath]) => !modulePath.endsWith(SELECTORS_MODULE_PATH_SUFFIX),
  ),
)

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectFixtureNames(): { classNames: string[]; attributeNames: string[] } {
  const classNames = new Set<string>()
  const attributeNames = new Set(SITE_ATTRIBUTE_NAMES_WITHOUT_DATA_PREFIX)
  const domParser = new DOMParser()

  for (const fixtureHtml of fixtureSources) {
    const fixtureDocument = domParser.parseFromString(fixtureHtml, HTML_MEDIA_TYPE)
    for (const element of fixtureDocument.querySelectorAll('*')) {
      for (const className of element.classList) {
        classNames.add(className)
      }
      for (const attributeName of element.getAttributeNames()) {
        if (attributeName.startsWith(DATA_ATTRIBUTE_PREFIX)) {
          attributeNames.add(attributeName)
        }
      }
    }
  }

  return { classNames: [...classNames], attributeNames: [...attributeNames] }
}

/**
 * Для класса с дефисом или подчёркиванием lookbehind не нужен: такое имя не встречается
 * как обращение к свойству, а селекторы вида nav.react-contextmenu иначе не находятся.
 */
function createClassPatterns(className: string): RegExp[] {
  const escapedClassName = escapeForPattern(className)
  const quotedPattern = new RegExp(`['"\`]${escapedClassName}['"\`]`)

  if (/[-_]/.test(className)) {
    return [new RegExp(`\\.${escapedClassName}(?![\\w-])`), quotedPattern]
  }

  return [
    new RegExp(`(?<![\\w$)\\]?-])\\.${escapedClassName}(?![\\w-])`),
    new RegExp(`(?<![\\w$.-])(?:${TAG_NAMES_BEFORE_CLASS})\\.${escapedClassName}(?![\\w-])`),
    quotedPattern,
  ]
}

function createAttributePatterns(attributeName: string): RegExp[] {
  const escapedAttributeName = escapeForPattern(attributeName)
  return [
    new RegExp(`\\[${escapedAttributeName}(?![\\w-])`),
    new RegExp(`['"\`]${escapedAttributeName}['"\`]`),
  ]
}

function findSiteNames(
  sources: Readonly<Record<string, string>>,
  classNames: readonly string[],
  attributeNames: readonly string[],
): string[] {
  const findings: string[] = []
  const patternsByName = new Map<string, RegExp[]>([
    ...classNames.map((className): [string, RegExp[]] => [
      className,
      createClassPatterns(className),
    ]),
    ...attributeNames.map((attributeName): [string, RegExp[]] => [
      attributeName,
      createAttributePatterns(attributeName),
    ]),
  ])

  for (const [sourcePath, sourceText] of Object.entries(sources)) {
    for (const [siteName, patterns] of patternsByName) {
      if (patterns.some((pattern) => pattern.test(sourceText))) {
        findings.push(`${sourcePath}${FINDING_SEPARATOR}${siteName}`)
      }
    }
  }

  return findings.sort()
}

const { classNames: fixtureClassNames, attributeNames: fixtureAttributeNames } =
  collectFixtureNames()

describe('изоляция имён DOM сайта', () => {
  it('фрагменты разметки дают достаточную базу имён', () => {
    expect(fixtureSources.length).toBeGreaterThan(0)
    expect(fixtureClassNames.length).toBeGreaterThanOrEqual(MINIMUM_FIXTURE_CLASS_COUNT)
    expect(Object.keys(checkedSources).length).toBeGreaterThan(0)
  })

  it('исходники вне selectors.ts не содержат имён классов и атрибутов сайта', () => {
    expect(findSiteNames(checkedSources, fixtureClassNames, fixtureAttributeNames)).toEqual([])
  })

  it('самопроверка: находит имена сайта в синтетических исходниках', () => {
    const suspiciousSources = {
      'multiline-css.ts': [
        'const styles = css`',
        '  ${featureScope}',
        '  .toolbar {',
        '  }',
        '`',
      ].join('\n'),
      'attribute.ts': "const entrySelector = '[data-open-chat]'",
      'menu.ts': "const menu = 'nav.react-contextmenu.chat-context-menu'",
      'entry.ts': "const entry = 'div.row.chat-list-entry'",
      'clear-button.ts': "const clearButton = 'button.icon-button'",
      'theme.ts': 'const darkTheme = `[theme="dark"]`',
      'animations.ts': "const reducedAnimations = 'body[reduced_animations]'",
    }

    const findings = findSiteNames(suspiciousSources, fixtureClassNames, fixtureAttributeNames)

    expect(findings).toContain(`multiline-css.ts${FINDING_SEPARATOR}toolbar`)
    expect(findings).toContain(`attribute.ts${FINDING_SEPARATOR}data-open-chat`)
    expect(findings).toContain(`menu.ts${FINDING_SEPARATOR}react-contextmenu`)
    expect(findings).toContain(`menu.ts${FINDING_SEPARATOR}chat-context-menu`)
    expect(findings).toContain(`entry.ts${FINDING_SEPARATOR}row`)
    expect(findings).toContain(`entry.ts${FINDING_SEPARATOR}chat-list-entry`)
    expect(findings).toContain(`clear-button.ts${FINDING_SEPARATOR}icon-button`)
    expect(findings).toContain(`theme.ts${FINDING_SEPARATOR}theme`)
    expect(findings).toContain(`animations.ts${FINDING_SEPARATOR}reduced_animations`)
  })

  it('самопроверка: не путает обращение к свойству с селектором', () => {
    const innocentSources = {
      'settings-table.ts': 'const firstRow = settingsTable.row',
      'feature-meta.ts': 'const featureTitle = featureMeta.title',
    }

    expect(findSiteNames(innocentSources, fixtureClassNames, fixtureAttributeNames)).toEqual([])
  })
})
