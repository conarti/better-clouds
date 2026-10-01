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
import { buildArchiveStylesheet, createArchiveViewAttributeName } from './archive-stylesheet'
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

const ALL_CHATS_FIXTURE_FILE_NAME = 'layout-all-chats.html'
const FIBER_PROPERTY_NAME = `${REACT_FIBER_PROPERTY_PREFIX}stub`
const FIRST_CHAT_ID = '0a1b2c3d-0000-4000-8000-000000000001'
const SECOND_CHAT_ID = '0a1b2c3d-0000-4000-8000-000000000002'
const NON_CHAT_KEY = 'row-17'
const UNSAFE_CHAT_ID = 'a"] , html { color: red'
const ELEMENT_TAG_NAME = 'div'
const ENABLED_ATTRIBUTE_VALUE = ''
const FEATURE_ATTRIBUTE_NAME = createFeatureAttributeName(featureMeta.id)
const ARCHIVE_VIEW_ATTRIBUTE_NAME = createArchiveViewAttributeName(featureMeta.id)
const FOREIGN_MARKER_VALUE = `${featureMeta.id}:foreign-instance`
const ARCHIVE_TAB_TEXT = 'Архив'
const ARCHIVE_FULL_TEXT_FRAGMENT = 'Архив заполнен'
const OVERFLOW_CHAT_COUNT = 220
const UUID_LENGTH = 36
const CONTEXT_MENU_EVENT_NAME = 'contextmenu'
const CHAT_ENTRY_INDEX_WITH_UNREAD = 1
const CHAT_ENTRY_INDEX_WITHOUT_UNREAD = 2
const QUIET_PERIOD_MILLISECONDS = 50

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

  it('все id в одном правиле скрытия, без вложенного :has()', () => {
    const stylesheet = buildArchiveStylesheet(featureMeta.id, [FIRST_CHAT_ID, SECOND_CHAT_ID])
    expect(stylesheet.match(/\{/g)).toHaveLength(2)
    expect(stylesheet.split(FIRST_CHAT_ID)).toHaveLength(3)
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

  beforeEach(() => {
    fakeBrowser.reset()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    document.body.innerHTML = loadFixture(ALL_CHATS_FIXTURE_FILE_NAME)
    findChatEntries().forEach((entry, index) => {
      entry.setAttribute(
        CHAT_ID_ATTRIBUTE_NAME,
        `${FIRST_CHAT_ID.slice(0, -3)}${String(index).padStart(3, '0')}`,
      )
    })
  })

  afterEach(() => {
    unmountFeature()
    consoleWarnSpy.mockRestore()
    document.documentElement.removeAttribute(ARCHIVE_VIEW_ATTRIBUTE_NAME)
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
