import { markOwnedElement } from '@/shared/feature/injected-elements'
import { siteClassNames, siteSelectors, siteTagNames } from '@/shared/site/selectors'
import { CHAT_ID_ATTRIBUTE_NAME } from './chat-id-marker'

const LABEL_TAG_NAME = 'span'
const COUNTER_TAG_NAME = 'i'
const ARCHIVE_TAB_LABEL = 'Архив'

/** Вкладка «Архив» с видом вкладки клиента и приглушённым счётчиком непрочитанных */
export interface ArchiveTab {
  readonly element: HTMLButtonElement
  setSelected(isSelected: boolean): void
  /** Число архивных чатов с непрочитанными; при нуле счётчик не выводится */
  setUnreadCount(unreadCount: number): void
}

export function createArchiveTab(documentRoot: Document, featureId: string): ArchiveTab {
  const element = markOwnedElement(documentRoot.createElement(siteTagNames.button), featureId)
  element.className = siteClassNames.chatListTab
  const label = documentRoot.createElement(LABEL_TAG_NAME)
  label.textContent = ARCHIVE_TAB_LABEL
  element.append(label)

  const counter = documentRoot.createElement(COUNTER_TAG_NAME)
  counter.className = [
    siteClassNames.chatListTabCounter,
    siteClassNames.chatListTabCounterVisible,
    siteClassNames.chatListTabCounterMuted,
  ].join(' ')
  const counterValue = documentRoot.createElement(LABEL_TAG_NAME)
  counterValue.className = siteClassNames.chatListTabCounterValue
  counter.append(counterValue)

  return {
    element,
    setSelected(isSelected) {
      element.classList.toggle(siteClassNames.chatListTabSelected, isSelected)
    },
    setUnreadCount(unreadCount) {
      if (unreadCount === 0) {
        counter.remove()
        return
      }
      const counterText = String(unreadCount)
      if (counterValue.textContent !== counterText) {
        counterValue.textContent = counterText
      }
      if (counter.parentElement !== element) {
        element.append(counter)
      }
    },
  }
}

/**
 * Архивные чаты с непрочитанными среди уже отрисованных записей: список подгружается
 * страницами, поэтому незагруженные чаты не учитываются (gate G3)
 */
export function countUnreadArchivedEntries(
  chatList: ParentNode,
  archivedChatIds: ReadonlySet<string>,
): number {
  const unreadChatIds = new Set<string>()
  for (const entry of chatList.querySelectorAll(
    `${siteSelectors.chatListEntry}[${CHAT_ID_ATTRIBUTE_NAME}]`,
  )) {
    const chatId = entry.getAttribute(CHAT_ID_ATTRIBUTE_NAME)
    if (
      chatId !== null &&
      archivedChatIds.has(chatId) &&
      entry.querySelector(siteSelectors.chatListEntryUnreadCounter) !== null
    ) {
      unreadChatIds.add(chatId)
    }
  }
  return unreadChatIds.size
}
