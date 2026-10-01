import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import { CHAT_ID_ATTRIBUTE_NAME } from './chat-id-marker'

const ARCHIVE_VIEW_STATE_NAME = 'archive-view'
const LOADING_MORE_STATE_NAME = 'loading-more'

/** Признак на корне: выбрана вкладка «Архив», список показывает только архивные чаты */
export function createArchiveViewAttributeName(featureId: string): string {
  return createFeatureStateAttributeName(featureId, ARCHIVE_VIEW_STATE_NAME)
}

/**
 * Признак на корне: идёт подгрузка следующей страницы в режиме архива. Скрытие на это время
 * снимается, иначе список не прокручивается и клиент не подгружает записи (gate G3)
 */
export function createLoadingMoreAttributeName(featureId: string): string {
  return createFeatureStateAttributeName(featureId, LOADING_MORE_STATE_NAME)
}

/**
 * Стили скрытия архивных чатов для текущего списка id. Правило одно на весь список: id
 * перечислены внутри одного :has(), область сужена до контейнера списка чатов, так как
 * обёртка записи это общий класс react-contextmenu. При непустом поиске правила не совпадают,
 * поэтому архивные чаты находятся поиском. В режиме архива наоборот скрыто всё, кроме
 * архивных; при пустом списке id :has() без аргументов недопустим, поэтому для него
 * отдельное правило, которое в режиме архива скрывает все записи
 */
export function buildArchiveStylesheet(
  featureId: string,
  archivedChatIds: readonly string[],
): string {
  const featureScope = createFeatureScopeSelector(featureId)
  const archiveView = `[${createArchiveViewAttributeName(featureId)}]`
  const loadingMore = `[${createLoadingMoreAttributeName(featureId)}]`
  const emptySearch = `:has(${siteSelectors.chatListSearchInputEmpty})`
  const chatListWrappers = `${siteSelectors.chatList} ${siteSelectors.chatListItemWrapper}`

  if (archivedChatIds.length === 0) {
    return css`
      ${featureScope}${archiveView}:not(${loadingMore})${emptySearch} ${chatListWrappers} {
        display: none;
      }
    `
  }

  const archivedEntries = archivedChatIds
    .map((chatId) => `> ${siteSelectors.chatListEntry}[${CHAT_ID_ATTRIBUTE_NAME}="${chatId}"]`)
    .join(', ')

  return css`
    ${featureScope}:not(${archiveView})${emptySearch} ${chatListWrappers}:has(${archivedEntries}) {
      display: none;
    }
    ${featureScope}${archiveView}:not(${loadingMore})${emptySearch} ${chatListWrappers}:not(:has(${archivedEntries})) {
      display: none;
    }
  `
}
