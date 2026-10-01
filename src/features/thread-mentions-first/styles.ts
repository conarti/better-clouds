import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Контейнер списка общий для всех вкладок, поэтому каждое правило начинается с условия на
 * корне: активна вкладка «Обсуждения» и поле поиска пустое. На других вкладках и в поиске
 * правила не совпадают, и список выглядит как у клиента.
 */
const threadsTabCondition = `${featureScope}:has(${siteSelectors.chatListThreadsTabActive}):has(${siteSelectors.chatListSearchInputEmpty})`

/**
 * Контейнер клиента это блок без виртуализации, записи в обычном потоке (разведка v3.72.37,
 * gate G2). Колонка flex нужна только ради order, поэтому она ставится лишь когда в списке
 * есть тред с упоминанием. Узлы клиента не переставляются: order -1 у помеченных обёрток
 * поднимает их наверх, а порядок внутри обеих групп остаётся порядком DOM.
 *
 * У записи клиента вертикальные поля 2px сверху и снизу, и в блочном контейнере поля соседних
 * записей схлопываются в 2px. Элемент flex сам образует контекст форматирования, схлопывание
 * пропадает, и шаг строк вырос бы на 2px. Нижнее поле записи на это время снимается: при
 * одинаковых полях сверху и снизу записи стоят ровно там же, где у клиента (живая проверка v3.72.37).
 */
export const featureStyles = css`
  ${threadsTabCondition} ${siteSelectors.chatList}:has(
      > ${siteSelectors.chatListItemWrapper}
        > ${siteSelectors.chatListEntry}
        ${siteSelectors.threadListEntryMentionCounterPair}
    ) {
    display: flex;
    flex-direction: column;
  }
  ${threadsTabCondition} ${siteSelectors.chatList}:has(
      > ${siteSelectors.chatListItemWrapper}
        > ${siteSelectors.chatListEntry}
        ${siteSelectors.threadListEntryMentionCounterPair}
    )
    > ${siteSelectors.chatListItemWrapper}
    > ${siteSelectors.chatListEntry} {
    margin-bottom: 0;
  }
  ${threadsTabCondition} ${siteSelectors.chatList} > ${siteSelectors.chatListItemWrapper}:has(
      > ${siteSelectors.chatListEntry} ${siteSelectors.threadListEntryMentionCounterPair}
    ) {
    order: -1;
  }
  ${threadsTabCondition} ${siteSelectors.chatList}
    > ${siteSelectors.chatListItemWrapper}
    > ${siteSelectors.chatListEntry}:has(${siteSelectors.threadListEntryMentionCounterPair}) {
    box-shadow: inset 3px 0 0 var(${siteCustomPropertyNames.buttonPrimary});
  }
`
