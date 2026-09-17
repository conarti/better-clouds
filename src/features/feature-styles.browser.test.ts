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

const FEATURE_DIRECTORY_PATTERN = /^\.\/([^/]+)\//
const PROBE_FEATURE_ID = 'styles-probe'
const EMPTY_FIXTURE_HTML_LIST: readonly string[] = []

const NESTED_HAS_SELF_CHECK_STYLES = 'html:has(div:has(span)) { color: red; }'
const UNSCOPED_SELF_CHECK_STYLES = 'div.unscoped-probe { color: red; }'
const FORBIDDEN_PROPERTY_SELF_CHECK_STYLES =
  'html[data-probe] { transform: translateX(1px); contain: layout; }'

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

function findForbiddenDeclarations(cssText: string): string[] {
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
      expect(findForbiddenDeclarations(featureStyles)).toEqual([])
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
    expect(findForbiddenDeclarations(FORBIDDEN_PROPERTY_SELF_CHECK_STYLES)).toHaveLength(2)
  })
})
