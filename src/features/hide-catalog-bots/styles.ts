import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Замер D9 показал, что правило дешевле базовой линии, поэтому наблюдателей здесь нет.
 * Скрывается обёртка записи, а не сама запись: закреплённые чаты лежат в другом контейнере
 * и не затрагиваются. Fail-open: без активной вкладки «Все чаты» или без пустого поля
 * поиска правило не совпадает и боты видны.
 */
export const featureStyles = css`
  ${featureScope}:has(${siteSelectors.chatListAllChatsTabActive}):has(
      ${siteSelectors.chatListSearchInputEmpty}
    )
    ${siteSelectors.chatList}
    ${siteSelectors.chatListItemWrapper}:has(
      > ${siteSelectors.chatListEntry} > ${siteSelectors.chatListEntryCatalogInfo}
    ) {
    display: none;
  }
`
