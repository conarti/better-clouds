import { defineFeatureContent } from '@/shared/feature/define-feature'
import { createFeatureStateAttributeName } from '@/shared/feature/feature-scope'
import { logger } from '@/shared/logging/logger'
import { createFeatureSettingsItem } from '@/shared/settings/feature-settings'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { featureSettings, resolveHiddenSections, TOOLBAR_SECTIONS } from './settings'
import { featureStyles } from './styles'

const STATE_ATTRIBUTE_VALUE = ''

const SETTINGS_READ_FAILURE_MESSAGE = 'Не удалось прочитать скрытые секции, показаны все секции'

/**
 * JS-часть функции: стили прячут секции по признакам состояния на корне, а здесь эти
 * признаки ставятся по списку скрытых секций из настроек и обновляются при изменении.
 * Флаг enabled не читается — включённость функции runtime выразит атрибутом функции,
 * а все признаки состояния при отключении сам уберёт
 */
export default defineFeatureContent({
  meta: featureMeta,
  styles: featureStyles,
  anchorSelectors: [siteSelectors.toolbar],
  async mount({ documentRoot }) {
    const rootElement = documentRoot.documentElement
    const settingsItem = createFeatureSettingsItem(featureMeta, featureSettings)

    function applyHiddenSections(hiddenSections: readonly string[]): void {
      for (const { id: sectionId } of TOOLBAR_SECTIONS) {
        const stateAttributeName = createFeatureStateAttributeName(featureMeta.id, sectionId)
        if (hiddenSections.includes(sectionId)) {
          rootElement.setAttribute(stateAttributeName, STATE_ATTRIBUTE_VALUE)
        } else {
          rootElement.removeAttribute(stateAttributeName)
        }
      }
    }

    try {
      applyHiddenSections(resolveHiddenSections(await settingsItem.getValue()))
    } catch (readError) {
      logger.warn(SETTINGS_READ_FAILURE_MESSAGE, readError)
      applyHiddenSections([])
    }

    return settingsItem.watch((storedValue) => {
      applyHiddenSections(resolveHiddenSections(storedValue))
    })
  },
})
