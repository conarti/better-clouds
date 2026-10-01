import { defineFeatureContent } from '@/shared/feature/define-feature'
import { logger } from '@/shared/logging/logger'
import {
  areDiscoveredValuesEqual,
  createDiscoveredValuesItem,
  normalizeDiscoveredValues,
  readDiscoveredValues,
  type DiscoveredValues,
} from '@/shared/settings/discovered-values'
import { createFeatureSettingsItem } from '@/shared/settings/feature-settings'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { featureSettings, resolveSelectedTagNames } from './settings'
import { createTabPositionAttributeName, featureStyles, MAXIMUM_TAB_POSITION_COUNT } from './styles'
import { computeSelectedTabPositions, findUserTagTabs } from './tag-tabs'

const STATE_ATTRIBUTE_VALUE = ''
const FIRST_TAB_POSITION = 1

/**
 * Список вкладок появляется после загрузки клиента и может пересоздаваться при смене экрана.
 * Наблюдать ради этого за всем документом дорого, поэтому список перепроверяется редким
 * интервалом, а за самим списком следит узкий наблюдатель
 */
const TABS_LIST_CHECK_INTERVAL_MILLISECONDS = 1000

/** Имя тега меняется текстом подписи, состав вкладок меняется детьми списка */
const TABS_LIST_MUTATION_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
}

const SETTINGS_READ_FAILURE_MESSAGE =
  'Не удалось прочитать выбранные теги, порядок вкладок не меняется'
const DISCOVERED_READ_FAILURE_MESSAGE = 'Не удалось прочитать обнаруженные теги'
const DISCOVERED_WRITE_FAILURE_MESSAGE = 'Не удалось сохранить обнаруженные теги'

/**
 * JS-часть функции: находит вкладки пользовательских тегов, сохраняет их имена в storage.local
 * для попапа и ставит на корень признаки позиций выбранных тегов. Стили по этим признакам
 * ставят выбранные вкладки первыми. Признаки состояния при отключении убирает runtime
 */
export default defineFeatureContent({
  meta: featureMeta,
  styles: featureStyles,
  anchorSelectors: [siteSelectors.chatListTabsList],
  async mount({ documentRoot, lifecycle }) {
    const rootElement = documentRoot.documentElement
    const settingsItem = createFeatureSettingsItem(featureMeta, featureSettings)
    const discoveredValuesItem = createDiscoveredValuesItem(featureMeta)

    let selectedTagNames: readonly string[] = []
    let storedDiscoveredValues: DiscoveredValues | null = null
    let observedTabsList: Element | null = null
    let disconnectTabsListObserver: (() => void) | null = null

    function applySelectedTabPositions(selectedPositions: readonly number[]): void {
      for (let position = FIRST_TAB_POSITION; position <= MAXIMUM_TAB_POSITION_COUNT; position++) {
        const attributeName = createTabPositionAttributeName(position)
        if (selectedPositions.includes(position)) {
          rootElement.setAttribute(attributeName, STATE_ATTRIBUTE_VALUE)
        } else {
          rootElement.removeAttribute(attributeName)
        }
      }
    }

    /* Пишем только изменившийся снимок: лишние записи будили бы попап и наблюдателей */
    function storeDiscoveredValues(discoveredValues: DiscoveredValues): void {
      if (
        storedDiscoveredValues !== null &&
        areDiscoveredValuesEqual(storedDiscoveredValues, discoveredValues)
      ) {
        return
      }
      storedDiscoveredValues = discoveredValues
      discoveredValuesItem.setValue(discoveredValues).catch((writeError: unknown) => {
        logger.warn(DISCOVERED_WRITE_FAILURE_MESSAGE, writeError)
      })
    }

    function refreshTabs(): void {
      if (observedTabsList === null) {
        applySelectedTabPositions([])
        return
      }
      const userTagTabs = findUserTagTabs(observedTabsList)
      applySelectedTabPositions(computeSelectedTabPositions(userTagTabs, selectedTagNames))
      storeDiscoveredValues(
        normalizeDiscoveredValues(userTagTabs.map((userTagTab) => userTagTab.name)),
      )
    }

    function observeCurrentTabsList(): void {
      const tabsList = documentRoot.querySelector(siteSelectors.chatListTabsList)
      if (tabsList === observedTabsList) {
        return
      }
      disconnectTabsListObserver?.()
      disconnectTabsListObserver = null
      observedTabsList = tabsList
      if (tabsList !== null) {
        disconnectTabsListObserver = lifecycle.observeMutations(
          tabsList,
          refreshTabs,
          TABS_LIST_MUTATION_OPTIONS,
        )
      }
      refreshTabs()
    }

    try {
      selectedTagNames = resolveSelectedTagNames(await settingsItem.getValue())
    } catch (readError) {
      logger.warn(SETTINGS_READ_FAILURE_MESSAGE, readError)
    }
    try {
      storedDiscoveredValues = readDiscoveredValues(await discoveredValuesItem.getValue())
    } catch (readError) {
      logger.warn(DISCOVERED_READ_FAILURE_MESSAGE, readError)
    }

    observeCurrentTabsList()
    lifecycle.setInterval(observeCurrentTabsList, TABS_LIST_CHECK_INTERVAL_MILLISECONDS)

    return settingsItem.watch((storedValue) => {
      selectedTagNames = resolveSelectedTagNames(storedValue)
      refreshTabs()
    })
  },
})
