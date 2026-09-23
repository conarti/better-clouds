import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles } from './styles'

const LAYOUT_FIXTURE_FILE_NAME = 'layout-all-chats.html'

/** Правила клиента для целевых элементов из разведки D2 */
const SITE_PANE_MAX_WIDTH_PIXELS = 1440
const SITE_PANE_TOP_PADDING_PIXELS = 16
const SITE_PANE_BORDER_WIDTH_PIXELS = 1
const SITE_LEFT_PANE_RADIUS_PIXELS = 10
/** Слагаемое клиента в высоте тела колонки, не зависящее от переменной отступа */
const SITE_PANE_BODY_RESERVED_HEIGHT_PIXELS = 60
const MAXIMUM_WIDTH_DIFFERENCE_PIXELS = 1
/** Допуск на дробные пиксели при сравнении высоты тела колонки с окном */
const MAXIMUM_BODY_BOTTOM_DIFFERENCE_PIXELS = 1

const NO_LIMIT_VALUE = 'none'
const ZERO_LENGTH_VALUE = '0px'

/**
 * У фикстур нет разметки сайта без разметки самой страницы, поэтому обнуляем отступ body:
 * иначе стандартный отступ браузера сдвинул бы колонку с 100dvh мимо низа окна.
 */
const siteStyles = css`
  :root {
    ${siteCustomPropertyNames.appTopPaddingHeight}: ${SITE_PANE_TOP_PADDING_PIXELS}px;
  }
  body {
    margin: 0;
  }
  ${siteSelectors.layoutPane} {
    display: flex;
    flex-direction: row;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    max-width: ${SITE_PANE_MAX_WIDTH_PIXELS}px;
    margin: 0 auto;
    height: 100dvh;
    padding-top: var(${siteCustomPropertyNames.appTopPaddingHeight});
    border-style: solid;
    border-top-width: 0;
    border-bottom-width: 0;
    border-left-width: ${SITE_PANE_BORDER_WIDTH_PIXELS}px;
    border-right-width: ${SITE_PANE_BORDER_WIDTH_PIXELS}px;
  }
  ${siteSelectors.layoutPaneLeft} {
    border-top-left-radius: ${SITE_LEFT_PANE_RADIUS_PIXELS}px;
  }
  ${siteSelectors.layoutPaneBody} {
    position: absolute;
    top: ${SITE_PANE_BODY_RESERVED_HEIGHT_PIXELS}px;
    left: 0;
    right: 0;
    height: calc(
      100dvh - ${SITE_PANE_BODY_RESERVED_HEIGHT_PIXELS}px -
        var(${siteCustomPropertyNames.appTopPaddingHeight})
    );
  }
`

/**
 * Правило клиента с идентификатором в селекторе: даже такая специфичность ниже нашей
 * благодаря guard, поэтому широкий режим не перебивается каскадом сайта. Отступ здесь тоже
 * читает переменную: на живой странице альтернативных правил с литеральным значением нет.
 */
const competingSiteStyles = css`
  ${siteSelectors.appRoot} div${siteSelectors.layoutPane} {
    max-width: ${SITE_PANE_MAX_WIDTH_PIXELS}px;
    padding-top: var(${siteCustomPropertyNames.appTopPaddingHeight});
  }
`

