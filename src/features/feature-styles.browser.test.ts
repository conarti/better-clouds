import { parse } from 'postcss'
import { describe, expect, it } from 'vitest'
import {
  findNestedHasSelector,
  splitTopLevelSelectorList,
} from '@/shared/feature/css-selector-analysis'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { collectStyleRules, mountFeatureFixture } from '@@/tests/helpers/feature-dom'

/**
 * Свойства, которые нельзя задавать колонке навигации и её предкам: они создают containing
 * block для потомков с position: fixed и ломают меню, вызванные из колонки (разведка D6, D7).
 */
const FORBIDDEN_PROPERTY_NAMES = [
  'transform',
  'translate',
  'scale',
  'rotate',
  'filter',
  'backdrop-filter',
  'perspective',
  'will-change',
  'container-type',
]
const CONTAIN_PROPERTY_NAME = 'contain'
const FORBIDDEN_CONTAIN_VALUES = ['layout', 'paint', 'strict', 'content']

const CLIP_PATH_PROPERTY_NAME = 'clip-path'

/**
 * clip-path режет всех потомков, включая меню, вызванные из колонки, поэтому по умолчанию
 * он запрещён вместе с остальными свойствами. Исключение одно: autohide-toolbar прячет им
 * саму колонку. Значения перечислены поимённо, потому что резать нельзя только в раскрытом
 * состоянии, а меню колонки открывается лишь в нём: inset(-100vh -100vw -100vh 0) уводит
 * границы за пределы окна и ничего не обрезает, none снимает обрезку на устройствах без
 * наведения, а inset(0 0 0 var(--better-clouds-toolbar-hidden-offset)) действует только
 * в покое, когда колонка спрятана и открытых меню у неё нет.
 */
const ALLOWED_CLIP_PATH_VALUES_BY_FEATURE_ID: ReadonlyMap<string, readonly string[]> = new Map([
  [
    'autohide-toolbar',
    [
      'inset(0 0 0 var(--better-clouds-toolbar-hidden-offset))',
      'inset(-100vh -100vw -100vh 0)',
      'none',
    ],
  ],
])

const FEATURE_DIRECTORY_PATTERN = /^\.\/([^/]+)\//
const PROBE_FEATURE_ID = 'styles-probe'
const EMPTY_FIXTURE_HTML_LIST: readonly string[] = []

const NESTED_HAS_SELF_CHECK_STYLES = 'html:has(div:has(span)) { color: red; }'
const UNSCOPED_SELF_CHECK_STYLES = 'div.unscoped-probe { color: red; }'
const FORBIDDEN_PROPERTY_SELF_CHECK_STYLES =
  'html[data-probe] { transform: translateX(1px); contain: layout; }'
const FORBIDDEN_DECLARATION_SELF_CHECK_COUNT = 2
const ARBITRARY_CLIP_PATH_SELF_CHECK_STYLES = 'html[data-probe] { clip-path: circle(40%); }'
const ALLOWED_CLIP_PATH_SELF_CHECK_STYLES = 'html[data-probe] { clip-path: none; }'
const ALLOWED_CLIP_PATH_FEATURE_ID = 'autohide-toolbar'

const featureStylesModules = import.meta.glob<string>('./*/styles.ts', {
  import: 'featureStyles',
  eager: true,
})

interface FeatureStylesEntry {
  readonly featureId: string
  readonly featureStyles: string
}

const featureStylesEntries: FeatureStylesEntry[] = Object.entries(featureStylesModules)
  .map(([modulePath, featureStyles]) => ({
    featureId: FEATURE_DIRECTORY_PATTERN.exec(modulePath)?.[1] ?? modulePath,
    featureStyles,
  }))
  .sort((firstEntry, secondEntry) => firstEntry.featureId.localeCompare(secondEntry.featureId))

function countSourceRules(cssText: string): number {
  let ruleCount = 0
  parse(cssText).walkRules(() => {
    ruleCount += 1
  })
  return ruleCount
}

function findForbiddenDeclarations(cssText: string, featureId: string): string[] {
  const allowedClipPathValues = ALLOWED_CLIP_PATH_VALUES_BY_FEATURE_ID.get(featureId) ?? []
  const forbiddenDeclarations: string[] = []
  parse(cssText).walkDecls((declaration) => {
    if (FORBIDDEN_PROPERTY_NAMES.includes(declaration.prop)) {
      forbiddenDeclarations.push(declaration.toString())
      return
    }
    if (
      declaration.prop === CONTAIN_PROPERTY_NAME &&
      FORBIDDEN_CONTAIN_VALUES.some((forbiddenValue) => declaration.value.includes(forbiddenValue))
    ) {
      forbiddenDeclarations.push(declaration.toString())
      return
    }
    if (
      declaration.prop === CLIP_PATH_PROPERTY_NAME &&
      !allowedClipPathValues.includes(declaration.value)
    ) {
      forbiddenDeclarations.push(declaration.toString())
    }
  })
  return forbiddenDeclarations
}

