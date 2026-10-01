import { markOwnedElement } from '@/shared/feature/injected-elements'
import { siteClassNames } from '@/shared/site/selectors'

const CONTAINER_TAG_NAME = 'div'
const LABEL_TAG_NAME = 'span'
const MENU_ITEM_ROLE = 'menuitem'
const ROLE_ATTRIBUTE_NAME = 'role'
const TAB_INDEX_ATTRIBUTE_NAME = 'tabindex'
const MENU_ITEM_TAB_INDEX = '-1'

export const ARCHIVE_ITEM_TEXT = 'В архив'
export const UNARCHIVE_ITEM_TEXT = 'Из архива'

/**
 * Пункт «В архив» или «Из архива» в контекстном меню чата, с классами пунктов клиента.
 * Клавиатурная навигация react-contextmenu знает только свои пункты, поэтому пункт работает мышью
 */
export interface ContextMenuItem {
  readonly element: HTMLElement
  /** Обычная подпись по состоянию чата */
  showAction(isArchived: boolean): void
  /** Ошибка красным текстом, меню остаётся открытым */
  showError(errorText: string): void
}

export function createContextMenuItem(documentRoot: Document, featureId: string): ContextMenuItem {
  const element = markOwnedElement(documentRoot.createElement(CONTAINER_TAG_NAME), featureId)
  element.className = siteClassNames.chatContextMenuItem
  element.setAttribute(ROLE_ATTRIBUTE_NAME, MENU_ITEM_ROLE)
  element.setAttribute(TAB_INDEX_ATTRIBUTE_NAME, MENU_ITEM_TAB_INDEX)
  const row = documentRoot.createElement(CONTAINER_TAG_NAME)
  row.classList.add(...siteClassNames.chatContextMenuItemRow)
  const label = documentRoot.createElement(LABEL_TAG_NAME)
  row.append(label)
  element.append(row)

  function setLabel(text: string, isError: boolean): void {
    if (label.textContent !== text) {
      label.textContent = text
    }
    label.classList.toggle(siteClassNames.negativeText, isError)
  }

  return {
    element,
    showAction(isArchived) {
      setLabel(isArchived ? UNARCHIVE_ITEM_TEXT : ARCHIVE_ITEM_TEXT, false)
    },
    showError(errorText) {
      setLabel(errorText, true)
    },
  }
}
