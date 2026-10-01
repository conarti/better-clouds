import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { findNestedHasSelector } from '@/shared/feature/css-selector-analysis'
import {
  createFeatureAttributeName,
  FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME,
} from '@/shared/feature/feature-scope'
import type { FeatureCleanup } from '@/shared/feature/feature-types'
import { createLifecycleScope, type LifecycleScope } from '@/shared/feature/lifecycle-scope'
import { createFeatureSettingsItem } from '@/shared/settings/feature-settings'
import { siteClassNames, siteSelectors } from '@/shared/site/selectors'
import {
  REACT_CONTEXTMENU_HIDE_EVENT_NAME,
  REACT_FIBER_PROPERTY_PREFIX,
} from '@/shared/site/site-constants'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import {
  buildArchiveStylesheet,
  createArchiveViewAttributeName,
  createLoadingMoreAttributeName,
} from './archive-stylesheet'
import {
  CHAT_ID_ATTRIBUTE_NAME,
  findReactChatId,
  markChatIds,
  startChatIdMarker,
} from './chat-id-marker'
import featureContent from './content'
import { ARCHIVE_ITEM_TEXT, UNARCHIVE_ITEM_TEXT } from './context-menu-item'
import featureMeta from './meta'
import { featureSettings, resolveArchivedChatIds } from './settings'
import { LOAD_MORE_BUTTON_CLASS_NAME } from './styles'

const ALL_CHATS_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const THREADS_TAB_FIXTURE_FILE_NAME = 'layout-threads-tab.html'
const USER_TAGS_FIXTURE_FILE_NAME = 'layout-user-tags.html'
const FIBER_PROPERTY_NAME = `${REACT_FIBER_PROPERTY_PREFIX}stub`
const FIRST_CHAT_ID = '0a1b2c3d-0000-4000-8000-000000000001'
const SECOND_CHAT_ID = '0a1b2c3d-0000-4000-8000-000000000002'
const NON_CHAT_KEY = 'row-17'
const UNSAFE_CHAT_ID = 'a"] , html { color: red'
const ELEMENT_TAG_NAME = 'div'
const ENABLED_ATTRIBUTE_VALUE = ''
const FEATURE_ATTRIBUTE_NAME = createFeatureAttributeName(featureMeta.id)
const ARCHIVE_VIEW_ATTRIBUTE_NAME = createArchiveViewAttributeName(featureMeta.id)
const LOADING_MORE_ATTRIBUTE_NAME = createLoadingMoreAttributeName(featureMeta.id)
const FOREIGN_MARKER_VALUE = `${featureMeta.id}:foreign-instance`
const ARCHIVE_TAB_TEXT = 'Архив'
const ARCHIVE_FULL_TEXT_FRAGMENT = 'Архив заполнен'
const OVERFLOW_CHAT_COUNT = 220
const UUID_LENGTH = 36
const CONTEXT_MENU_EVENT_NAME = 'contextmenu'
const CHAT_ENTRY_INDEX_WITH_UNREAD = 1
const CHAT_ENTRY_INDEX_WITHOUT_UNREAD = 2
const QUIET_PERIOD_MILLISECONDS = 50
const ALL_CHATS_TAB_INDEX = 0
const THREADS_TAB_INDEX = 2
const MENTIONED_TAB_INDEX = 3
const USER_TAG_TAB_INDEX = 4
const SCROLLER_CONTENT_HEIGHT = 900
const FRAME_MILLISECONDS = 20
const LOAD_MORE_TIMEOUT_MILLISECONDS = 3000
const INVALID_CHAT_ID = 'chat id with spaces'
const OWNED_ELEMENT_SELECTOR = `[${FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME}]`

interface FiberStub {
  key: unknown
  return: FiberStub | null
}

function createFiberChain(keys: readonly unknown[]): FiberStub | null {
  return keys.reduceRight<FiberStub | null>(
    (parentFiber, key) => ({ key, return: parentFiber }),
    null,
  )
}