function findUnscopedSelectors(cssText: string, featureScope: string): string[] {
  const fixture = mountFeatureFixture({
    featureId: PROBE_FEATURE_ID,
    featureStyles: cssText,
    fixtureHtmlList: EMPTY_FIXTURE_HTML_LIST,
  })
  try {
    return collectStyleRules(fixture.featureStyleElement)
      .flatMap((styleRule) => splitTopLevelSelectorList(styleRule.selectorText))
      .filter((selector) => !selector.startsWith(featureScope))
  } finally {
    fixture.unmount()
  }
}

function countBrowserRules(cssText: string): number {
  const fixture = mountFeatureFixture({
    featureId: PROBE_FEATURE_ID,
    featureStyles: cssText,
    fixtureHtmlList: EMPTY_FIXTURE_HTML_LIST,
  })
  try {
    return collectStyleRules(fixture.featureStyleElement).length
  } finally {
    fixture.unmount()
  }
}

describe('стили функций', () => {
  it('стили есть у каждой функции', () => {
    expect(featureStylesEntries.length).toBeGreaterThan(0)
    for (const { featureStyles } of featureStylesEntries) {
      expect(featureStyles.length).toBeGreaterThan(0)
    }
  })

  describe.each(featureStylesEntries)('$featureId', ({ featureId, featureStyles }) => {
    it('Chromium принимает все правила', () => {
      const sourceRuleCount = countSourceRules(featureStyles)
      expect(sourceRuleCount).toBeGreaterThan(0)
      expect(countBrowserRules(featureStyles)).toBe(sourceRuleCount)
    })

    it('каждое правило ограничено областью функции', () => {
      expect(findUnscopedSelectors(featureStyles, createFeatureScopeSelector(featureId))).toEqual(
        [],
      )
    })

    it('не задаёт свойств, ломающих меню внутри колонки', () => {
      expect(findForbiddenDeclarations(featureStyles, featureId)).toEqual([])
    })

    it('не содержит вложенного :has()', () => {
      expect(findNestedHasSelector(featureStyles)).toEqual([])
    })
  })

  it('самопроверка: Chromium выбрасывает правило с вложенным :has()', () => {
    expect(countSourceRules(NESTED_HAS_SELF_CHECK_STYLES)).toBe(1)
    expect(countBrowserRules(NESTED_HAS_SELF_CHECK_STYLES)).toBe(0)
    expect(findNestedHasSelector(NESTED_HAS_SELF_CHECK_STYLES)).not.toEqual([])
  })

  it('самопроверка: правило без области функции находится', () => {
    const [{ featureId }] = featureStylesEntries as [FeatureStylesEntry]
    expect(
      findUnscopedSelectors(UNSCOPED_SELF_CHECK_STYLES, createFeatureScopeSelector(featureId)),
    ).not.toEqual([])
  })

  it('самопроверка: запрещённые свойства находятся', () => {
    expect(
      findForbiddenDeclarations(FORBIDDEN_PROPERTY_SELF_CHECK_STYLES, PROBE_FEATURE_ID),
    ).toHaveLength(FORBIDDEN_DECLARATION_SELF_CHECK_COUNT)
  })

  it('самопроверка: произвольный clip-path находится даже у функции с исключением', () => {
    expect(
      findForbiddenDeclarations(
        ARBITRARY_CLIP_PATH_SELF_CHECK_STYLES,
        ALLOWED_CLIP_PATH_FEATURE_ID,
      ),
    ).not.toEqual([])
  })

  it('самопроверка: разрешённое значение clip-path запрещено другой функции', () => {
    expect(
      findForbiddenDeclarations(ALLOWED_CLIP_PATH_SELF_CHECK_STYLES, PROBE_FEATURE_ID),
    ).not.toEqual([])
    expect(
      findForbiddenDeclarations(ALLOWED_CLIP_PATH_SELF_CHECK_STYLES, ALLOWED_CLIP_PATH_FEATURE_ID),
    ).toEqual([])
  })
})
