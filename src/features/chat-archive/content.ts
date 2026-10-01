import { defineFeatureContent } from '@/shared/feature/define-feature'
import {
  createInjectedElementKeeper,
  isOwnElement,
  markOwnedElement,
  removeOwnElements,
  type InjectedElementKeeper,
} from '@/shared/feature/injected-elements'
import type { FeatureLifecycle } from '@/shared/feature/feature-types'
import { logger } from '@/shared/logging/logger'
import { createFeatureSettingsItem } from '@/shared/settings/feature-settings'
import { fitsFeatureSettingsSyncQuota } from '@/shared/settings/sync-quota'
import { siteSelectors, siteTagNames } from '@/shared/site/selectors'
import { REACT_CONTEXTMENU_HIDE_EVENT_NAME } from '@/shared/site/site-constants'
import { countUnreadArchivedEntries, createArchiveTab } from './archive-tab'
import {
  buildArchiveStylesheet,
  createArchiveViewAttributeName,
  createLoadingMoreAttributeName,
} from './archive-stylesheet'
import { CHAT_ID_ATTRIBUTE_NAME } from './chat-id-marker'
import { createContextMenuItem } from './context-menu-item'
import featureMeta from './meta'
import {
  APPROXIMATE_ARCHIVE_CAPACITY,
  ARCHIVED_CHAT_IDS_OPTION_KEY,
  CHAT_ID_PATTERN,
  featureSettings,
  resolveArchivedChatIds,
} from './settings'
import { featureStyles, LOAD_MORE_BUTTON_CLASS_NAME } from './styles'

const STATE_ATTRIBUTE_VALUE = ''
const STYLE_TAG_NAME = 'style'
const LOAD_MORE_TEXT = 'Загрузить ещё'
const CONTEXT_MENU_EVENT_NAME = 'contextmenu'
const CLICK_EVENT_NAME = 'click'
const TOP_SCROLL_POSITION = 0

/**
 * Контейнеры клиента появляются после загрузки и пересоздаются при смене экрана, поэтому они
 * перепроверяются редким интервалом, а за каждым следит узкий наблюдатель
 */
const CONTAINER_CHECK_INTERVAL_MILLISECONDS = 1000

/** Сколько ждать подгрузки страницы записей, прежде чем вернуть режим архива */
const LOAD_MORE_TIMEOUT_MILLISECONDS = 3000

const TABS_LIST_MUTATION_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
}
const CHAT_LIST_MUTATION_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [CHAT_ID_ATTRIBUTE_NAME],
}
const CONTEXT_MENU_MUTATION_OPTIONS: MutationObserverInit = {
  childList: true,
  attributes: true,
  attributeFilter: ['class'],
}

const ARCHIVE_FULL_TEXT = `Архив заполнен (около ${APPROXIMATE_ARCHIVE_CAPACITY} чатов)`
const SAVE_FAILURE_TEXT = 'Не удалось сохранить'
const ARCHIVE_FULL_MESSAGE = 'Архив не помещается в элемент storage.sync, чат не добавлен'
const SAVE_FAILURE_MESSAGE = 'Не удалось сохранить архив чатов'
const SETTINGS_READ_FAILURE_MESSAGE = 'Не удалось прочитать архив чатов, чаты не скрываются'
const INVALID_CHAT_ID_MESSAGE = 'Id чата недопустимого вида, архив не изменён'

/** Вкладки, где пункт меню доступен: «Все чаты» (в том числе режим архива) и теги */
const CHAT_TABS_ACTIVE_SELECTOR = [
  siteSelectors.chatListAllChatsTabActive,
  siteSelectors.chatListUserTagTabActive,
].join(', ')

interface WatchedContainer {
  readonly current: () => Element | null
  refresh(): void
}

