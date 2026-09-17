import { storage, type StorageItemKey, type WxtStorageItem } from '#imports'
import type { FeatureMeta, FeatureSettingsDefinition } from '@/shared/feature/feature-types'
import type { Logger } from '@/shared/logging/logger'

/** Отдельный элемент хранения на функцию: миграции одной функции не задевают остальные */
export const FEATURE_SETTINGS_KEY_PREFIX = 'sync:feature.'

const SETTINGS_READ_FAILURE_MESSAGE =
  'Не удалось прочитать настройку функции, взято значение по умолчанию'

const ENABLED_FIELD_NAME = 'enabled'

export interface FeatureSettingsValue {
  enabled: boolean
}

/** Схема для функций без собственного settings.ts */
export const DEFAULT_FEATURE_SETTINGS: FeatureSettingsDefinition = {
  version: 1,
  migrations: {},
}

type FeatureSettingsItem = WxtStorageItem<FeatureSettingsValue, Record<string, unknown>>

export interface FeatureSettingsSource {
  getAllEnabled(): Promise<Map<string, boolean>>
  watchEnabled(featureMeta: FeatureMeta, callback: (isEnabled: boolean) => void): () => void
  setEnabled(featureMeta: FeatureMeta, isEnabled: boolean): Promise<void>
}

export interface FeatureSettingsSourceOptions {
  readonly featureMetas: readonly FeatureMeta[]
  readonly featureSettingsById: ReadonlyMap<string, FeatureSettingsDefinition>
  readonly logger: Logger
}

/**
 * Создаёт элемент хранения функции. Миграции запускает сам WXT при вызове defineItem,
 * поэтому элемент создаётся один раз на контекст и не кэшируется на уровне модуля.
 */
export function createFeatureSettingsItem(
  featureMeta: FeatureMeta,
  featureSettings: FeatureSettingsDefinition = DEFAULT_FEATURE_SETTINGS,
): FeatureSettingsItem {
  const storageKey: StorageItemKey = `${FEATURE_SETTINGS_KEY_PREFIX}${featureMeta.id}`
  return storage.defineItem<FeatureSettingsValue>(storageKey, {
    fallback: { enabled: featureMeta.defaultEnabled },
    version: featureSettings.version,
    migrations: featureSettings.migrations,
  })
}

/**
 * Приводит сохранённое значение к флагу. Наблюдение за хранилищем миграций не применяет,
 * поэтому значение чужой версии расширения не должно ломать функцию.
 */
export function readEnabledFlag(storedValue: unknown, featureMeta: FeatureMeta): boolean {
  if (
    typeof storedValue === 'object' &&
    storedValue !== null &&
    ENABLED_FIELD_NAME in storedValue
  ) {
    const { enabled } = storedValue as { enabled: unknown }
    if (typeof enabled === 'boolean') {
      return enabled
    }
  }
  return featureMeta.defaultEnabled
}

export function createFeatureSettingsSource({
  featureMetas,
  featureSettingsById,
  logger,
}: FeatureSettingsSourceOptions): FeatureSettingsSource {
  const settingsEntries = featureMetas.map((featureMeta) => ({
    featureMeta,
    item: createFeatureSettingsItem(featureMeta, featureSettingsById.get(featureMeta.id)),
  }))
  const itemsByFeatureId = new Map(
    settingsEntries.map(({ featureMeta, item }) => [featureMeta.id, item]),
  )

  function requireItem(featureMeta: FeatureMeta): FeatureSettingsItem {
    const item = itemsByFeatureId.get(featureMeta.id)
    return item ?? createFeatureSettingsItem(featureMeta, featureSettingsById.get(featureMeta.id))
  }

  return {
    /**
     * Читает каждый элемент отдельно: storage.getItems не ждёт миграций, а элемент, записанный
     * более новой версией расширения на другом устройстве, отклоняет чтение и не должен
     * выключать остальные функции.
     */
    async getAllEnabled() {
      const readResults = await Promise.allSettled(
        settingsEntries.map(({ item }) => item.getValue()),
      )
      const enabledByFeatureId = new Map<string, boolean>()

      readResults.forEach((readResult, entryIndex) => {
        const settingsEntry = settingsEntries[entryIndex]
        if (!settingsEntry) {
          return
        }
        if (readResult.status === 'rejected') {
          logger.warn(
            SETTINGS_READ_FAILURE_MESSAGE,
            settingsEntry.featureMeta.id,
            readResult.reason,
          )
          enabledByFeatureId.set(
            settingsEntry.featureMeta.id,
            settingsEntry.featureMeta.defaultEnabled,
          )
          return
        }
        enabledByFeatureId.set(
          settingsEntry.featureMeta.id,
          readEnabledFlag(readResult.value, settingsEntry.featureMeta),
        )
      })

      return enabledByFeatureId
    },

    watchEnabled(featureMeta, callback) {
      return requireItem(featureMeta).watch((newValue) => {
        callback(readEnabledFlag(newValue, featureMeta))
      })
    },

    async setEnabled(featureMeta, isEnabled) {
      await requireItem(featureMeta).setValue({ enabled: isEnabled })
    },
  }
}
