import { onScopeDispose, readonly, ref, type DeepReadonly, type Ref } from 'vue'
import { featureMetaRegistry } from '@/features/registry'
import { featureSettingsRegistry } from '@/features/settings-registry'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import { logger } from '@/shared/logging/logger'
import {
  createFeatureSettingsSource,
  readEnabledFlag,
  type FeatureSettingsOptions,
  type FeatureSettingsStoredValue,
} from '@/shared/settings/feature-settings'

const SETTINGS_WRITE_FAILURE_MESSAGE = 'Не удалось сохранить настройку функции'

export interface FeatureSettingsState {
  readonly enabledByFeatureId: DeepReadonly<Ref<Record<string, boolean>>>
  /**
   * Полные хранимые значения функций: флаг и параметры. Параметры прозрачны для общего
   * слоя, интерпретирует их только владелец схемы (settings.ts функции)
   */
  readonly storedValuesByFeatureId: DeepReadonly<Ref<Record<string, FeatureSettingsStoredValue>>>
  readonly isLoaded: Readonly<Ref<boolean>>
  setFeatureEnabled(featureId: string, isEnabled: boolean): Promise<void>
  setFeatureOptions(featureId: string, options: FeatureSettingsOptions): Promise<void>
}

/**
 * Один источник настроек на попап: элементы хранения создаются внутри него, поэтому
 * на уровне модуля скрытого состояния нет.
 */
export function useFeatureSettings(
  featureMetas: readonly FeatureMeta[] = featureMetaRegistry,
): FeatureSettingsState {
  const settingsSource = createFeatureSettingsSource({
    featureMetas,
    featureSettingsById: featureSettingsRegistry,
    logger,
  })
  const featureMetaById = new Map(featureMetas.map((featureMeta) => [featureMeta.id, featureMeta]))
  const enabledByFeatureId = ref<Record<string, boolean>>(
    Object.fromEntries(
      featureMetas.map((featureMeta) => [featureMeta.id, featureMeta.defaultEnabled]),
    ),
  )
  const storedValuesByFeatureId = ref<Record<string, FeatureSettingsStoredValue>>(
    Object.fromEntries(
      featureMetas.map((featureMeta) => [featureMeta.id, { enabled: featureMeta.defaultEnabled }]),
    ),
  )
  const isLoaded = ref(false)

  const knownFeatureIds = new Set<string>()

  const unwatchCallbacks = featureMetas.map((featureMeta) =>
    settingsSource.watchValue(featureMeta, (storedValue) => {
      knownFeatureIds.add(featureMeta.id)
      enabledByFeatureId.value = {
        ...enabledByFeatureId.value,
        [featureMeta.id]: readEnabledFlag(storedValue, featureMeta),
      }
      storedValuesByFeatureId.value = {
        ...storedValuesByFeatureId.value,
        [featureMeta.id]: storedValue,
      }
    }),
  )

  onScopeDispose(() => {
    for (const unwatch of unwatchCallbacks) {
      unwatch()
    }
  })

  /* Значения, пришедшие во время чтения, свежее снимка, поэтому чтение их не перетирает */
  void Promise.all([
    settingsSource.getAllEnabled(),
    Promise.all(featureMetas.map((featureMeta) => settingsSource.getValue(featureMeta))),
  ]).then(([loadedEnabledByFeatureId, loadedStoredValues]) => {
    const loadedEntries = [...loadedEnabledByFeatureId].filter(
      ([featureId]) => !knownFeatureIds.has(featureId),
    )
    enabledByFeatureId.value = {
      ...enabledByFeatureId.value,
      ...Object.fromEntries(loadedEntries),
    }
    const loadedStoredEntries: Array<readonly [string, FeatureSettingsStoredValue]> = []
    loadedStoredValues.forEach((storedValue, index) => {
      const featureMeta = featureMetas[index]
      if (featureMeta !== undefined && !knownFeatureIds.has(featureMeta.id)) {
        loadedStoredEntries.push([featureMeta.id, storedValue])
      }
    })
    storedValuesByFeatureId.value = {
      ...storedValuesByFeatureId.value,
      ...Object.fromEntries(loadedStoredEntries),
    }
    isLoaded.value = true
  })

  /**
   * Значение меняется сразу, чтобы тумблер не ждал хранилища. Если запись не удалась,
   * прежнее значение возвращается, а функция снова считается непрочитанной: иначе тумблер
   * показывал бы состояние, которого в хранилище нет, и чтение не могло бы его поправить.
   */
  async function setFeatureEnabled(featureId: string, isEnabled: boolean): Promise<void> {
    const featureMeta = featureMetaById.get(featureId)
    if (featureMeta === undefined) {
      return
    }
    const previousEnabled = enabledByFeatureId.value[featureId] ?? featureMeta.defaultEnabled
    knownFeatureIds.add(featureId)
    enabledByFeatureId.value = { ...enabledByFeatureId.value, [featureId]: isEnabled }
    try {
      await settingsSource.setEnabled(featureMeta, isEnabled)
    } catch (writeError) {
      logger.error(SETTINGS_WRITE_FAILURE_MESSAGE, featureId, writeError)
      knownFeatureIds.delete(featureId)
      enabledByFeatureId.value = { ...enabledByFeatureId.value, [featureId]: previousEnabled }
    }
  }

  /**
   * Тумблеры секций меняются сразу, чтобы не ждать хранилища; флаг enabled не трогается,
   * общий слой слияет патч с актуальным значением
   */
  async function setFeatureOptions(
    featureId: string,
    options: FeatureSettingsOptions,
  ): Promise<void> {
    const featureMeta = featureMetaById.get(featureId)
    if (featureMeta === undefined) {
      return
    }
    const previousStoredValue = storedValuesByFeatureId.value[featureId]
    if (previousStoredValue === undefined) {
      return
    }
    const nextStoredValue: FeatureSettingsStoredValue = { ...previousStoredValue, ...options }
    knownFeatureIds.add(featureId)
    storedValuesByFeatureId.value = {
      ...storedValuesByFeatureId.value,
      [featureId]: nextStoredValue,
    }
    try {
      await settingsSource.updateValue(featureMeta, options)
    } catch (writeError) {
      logger.error(SETTINGS_WRITE_FAILURE_MESSAGE, featureId, writeError)
      knownFeatureIds.delete(featureId)
      storedValuesByFeatureId.value = {
        ...storedValuesByFeatureId.value,
        [featureId]: previousStoredValue,
      }
    }
  }

  return {
    enabledByFeatureId: readonly(enabledByFeatureId),
    storedValuesByFeatureId: readonly(storedValuesByFeatureId),
    isLoaded: readonly(isLoaded),
    setFeatureEnabled,
    setFeatureOptions,
  }
}
