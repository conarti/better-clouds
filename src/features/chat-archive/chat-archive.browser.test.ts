import { afterEach, describe, expect, it, vi } from 'vitest'
import { findNestedHasSelector } from '@/shared/feature/css-selector-analysis'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { createInjectedElementKeeper } from '@/shared/feature/injected-elements'
import { createLifecycleScope, type LifecycleScope } from '@/shared/feature/lifecycle-scope'
import { siteClassNames, siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import {
  collectBrowserRules,
  countSourceRules,
  findForbiddenDeclarations,
  findUnscopedSelectors,
} from '@@/tests/helpers/style-checks'
import { countUnreadArchivedEntries, createArchiveTab } from './archive-tab'
import {
  buildArchiveStylesheet,
  createArchiveViewAttributeName,
  createLoadingMoreAttributeName,
} from './archive-stylesheet'
import { CHAT_ID_ATTRIBUTE_NAME } from './chat-id-marker'
import { ARCHIVE_ITEM_TEXT, createContextMenuItem } from './context-menu-item'
import featureMeta from './meta'
import { featureStyles } from './styles'

const ALL_CHATS_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const SEARCH_ACTIVE_FIXTURE_FILE_NAME = 'layout-all-chats-search-active.html'
const USER_TAGS_FIXTURE_FILE_NAME = 'layout-user-tags.html'
const CONTEXT_MENU_FIXTURE_FILE_NAME = 'chat-context-menu-open.html'

const HIDDEN_DISPLAY_VALUE = 'none'
const STATE_ATTRIBUTE_VALUE = ''
const SYNTHETIC_CHAT_ID_PREFIX = '00000000-0000-4000-8000-'
const SYNTHETIC_CHAT_ID_SUFFIX_LENGTH = 12
const SAMPLE_CHAT_IDS = [
  '0a1b2c3d-0000-4000-8000-000000000001',
  '0a1b2c3d-0000-4000-8000-000000000002',
]
/** Архивные записи фикстуры: закреплённая и две обычные, одна из них с непрочитанными */
const ARCHIVED_ENTRY_INDEXES = [1, 4, 8]
const ARCHIVE_TAB_TEXT = 'Архив'
const AFTER_PSEUDO_ELEMENT = '::after'
const NO_CONTENT_VALUE = 'none'
/** Запас снизу, который список получает на время подгрузки (styles.ts) */
const LOADING_MORE_PADDING_BOTTOM = '1px'

const archiveViewAttributeName = createArchiveViewAttributeName(featureMeta.id)
const loadingMoreAttributeName = createLoadingMoreAttributeName(featureMeta.id)

/** Подчёркивание выбранной вкладки как у клиента: ::after с пустым content */
const SELECTED_TAB_SITE_STYLES = `.${siteClassNames.chatListTabSelected}::after { content: ""; display: block; }`

function createSyntheticChatId(index: number): string {
  return `${SYNTHETIC_CHAT_ID_PREFIX}${String(index).padStart(SYNTHETIC_CHAT_ID_SUFFIX_LENGTH, '0')}`
}

describe('chat-archive: сгенерированные стили', () => {
  const featureScope = createFeatureScopeSelector(featureMeta.id)

  it.each([
    ['пустой список', []],
    ['список id', SAMPLE_CHAT_IDS],
  ])('%s: Chromium принимает правила, область, свойства, :has()', (_, archivedChatIds) => {
    const stylesheet = buildArchiveStylesheet(featureMeta.id, archivedChatIds)
    const sourceRuleCount = countSourceRules(stylesheet)
    expect(sourceRuleCount).toBeGreaterThan(0)
    expect(collectBrowserRules(stylesheet)).toHaveLength(sourceRuleCount)
    expect(findUnscopedSelectors(stylesheet, featureScope)).toEqual([])
    expect(findForbiddenDeclarations(stylesheet, featureMeta.id)).toEqual([])
    expect(findNestedHasSelector(stylesheet)).toEqual([])
  })
})

describe('chat-archive', () => {
  let fixture: MountedFeatureFixture
  let lifecycleScope: LifecycleScope | null = null

  function mountChatList(fixtureFileName: string, wrapInLayoutPane = false): void {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(fixtureFileName)],
      siteStyles: SELECTED_TAB_SITE_STYLES,
      wrapInLayoutPane,
    })
  }

  function findEntries(): Element[] {
    return [
      ...fixture.container.querySelectorAll(
        `${siteSelectors.chatList} ${siteSelectors.chatListEntry}`,
      ),
    ]
  }

  /** Санитайзер стёр id, поэтому записи получают синтетические, как от скрипта главного мира */
  function assignSyntheticChatIds(): string[] {
    return findEntries().map((entry, index) => {
      const chatId = createSyntheticChatId(index)
      entry.setAttribute(CHAT_ID_ATTRIBUTE_NAME, chatId)
      return chatId
    })
  }

  function applyArchive(archivedChatIds: readonly string[]): void {
    fixture.addStyles(buildArchiveStylesheet(featureMeta.id, archivedChatIds))
  }

  function isWrapperHidden(entry: Element): boolean {
    const wrapper = entry.parentElement as Element
    return getComputedStyle(wrapper).display === HIDDEN_DISPLAY_VALUE
  }

  function splitEntries(chatIds: readonly string[], archivedChatIds: readonly string[]) {
    const entries = findEntries()
    const archivedEntries = entries.filter((_, index) =>
      archivedChatIds.includes(chatIds[index] as string),
    )
    const otherEntries = entries.filter((entry) => !archivedEntries.includes(entry))
    return { archivedEntries, otherEntries }
  }

  function setRootState(attributeName: string, isEnabled: boolean): void {
    if (isEnabled) {
      document.documentElement.setAttribute(attributeName, STATE_ATTRIBUTE_VALUE)
    } else {
      document.documentElement.removeAttribute(attributeName)
    }
  }

  afterEach(() => {
    lifecycleScope?.dispose()
    lifecycleScope = null
    setRootState(archiveViewAttributeName, false)
    setRootState(loadingMoreAttributeName, false)
    fixture.unmount()
  })

  it('прячет архивные чаты, включая закреплённый, остальные видны', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const chatIds = assignSyntheticChatIds()
    const archivedChatIds = ARCHIVED_ENTRY_INDEXES.map((index) => chatIds[index] as string)
    applyArchive(archivedChatIds)
    const { archivedEntries, otherEntries } = splitEntries(chatIds, archivedChatIds)

    expect(archivedEntries).toHaveLength(ARCHIVED_ENTRY_INDEXES.length)
    expect(archivedEntries.every(isWrapperHidden)).toBe(true)
    expect(otherEntries.some(isWrapperHidden)).toBe(false)

    fixture.setEnabled(false)
    expect(archivedEntries.some(isWrapperHidden)).toBe(false)
  })

  it('режим архива показывает только архивные, и во время подгрузки тоже', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const chatIds = assignSyntheticChatIds()
    const archivedChatIds = ARCHIVED_ENTRY_INDEXES.map((index) => chatIds[index] as string)
    applyArchive(archivedChatIds)
    const { archivedEntries, otherEntries } = splitEntries(chatIds, archivedChatIds)

    setRootState(archiveViewAttributeName, true)
    expect(archivedEntries.some(isWrapperHidden)).toBe(false)
    expect(otherEntries.every(isWrapperHidden)).toBe(true)

    setRootState(loadingMoreAttributeName, true)
    expect(archivedEntries.some(isWrapperHidden)).toBe(false)
    expect(otherEntries.every(isWrapperHidden)).toBe(true)
    const chatList = findRequiredElement(fixture.container, siteSelectors.chatList)
    expect(getComputedStyle(chatList).paddingBottom).toBe(LOADING_MORE_PADDING_BOTTOM)

    setRootState(loadingMoreAttributeName, false)
    expect(getComputedStyle(chatList).paddingBottom).not.toBe(LOADING_MORE_PADDING_BOTTOM)
  })

  it('пустой архив: в режиме архива скрыто всё, в обычном ничего', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    assignSyntheticChatIds()
    applyArchive([])
    expect(findEntries().some(isWrapperHidden)).toBe(false)
    setRootState(archiveViewAttributeName, true)
    expect(findEntries().every(isWrapperHidden)).toBe(true)
  })

  it('архивные чаты находятся поиском', () => {
    mountChatList(SEARCH_ACTIVE_FIXTURE_FILE_NAME)
    const chatIds = assignSyntheticChatIds()
    expect(chatIds.length).toBeGreaterThan(0)
    applyArchive(chatIds)
    expect(findEntries().some(isWrapperHidden)).toBe(false)
    setRootState(archiveViewAttributeName, true)
    expect(findEntries().some(isWrapperHidden)).toBe(false)
  })

  it('архивные чаты скрыты и на вкладке тега', () => {
    mountChatList(USER_TAGS_FIXTURE_FILE_NAME)
    const tabButtons = [
      ...fixture.container.querySelectorAll(
        `${siteSelectors.chatListTabsList} ${siteSelectors.chatListTabButton}`,
      ),
    ]
    tabButtons.forEach((tabButton) => {
      tabButton.classList.remove(siteClassNames.chatListTabSelected)
    })
    tabButtons.at(-1)?.classList.add(siteClassNames.chatListTabSelected)
    const chatIds = assignSyntheticChatIds()
    const archivedChatIds = chatIds.slice(0, 2)
    applyArchive(archivedChatIds)
    const { archivedEntries, otherEntries } = splitEntries(chatIds, archivedChatIds)
    expect(archivedEntries.every(isWrapperHidden)).toBe(true)
    expect(otherEntries.some(isWrapperHidden)).toBe(false)
  })

  it('вкладка «Архив» последняя, приглушённый счётчик только при непрочитанных', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const chatIds = assignSyntheticChatIds()
    lifecycleScope = createLifecycleScope()
    const archiveTab = createArchiveTab(document, featureMeta.id)
    const tabsList = findRequiredElement(fixture.container, siteSelectors.chatListTabsList)
    createInjectedElementKeeper({
      featureId: featureMeta.id,
      element: archiveTab.element,
      lifecycle: lifecycleScope.lifecycle,
      logger: { warn: vi.fn(), error: vi.fn() },
    }).keep(tabsList)

    expect(tabsList.lastElementChild).toBe(archiveTab.element)
    expect(archiveTab.element.matches(siteSelectors.chatListTabButton)).toBe(true)
    expect(archiveTab.element.textContent).toBe(ARCHIVE_TAB_TEXT)

    const chatList = findRequiredElement(fixture.container, siteSelectors.chatList)
    const archivedChatIds = new Set(ARCHIVED_ENTRY_INDEXES.map((index) => chatIds[index] as string))
    const unreadCount = countUnreadArchivedEntries(chatList, archivedChatIds)
    expect(unreadCount).toBe(1)
    archiveTab.setUnreadCount(unreadCount)
    const counter = archiveTab.element.lastElementChild as Element
    expect(counter.classList.contains(siteClassNames.chatListTabCounterMuted)).toBe(true)
    expect(counter.textContent).toBe(String(unreadCount))

    archiveTab.setUnreadCount(0)
    expect(archiveTab.element.textContent).toBe(ARCHIVE_TAB_TEXT)
  })

  it('в режиме архива выделение «Все чаты» снято', () => {
    mountChatList(ALL_CHATS_FIXTURE_FILE_NAME)
    const allChatsButton = findRequiredElement(
      fixture.container,
      siteSelectors.chatListAllChatsTabButton,
    )
    expect(getComputedStyle(allChatsButton, AFTER_PSEUDO_ELEMENT).content).not.toBe(
      NO_CONTENT_VALUE,
    )
    setRootState(archiveViewAttributeName, true)
    expect(getComputedStyle(allChatsButton, AFTER_PSEUDO_ELEMENT).content).toBe(NO_CONTENT_VALUE)
  })

  it('пункт меню встаёт последним и повторяет разметку пунктов клиента', () => {
    mountChatList(CONTEXT_MENU_FIXTURE_FILE_NAME, true)
    lifecycleScope = createLifecycleScope()
    const contextMenu = findRequiredElement(fixture.container, siteSelectors.chatContextMenuVisible)
    const clientItem = contextMenu.firstElementChild as Element
    const menuItem = createContextMenuItem(document, featureMeta.id)
    menuItem.showAction(false)
    createInjectedElementKeeper({
      featureId: featureMeta.id,
      element: menuItem.element,
      lifecycle: lifecycleScope.lifecycle,
      logger: { warn: vi.fn(), error: vi.fn() },
    }).keep(contextMenu)

    expect(contextMenu.lastElementChild).toBe(menuItem.element)
    expect(menuItem.element.className).toBe(clientItem.className)
    expect(menuItem.element.firstElementChild?.className).toBe(
      clientItem.firstElementChild?.className,
    )
    expect(menuItem.element.textContent).toBe(ARCHIVE_ITEM_TEXT)
  })
})
