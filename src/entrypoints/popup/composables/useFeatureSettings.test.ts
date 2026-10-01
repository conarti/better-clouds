import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { useFeatureSettings, type FeatureSettingsState } from './useFeatureSettings'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import tagTabsFirstMeta from '@/features/tag-tabs-first/meta'

const STUB_FEATURE_META: FeatureMeta = {
  id: 'stub-feature',
  title: 'Заглушка функции',
  description: 'Функция-заглушка для тестов попапа',
  defaultEnabled: true,
}

const FEATURE_METAS = [STUB_FEATURE_META]
const STORAGE_AREA_KEY = `feature.${STUB_FEATURE_META.id}`
const STORAGE_FAILURE_MESSAGE = 'Хранилище недоступно'

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

  it('при ошибке записи тумблер возвращается к прежнему значению', async () => {
    await withFeatureSettings(async (featureSettings) => {
      await vi.waitFor(() => {
        expect(featureSettings.isLoaded.value).toBe(true)
      })
      const failingWrite = vi
        .spyOn(fakeBrowser.storage.sync, 'set')
        .mockRejectedValue(new Error(STORAGE_FAILURE_MESSAGE))

      try {
        await featureSettings.setFeatureEnabled(STUB_FEATURE_META.id, false)
        expect(featureSettings.enabledByFeatureId.value[STUB_FEATURE_META.id]).toBe(true)
      } finally {
        failingWrite.mockRestore()
      }

      const storedRecord = await fakeBrowser.storage.sync.get(STORAGE_AREA_KEY)
      expect(storedRecord[STORAGE_AREA_KEY]).toBeUndefined()
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

  describe('обнаруженные значения', () => {
    const DISCOVERED_STORAGE_KEY = `feature.${tagTabsFirstMeta.id}.discovered`
    const FIRST_TAG_NAME = 'Работа'
    const SECOND_TAG_NAME = 'Семья'

    async function withDiscoveringFeature(
      assertion: (featureSettings: FeatureSettingsState) => Promise<void>,
    ): Promise<void> {
      const scope = effectScope()
      const featureSettings = scope.run(() => useFeatureSettings([tagTabsFirstMeta]))
      if (featureSettings === undefined) {
        throw new Error('Не удалось создать состояние настроек')
      }
      try {
        await assertion(featureSettings)
      } finally {
        scope.stop()
      }
    }

    it('читает последний снимок из storage.local и следит за ним', async () => {
      await fakeBrowser.storage.local.set({
        [DISCOVERED_STORAGE_KEY]: { values: [FIRST_TAG_NAME], isTruncated: false },
      })

      await withDiscoveringFeature(async (featureSettings) => {
        await vi.waitFor(() => {
          expect(featureSettings.discoveredValuesByFeatureId.value[tagTabsFirstMeta.id]).toEqual({
            values: [FIRST_TAG_NAME],
            isTruncated: false,
          })
        })

        await fakeBrowser.storage.local.set({
          [DISCOVERED_STORAGE_KEY]: {
            values: [FIRST_TAG_NAME, SECOND_TAG_NAME],
            isTruncated: false,
          },
        })
        await vi.waitFor(() => {
          expect(
            featureSettings.discoveredValuesByFeatureId.value[tagTabsFirstMeta.id]?.values,
          ).toEqual([FIRST_TAG_NAME, SECOND_TAG_NAME])
        })
      })
    })

    it('функции без опций из обнаруженного снимка не получают', async () => {
      await withFeatureSettings(async (featureSettings) => {
        await vi.waitFor(() => {
          expect(featureSettings.isLoaded.value).toBe(true)
        })
        expect(featureSettings.discoveredValuesByFeatureId.value).toEqual({})
      })
    })

    it('выбранные теги сохраняются в sync параметром функции', async () => {
      await withDiscoveringFeature(async (featureSettings) => {
        await vi.waitFor(() => {
          expect(featureSettings.isLoaded.value).toBe(true)
        })
        await featureSettings.setFeatureOptions(tagTabsFirstMeta.id, {
          selectedTagNames: [SECOND_TAG_NAME],
        })

        const storageKey = `feature.${tagTabsFirstMeta.id}`
        const storedRecord = await fakeBrowser.storage.sync.get(storageKey)
        expect(storedRecord[storageKey]).toEqual({
          enabled: false,
          selectedTagNames: [SECOND_TAG_NAME],
        })
      })
    })
  })
})
