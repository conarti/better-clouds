import { parse } from 'postcss'
import { splitTopLevelSelectorList } from '@/shared/feature/css-selector-analysis'
import { collectStyleRules, mountFeatureFixture } from './feature-dom'

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

export const PROBE_FEATURE_ID = 'styles-probe'
const EMPTY_FIXTURE_HTML_LIST: readonly string[] = []

export function countSourceRules(cssText: string): number {
  let ruleCount = 0
  parse(cssText).walkRules(() => {
    ruleCount += 1
  })
  return ruleCount
}

export function findForbiddenDeclarations(cssText: string, featureId: string): string[] {
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

/** Правила в том виде, в каком их принял Chromium: отброшенные правила сюда не попадают */
export function collectBrowserRules(cssText: string): CSSStyleRule[] {
  const fixture = mountFeatureFixture({
    featureId: PROBE_FEATURE_ID,
    featureStyles: cssText,
    fixtureHtmlList: EMPTY_FIXTURE_HTML_LIST,
  })
  try {
    return collectStyleRules(fixture.featureStyleElement)
  } finally {
    fixture.unmount()
  }
}

export function findUnscopedSelectors(cssText: string, featureScope: string): string[] {
  return collectBrowserRules(cssText)
    .flatMap((styleRule) => splitTopLevelSelectorList(styleRule.selectorText))
    .filter((selector) => !selector.startsWith(featureScope))
}
