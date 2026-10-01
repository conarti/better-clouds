import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'

/** Срезает точку селектора: имена классов берутся из общих селекторов, не из литералов */
function className(siteSelector: string): string {
  return siteSelector.slice(1)
}
import featureMeta from './meta'
import { featureStyles } from './styles'

const CHAT_LIST_FIXTURE_FILE_NAME = 'layout-all-chats.html'

/**
 * Правила клиента для строк списка чатов из разведки живой страницы v3.72.37: высота и
 * отступы задаются стилями сайта, inline у записи только flex-свойства. Аватар в записи
 * фикстура держит inline-размерами 48px, как на живой странице
 */
const siteChatListStyles = css`
  ${siteSelectors.chatListEntry} {
    display: flex;
    height: 64px;
    padding: 8px;
    box-sizing: border-box;
  }
`

/**
 * Строки переписки в фикстурах v3.70.53 отсутствуют, поэтому зона собирается из
 * фрагмента разметки по структуре разведки v3.72.37: строка, внутренний блок с карманом
 * под аватар и разделитель дат рядом
 */
const MESSAGE_ZONE_FIXTURE_HTML = `<div class="${className(siteSelectors.chatMessageRow)}"><div class="${className(siteSelectors.chatMessageInner)}"><div class="${className(siteSelectors.chatAvatar)}"><div class="${className(siteSelectors.chatListEntryAvatarInner)}" style="width: 48px; height: 48px;"></div></div></div></div><div class="${className(siteSelectors.dateSplitter)}"></div>`

const siteMessageZoneStyles = css`
  ${siteSelectors.chatMessageRow} {
    margin-top: 10px;
    margin-bottom: 4px;
  }
  ${siteSelectors.chatMessageInner} {
    padding-left: 48px;
    margin-left: -32px;
  }
  /* Аватар сообщения на живой странице задаётся стилями сайта, не inline */
  ${siteSelectors.chatMessageRow} ${siteSelectors.chatListEntryAvatarInner} {
    width: 48px;
    height: 48px;
  }
  ${siteSelectors.dateSplitter} {
    height: 37px;
  }
`

describe('compact-mode', () => {
  let fixture: MountedFeatureFixture

  function readFirstEntryStyle(): CSSStyleDeclaration {
    const entries = fixture.container.querySelectorAll(siteSelectors.chatListEntry)
    expect(entries.length).toBeGreaterThan(0)
    return getComputedStyle(entries.item(0) as Element)
  }

  function readFirstChatListAvatarStyle(): CSSStyleDeclaration {
    return getComputedStyle(
      findRequiredElement(
        fixture.container,
        `${siteSelectors.chatListEntry} ${siteSelectors.chatListEntryAvatarInner}`,
      ),
    )
  }

  function readMessageRowStyle(): CSSStyleDeclaration {
    return getComputedStyle(findRequiredElement(fixture.container, siteSelectors.chatMessageRow))
  }

  function readMessageInnerStyle(): CSSStyleDeclaration {
    return getComputedStyle(findRequiredElement(fixture.container, siteSelectors.chatMessageInner))
  }

  function readMessageAvatarStyle(): CSSStyleDeclaration {
    return getComputedStyle(
      findRequiredElement(
        fixture.container,
        `${siteSelectors.chatMessageRow} ${siteSelectors.chatListEntryAvatarInner}`,
      ),
    )
  }

  function readDateSplitterStyle(): CSSStyleDeclaration {
    return getComputedStyle(findRequiredElement(fixture.container, siteSelectors.dateSplitter))
  }

  afterEach(() => {
    fixture.unmount()
  })

  describe('список чатов', () => {
    beforeEach(() => {
      fixture = mountFeatureFixture({
        featureId: featureMeta.id,
        featureStyles,
        fixtureHtmlList: [loadFixture(CHAT_LIST_FIXTURE_FILE_NAME)],
        siteStyles: siteChatListStyles,
      })
    })

    it('сжимает запись до 48px с уменьшёнными отступами', () => {
      const entryStyle = readFirstEntryStyle()
      expect(entryStyle.height).toBe('48px')
      expect(entryStyle.paddingTop).toBe('4px')
      expect(entryStyle.paddingBottom).toBe('4px')
    })

    it('уменьшает аватар в записи до 36px поверх inline-размеров клиента', () => {
      const avatarStyle = readFirstChatListAvatarStyle()
      expect(avatarStyle.width).toBe('36px')
      expect(avatarStyle.height).toBe('36px')
      expect(avatarStyle.lineHeight).toBe('36px')
    })

    it('возвращает размеры сайта при отключении фичи', () => {
      fixture.setEnabled(false)
      const entryStyle = readFirstEntryStyle()
      expect(entryStyle.height).toBe('64px')
      expect(entryStyle.paddingTop).toBe('8px')
      expect(readFirstChatListAvatarStyle().width).toBe('48px')
    })
  })

  describe('переписка', () => {
    beforeEach(() => {
      fixture = mountFeatureFixture({
        featureId: featureMeta.id,
        featureStyles,
        fixtureHtmlList: [MESSAGE_ZONE_FIXTURE_HTML],
        siteStyles: siteMessageZoneStyles,
      })
    })

    it('сжимает вертикальные отступы строки сообщения', () => {
      const rowStyle = readMessageRowStyle()
      expect(rowStyle.marginTop).toBe('4px')
      expect(rowStyle.marginBottom).toBe('2px')
    })

    it('сужает карман под аватаром в строке сообщения', () => {
      expect(readMessageInnerStyle().paddingLeft).toBe('36px')
    })

    it('не уменьшает аватар в сообщении', () => {
      expect(readMessageAvatarStyle().width).toBe('48px')
      expect(readMessageAvatarStyle().height).toBe('48px')
    })

    it('не трогает разделитель дат', () => {
      expect(readDateSplitterStyle().height).toBe('37px')
    })

    it('возвращает отступы сайта при отключении фичи', () => {
      fixture.setEnabled(false)
      const rowStyle = readMessageRowStyle()
      expect(rowStyle.marginTop).toBe('10px')
      expect(rowStyle.marginBottom).toBe('4px')
      expect(readMessageInnerStyle().paddingLeft).toBe('48px')
    })
  })
})
