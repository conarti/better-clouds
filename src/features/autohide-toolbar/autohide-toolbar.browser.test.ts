import { afterEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteAttributeNames, siteSelectors } from '@/shared/site/selectors'
import {
  collectStyleRules,
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles, keyboardNavigationAttributeName } from './styles'

const UNREAD_TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-notifications-unread.html'
const EMPTY_TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-notifications-none.html'
const MENU_OPEN_TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-menu-open.html'
const CHAT_CONTEXT_MENU_FIXTURE_FILE_NAME = 'chat-context-menu-open.html'
const LOGIN_PAGE_FIXTURE_FILE_NAME = 'login-page.html'
const CHAT_LIST_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const NO_MATCHED_RULE_COUNT = 0

/** Ширина видимой полосы в покое: та же величина, что и в стилях функции */
const EDGE_STRIP_WIDTH_PIXELS = 8
const MAXIMUM_POSITION_DIFFERENCE_PIXELS = 1
const EXPANDED_LEFT_VALUE = '0px'
const EMPTY_CONTENT_VALUE = 'none'
const REST_TRANSITION_DURATION = '0.15s'
const REST_TRANSITION_DELAY = '0.4s'
const DISABLED_TRANSITION_DURATION = '0s'
const REDUCED_ANIMATIONS_ATTRIBUTE_VALUE = 'true'
const REDUCED_MOTION_MEDIA_CONDITION = 'prefers-reduced-motion'
const DISABLED_DURATION_DECLARATION_COUNT = 2
const FIRST_RULE_INDEX = 0
const DISABLED_DURATION_VALUE = '0ms'
const KEYBOARD_NAVIGATION_ATTRIBUTE_VALUE = ''
const ANY_ELEMENT_SELECTOR = '*'
const EXPANSION_TIMEOUT_MILLISECONDS = 2000

/** Правила клиента для колонки из разведки D2 и D10 */
const SITE_TOOLBAR_WIDE_WINDOW_WIDTH_PIXELS = 84
const SITE_TOOLBAR_NARROW_WINDOW_WIDTH_PIXELS = 64
const SITE_TOOLBAR_NARROW_WINDOW_MAX_WIDTH_PIXELS = 1919

const siteStyles = css`
  ${siteSelectors.layoutPane} {
    display: flex;
    flex-direction: row;
    position: relative;
  }
  ${siteSelectors.toolbar} {
    width: ${SITE_TOOLBAR_WIDE_WINDOW_WIDTH_PIXELS}px;
    box-sizing: border-box;
  }
  @media screen and (max-width: ${SITE_TOOLBAR_NARROW_WINDOW_MAX_WIDTH_PIXELS}px) {
    ${siteSelectors.toolbar} {
      min-width: ${SITE_TOOLBAR_NARROW_WINDOW_WIDTH_PIXELS}px;
      max-width: ${SITE_TOOLBAR_NARROW_WINDOW_WIDTH_PIXELS}px;
    }
  }
`

/**
 * Правило доступности клиента из разведки D13: оно объявляет весь набор transition-*
 * с !important и специфичностью (0,6,1), поэтому наши переходы объявлены с !important.
 */
const SITE_REDUCED_ANIMATIONS_EXCLUSION_COUNT = 5
const SITE_REDUCED_ANIMATIONS_EXCLUSION_CLASS_PREFIX = '.animation-exclusion-'

const siteReducedAnimationsExclusions = Array.from(
  { length: SITE_REDUCED_ANIMATIONS_EXCLUSION_COUNT },
  (_unused, exclusionIndex) =>
    `:not(${SITE_REDUCED_ANIMATIONS_EXCLUSION_CLASS_PREFIX}${exclusionIndex})`,
).join('')

const siteReducedAnimationsStyles = css`
  ${siteSelectors.reducedAnimationsBody} ${siteReducedAnimationsExclusions} {
    transition-property: none !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`

