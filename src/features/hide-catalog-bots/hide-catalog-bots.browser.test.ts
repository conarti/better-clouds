import { afterEach, describe, expect, it } from 'vitest'
import { siteClassNames, siteSelectors } from '@/shared/site/selectors'
import { mountFeatureFixture, type MountedFeatureFixture } from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles } from './styles'

const ALL_CHATS_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const SEARCH_ACTIVE_FIXTURE_FILE_NAME = 'layout-all-chats-search-active.html'
const CATALOG_TAB_FIXTURE_FILE_NAME = 'layout-catalog-tab.html'

const HIDDEN_DISPLAY_VALUE = 'none'
const MINIMUM_CATALOG_ENTRY_COUNT = 5
const MINIMUM_REGULAR_ENTRY_COUNT = 5

/** Признак каталожной записи, тот же, что и в правиле функции */
const catalogEntryCondition = `:has(> ${siteSelectors.chatListEntry} > ${siteSelectors.chatListEntryCatalogInfo})`
const catalogWrapperSelector = `${siteSelectors.chatList} ${siteSelectors.chatListItemWrapper}${catalogEntryCondition}`
const regularWrapperSelector = `${siteSelectors.chatList} > ${siteSelectors.chatListItemWrapper}:not(${catalogEntryCondition})`

describe('hide-catalog-bots', () => {
  let fixture: MountedFeatureFixture

  function mountChatList(fixtureFileName: string): void {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(fixtureFileName)],
    })
  }

  function findElements(selector: string): Element[] {
    return [...fixture.container.querySelectorAll(selector)]
  }

  function countHidden(elements: readonly Element[]): number {
    return elements.filter((element) => getComputedStyle(element).display === HIDDEN_DISPLAY_VALUE)
      .length
  }

  afterEach(() => {
    fixture.unmount()
  })

  it('скрывает каталожные записи и не трогает остальные', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const catalogWrappers = findElements(catalogWrapperSelector)
    const regularWrappers = findElements(regularWrapperSelector)
    expect(catalogWrappers.length).toBeGreaterThanOrEqual(MINIMUM_CATALOG_ENTRY_COUNT)
    expect(regularWrappers.length).toBeGreaterThanOrEqual(MINIMUM_REGULAR_ENTRY_COUNT)
    expect(countHidden(catalogWrappers)).toBe(catalogWrappers.length)
    expect(countHidden(regularWrappers)).toBe(0)
  })

  it('не трогает область закреплённых чатов', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const pinnedElements = findElements(siteSelectors.chatListPinnedDroppable)
    expect(pinnedElements).not.toHaveLength(0)
    expect(countHidden(pinnedElements)).toBe(0)
    expect(
      countHidden(
        findElements(
          `${siteSelectors.chatListPinnedDroppable} ${siteSelectors.chatListItemWrapper}`,
        ),
      ),
    ).toBe(0)
  })

  it('без атрибута функции каталожные записи видны', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    fixture.setEnabled(false)
    expect(countHidden(findElements(catalogWrapperSelector))).toBe(0)
  })

  it('при непустом поле поиска ничего не скрывает', () => {
    mountChatList(SEARCH_ACTIVE_FIXTURE_FILE_NAME)
    expect(findElements(catalogWrapperSelector).length).toBeGreaterThanOrEqual(
      MINIMUM_CATALOG_ENTRY_COUNT,
    )
    expect(countHidden(findElements(catalogWrapperSelector))).toBe(0)
  })

  it('возвращает записи, как только в поле поиска появляется значение', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const searchInputElement = fixture.container.querySelector(siteSelectors.chatListSearchInput)
    expect(searchInputElement).not.toBeNull()
    const catalogWrappers = findElements(catalogWrapperSelector)
    expect(countHidden(catalogWrappers)).toBe(catalogWrappers.length)

    ;(searchInputElement as Element).classList.add(siteClassNames.chatListSearchInputValue)
    expect(countHidden(catalogWrappers)).toBe(0)
    ;(searchInputElement as Element).classList.remove(siteClassNames.chatListSearchInputValue)
    expect(countHidden(catalogWrappers)).toBe(catalogWrappers.length)
  })

  it('на вкладке «Каталог» ничего не скрывает', () => {
    mountChatList(CATALOG_TAB_FIXTURE_FILE_NAME)
    expect(findElements(catalogWrapperSelector).length).toBeGreaterThanOrEqual(
      MINIMUM_CATALOG_ENTRY_COUNT,
    )
    expect(countHidden(findElements(catalogWrapperSelector))).toBe(0)
  })

  it('скрывает каталожную запись, добавленную догрузкой списка', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const [catalogWrapper] = findElements(catalogWrapperSelector)
    expect(catalogWrapper).toBeDefined()
    const chatListElement = fixture.container.querySelector(siteSelectors.chatList)
    const appendedWrapper = (catalogWrapper as Element).cloneNode(true) as Element
    ;(chatListElement as Element).append(appendedWrapper)
    expect(getComputedStyle(appendedWrapper).display).toBe(HIDDEN_DISPLAY_VALUE)
  })
})
