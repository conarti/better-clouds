import { onScopeDispose, readonly, ref, type DeepReadonly, type Ref } from 'vue'
import { featureMetaRegistry } from '@/features/registry'
import { featureSettingsRegistry } from '@/features/settings-registry'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import { logger } from '@/shared/logging/logger'
import { createFeatureSettingsSource } from '@/shared/settings/feature-settings'

const SETTINGS_WRITE_FAILURE_MESSAGE = 'Не удалось сохранить настройку функции'

export interface FeatureSettingsState {
  readonly enabledByFeatureId: DeepReadonly<Ref<Record<string, boolean>>>
  readonly isLoaded: Readonly<Ref<boolean>>
  setFeatureEnabled(featureId: string, isEnabled: boolean): Promise<void>
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
  const isLoaded = ref(false)

  const knownFeatureIds = new Set<string>()

  const unwatchCallbacks = featureMetas.map((featureMeta) =>
    settingsSource.watchEnabled(featureMeta, (isEnabled) => {
      knownFeatureIds.add(featureMeta.id)
      enabledByFeatureId.value = { ...enabledByFeatureId.value, [featureMeta.id]: isEnabled }
    }),
  )

  onScopeDispose(() => {
    for (const unwatch of unwatchCallbacks) {
      unwatch()
    }
  })

  /* Значения, пришедшие во время чтения, свежее снимка, поэтому чтение их не перетирает */
  void settingsSource.getAllEnabled().then((loadedEnabledByFeatureId) => {
    const loadedEntries = [...loadedEnabledByFeatureId].filter(
      ([featureId]) => !knownFeatureIds.has(featureId),
    )
    enabledByFeatureId.value = {
      ...enabledByFeatureId.value,
      ...Object.fromEntries(loadedEntries),
    }
    isLoaded.value = true
  })

  async function setFeatureEnabled(featureId: string, isEnabled: boolean): Promise<void> {
    const featureMeta = featureMetaById.get(featureId)
    if (featureMeta === undefined) {
      return
    }
    knownFeatureIds.add(featureId)
    enabledByFeatureId.value = { ...enabledByFeatureId.value, [featureId]: isEnabled }
    try {
      await settingsSource.setEnabled(featureMeta, isEnabled)
    } catch (writeError) {
      logger.error(SETTINGS_WRITE_FAILURE_MESSAGE, featureId, writeError)
    }
  }

  return {
    enabledByFeatureId: readonly(enabledByFeatureId),
    isLoaded: readonly(isLoaded),
    setFeatureEnabled,
  }
}
