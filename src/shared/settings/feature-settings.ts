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

/**
 * Параметры функции, прозрачные для общего слоя: содержимое интерпретирует только
 * владелец схемы (settings.ts функции). Ключи не должны конфликтовать с enabled
 */
export type FeatureSettingsOptions = Record<string, unknown>

/** Полное хранимое значение: флаг и параметры функции */
export type FeatureSettingsStoredValue = FeatureSettingsValue & FeatureSettingsOptions

/** Схема для функций без собственного settings.ts */
export const DEFAULT_FEATURE_SETTINGS: FeatureSettingsDefinition = {
  version: 1,
  migrations: {},
}

type FeatureSettingsItem = WxtStorageItem<FeatureSettingsStoredValue, Record<string, unknown>>

export interface FeatureSettingsSource {
  getAllEnabled(): Promise<Map<string, boolean>>
  watchEnabled(featureMeta: FeatureMeta, callback: (isEnabled: boolean) => void): () => void
  setEnabled(featureMeta: FeatureMeta, isEnabled: boolean): Promise<void>
  /** Читает полное хранимое значение: флаг и параметры функции */
  getValue(featureMeta: FeatureMeta): Promise<FeatureSettingsStoredValue>
  /**
   * Сливает патч параметров в хранимое значение, флаг enabled не трогает. Читает
   * актуальное значение, чтобы не затереть параметры, записанные другим контекстом
   */
  updateValue(featureMeta: FeatureMeta, optionsPatch: FeatureSettingsOptions): Promise<void>
  /** Наблюдает за полным хранимым значением, отдаёт его целиком на каждое изменение */
  watchValue(
    featureMeta: FeatureMeta,
    callback: (value: FeatureSettingsStoredValue) => void,
  ): () => void
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
  return storage.defineItem<FeatureSettingsStoredValue>(storageKey, {
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

  /**
   * Читает хранимое значение с откатом на fallback: отклонённое чтение чужой версии не
   * должно ломать запись, достаточно значения по умолчанию как базы для слияния
   */
  async function readStoredValue(
    featureMeta: FeatureMeta,
    item: FeatureSettingsItem,
  ): Promise<FeatureSettingsStoredValue> {
    try {
      return await item.getValue()
    } catch (readError) {
      logger.warn(SETTINGS_READ_FAILURE_MESSAGE, featureMeta.id, readError)
      return { enabled: featureMeta.defaultEnabled }
    }
  }

  return {
    /**
     * Читает каждый элемент отдельно: storage.getItems не ждёт миграций, а элемент, записанный
     * более новой версией расширения на другом устройстве, отклоняет чтение и не должен
     * выключать остальные функции.
     */
    async getAllEnabled() {
      const enabledEntries = await Promise.all(
        settingsEntries.map(async ({ featureMeta, item }): Promise<[string, boolean]> => {
          try {
            return [featureMeta.id, readEnabledFlag(await item.getValue(), featureMeta)]
          } catch (readError) {
            logger.warn(SETTINGS_READ_FAILURE_MESSAGE, featureMeta.id, readError)
            return [featureMeta.id, featureMeta.defaultEnabled]
          }
        }),
      )

      return new Map(enabledEntries)
    },

    watchEnabled(featureMeta, callback) {
      return requireItem(featureMeta).watch((newValue) => {
        callback(readEnabledFlag(newValue, featureMeta))
      })
    },

    async setEnabled(featureMeta, isEnabled) {
      const item = requireItem(featureMeta)
      const currentValue = await readStoredValue(featureMeta, item)
      await item.setValue({ ...currentValue, enabled: isEnabled })
    },

    async getValue(featureMeta) {
      const item = requireItem(featureMeta)
      return readStoredValue(featureMeta, item)
    },

    async updateValue(featureMeta, optionsPatch) {
      const item = requireItem(featureMeta)
      const currentValue = await readStoredValue(featureMeta, item)
      const nextValue: FeatureSettingsStoredValue = {
        ...currentValue,
        ...optionsPatch,
        /* enabled не из патча: флаг меняется только через setEnabled */
        enabled: readEnabledFlag(currentValue, featureMeta),
      }
      await item.setValue(nextValue)
    },

    watchValue(featureMeta, callback) {
      return requireItem(featureMeta).watch((newValue) => {
        callback(newValue as FeatureSettingsStoredValue)
      })
    },
  }
}