function attachFiber(element: Element, keys: readonly unknown[]): void {
  Object.assign(element, { [FIBER_PROPERTY_NAME]: createFiberChain(keys) })
}

function waitForFrames(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, QUIET_PERIOD_MILLISECONDS)
  })
}

function findChatEntries(): Element[] {
  return [...document.querySelectorAll(`${siteSelectors.chatList} ${siteSelectors.chatListEntry}`)]
}

function requireElement(selector: string): Element {
  const element = document.querySelector(selector)
  if (element === null) {
    throw new Error(`Нет элемента ${selector}`)
  }
  return element
}

describe('findReactChatId', () => {
  it('берёт ближайший ключ вида UUID среди предков fiber', () => {
    const element = document.createElement(ELEMENT_TAG_NAME)
    attachFiber(element, [null, NON_CHAT_KEY, null, FIRST_CHAT_ID, SECOND_CHAT_ID])
    expect(findReactChatId(element)).toBe(FIRST_CHAT_ID)
  })

  it('без fiber, без подходящего ключа и при странной форме даёт null', () => {
    const withoutFiber = document.createElement(ELEMENT_TAG_NAME)
    expect(findReactChatId(withoutFiber)).toBeNull()

    const withoutChatKey = document.createElement(ELEMENT_TAG_NAME)
    attachFiber(withoutChatKey, [null, NON_CHAT_KEY, 42])
    expect(findReactChatId(withoutChatKey)).toBeNull()

    const brokenFiber = document.createElement(ELEMENT_TAG_NAME)
    Object.defineProperty(brokenFiber, FIBER_PROPERTY_NAME, {
      enumerable: true,
      get() {
        throw new Error('fiber недоступен')
      },
    })
    expect(findReactChatId(brokenFiber)).toBeNull()
  })

  it('не уходит дальше предела предков', () => {
    const element = document.createElement(ELEMENT_TAG_NAME)
    attachFiber(element, [...Array<null>(30).fill(null), FIRST_CHAT_ID])
    expect(findReactChatId(element)).toBeNull()
  })
})

describe('startChatIdMarker', () => {
  beforeEach(() => {
    document.body.innerHTML = loadFixture(ALL_CHATS_FIXTURE_FILE_NAME)
  })

  afterEach(() => {
    document.documentElement.removeAttribute(FEATURE_ATTRIBUTE_NAME)
    document.body.innerHTML = ''
  })

  it('markChatIds ставит и поправляет атрибут по fiber', () => {
    const [firstEntry, secondEntry] = findChatEntries() as [Element, Element]
    attachFiber(firstEntry, [null, FIRST_CHAT_ID])
    secondEntry.setAttribute(CHAT_ID_ATTRIBUTE_NAME, FIRST_CHAT_ID)

    markChatIds(requireElement(siteSelectors.chatList))

    expect(firstEntry.getAttribute(CHAT_ID_ATTRIBUTE_NAME)).toBe(FIRST_CHAT_ID)
    expect(secondEntry.hasAttribute(CHAT_ID_ATTRIBUTE_NAME)).toBe(false)
  })

  it('работает только пока включена функция архива и убирает атрибуты при выключении', async () => {
    const [firstEntry] = findChatEntries() as [Element]
    attachFiber(firstEntry, [FIRST_CHAT_ID])
    const stop = startChatIdMarker(document)

    await waitForFrames()
    expect(firstEntry.hasAttribute(CHAT_ID_ATTRIBUTE_NAME)).toBe(false)

    document.documentElement.setAttribute(FEATURE_ATTRIBUTE_NAME, ENABLED_ATTRIBUTE_VALUE)
    await vi.waitFor(() => {
      expect(firstEntry.getAttribute(CHAT_ID_ATTRIBUTE_NAME)).toBe(FIRST_CHAT_ID)
    })

    const addedEntry = firstEntry.cloneNode(true) as Element
    addedEntry.removeAttribute(CHAT_ID_ATTRIBUTE_NAME)
    attachFiber(addedEntry, [SECOND_CHAT_ID])
    requireElement(siteSelectors.chatList).append(addedEntry)
    await vi.waitFor(() => {
      expect(addedEntry.getAttribute(CHAT_ID_ATTRIBUTE_NAME)).toBe(SECOND_CHAT_ID)
    })

    document.documentElement.removeAttribute(FEATURE_ATTRIBUTE_NAME)
    await vi.waitFor(() => {
      expect(document.querySelectorAll(`[${CHAT_ID_ATTRIBUTE_NAME}]`)).toHaveLength(0)
    })
    stop()
  })
})