/** Следит за контейнером клиента по селектору и переподключает наблюдатель при пересоздании */
function watchContainer(
  documentRoot: Document,
  lifecycle: FeatureLifecycle,
  selector: string,
  options: MutationObserverInit,
  onChange: () => void,
): WatchedContainer {
  let observedElement: Element | null = null
  let disconnectObserver: (() => void) | null = null
  return {
    current: () => observedElement,
    refresh() {
      const element = documentRoot.querySelector(selector)
      if (element === observedElement) {
        return
      }
      disconnectObserver?.()
      disconnectObserver = null
      observedElement = element
      if (element !== null) {
        disconnectObserver = lifecycle.observeMutations(element, onChange, options)
      }
      onChange()
    },
  }
}

/**
 * Локальный архив: пункт контекстного меню пишет id чата в sync, сгенерированный стиль прячет
 * архивные записи, вкладка «Архив» в конце списка вкладок показывает только их. id записей
 * ставит скрипт главного мира (chat-ids.content.ts). Отключение убирает узлы этой копии,
 * признаки состояния снимает runtime, список в sync остаётся
 */
export default defineFeatureContent({
  meta: featureMeta,
  styles: featureStyles,
  anchorSelectors: [
    siteSelectors.chatList,
    siteSelectors.chatListTabsList,
    siteSelectors.chatContextMenu,
  ],
  async mount({ documentRoot, lifecycle }) {
    const featureId = featureMeta.id
    const rootElement = documentRoot.documentElement
    const archiveViewAttributeName = createArchiveViewAttributeName(featureId)
    const loadingMoreAttributeName = createLoadingMoreAttributeName(featureId)
    const settingsItem = createFeatureSettingsItem(featureMeta, featureSettings)

    let archivedChatIds: readonly string[] = []
    let contextMenuChatId: string | null = null
    let menuErrorText: string | null = null
    let entryCountBeforeLoading: number | null = null

    const styleElement = markOwnedElement(documentRoot.createElement(STYLE_TAG_NAME), featureId)
    const archiveTab = createArchiveTab(documentRoot, featureId)
    const menuItem = createContextMenuItem(documentRoot, featureId)
    const loadMoreButton = markOwnedElement(
      documentRoot.createElement(siteTagNames.button),
      featureId,
    )
    loadMoreButton.className = LOAD_MORE_BUTTON_CLASS_NAME
    loadMoreButton.textContent = LOAD_MORE_TEXT

    function createKeeper(element: Element): InjectedElementKeeper {
      return createInjectedElementKeeper({ featureId, element, lifecycle, logger })
    }
    const tabKeeper = createKeeper(archiveTab.element)
    const menuItemKeeper = createKeeper(menuItem.element)
    const loadMoreKeeper = createKeeper(loadMoreButton)

    function isArchiveView(): boolean {
      return rootElement.hasAttribute(archiveViewAttributeName)
    }

    function countChatListEntries(): number {
      return chatListContainer.current()?.querySelectorAll(siteSelectors.chatListEntry).length ?? 0
    }

    function finishLoadingMore(): void {
      if (entryCountBeforeLoading === null) {
        return
      }
      entryCountBeforeLoading = null
      rootElement.removeAttribute(loadingMoreAttributeName)
      const scroller = documentRoot.querySelector(siteSelectors.chatListScroller)
      if (scroller !== null) {
        scroller.scrollTop = TOP_SCROLL_POSITION
      }
    }

    /**
     * Клиент подгружает записи только прокруткой до конца, а в режиме архива почти все записи
     * скрыты и прокручивать нечего. Скрытие снимается на время подгрузки, список прокручивается
     * до конца, и после новой страницы (или по таймауту) режим архива возвращается
     */
    function loadMoreEntries(): void {
      const scroller = documentRoot.querySelector(siteSelectors.chatListScroller)
      if (scroller === null || entryCountBeforeLoading !== null) {
        return
      }
      entryCountBeforeLoading = countChatListEntries()
      rootElement.setAttribute(loadingMoreAttributeName, STATE_ATTRIBUTE_VALUE)
      lifecycle.requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight
      })
      lifecycle.setTimeout(finishLoadingMore, LOAD_MORE_TIMEOUT_MILLISECONDS)
    }

    function refreshChatList(): void {
      const chatList = chatListContainer.current()
      if (chatList === null) {
        archiveTab.setUnreadCount(0)
        return
      }
      archiveTab.setUnreadCount(countUnreadArchivedEntries(chatList, new Set(archivedChatIds)))
      if (isArchiveView()) {
        loadMoreKeeper.keep(chatList)
      } else {
        loadMoreButton.remove()
      }
      if (entryCountBeforeLoading !== null && countChatListEntries() > entryCountBeforeLoading) {
        finishLoadingMore()
      }
    }

    function setArchiveView(isEnabled: boolean): void {
      if (isEnabled) {
        rootElement.setAttribute(archiveViewAttributeName, STATE_ATTRIBUTE_VALUE)
      } else {
        rootElement.removeAttribute(archiveViewAttributeName)
        finishLoadingMore()
      }
      archiveTab.setSelected(isEnabled)
      refreshChatList()
    }

    function refreshTabs(): void {
      tabKeeper.keep(tabsListContainer.current())
      /* Режим архива держится только на выбранной «Все чаты»: другая вкладка его снимает */
      if (
        isArchiveView() &&
        documentRoot.querySelector(siteSelectors.chatListAllChatsTabActive) === null
      ) {
        setArchiveView(false)
      }
    }

    function refreshContextMenu(): void {
      const contextMenu = documentRoot.querySelector(siteSelectors.chatContextMenuVisible)
      if (contextMenu === null || contextMenuChatId === null) {
        menuItem.element.remove()
        return
      }
      if (menuErrorText === null) {
        menuItem.showAction(archivedChatIds.includes(contextMenuChatId))
      } else {
        menuItem.showError(menuErrorText)
      }
      menuItemKeeper.keep(contextMenu)
    }

    const tabsListContainer = watchContainer(
      documentRoot,
      lifecycle,
      siteSelectors.chatListTabsList,
      TABS_LIST_MUTATION_OPTIONS,
      refreshTabs,
    )
    const chatListContainer = watchContainer(
      documentRoot,
      lifecycle,
      siteSelectors.chatList,
      CHAT_LIST_MUTATION_OPTIONS,
      refreshChatList,
    )
    const contextMenuContainer = watchContainer(
      documentRoot,
      lifecycle,
      siteSelectors.chatContextMenu,
      CONTEXT_MENU_MUTATION_OPTIONS,
      refreshContextMenu,
    )

    function refreshContainers(): void {
      tabsListContainer.refresh()
      chatListContainer.refresh()
      contextMenuContainer.refresh()
    }

    function applyArchivedChatIds(nextArchivedChatIds: readonly string[]): void {
      archivedChatIds = nextArchivedChatIds
      styleElement.textContent = buildArchiveStylesheet(featureId, archivedChatIds)
      refreshChatList()
      refreshContextMenu()
    }

    function hideContextMenu(): void {
      documentRoot.defaultView?.dispatchEvent(new CustomEvent(REACT_CONTEXTMENU_HIDE_EVENT_NAME))
    }

    function showMenuError(errorText: string): void {
      menuErrorText = errorText
      refreshContextMenu()
    }

    /**
     * id чата под курсором для пункта меню. Архивируются только чаты: на вкладках «Обсуждения»,
     * «Упоминания» и «Каталог» и для записей тредов пункта нет
     */
    function findContextMenuChatId(target: EventTarget | null): string | null {
      if (
        !(target instanceof Element) ||
        documentRoot.querySelector(CHAT_TABS_ACTIVE_SELECTOR) === null
      ) {
        return null
      }
      const entry = target.closest(`${siteSelectors.chatList} ${siteSelectors.chatListEntry}`)
      if (entry === null || entry.querySelector(siteSelectors.chatListEntryThreadExtra) !== null) {
        return null
      }
      return entry.getAttribute(CHAT_ID_ATTRIBUTE_NAME)
    }

    /** Переключает архив чата из меню. Новое сообщение архив не меняет: запись только здесь */
    async function toggleContextMenuChat(): Promise<void> {
      const chatId = contextMenuChatId
      if (chatId === null) {
        return
      }
      if (!CHAT_ID_PATTERN.test(chatId)) {
        logger.warn(INVALID_CHAT_ID_MESSAGE, chatId)
        return
      }
      let nextArchivedChatIds: readonly string[]
      try {
        const storedValue = await settingsItem.getValue()
        const currentArchivedChatIds = resolveArchivedChatIds(storedValue)
        nextArchivedChatIds = currentArchivedChatIds.includes(chatId)
          ? currentArchivedChatIds.filter((archivedChatId) => archivedChatId !== chatId)
          : [...currentArchivedChatIds, chatId]
        const nextValue = { ...storedValue, [ARCHIVED_CHAT_IDS_OPTION_KEY]: nextArchivedChatIds }
        if (!fitsFeatureSettingsSyncQuota(featureId, nextValue)) {
          logger.warn(ARCHIVE_FULL_MESSAGE)
          showMenuError(ARCHIVE_FULL_TEXT)
          return
        }
        await settingsItem.setValue(nextValue)
      } catch (writeError) {
        logger.warn(SAVE_FAILURE_MESSAGE, writeError)
        showMenuError(SAVE_FAILURE_TEXT)
        return
      }
      applyArchivedChatIds(nextArchivedChatIds)
      hideContextMenu()
    }

    lifecycle.addEventListener(
      documentRoot,
      CONTEXT_MENU_EVENT_NAME,
      (event) => {
        contextMenuChatId = findContextMenuChatId(event.target)
        menuErrorText = null
        lifecycle.requestAnimationFrame(refreshContextMenu)
      },
      { capture: true },
    )
    lifecycle.addEventListener(
      documentRoot,
      CLICK_EVENT_NAME,
      (event) => {
        const target = event.target
        if (!(target instanceof Element) || !isArchiveView()) {
          return
        }
        const tabButton = target.closest(
          `${siteSelectors.chatListTabsList} ${siteSelectors.chatListTabButton}`,
        )
        if (tabButton !== null && !isOwnElement(tabButton, featureId)) {
          setArchiveView(false)
        }
      },
      { capture: true },
    )
    lifecycle.addEventListener(archiveTab.element, CLICK_EVENT_NAME, () => {
      const allChatsButton = documentRoot.querySelector(siteSelectors.chatListAllChatsTabButton)
      if (
        allChatsButton instanceof HTMLElement &&
        documentRoot.querySelector(siteSelectors.chatListAllChatsTabActive) === null
      ) {
        allChatsButton.click()
      }
      setArchiveView(true)
    })
    lifecycle.addEventListener(menuItem.element, CLICK_EVENT_NAME, () => {
      void toggleContextMenuChat()
    })
    lifecycle.addEventListener(loadMoreButton, CLICK_EVENT_NAME, loadMoreEntries)

    const styleParent = documentRoot.head ?? rootElement
    styleParent.append(styleElement)
    try {
      applyArchivedChatIds(resolveArchivedChatIds(await settingsItem.getValue()))
    } catch (readError) {
      logger.warn(SETTINGS_READ_FAILURE_MESSAGE, readError)
      applyArchivedChatIds([])
    }
    refreshContainers()
    lifecycle.setInterval(refreshContainers, CONTAINER_CHECK_INTERVAL_MILLISECONDS)

    const unwatchSettings = settingsItem.watch((storedValue) => {
      applyArchivedChatIds(resolveArchivedChatIds(storedValue))
    })
    return () => {
      unwatchSettings()
      removeOwnElements(documentRoot, featureId)
    }
  },
})
