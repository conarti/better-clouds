import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME,
} from '@/shared/feature/feature-scope'
import { OWNED_ELEMENT_MARKER_SEPARATOR } from '@/shared/feature/injected-elements'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import {
  createArchiveViewAttributeName,
  createLoadingMoreAttributeName,
} from './archive-stylesheet'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)
const archiveView = `[${createArchiveViewAttributeName(featureMeta.id)}]`
const loadingMore = `[${createLoadingMoreAttributeName(featureMeta.id)}]`

const ownedElement = `[${FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME}^="${featureMeta.id}${OWNED_ELEMENT_MARKER_SEPARATOR}"]`

/** Высота иконки в пунктах меню клиента: без иконки свой пункт был бы на 2px ниже */
const MENU_ITEM_ICON_HEIGHT = '20px'

/**
 * Запас высоты списка на время подгрузки. Клиент подгружает страницу, когда прокрутка дошла до
 * конца и ушла дальше прежнего максимума, а событие прокрутки приходит только при сдвиге.
 * Список не ниже окна плюс запас, и запас снизу: прокрутка до конца всегда сдвигается хотя бы
 * на него, даже если список уже стоял внизу или без запаса не прокручивался бы совсем
 */
const LOADING_MORE_EXTRA_HEIGHT = '1px'

/** Класс собственной кнопки подгрузки в конце списка в режиме архива */
export const LOAD_MORE_BUTTON_CLASS_NAME = 'better-clouds-archive-load-more'

/**
 * Статичная часть стилей: вид вкладки «Все чаты» и кнопки подгрузки в режиме архива. Режим
 * архива технически стоит на вкладке «Все чаты», поэтому её выделение (цвет и подчёркивание
 * ::after клиента) снимается, а выделенной выглядит вкладка «Архив». На время подгрузки список
 * получает запас высоты, скрытые записи при этом остаются скрытыми. Скрытие самих записей
 * зависит от списка id и собирается отдельно (archive-stylesheet.ts)
 */
export const featureStyles = css`
  ${featureScope}${archiveView} ${siteSelectors.chatListAllChatsTabButton} {
    color: var(${siteCustomPropertyNames.textSecondary});
  }
  ${featureScope}${archiveView} ${siteSelectors.chatListAllChatsTabButton}::after {
    content: none;
  }
  ${featureScope} ${siteSelectors.chatContextMenu} > ${ownedElement} > * {
    min-height: ${MENU_ITEM_ICON_HEIGHT};
    align-items: center;
  }
  ${featureScope} ${siteSelectors.chatList} > .${LOAD_MORE_BUTTON_CLASS_NAME} {
    display: block;
    width: 100%;
    margin: 8px 0;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(${siteCustomPropertyNames.buttonPrimary});
    font: inherit;
    cursor: pointer;
  }
  ${featureScope}${archiveView}${loadingMore} ${siteSelectors.chatList} {
    min-height: calc(100% + ${LOADING_MORE_EXTRA_HEIGHT});
    padding-bottom: ${LOADING_MORE_EXTRA_HEIGHT};
  }
  ${featureScope}:not(${archiveView}) ${siteSelectors.chatList} > .${LOAD_MORE_BUTTON_CLASS_NAME} {
    display: none;
  }
`
