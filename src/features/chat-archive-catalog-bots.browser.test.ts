import { afterEach, describe, expect, it } from 'vitest'
import { createFeatureAttributeName } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import { mountFeatureFixture, type MountedFeatureFixture } from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import {
  buildArchiveStylesheet,
  createArchiveViewAttributeName,
} from './chat-archive/archive-stylesheet'
import { CHAT_ID_ATTRIBUTE_NAME } from './chat-archive/chat-id-marker'
import chatArchiveMeta from './chat-archive/meta'
import { featureStyles as chatArchiveStyles } from './chat-archive/styles'
import hideCatalogBotsMeta from './hide-catalog-bots/meta'
import { featureStyles as hideCatalogBotsStyles } from './hide-catalog-bots/styles'

const ALL_CHATS_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const HIDDEN_DISPLAY_VALUE = 'none'
const ENABLED_ATTRIBUTE_VALUE = ''
const SYNTHETIC_CHAT_ID_PREFIX = '00000000-0000-4000-8000-'
const SYNTHETIC_CHAT_ID_SUFFIX_LENGTH = 12

const archiveViewAttributeName = createArchiveViewAttributeName(chatArchiveMeta.id)
const hideCatalogBotsAttributeName = createFeatureAttributeName(hideCatalogBotsMeta.id)

/**
 * Архив и hide-catalog-bots это независимые функции на одних обёртках записей: тест держит обе
 * включёнными на одной разметке, поэтому лежит над папками функций. Стили hide-catalog-bots
 * вставлены последними, чтобы порядок в документе не решал исход вместо специфичности
 */
describe('режим архива и скрытие каталожных ботов', () => {
  let fixture: MountedFeatureFixture

  function findCatalogEntries(): Element[] {
    return [
      ...fixture.container.querySelectorAll(
        `${siteSelectors.chatList} ${siteSelectors.chatListEntry}`,
      ),
    ].filter((entry) => entry.querySelector(siteSelectors.chatListEntryCatalogInfo) !== null)
  }

  function isWrapperHidden(entry: Element): boolean {
    return getComputedStyle(entry.parentElement as Element).display === HIDDEN_DISPLAY_VALUE
  }

  /** Архивирует первую каталожную запись и возвращает её вместе с остальными каталожными */
  function mountBothFeatures(): { archivedEntry: Element; otherCatalogEntries: Element[] } {
    fixture = mountFeatureFixture({
      featureId: chatArchiveMeta.id,
      featureStyles: chatArchiveStyles,
      fixtureHtmlList: [loadFixture(ALL_CHATS_FIXTURE_FILE_NAME)],
    })
    const [archivedEntry, ...otherCatalogEntries] = findCatalogEntries()
    if (archivedEntry === undefined || otherCatalogEntries.length === 0) {
      throw new Error('В фрагменте не хватает каталожных записей')
    }
    const archivedChatId = `${SYNTHETIC_CHAT_ID_PREFIX}${'1'.padStart(SYNTHETIC_CHAT_ID_SUFFIX_LENGTH, '0')}`
    archivedEntry.setAttribute(CHAT_ID_ATTRIBUTE_NAME, archivedChatId)
    fixture.addStyles(buildArchiveStylesheet(chatArchiveMeta.id, [archivedChatId]))
    fixture.addStyles(hideCatalogBotsStyles)
    document.documentElement.setAttribute(hideCatalogBotsAttributeName, ENABLED_ATTRIBUTE_VALUE)
    return { archivedEntry, otherCatalogEntries }
  }

  afterEach(() => {
    document.documentElement.removeAttribute(archiveViewAttributeName)
    document.documentElement.removeAttribute(hideCatalogBotsAttributeName)
    fixture.unmount()
  })

  it('в режиме архива архивный каталожный бот виден, остальные боты скрыты', () => {
    const { archivedEntry, otherCatalogEntries } = mountBothFeatures()
    expect(isWrapperHidden(archivedEntry)).toBe(true)

    document.documentElement.setAttribute(archiveViewAttributeName, ENABLED_ATTRIBUTE_VALUE)

    expect(isWrapperHidden(archivedEntry)).toBe(false)
    expect(otherCatalogEntries.every(isWrapperHidden)).toBe(true)
  })
})
