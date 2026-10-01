import {
  createFeatureAttributeName,
  FEATURE_ATTRIBUTE_PREFIX,
} from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import { REACT_FIBER_PROPERTY_PREFIX } from '@/shared/site/site-constants'
import featureMeta from './meta'

/**
 * Атрибут расширения на записи списка чатов: id чата, прочитанный из React key записи.
 * Его ставит скрипт главного мира страницы, а читает content script функции
 */
export const CHAT_ID_ATTRIBUTE_NAME = `${FEATURE_ATTRIBUTE_PREFIX}chat-id`

/** UUID чата: так выглядит React key записи (разведка живой страницы v3.72.37, длина 36) */
const CHAT_ID_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Сколько предков fiber просматривается. Ключ чата найден в пяти шагах от записи; запас
 * нужен на обёртки, а предел не даёт уйти в ключи других списков страницы
 */
const MAXIMUM_FIBER_ANCESTOR_STEPS = 12

/** Как часто ищется пересозданный контейнер списка чатов */
const CHAT_LIST_CHECK_INTERVAL_MILLISECONDS = 1000

const CHAT_LIST_MUTATION_OPTIONS: MutationObserverInit = { childList: true, subtree: true }

interface FiberLike {
  readonly key?: unknown
  readonly return?: unknown
}

function isFiberLike(value: unknown): value is FiberLike {
  return typeof value === 'object' && value !== null
}

/**
 * id чата из React key ближайшего предка fiber записи. Читается только ключ, не props и не
 * содержимое переписки. Любая неожиданная форма fiber даёт null, а не исключение
 */
export function findReactChatId(element: Element): string | null {
  try {
    const fiberPropertyName = Object.keys(element).find((propertyName) =>
      propertyName.startsWith(REACT_FIBER_PROPERTY_PREFIX),
    )
    if (fiberPropertyName === undefined) {
      return null
    }
    let fiber: unknown = (element as unknown as Record<string, unknown>)[fiberPropertyName]
    for (let step = 0; step < MAXIMUM_FIBER_ANCESTOR_STEPS && isFiberLike(fiber); step++) {
      const { key } = fiber
      if (typeof key === 'string' && CHAT_ID_KEY_PATTERN.test(key)) {
        return key
      }
      fiber = fiber.return
    }
  } catch {
    return null
  }
  return null
}

/** Ставит или поправляет атрибут id на каждой записи контейнера */
export function markChatIds(container: ParentNode): void {
  for (const entry of container.querySelectorAll(siteSelectors.chatListEntry)) {
    const chatId = findReactChatId(entry)
    if (chatId === null) {
      entry.removeAttribute(CHAT_ID_ATTRIBUTE_NAME)
    } else if (entry.getAttribute(CHAT_ID_ATTRIBUTE_NAME) !== chatId) {
      entry.setAttribute(CHAT_ID_ATTRIBUTE_NAME, chatId)
    }
  }
}

/**
 * Скрипт главного мира не читает хранилище, поэтому работает, пока на корне стоит атрибут
 * включённой функции архива. Изменения списка сводятся к одному проходу за кадр. Возвращает
 * функцию остановки, которая снимает атрибуты id
 */
export function startChatIdMarker(documentRoot: Document): () => void {
  const rootElement = documentRoot.documentElement
  const featureAttributeName = createFeatureAttributeName(featureMeta.id)
  const defaultView = documentRoot.defaultView
  let chatListObserver: MutationObserver | null = null
  let observedChatList: Element | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let animationFrameId: number | null = null

  function scheduleMarking(): void {
    if (animationFrameId !== null || defaultView === null) {
      return
    }
    animationFrameId = defaultView.requestAnimationFrame(() => {
      animationFrameId = null
      if (observedChatList !== null) {
        markChatIds(observedChatList)
      }
    })
  }

  function observeCurrentChatList(): void {
    const chatList = documentRoot.querySelector(siteSelectors.chatList)
    if (chatList === observedChatList) {
      return
    }
    chatListObserver?.disconnect()
    chatListObserver = null
    observedChatList = chatList
    if (chatList !== null && defaultView !== null) {
      chatListObserver = new defaultView.MutationObserver(scheduleMarking)
      chatListObserver.observe(chatList, CHAT_LIST_MUTATION_OPTIONS)
      scheduleMarking()
    }
  }

  function activate(): void {
    if (intervalId !== null) {
      return
    }
    observeCurrentChatList()
    intervalId = setInterval(observeCurrentChatList, CHAT_LIST_CHECK_INTERVAL_MILLISECONDS)
  }

  function deactivate(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (animationFrameId !== null) {
      defaultView?.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    chatListObserver?.disconnect()
    chatListObserver = null
    observedChatList = null
    for (const entry of documentRoot.querySelectorAll(`[${CHAT_ID_ATTRIBUTE_NAME}]`)) {
      entry.removeAttribute(CHAT_ID_ATTRIBUTE_NAME)
    }
  }

  function synchronizeWithFeature(): void {
    if (rootElement.hasAttribute(featureAttributeName)) {
      activate()
    } else {
      deactivate()
    }
  }

  if (defaultView === null) {
    return () => {}
  }
  const rootObserver = new defaultView.MutationObserver(synchronizeWithFeature)
  rootObserver.observe(rootElement, { attributes: true, attributeFilter: [featureAttributeName] })
  synchronizeWithFeature()

  return () => {
    rootObserver.disconnect()
    deactivate()
  }
}