describe('autohide-toolbar', () => {
  let fixture: MountedFeatureFixture

  function mountToolbar(fixtureFileNames: readonly string[]): void {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: fixtureFileNames.map((fixtureFileName) => loadFixture(fixtureFileName)),
      siteStyles,
      wrapInLayoutPane: true,
    })
  }

  function findToolbarElement(): Element {
    return findRequiredElement(fixture.container, siteSelectors.toolbar)
  }

  function readToolbarStyle(): CSSStyleDeclaration {
    return getComputedStyle(findToolbarElement())
  }

  function readHiddenOffsetPixels(): number {
    return Number.parseFloat(readToolbarStyle().width) - EDGE_STRIP_WIDTH_PIXELS
  }

  afterEach(() => {
    document.body.removeAttribute(siteAttributeNames.reducedAnimations)
    fixture.unmount()
  })

  it('в покое оставляет у края полосу шириной с видимую часть колонки', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    const toolbarStyle = readToolbarStyle()
    const hiddenOffsetPixels = readHiddenOffsetPixels()
    expect(toolbarStyle.left).toBe(`-${hiddenOffsetPixels}px`)
    expect(toolbarStyle.marginRight).toBe(`-${hiddenOffsetPixels}px`)

    const toolbarRect = findToolbarElement().getBoundingClientRect()
    const layoutPaneRect = findRequiredElement(
      fixture.container,
      siteSelectors.layoutPane,
    ).getBoundingClientRect()
    expect(
      Math.abs(toolbarRect.right - layoutPaneRect.left - EDGE_STRIP_WIDTH_PIXELS),
    ).toBeLessThanOrEqual(MAXIMUM_POSITION_DIFFERENCE_PIXELS)
  })

  it('без атрибута функции колонка остаётся в потоке клиента', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    fixture.setEnabled(false)
    const toolbarStyle = readToolbarStyle()
    expect(toolbarStyle.left).toBe('auto')
    expect(toolbarStyle.marginRight).toBe('0px')
    expect(toolbarStyle.clipPath).toBe(EMPTY_CONTENT_VALUE)
  })

  it('показывает точку при непрочитанных уведомлениях', () => {
    mountToolbar([UNREAD_TOOLBAR_FIXTURE_FILE_NAME])
    expect(getComputedStyle(findToolbarElement(), '::before').content).not.toBe(EMPTY_CONTENT_VALUE)
  })

  it('не показывает точку без бейджа непрочитанных', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    expect(getComputedStyle(findToolbarElement(), '::before').content).toBe(EMPTY_CONTENT_VALUE)
  })

  it('раскрывает колонку при открытом меню самой колонки', () => {
    mountToolbar([MENU_OPEN_TOOLBAR_FIXTURE_FILE_NAME])
    expect(readToolbarStyle().left).toBe(EXPANDED_LEFT_VALUE)
  })

  it('не раскрывает колонку при контекстном меню чата', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME, CHAT_CONTEXT_MENU_FIXTURE_FILE_NAME])
    expect(fixture.container.querySelector(siteSelectors.chatContextMenu)).not.toBeNull()
    expect(readToolbarStyle().left).toBe(`-${readHiddenOffsetPixels()}px`)
  })

  it('раскрывает колонку по фокусу только при клавиатурной навигации', async () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    /* Имя тега button совпадает с именем класса клиента, поэтому элемент ищется по типу */
    const focusableElement = [...fixture.container.querySelectorAll(ANY_ELEMENT_SELECTOR)].find(
      (element) => element instanceof HTMLButtonElement,
    )
    expect(focusableElement).toBeDefined()
    ;(focusableElement as HTMLButtonElement).focus()
    expect(readToolbarStyle().left).toBe(`-${readHiddenOffsetPixels()}px`)

    document.documentElement.setAttribute(
      keyboardNavigationAttributeName,
      KEYBOARD_NAVIGATION_ATTRIBUTE_VALUE,
    )
    /* Раскрытие идёт переходом, поэтому вычисленное значение доходит до края не сразу */
    await expect
      .poll(() => readToolbarStyle().left, { timeout: EXPANSION_TIMEOUT_MILLISECONDS })
      .toBe(EXPANDED_LEFT_VALUE)
    document.documentElement.removeAttribute(keyboardNavigationAttributeName)
  })

  it('при отключённых анимациях обнуляет длительность и сохраняет задержку скрытия', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    fixture.addStyles(siteReducedAnimationsStyles)
    expect(readToolbarStyle().transitionDuration).toBe(REST_TRANSITION_DURATION)
    expect(readToolbarStyle().transitionDelay).toBe(REST_TRANSITION_DELAY)

    document.body.setAttribute(
      siteAttributeNames.reducedAnimations,
      REDUCED_ANIMATIONS_ATTRIBUTE_VALUE,
    )
    expect(readToolbarStyle().transitionDuration).toBe(DISABLED_TRANSITION_DURATION)
    expect(readToolbarStyle().transitionDelay).toBe(REST_TRANSITION_DELAY)
  })

  it('обнуляет длительности при системной настройке уменьшенного движения', () => {
    mountToolbar([EMPTY_TOOLBAR_FIXTURE_FILE_NAME])
    const styleSheet = fixture.featureStyleElement.sheet
    expect(styleSheet).not.toBeNull()

    const reducedMotionRules = [...(styleSheet as CSSStyleSheet).cssRules].filter(
      (cssRule): cssRule is CSSMediaRule =>
        cssRule instanceof CSSMediaRule &&
        cssRule.conditionText.includes(REDUCED_MOTION_MEDIA_CONDITION),
    )
    expect(reducedMotionRules).toHaveLength(1)

    const [reducedMotionRule] = reducedMotionRules
    const nestedRule = (reducedMotionRule as CSSMediaRule).cssRules.item(FIRST_RULE_INDEX)
    expect(nestedRule).toBeInstanceOf(CSSStyleRule)

    const { style } = nestedRule as CSSStyleRule
    expect(style).toHaveLength(DISABLED_DURATION_DECLARATION_COUNT)
    for (let declarationIndex = 0; declarationIndex < style.length; declarationIndex += 1) {
      const propertyName = style.item(declarationIndex)
      expect(style.getPropertyValue(propertyName).trim()).toBe(DISABLED_DURATION_VALUE)
    }
  })

  function countMatchedRules(fixtureFileName: string): number {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(fixtureFileName)],
    })
    const styleRules = collectStyleRules(fixture.featureStyleElement)
    expect(styleRules.length).toBeGreaterThan(NO_MATCHED_RULE_COUNT)
    return styleRules.filter(
      (styleRule) => fixture.container.querySelectorAll(styleRule.selectorText).length > 0,
    ).length
  }

  it('на странице входа ни одно наше правило не совпадает', () => {
    expect(countMatchedRules(LOGIN_PAGE_FIXTURE_FILE_NAME)).toBe(NO_MATCHED_RULE_COUNT)
  })

  /* Парная проба: на разметке со списком чатов тот же счёт даёт совпадения, иначе он ложно-зелёный */
  it('самопроверка: на разметке списка чатов правила совпадают', () => {
    expect(countMatchedRules(CHAT_LIST_FIXTURE_FILE_NAME)).toBeGreaterThan(NO_MATCHED_RULE_COUNT)
  })
})
