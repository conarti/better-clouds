import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles } from './styles'

const CONVERSATION_FIXTURE_FILE_NAME = 'conversation-media.html'
const BUBBLE_PADDING_PIXELS = 10

/**
 * Правила клиента для сообщений с медиа из разведки живой страницы v3.72.37: пузырь relative
 * с отступом, время абсолютно поверх превью с тёмной плашкой, длительность видео абсолютно
 * внутри превью. Размеры картинок в фикстуре inline, src удалён санитайзером
 */
const siteMessageStyles = css`
  ${siteSelectors.chatMessageBubble} {
    position: relative;
    display: block;
    padding: ${BUBBLE_PADDING_PIXELS}px;
    width: 320px;
    box-sizing: border-box;
    color: rgb(0, 0, 0);
  }
  ${siteSelectors.chatMessageMeta} {
    position: absolute;
    right: 12px;
    bottom: 8px;
    font-size: 12px;
    line-height: 14px;
    color: rgba(0, 0, 0, 0.5);
  }
  ${siteSelectors.chatMessageImageTime}, ${siteSelectors.chatMessageVideoTime} {
    padding: 4px 6px;
    background-color: rgba(0, 0, 0, 0.5);
    color: rgb(255, 255, 255);
  }
  ${siteSelectors.chatMessagePicture}, ${siteSelectors.chatMessageVideo} {
    position: relative;
  }
  ${siteSelectors.chatMessageVideoDuration} {
    position: absolute;
    top: 0;
    left: 0;
    right: auto;
    bottom: auto;
  }
`

describe('media-time-below', () => {
  let fixture: MountedFeatureFixture

  function readTimeAndPreviewRects(
    timeSelector: string,
    previewSelector: string,
  ): { timeRect: DOMRect; previewRect: DOMRect } {
    const timeElement = findRequiredElement(fixture.container, timeSelector)
    const bubble = timeElement.parentElement
    if (bubble === null) {
      throw new Error(`У времени ${timeSelector} нет пузыря`)
    }
    return {
      timeRect: timeElement.getBoundingClientRect(),
      previewRect: findRequiredElement(bubble, previewSelector).getBoundingClientRect(),
    }
  }

  function expectTimeBelowPreview(timeSelector: string, previewSelector: string): void {
    const { timeRect, previewRect } = readTimeAndPreviewRects(timeSelector, previewSelector)
    expect(timeRect.height).toBeGreaterThan(0)
    expect(timeRect.top).toBeGreaterThanOrEqual(previewRect.bottom)
  }

  function expectTimeOverPreview(timeSelector: string, previewSelector: string): void {
    const { timeRect, previewRect } = readTimeAndPreviewRects(timeSelector, previewSelector)
    expect(timeRect.top).toBeLessThan(previewRect.bottom)
  }

  function findTextMeta(): Element {
    const textMeta = Array.from(
      fixture.container.querySelectorAll(siteSelectors.chatMessageMeta),
    ).find(
      (candidate) =>
        candidate.parentElement?.matches(siteSelectors.chatMessageBubble) === true &&
        !candidate.matches(
          `${siteSelectors.chatMessageImageTime}, ${siteSelectors.chatMessageVideoTime}`,
        ),
    )
    if (textMeta === undefined) {
      throw new Error('Время текстового сообщения не найдено')
    }
    return textMeta
  }

  beforeEach(() => {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(CONVERSATION_FIXTURE_FILE_NAME)],
      siteStyles: siteMessageStyles,
    })
  })

  afterEach(() => {
    fixture.unmount()
  })

  it('выводит время картинки под превью без пересечения', () => {
    expectTimeBelowPreview(siteSelectors.chatMessageImageTime, siteSelectors.chatMessagePicture)
  })

  it('выводит время видео под превью без пересечения', () => {
    expectTimeBelowPreview(siteSelectors.chatMessageVideoTime, siteSelectors.chatMessageVideo)
  })

  it('не трогает длительность внутри превью видео', () => {
    const durationStyle = getComputedStyle(
      findRequiredElement(fixture.container, siteSelectors.chatMessageVideoDuration),
    )
    expect(durationStyle.position).toBe('absolute')
    expect(durationStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('не меняет положение времени текстового сообщения', () => {
    const textMetaStyle = getComputedStyle(findTextMeta())
    expect(textMetaStyle.position).toBe('absolute')
    expect(textMetaStyle.right).toBe('12px')
    expect(textMetaStyle.bottom).toBe('8px')
  })

  it('возвращает время поверх превью при отключении фичи', () => {
    fixture.setEnabled(false)
    expectTimeOverPreview(siteSelectors.chatMessageImageTime, siteSelectors.chatMessagePicture)
    expectTimeOverPreview(siteSelectors.chatMessageVideoTime, siteSelectors.chatMessageVideo)
  })
})
