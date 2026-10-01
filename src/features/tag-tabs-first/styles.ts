import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { MAXIMUM_DISCOVERED_VALUE_COUNT } from '@/shared/feature/feature-types'
import { siteSelectors } from '@/shared/site/selectors'
import { CHAT_LIST_SYSTEM_TAB_COUNT } from '@/shared/site/site-constants'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

const TAB_POSITION_STATE_PREFIX = 'position-'

/** Порядок выбранных вкладок: меньше нуля, у остальных вкладок order по умолчанию 0 */
const SELECTED_TAB_ORDER = -1

/** Правила заготовлены на все системные вкладки и максимум обнаруживаемых тегов */
export const MAXIMUM_TAB_POSITION_COUNT =
  CHAT_LIST_SYSTEM_TAB_COUNT + MAXIMUM_DISCOVERED_VALUE_COUNT

/** Признак на корне: вкладка в позиции position (как в :nth-child) выбрана и идёт первой */
export function createTabPositionAttributeName(position: number): string {
  return createFeatureStateAttributeName(featureMeta.id, `${TAB_POSITION_STATE_PREFIX}${position}`)
}

const tabPositions = Array.from({ length: MAXIMUM_TAB_POSITION_COUNT }, (_, index) => index + 1)

/**
 * Узлы клиента не переставляются: content script ставит на корень признак позиции вкладки
 * выбранного тега, а правило с той же позицией даёт её кнопке отрицательный order. Обёртка
 * вкладки display: contents, поэтому order ставится кнопке, элементу flex-списка. Подчёркивание
 * выбранной вкладки это её ::after, оно едет вместе с кнопкой, своё правило не нужно
 */
export const featureStyles = css`
  ${tabPositions
    .map(
      (position) => css`
        ${featureScope}[${createTabPositionAttributeName(position)}] ${siteSelectors.chatListTabsList} > ${siteSelectors.chatListTabWrapper}:nth-child(${position}) > ${siteSelectors.chatListTabButton} {
          order: ${SELECTED_TAB_ORDER};
        }
      `,
    )
    .join('\n')}
`
