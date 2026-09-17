import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteSelectors } from '@/shared/site/selectors'
import { mountFeatureFixture, type MountedFeatureFixture } from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles } from './styles'

const LAYOUT_FIXTURE_FILE_NAME = 'layout-all-chats.html'

/** Правила клиента для целевых элементов из разведки D2 */
const SITE_PANE_MAX_WIDTH_PIXELS = 1440
const SITE_PANE_TOP_PADDING_PIXELS = 16
const SITE_PANE_BORDER_WIDTH_PIXELS = 1
const SITE_LEFT_PANE_RADIUS_PIXELS = 10
const MAXIMUM_WIDTH_DIFFERENCE_PIXELS = 1

const NO_LIMIT_VALUE = 'none'
const ZERO_LENGTH_VALUE = '0px'

const siteStyles = css`
  ${siteSelectors.layoutPane} {
    display: flex;
    flex-direction: row;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    max-width: ${SITE_PANE_MAX_WIDTH_PIXELS}px;
    margin: 0 auto;
    padding-top: ${SITE_PANE_TOP_PADDING_PIXELS}px;
    border-style: solid;
    border-left-width: ${SITE_PANE_BORDER_WIDTH_PIXELS}px;
    border-right-width: ${SITE_PANE_BORDER_WIDTH_PIXELS}px;
  }
  ${siteSelectors.layoutPaneLeft} {
    border-top-left-radius: ${SITE_LEFT_PANE_RADIUS_PIXELS}px;
  }
`

/**
 * Правило клиента с идентификатором в селекторе: даже такая специфичность ниже нашей
 * благодаря guard, поэтому широкий режим не перебивается каскадом сайта.
 */
const competingSiteStyles = css`
  ${siteSelectors.appRoot} div${siteSelectors.layoutPane} {
    max-width: ${SITE_PANE_MAX_WIDTH_PIXELS}px;
    padding-top: ${SITE_PANE_TOP_PADDING_PIXELS}px;
  }
`

describe('wide-layout', () => {
  let fixture: MountedFeatureFixture

  function readLayoutPaneStyle(): CSSStyleDeclaration {
    const layoutPaneElement = fixture.container.querySelector(siteSelectors.layoutPane)
    expect(layoutPaneElement).not.toBeNull()
    return getComputedStyle(layoutPaneElement as Element)
  }

  function readLeftPaneStyle(): CSSStyleDeclaration {
    const leftPaneElement = fixture.container.querySelector(siteSelectors.layoutPaneLeft)
    expect(leftPaneElement).not.toBeNull()
    return getComputedStyle(leftPaneElement as Element)
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
    const layoutPaneElement = fixture.container.querySelector(siteSelectors.layoutPane)
    const layoutPaneRect = (layoutPaneElement as Element).getBoundingClientRect()
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
