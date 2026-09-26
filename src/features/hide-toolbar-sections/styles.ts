import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { TOOLBAR_SECTIONS } from './settings'

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
}

/**
 * Каждая секция прячется своим признаком состояния на корне: контент-скрипт ставит
 * атрибут data-better-clouds-hide-toolbar-sections_<секция> для каждой скрытой секции,
 * runtime убирает все признаки при отключении функции. Секций всего шесть, поэтому
 * правила пишутся без @media-трюков
 */
export const featureStyles = css`
  ${TOOLBAR_SECTIONS.map(
    (section) => css`
      ${featureScope}[${createFeatureStateAttributeName(featureMeta.id, section.id)}] ${SECTION_SELECTOR_BY_ID[section.id]} {
        display: none;
      }
    `,
  ).join('\n')}
`
