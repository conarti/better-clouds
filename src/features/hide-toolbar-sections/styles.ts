import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { NOTIFICATION_DOT_VISIBILITY_PROPERTY } from '@/shared/feature/shared-custom-properties'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { BELL_COUNTER_SECTION_ID, BELL_SECTION_ID, TOOLBAR_SECTIONS } from './settings'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Селектор каждой секции из общих селекторов: секция определяется позицией среди детей
 * тулбара или стабильным классом, в разметке идентификаторов нет
 */
export const SECTION_SELECTOR_BY_ID: Readonly<Record<string, string>> = {
  main: siteSelectors.toolbarSectionMain,
  chats: siteSelectors.toolbarSectionChats,
  contacts: siteSelectors.toolbarSectionContacts,
  calls: siteSelectors.toolbarSectionCalls,
  smartapps: siteSelectors.toolbarSectionSmartapps,
  'smartapps-block': siteSelectors.toolbarSmartappSectionBlock,
  [BELL_COUNTER_SECTION_ID]: siteSelectors.toolbarNotificationsButtonBadge,
  [BELL_SECTION_ID]: siteSelectors.toolbarNotificationsButton,
}

const HIDDEN_DOT_VISIBILITY = '0'

/**
 * Каждая секция прячется своим признаком состояния на корне: контент-скрипт ставит
 * атрибут data-better-clouds-hide-toolbar-sections_<секция> для каждой скрытой секции,
 * runtime убирает все признаки при отключении функции. Секций немного, поэтому
 * правила пишутся без @media-трюков. Скрытый колокольчик или счётчик гасит точку
 * непрочитанных у autohide-toolbar через общее свойство: бейдж остаётся в разметке,
 * и точка без этого продолжала бы на него реагировать
 */
export const featureStyles = css`
  ${TOOLBAR_SECTIONS.map(
    (section) => css`
      ${featureScope}[${createFeatureStateAttributeName(featureMeta.id, section.id)}] ${SECTION_SELECTOR_BY_ID[section.id]} {
        display: none;
      }
    `,
  ).join('\n')}
  ${featureScope}[${createFeatureStateAttributeName(featureMeta.id, BELL_COUNTER_SECTION_ID)}],
  ${featureScope}[${createFeatureStateAttributeName(featureMeta.id, BELL_SECTION_ID)}] {
    ${NOTIFICATION_DOT_VISIBILITY_PROPERTY}: ${HIDDEN_DOT_VISIBILITY};
  }
`
