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

const CONVERSATION_FIXTURE_FILE_NAME = 'conversation-media.html'
const BUBBLE_PADDING_PIXELS = 10
const STATUS_ICON_COLOR = 'rgb(1, 2, 3)'
const LIGHT_ICON_COLOR = 'rgb(255, 255, 255)'
/** Сообщения без подписи в фикстуре: своя картинка, своя картинка со статусом, картинка до загрузки превью, видео */
const EXPECTED_MEDIA_TIME_COUNT = 4

/**
 * Правила клиента для сообщений с медиа из разведки живой страницы v3.72.37: пузырь relative
 * с отступом, время абсолютно поверх превью с тёмной плашкой, длительность видео абсолютно
 * внутри превью. Размеры картинок в фикстуре inline, src удалён санитайзером
 */
const siteMessageStyles = css`
  ${siteSelectors.chatMessageBubble} {
    ${siteCustomPropertyNames.messageStatusIconColor}: ${STATUS_ICON_COLOR};
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
  ${siteSelectors.chatMessageImageTime} ${siteSelectors.chatMessageMediaTimeLightIcon} {
    color: ${LIGHT_ICON_COLOR};
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

  function findMediaTimes(): Element[] {
    return Array.from(fixture.container.querySelectorAll(siteSelectors.chatMessageMediaTime))
  }

  function readTimeAndPreviewRects(timeElement: Element): {
    timeRect: DOMRect
    previewRect: DOMRect
  } {
    const bubble = timeElement.parentElement
    if (bubble === null) {
      throw new Error('У времени сообщения с медиа нет пузыря')
    }
    return {
      timeRect: timeElement.getBoundingClientRect(),
      previewRect: findRequiredElement(
        bubble,
        `${siteSelectors.chatMessagePicture}, ${siteSelectors.chatMessageVideo}`,
      ).getBoundingClientRect(),
    }
  }

  function rectsIntersect(firstRect: DOMRect, secondRect: DOMRect): boolean {
    return (
      firstRect.left < secondRect.right &&
      secondRect.left < firstRect.right &&
      firstRect.top < secondRect.bottom &&
      secondRect.top < firstRect.bottom
    )
  }

  function findUntouchedMetas(): Element[] {
    return Array.from(fixture.container.querySelectorAll(siteSelectors.chatMessageMeta)).filter(
      (candidate) =>
        candidate.parentElement?.matches(siteSelectors.chatMessageBubble) === true &&
        !candidate.matches(
          `${siteSelectors.chatMessageImageTime}, ${siteSelectors.chatMessageVideoTime}, ${siteSelectors.chatMessageMediaTime}`,
        ),
    )
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

  it('находит время у каждого сообщения с картинкой или видео без подписи', () => {
    expect(findMediaTimes()).toHaveLength(EXPECTED_MEDIA_TIME_COUNT)
    expect(
      fixture.container.querySelectorAll(siteSelectors.chatMessageImageTime).length,
    ).toBeGreaterThan(0)
    expect(
      fixture.container.querySelectorAll(siteSelectors.chatMessageVideoTime).length,
    ).toBeGreaterThan(0)
  })

  it('выводит время каждой картинки и видео под превью без пересечения', () => {
    for (const timeElement of findMediaTimes()) {
      const { timeRect, previewRect } = readTimeAndPreviewRects(timeElement)
      expect(timeRect.height).toBeGreaterThan(0)
      expect(rectsIntersect(timeRect, previewRect)).toBe(false)
      expect(timeRect.top).toBeGreaterThanOrEqual(previewRect.bottom)
    }
  })

  it('возвращает значку статуса под картинкой обычный цвет вместо белого', () => {
    const statusIcon = findRequiredElement(
      fixture.container,
      `${siteSelectors.chatMessageImageTime} ${siteSelectors.chatMessageMediaTimeLightIcon}`,
    )
    expect(getComputedStyle(statusIcon).color).toBe(STATUS_ICON_COLOR)
  })

  it('не трогает длительность внутри превью видео', () => {
    const durationStyle = getComputedStyle(
      findRequiredElement(fixture.container, siteSelectors.chatMessageVideoDuration),
    )
    expect(durationStyle.position).toBe('absolute')
    expect(durationStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('не меняет положение времени текстовых сообщений и альбома с подписью', () => {
    const untouchedMetas = findUntouchedMetas()
    expect(untouchedMetas.length).toBeGreaterThan(0)
    for (const metaElement of untouchedMetas) {
      const metaStyle = getComputedStyle(metaElement)
      expect(metaStyle.position).toBe('absolute')
      expect(metaStyle.right).toBe('12px')
      expect(metaStyle.bottom).toBe('8px')
    }
  })

  it('возвращает время поверх превью и белый значок при отключении фичи', () => {
    fixture.setEnabled(false)
    for (const timeElement of findMediaTimes()) {
      const { timeRect, previewRect } = readTimeAndPreviewRects(timeElement)
      expect(rectsIntersect(timeRect, previewRect)).toBe(true)
    }
    const statusIcon = findRequiredElement(
      fixture.container,
      `${siteSelectors.chatMessageImageTime} ${siteSelectors.chatMessageMediaTimeLightIcon}`,
    )
    expect(getComputedStyle(statusIcon).color).toBe(LIGHT_ICON_COLOR)
  })
})
