import { describe, expect, it } from 'vitest'
import { findNestedHasSelector } from '@/shared/feature/css-selector-analysis'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import {
  collectBrowserRules,
  countSourceRules,
  findForbiddenDeclarations,
  findUnscopedSelectors,
  PROBE_FEATURE_ID,
} from '@@/tests/helpers/style-checks'

const FEATURE_DIRECTORY_PATTERN = /^\.\/([^/]+)\//

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
      expect(collectBrowserRules(featureStyles)).toHaveLength(sourceRuleCount)
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
    expect(collectBrowserRules(NESTED_HAS_SELF_CHECK_STYLES)).toEqual([])
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
