import { createFeatureAttributeName } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'

const ID_SELECTOR_PREFIX_LENGTH = 1
const CLASS_SELECTOR_PREFIX_LENGTH = 1
const CONTAINER_TAG_NAME = 'div'
const STYLE_ELEMENT_TAG_NAME = 'style'
const ENABLED_ATTRIBUTE_VALUE = ''

export interface MountFeatureFixtureOptions {
  readonly featureId: string
  readonly featureStyles: string
  /** Фрагменты разметки клиента: несколько фрагментов складываются в один контейнер */
  readonly fixtureHtmlList: readonly string[]
  /** Правила клиента, которые нужны тесту: вставляются после наших, как на живой странице */
  readonly siteStyles?: string
  /** Фрагменты колонки сняты без родителя, а селектор колонки уточнён через центральную колонку */
  readonly wrapInLayoutPane?: boolean
}

export interface MountedFeatureFixture {
  readonly container: HTMLElement
  readonly featureStyleElement: HTMLStyleElement
  setEnabled(isEnabled: boolean): void
  addStyles(cssText: string): HTMLStyleElement
  unmount(): void
}

/** Корень приложения: по нему сайт задаёт фон и правила с идентификатором в селекторе */
function createContainerElement(): HTMLElement {
  const containerElement = document.createElement(CONTAINER_TAG_NAME)
  containerElement.id = siteSelectors.appRoot.slice(ID_SELECTOR_PREFIX_LENGTH)
  return containerElement
}

function createLayoutPaneElement(): HTMLElement {
  const layoutPaneElement = document.createElement(CONTAINER_TAG_NAME)
  layoutPaneElement.className = siteSelectors.layoutPane.slice(CLASS_SELECTOR_PREFIX_LENGTH)
  return layoutPaneElement
}

/**
 * Собирает страницу для browser-теста: контейнер с фрагментами разметки, наш элемент style
 * перед стилями клиента и атрибут включённой функции на корне документа.
 */
export function mountFeatureFixture({
  featureId,
  featureStyles,
  fixtureHtmlList,
  siteStyles,
  wrapInLayoutPane = false,
}: MountFeatureFixtureOptions): MountedFeatureFixture {
  const containerElement = createContainerElement()
  const fixtureHostElement = wrapInLayoutPane ? createLayoutPaneElement() : containerElement
  if (fixtureHostElement !== containerElement) {
    containerElement.append(fixtureHostElement)
  }
  fixtureHostElement.innerHTML = fixtureHtmlList.join('')
  document.body.append(containerElement)

  const addedStyleElements: HTMLStyleElement[] = []

  function addStyles(cssText: string): HTMLStyleElement {
    const styleElement = document.createElement(STYLE_ELEMENT_TAG_NAME)
    styleElement.textContent = cssText
    document.head.append(styleElement)
    addedStyleElements.push(styleElement)
    return styleElement
  }

  const featureStyleElement = addStyles(featureStyles)
  if (siteStyles !== undefined) {
    addStyles(siteStyles)
  }

  const featureAttributeName = createFeatureAttributeName(featureId)

  function setEnabled(isEnabled: boolean): void {
    if (isEnabled) {
      document.documentElement.setAttribute(featureAttributeName, ENABLED_ATTRIBUTE_VALUE)
      return
    }
    document.documentElement.removeAttribute(featureAttributeName)
  }

  function unmount(): void {
    setEnabled(false)
    containerElement.remove()
    for (const styleElement of addedStyleElements) {
      styleElement.remove()
    }
    addedStyleElements.length = 0
  }

  setEnabled(true)

  return { container: containerElement, featureStyleElement, setEnabled, addStyles, unmount }
}

/** Все правила таблицы стилей, включая вложенные в @media, в порядке объявления */
export function collectStyleRules(styleElement: HTMLStyleElement): CSSStyleRule[] {
  const styleRules: CSSStyleRule[] = []

  function collectFromRuleList(ruleList: CSSRuleList): void {
    for (let ruleIndex = 0; ruleIndex < ruleList.length; ruleIndex += 1) {
      const cssRule = ruleList.item(ruleIndex)
      if (cssRule instanceof CSSStyleRule) {
        styleRules.push(cssRule)
        continue
      }
      if (cssRule instanceof CSSGroupingRule) {
        collectFromRuleList(cssRule.cssRules)
      }
    }
  }

  const styleSheet = styleElement.sheet
  if (styleSheet !== null) {
    collectFromRuleList(styleSheet.cssRules)
  }
  return styleRules
}
