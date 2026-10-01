import { FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import { CHAT_LIST_SYSTEM_TAB_COUNT } from '@/shared/site/site-constants'

const OWNED_ELEMENT_SELECTOR = `[${FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME}]`
const FIRST_CHILD_POSITION = 1

/** Вкладка пользовательского тега: имя и позиция обёртки среди детей списка (как в :nth-child) */
export interface UserTagTab {
  readonly name: string
  readonly position: number
}

function isOwnedElement(element: Element): boolean {
  return (
    element.hasAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME) ||
    element.querySelector(OWNED_ELEMENT_SELECTOR) !== null
  )
}

/**
 * Вкладки пользовательских тегов в порядке клиента. Тег отличается от системной вкладки только
 * позицией, поэтому первые CHAT_LIST_SYSTEM_TAB_COUNT вкладок пропускаются. Узлы, которые
 * добавило расширение (любая его копия), не считаются ни системными вкладками, ни тегами
 */
export function findUserTagTabs(tabsList: Element): UserTagTab[] {
  const userTagTabs: UserTagTab[] = []
  let clientTabCount = 0
  Array.from(tabsList.children).forEach((tabWrapper, index) => {
    if (isOwnedElement(tabWrapper) || !tabWrapper.matches(siteSelectors.chatListTabWrapper)) {
      return
    }
    clientTabCount += 1
    if (clientTabCount <= CHAT_LIST_SYSTEM_TAB_COUNT) {
      return
    }
    const name = tabWrapper.querySelector(siteSelectors.chatListTabLabel)?.textContent?.trim()
    if (name !== undefined && name.length > 0) {
      userTagTabs.push({ name, position: index + FIRST_CHILD_POSITION })
    }
  })
  return userTagTabs
}

/**
 * Позиции вкладок выбранных тегов. Порядок между ними задаёт клиент: CSS ставит им общий
 * order, и flex сохраняет их взаимный порядок. Выбранное имя без вкладки просто не совпадает
 */
export function computeSelectedTabPositions(
  userTagTabs: readonly UserTagTab[],
  selectedTagNames: readonly string[],
): number[] {
  const selectedTagNameSet = new Set(selectedTagNames)
  return userTagTabs
    .filter((userTagTab) => selectedTagNameSet.has(userTagTab.name))
    .map((userTagTab) => userTagTab.position)
}