describe('resolveArchivedChatIds', () => {
  it('оставляет строки допустимого вида без повторов', () => {
    expect(resolveArchivedChatIds(undefined)).toEqual([])
    expect(resolveArchivedChatIds({ archivedChatIds: FIRST_CHAT_ID })).toEqual([])
    expect(
      resolveArchivedChatIds({
        archivedChatIds: [FIRST_CHAT_ID, 7, UNSAFE_CHAT_ID, FIRST_CHAT_ID, SECOND_CHAT_ID],
      }),
    ).toEqual([FIRST_CHAT_ID, SECOND_CHAT_ID])
  })
})

describe('buildArchiveStylesheet', () => {
  it('пустой список даёт одно правило режима архива без :has() по id', () => {
    const stylesheet = buildArchiveStylesheet(featureMeta.id, [])
    expect(stylesheet).toContain(ARCHIVE_VIEW_ATTRIBUTE_NAME)
    expect(stylesheet).not.toContain(CHAT_ID_ATTRIBUTE_NAME)
    expect(stylesheet.match(/\{/g)).toHaveLength(1)
  })

  it('все id в одном правиле на каждое правило, без вложенного :has()', () => {
    const stylesheet = buildArchiveStylesheet(featureMeta.id, [FIRST_CHAT_ID, SECOND_CHAT_ID])
    expect(stylesheet.match(/\{/g)).toHaveLength(3)
    expect(stylesheet.split(FIRST_CHAT_ID)).toHaveLength(4)
    expect(stylesheet).toContain(SECOND_CHAT_ID)
    expect(findNestedHasSelector(stylesheet)).toEqual([])
  })
})

describe('chat-archive mount', () => {
  let lifecycleScope: LifecycleScope | null = null
  let cleanup: FeatureCleanup | null = null
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  const settingsItem = () => createFeatureSettingsItem(featureMeta, featureSettings)

  async function storeArchivedChatIds(archivedChatIds: readonly string[]): Promise<void> {
    await settingsItem().setValue({ enabled: true, archivedChatIds: [...archivedChatIds] })
  }

  async function readArchivedChatIds(): Promise<readonly string[]> {
    return resolveArchivedChatIds(await settingsItem().getValue())
  }

  async function mountFeature(): Promise<void> {
    const scope = createLifecycleScope()
    lifecycleScope = scope
    const mountResult = await featureContent.mount?.({
      documentRoot: document,
      signal: scope.signal,
      lifecycle: scope.lifecycle,
    })
    cleanup = mountResult as FeatureCleanup
  }

  function unmountFeature(): void {
    lifecycleScope?.dispose()
    cleanup?.()
    lifecycleScope = null
    cleanup = null
  }

  function findOwnedElements(): Element[] {
    return [...document.querySelectorAll(`[${FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME}]`)]
  }

  function openContextMenu(entry: Element): Element {
    entry.dispatchEvent(new MouseEvent(CONTEXT_MENU_EVENT_NAME, { bubbles: true }))
    const contextMenu = requireElement(siteSelectors.chatContextMenu)
    contextMenu.classList.add(siteClassNames.contextMenuVisible)
    return contextMenu
  }

  function findArchiveTab(): Element {
    const tabsList = requireElement(siteSelectors.chatListTabsList)
    const lastTab = tabsList.lastElementChild
    if (lastTab === null || lastTab.textContent?.startsWith(ARCHIVE_TAB_TEXT) !== true) {
      throw new Error('Вкладка «Архив» не последняя')
    }
    return lastTab
  }

  function loadChatListFixture(fixtureFileName: string): void {
    document.body.innerHTML = loadFixture(fixtureFileName)
    findChatEntries().forEach((entry, index) => {
      entry.setAttribute(
        CHAT_ID_ATTRIBUTE_NAME,
        `${FIRST_CHAT_ID.slice(0, -3)}${String(index).padStart(3, '0')}`,
      )
    })
  }

  function selectTab(tabIndex: number): void {
    const tabButtons = [
      ...document.querySelectorAll(
        `${siteSelectors.chatListTabsList} ${siteSelectors.chatListTabButton}`,
      ),
    ]
    tabButtons.forEach((tabButton, index) => {
      tabButton.classList.toggle(siteClassNames.chatListTabSelected, index === tabIndex)
    })
  }

  async function expectNoMenuItem(entry: Element): Promise<void> {
    const contextMenu = openContextMenu(entry)
    await waitForFrames()
    expect(contextMenu.querySelector(OWNED_ELEMENT_SELECTOR)).toBeNull()
  }

  async function expectMenuItem(entry: Element): Promise<void> {
    const contextMenu = openContextMenu(entry)
    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toBe(ARCHIVE_ITEM_TEXT)
    })
  }

  beforeEach(() => {
    fakeBrowser.reset()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadChatListFixture(ALL_CHATS_FIXTURE_FILE_NAME)
  })

  afterEach(() => {
    vi.useRealTimers()
    unmountFeature()
    consoleWarnSpy.mockRestore()
    document.documentElement.removeAttribute(ARCHIVE_VIEW_ATTRIBUTE_NAME)
    document.documentElement.removeAttribute(LOADING_MORE_ATTRIBUTE_NAME)
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('пункт меню добавляет чат в архив и закрывает меню, повторно возвращает', async () => {
    await mountFeature()
    const entry = findChatEntries()[CHAT_ENTRY_INDEX_WITHOUT_UNREAD] as Element
    const chatId = entry.getAttribute(CHAT_ID_ATTRIBUTE_NAME) as string
    const hideListener = vi.fn()
    window.addEventListener(REACT_CONTEXTMENU_HIDE_EVENT_NAME, hideListener)

    const contextMenu = openContextMenu(entry)
    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toBe(ARCHIVE_ITEM_TEXT)
    })
    ;(contextMenu.lastElementChild as HTMLElement).click()

    await vi.waitFor(async () => {
      expect(await readArchivedChatIds()).toEqual([chatId])
    })
    expect(hideListener).toHaveBeenCalledTimes(1)
    expect(document.head.textContent).toContain(chatId)

    openContextMenu(entry)
    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toBe(UNARCHIVE_ITEM_TEXT)
    })
    ;(contextMenu.lastElementChild as HTMLElement).click()
    await vi.waitFor(async () => {
      expect(await readArchivedChatIds()).toEqual([])
    })
    window.removeEventListener(REACT_CONTEXTMENU_HIDE_EVENT_NAME, hideListener)
  })

  it('пункт меню есть у чатов на «Все чаты» и на вкладке тега', async () => {
    await mountFeature()
    await expectMenuItem(findChatEntries()[0] as Element)

    unmountFeature()
    loadChatListFixture(USER_TAGS_FIXTURE_FILE_NAME)
    selectTab(USER_TAG_TAB_INDEX)
    await mountFeature()
    await expectMenuItem(findChatEntries()[0] as Element)
  })

  it('пункта меню нет на вкладках «Обсуждения» и «Упоминания»', async () => {
    await mountFeature()
    const entry = findChatEntries()[0] as Element
    selectTab(THREADS_TAB_INDEX)
    await expectNoMenuItem(entry)
    selectTab(MENTIONED_TAB_INDEX)
    await expectNoMenuItem(entry)
  })

  it('пункта меню нет у записи треда даже на «Все чаты»', async () => {
    loadChatListFixture(THREADS_TAB_FIXTURE_FILE_NAME)
    selectTab(ALL_CHATS_TAB_INDEX)
    await mountFeature()
    const threadEntry = findChatEntries()[0] as Element
    expect(threadEntry.querySelector(siteSelectors.chatListEntryThreadExtra)).not.toBeNull()
    await expectNoMenuItem(threadEntry)
  })

  it('id недопустимого вида не пишется и не попадает в стили', async () => {
    await mountFeature()
    const entry = findChatEntries()[0] as Element
    entry.setAttribute(CHAT_ID_ATTRIBUTE_NAME, INVALID_CHAT_ID)
    const contextMenu = openContextMenu(entry)
    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toBe(ARCHIVE_ITEM_TEXT)
    })
    ;(contextMenu.lastElementChild as HTMLElement).click()

    await vi.waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
    expect(await readArchivedChatIds()).toEqual([])
    expect(await settingsItem().getValue()).not.toHaveProperty('archivedChatIds')
    expect(document.head.textContent).not.toContain(INVALID_CHAT_ID)
  })

  it('при переполнении квоты пункт показывает ошибку и ничего не пишет', async () => {
    const storedChatIds = Array.from({ length: OVERFLOW_CHAT_COUNT }, (_, index) =>
      String(index).padStart(UUID_LENGTH, '0'),
    )
    await storeArchivedChatIds(storedChatIds)
    await mountFeature()
    const contextMenu = openContextMenu(findChatEntries()[0] as Element)
    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toBe(ARCHIVE_ITEM_TEXT)
    })
    ;(contextMenu.lastElementChild as HTMLElement).click()

    await vi.waitFor(() => {
      expect(contextMenu.lastElementChild?.textContent).toContain(ARCHIVE_FULL_TEXT_FRAGMENT)
    })
    expect(await readArchivedChatIds()).toEqual(storedChatIds)
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('вкладка «Архив» последняя, счётчик считает непрочитанные архивные, новое сообщение не возвращает чат', async () => {
    const unreadEntry = findChatEntries()[CHAT_ENTRY_INDEX_WITH_UNREAD] as Element
    const unreadCounter = unreadEntry.querySelector(siteSelectors.chatListEntryUnreadCounter)
    if (unreadCounter === null) {
      throw new Error('У записи нет счётчика непрочитанных')
    }
    const unreadChatId = unreadEntry.getAttribute(CHAT_ID_ATTRIBUTE_NAME) as string
    await storeArchivedChatIds([unreadChatId])
    await mountFeature()

    const archiveTab = findArchiveTab()
    expect(archiveTab.textContent).toContain('1')

    const counterParent = unreadCounter.parentElement as Element
    unreadEntry.querySelectorAll(siteSelectors.chatListEntryUnreadCounter).forEach((counter) => {
      counter.remove()
    })
    await vi.waitFor(() => {
      expect(archiveTab.textContent?.trim()).toBe(ARCHIVE_TAB_TEXT)
    })

    counterParent.append(unreadCounter)
    await vi.waitFor(() => {
      expect(archiveTab.textContent).toContain('1')
    })
    expect(await readArchivedChatIds()).toEqual([unreadChatId])
  })

  it('вкладка включает режим архива, вкладка клиента его снимает', async () => {
    await mountFeature()
    const archiveTab = findArchiveTab() as HTMLElement
    archiveTab.click()
    expect(document.documentElement.hasAttribute(ARCHIVE_VIEW_ATTRIBUTE_NAME)).toBe(true)
    expect(archiveTab.classList.contains(siteClassNames.chatListTabSelected)).toBe(true)
    await vi.waitFor(() => {
      expect(
        requireElement(siteSelectors.chatList).lastElementChild?.hasAttribute(
          FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME,
        ),
      ).toBe(true)
    })

    ;(requireElement(siteSelectors.chatListAllChatsTabButton) as HTMLElement).click()
    expect(document.documentElement.hasAttribute(ARCHIVE_VIEW_ATTRIBUTE_NAME)).toBe(false)
    expect(archiveTab.classList.contains(siteClassNames.chatListTabSelected)).toBe(false)
  })

  describe('«Загрузить ещё»', () => {
    let scrollTopValue = 0

    function findLoadMoreButton(): HTMLElement | null {
      return document.querySelector(`${siteSelectors.chatList} > .${LOAD_MORE_BUTTON_CLASS_NAME}`)
    }

    /** happy-dom не считает раскладку: высота и прокрутка списка задаются вручную */
    function stubScroller(): void {
      scrollTopValue = 0
      const scroller = requireElement(siteSelectors.chatListScroller)
      Object.defineProperty(scroller, 'scrollHeight', {
        configurable: true,
        get: () => SCROLLER_CONTENT_HEIGHT,
      })
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => scrollTopValue,
        set: (nextScrollTop: number) => {
          scrollTopValue = nextScrollTop
        },
      })
    }

    async function openArchiveViewAndLoadMore(): Promise<void> {
      stubScroller()
      await mountFeature()
      vi.useFakeTimers()
      ;(findArchiveTab() as HTMLElement).click()
      await vi.advanceTimersByTimeAsync(FRAME_MILLISECONDS)
      const loadMoreButton = findLoadMoreButton()
      if (loadMoreButton === null) {
        throw new Error('Нет кнопки «Загрузить ещё»')
      }
      loadMoreButton.click()
      await vi.advanceTimersByTimeAsync(FRAME_MILLISECONDS)
    }

    function isLoadingMore(): boolean {
      return document.documentElement.hasAttribute(LOADING_MORE_ATTRIBUTE_NAME)
    }

    it('кнопка есть только в режиме архива', async () => {
      await mountFeature()
      await waitForFrames()
      expect(findLoadMoreButton()).toBeNull()

      ;(findArchiveTab() as HTMLElement).click()
      await vi.waitFor(() => {
        expect(findLoadMoreButton()).not.toBeNull()
      })

      ;(requireElement(siteSelectors.chatListAllChatsTabButton) as HTMLElement).click()
      await vi.waitFor(() => {
        expect(findLoadMoreButton()).toBeNull()
      })
    })

    it('клик снимает скрытие и прокручивает список вниз, новая страница возвращает режим', async () => {
      await openArchiveViewAndLoadMore()
      expect(isLoadingMore()).toBe(true)
      expect(scrollTopValue).toBe(SCROLLER_CONTENT_HEIGHT)

      const chatList = requireElement(siteSelectors.chatList)
      const loadedWrapper = (findChatEntries()[0] as Element).parentElement?.cloneNode(true)
      chatList.append(loadedWrapper as Node)
      await vi.advanceTimersByTimeAsync(FRAME_MILLISECONDS)

      expect(isLoadingMore()).toBe(false)
      expect(scrollTopValue).toBe(0)
      expect(document.documentElement.hasAttribute(ARCHIVE_VIEW_ATTRIBUTE_NAME)).toBe(true)
    })

    it('без новой страницы режим возвращается по таймауту', async () => {
      await openArchiveViewAndLoadMore()
      await vi.advanceTimersByTimeAsync(LOAD_MORE_TIMEOUT_MILLISECONDS - 2 * FRAME_MILLISECONDS)
      expect(isLoadingMore()).toBe(true)

      await vi.advanceTimersByTimeAsync(2 * FRAME_MILLISECONDS)
      expect(isLoadingMore()).toBe(false)
      expect(scrollTopValue).toBe(0)
    })
  })

  it('выключение убирает узлы своей копии, чужие и список в sync остаются', async () => {
    await storeArchivedChatIds([FIRST_CHAT_ID])
    const foreignElement = document.createElement(ELEMENT_TAG_NAME)
    foreignElement.setAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME, FOREIGN_MARKER_VALUE)
    document.body.append(foreignElement)
    await mountFeature()
    expect(findOwnedElements().length).toBeGreaterThan(1)

    unmountFeature()

    expect(findOwnedElements()).toEqual([foreignElement])
    expect(await readArchivedChatIds()).toEqual([FIRST_CHAT_ID])
  })
})