describe('wide-layout', () => {
  let fixture: MountedFeatureFixture

  function readLayoutPaneStyle(): CSSStyleDeclaration {
    return getComputedStyle(findRequiredElement(fixture.container, siteSelectors.layoutPane))
  }

  function readLeftPaneStyle(): CSSStyleDeclaration {
    return getComputedStyle(findRequiredElement(fixture.container, siteSelectors.layoutPaneLeft))
  }

  function readLayoutPaneBodyRect(): DOMRect {
    return findRequiredElement(
      fixture.container,
      siteSelectors.layoutPaneBody,
    ).getBoundingClientRect()
  }

  beforeEach(() => {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(LAYOUT_FIXTURE_FILE_NAME)],
      siteStyles,
    })
  })

  afterEach(() => {
    fixture.unmount()
  })

  it('снимает поля по бокам, отступ сверху и рамку', () => {
    const layoutPaneStyle = readLayoutPaneStyle()
    expect(layoutPaneStyle.maxWidth).toBe(NO_LIMIT_VALUE)
    expect(layoutPaneStyle.paddingTop).toBe(ZERO_LENGTH_VALUE)
    expect(layoutPaneStyle.marginLeft).toBe(ZERO_LENGTH_VALUE)
    expect(layoutPaneStyle.marginRight).toBe(ZERO_LENGTH_VALUE)
    expect(layoutPaneStyle.borderLeftWidth).toBe(ZERO_LENGTH_VALUE)
    expect(layoutPaneStyle.borderRightWidth).toBe(ZERO_LENGTH_VALUE)
  })

  it('растягивает центральную колонку на всю ширину корня приложения', () => {
    const layoutPaneRect = findRequiredElement(
      fixture.container,
      siteSelectors.layoutPane,
    ).getBoundingClientRect()
    const containerRect = fixture.container.getBoundingClientRect()
    expect(Math.abs(layoutPaneRect.width - containerRect.width)).toBeLessThanOrEqual(
      MAXIMUM_WIDTH_DIFFERENCE_PIXELS,
    )
    expect(Math.abs(layoutPaneRect.left - containerRect.left)).toBeLessThanOrEqual(
      MAXIMUM_WIDTH_DIFFERENCE_PIXELS,
    )
  })

  it('без атрибута действуют стили клиента', () => {
    fixture.setEnabled(false)
    const layoutPaneStyle = readLayoutPaneStyle()
    expect(layoutPaneStyle.maxWidth).toBe(`${SITE_PANE_MAX_WIDTH_PIXELS}px`)
    expect(layoutPaneStyle.paddingTop).toBe(`${SITE_PANE_TOP_PADDING_PIXELS}px`)
    expect(layoutPaneStyle.borderLeftWidth).toBe(`${SITE_PANE_BORDER_WIDTH_PIXELS}px`)
  })

  it('тело центральной колонки достаёт до низа окна без белой полосы', () => {
    const bodyBottomGapPixels =
      document.documentElement.clientHeight - readLayoutPaneBodyRect().bottom
    expect(Math.abs(bodyBottomGapPixels)).toBeLessThanOrEqual(
      MAXIMUM_BODY_BOTTOM_DIFFERENCE_PIXELS,
    )
    expect(readLayoutPaneStyle().paddingTop).toBe(ZERO_LENGTH_VALUE)
  })

  it('без атрибута тело центральной колонки останавливается выше низа окна', () => {
    fixture.setEnabled(false)
    const bodyBottomGapPixels =
      document.documentElement.clientHeight - readLayoutPaneBodyRect().bottom
    expect(Math.abs(bodyBottomGapPixels - SITE_PANE_TOP_PADDING_PIXELS)).toBeLessThanOrEqual(
      MAXIMUM_BODY_BOTTOM_DIFFERENCE_PIXELS,
    )
    expect(readLayoutPaneStyle().paddingTop).toBe(`${SITE_PANE_TOP_PADDING_PIXELS}px`)
  })

  it('правило клиента с идентификатором в селекторе не перебивает наше', () => {
    fixture.addStyles(competingSiteStyles)
    const layoutPaneStyle = readLayoutPaneStyle()
    expect(layoutPaneStyle.maxWidth).toBe(NO_LIMIT_VALUE)
    expect(layoutPaneStyle.paddingTop).toBe(ZERO_LENGTH_VALUE)
  })

  it('снимает скругление левой колонки и возвращает его при выключении', () => {
    expect(readLeftPaneStyle().borderTopLeftRadius).toBe(ZERO_LENGTH_VALUE)
    fixture.setEnabled(false)
    expect(readLeftPaneStyle().borderTopLeftRadius).toBe(`${SITE_LEFT_PANE_RADIUS_PIXELS}px`)
  })
})
