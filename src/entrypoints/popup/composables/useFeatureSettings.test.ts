import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { useFeatureSettings, type FeatureSettingsState } from './useFeatureSettings'
import type { FeatureMeta } from '@/shared/feature/feature-types'

const STUB_FEATURE_META: FeatureMeta = {
  id: 'stub-feature',
  title: 'Заглушка функции',
  description: 'Функция-заглушка для тестов попапа',
  defaultEnabled: true,
}

const FEATURE_METAS = [STUB_FEATURE_META]
const STORAGE_AREA_KEY = `feature.${STUB_FEATURE_META.id}`

async function withFeatureSettings(
  assertion: (featureSettings: FeatureSettingsState) => Promise<void>,
): Promise<void> {
  const scope = effectScope()
  const featureSettings = scope.run(() => useFeatureSettings(FEATURE_METAS))
  if (featureSettings === undefined) {
    throw new Error('Не удалось создать состояние настроек')
  }
  try {
    await assertion(featureSettings)
  } finally {
    scope.stop()
  }
}

describe('useFeatureSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('до загрузки отдаёт значения по умолчанию и снимает флаг загрузки', async () => {
    await withFeatureSettings(async (featureSettings) => {
      expect(featureSettings.isLoaded.value).toBe(false)
      expect(featureSettings.enabledByFeatureId.value[STUB_FEATURE_META.id]).toBe(true)

      await vi.waitFor(() => {
        expect(featureSettings.isLoaded.value).toBe(true)
      })
    })
  })

  it('запись переключателя сохраняется в хранилище', async () => {
    await withFeatureSettings(async (featureSettings) => {
      await vi.waitFor(() => {
        expect(featureSettings.isLoaded.value).toBe(true)
      })
      await featureSettings.setFeatureEnabled(STUB_FEATURE_META.id, false)

      expect(featureSettings.enabledByFeatureId.value[STUB_FEATURE_META.id]).toBe(false)
      const storedRecord = await fakeBrowser.storage.sync.get(STORAGE_AREA_KEY)
      expect(storedRecord[STORAGE_AREA_KEY]).toEqual({ enabled: false })
    })
  })

  it('внешнее изменение настройки приходит в попап', async () => {
    await withFeatureSettings(async (featureSettings) => {
      await fakeBrowser.storage.sync.set({ [STORAGE_AREA_KEY]: { enabled: false } })

      await vi.waitFor(() => {
        expect(featureSettings.enabledByFeatureId.value[STUB_FEATURE_META.id]).toBe(false)
      })
    })
  })
})
