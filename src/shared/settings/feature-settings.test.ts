import { storage } from '#imports'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  createFeatureSettingsItem,
  createFeatureSettingsSource,
  FEATURE_SETTINGS_KEY_PREFIX,
  readEnabledFlag,
  type FeatureSettingsSource,
  type FeatureSettingsValue,
} from './feature-settings'
import type { FeatureMeta, FeatureSettingsDefinition } from '@/shared/feature/feature-types'
import type { Logger } from '@/shared/logging/logger'

const FIRST_FEATURE_META: FeatureMeta = {
  id: 'first-stub-feature',
  title: 'Первая заглушка',
  description: 'Заглушка для тестов настроек',
  defaultEnabled: true,
}

const SECOND_FEATURE_META: FeatureMeta = {
  id: 'second-stub-feature',
  title: 'Вторая заглушка',
  description: 'Вторая заглушка для тестов настроек',
  defaultEnabled: false,
}

const FEATURE_METAS = [FIRST_FEATURE_META, SECOND_FEATURE_META]
const EMPTY_SETTINGS_REGISTRY = new Map<string, FeatureSettingsDefinition>()
const SYNC_AREA_PREFIX = 'sync:'
const MIGRATED_VERSION = 2

function createTestLogger(): Logger {
  return { warn: vi.fn(), error: vi.fn() }
}

function createSource(logger: Logger = createTestLogger()): FeatureSettingsSource {
  return createFeatureSettingsSource({
    featureMetas: FEATURE_METAS,
    featureSettingsById: EMPTY_SETTINGS_REGISTRY,
    logger,
  })
}

function readStorageAreaKey(featureMeta: FeatureMeta): string {
  return `${FEATURE_SETTINGS_KEY_PREFIX}${featureMeta.id}`.slice(SYNC_AREA_PREFIX.length)
}

describe('feature-settings', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
  })

  it('хранит значение под ключом области sync с префиксом функции', async () => {
    const source = createSource()

    await source.setEnabled(FIRST_FEATURE_META, false)

    const storageAreaKey = readStorageAreaKey(FIRST_FEATURE_META)
    const storedRecord = await fakeBrowser.storage.sync.get(storageAreaKey)
    expect(storedRecord[storageAreaKey]).toEqual({ enabled: false })
  })

  it('без записи возвращает значение по умолчанию каждой функции', async () => {
    const source = createSource()

    const enabledByFeatureId = await source.getAllEnabled()

    expect(enabledByFeatureId.get(FIRST_FEATURE_META.id)).toBe(true)
    expect(enabledByFeatureId.get(SECOND_FEATURE_META.id)).toBe(false)
  })

  it('читает записанное значение', async () => {
    const source = createSource()

    await source.setEnabled(SECOND_FEATURE_META, true)
    const enabledByFeatureId = await source.getAllEnabled()

    expect(enabledByFeatureId.get(SECOND_FEATURE_META.id)).toBe(true)
  })

  it('наблюдение получает новое значение, а после удаления ключа значение по умолчанию', async () => {
    const source = createSource()
    const observedValues: boolean[] = []
    const unwatch = source.watchEnabled(FIRST_FEATURE_META, (isEnabled) => {
      observedValues.push(isEnabled)
    })

    await source.setEnabled(FIRST_FEATURE_META, false)
    await createFeatureSettingsItem(FIRST_FEATURE_META).removeValue()
    unwatch()

    expect(observedValues).toEqual([false, FIRST_FEATURE_META.defaultEnabled])
  })

  it('отклонённое чтение одной функции не мешает остальным и пишет одно предупреждение', async () => {
    const logger = createTestLogger()
    const defineItemWithoutSpy = storage.defineItem.bind(storage)
    const failingStorageKey = `${FEATURE_SETTINGS_KEY_PREFIX}${FIRST_FEATURE_META.id}`
    vi.spyOn(storage, 'defineItem').mockImplementation(((
      storageKey: Parameters<typeof storage.defineItem>[0],
      options: Parameters<typeof storage.defineItem>[1],
    ) => {
      const storageItem = defineItemWithoutSpy(storageKey, options)
      if (storageKey !== failingStorageKey) {
        return storageItem
      }
      return {
        ...storageItem,
        getValue: () => Promise.reject(new Error('Хранилище недоступно')),
      }
    }) as typeof storage.defineItem)

    const source = createSource(logger)
    const enabledByFeatureId = await source.getAllEnabled()

    expect(enabledByFeatureId.get(FIRST_FEATURE_META.id)).toBe(FIRST_FEATURE_META.defaultEnabled)
    expect(enabledByFeatureId.get(SECOND_FEATURE_META.id)).toBe(SECOND_FEATURE_META.defaultEnabled)
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('данные более новой схемы не ломают чтение остальных функций', async () => {
    const newerSchema: FeatureSettingsDefinition = { version: MIGRATED_VERSION, migrations: {} }
    await createFeatureSettingsItem(FIRST_FEATURE_META, newerSchema).setValue({ enabled: false })
    await createFeatureSettingsItem(SECOND_FEATURE_META).setValue({ enabled: true })

    const source = createSource()
    const enabledByFeatureId = await source.getAllEnabled()

    expect(enabledByFeatureId.get(SECOND_FEATURE_META.id)).toBe(true)
    expect(enabledByFeatureId.has(FIRST_FEATURE_META.id)).toBe(true)
  })

  it('нормализует значение чужой версии', () => {
    expect(readEnabledFlag({}, FIRST_FEATURE_META)).toBe(true)
    expect(readEnabledFlag(null, FIRST_FEATURE_META)).toBe(true)
    expect(readEnabledFlag({ enabled: 'yes' }, SECOND_FEATURE_META)).toBe(false)
    expect(readEnabledFlag({ enabled: false }, FIRST_FEATURE_META)).toBe(false)
  })

  it('setEnabled не затирает параметры, записанные другим контекстом', async () => {
    await createFeatureSettingsItem(FIRST_FEATURE_META).setValue({
      enabled: true,
      hidden: ['main'],
    })
    const source = createSource()

    await source.setEnabled(FIRST_FEATURE_META, false)

    expect(await createFeatureSettingsItem(FIRST_FEATURE_META).getValue()).toEqual({
      enabled: false,
      hidden: ['main'],
    })
  })

  it('updateValue сливает параметры, не трогая флаг enabled', async () => {
    const source = createSource()
    await source.setEnabled(FIRST_FEATURE_META, false)

    await source.updateValue(FIRST_FEATURE_META, { hidden: ['chats'] })

    expect(await source.getValue(FIRST_FEATURE_META)).toEqual({
      enabled: false,
      hidden: ['chats'],
    })
  })

  it('updateValue заменяет параметр того же имени', async () => {
    const source = createSource()
    await source.updateValue(FIRST_FEATURE_META, { hidden: ['chats'] })

    await source.updateValue(FIRST_FEATURE_META, { hidden: [] })

    expect(await source.getValue(FIRST_FEATURE_META)).toEqual({
      enabled: FIRST_FEATURE_META.defaultEnabled,
      hidden: [],
    })
  })

  it('watchValue отдаёт полное значение на каждое изменение', async () => {
    const source = createSource()
    const observedValues: Array<Record<string, unknown>> = []
    const unwatch = source.watchValue(FIRST_FEATURE_META, (value) => {
      observedValues.push(value)
    })

    await source.updateValue(FIRST_FEATURE_META, { hidden: ['calls'] })
    await source.setEnabled(FIRST_FEATURE_META, false)
    unwatch()

    expect(observedValues).toEqual([
      { enabled: FIRST_FEATURE_META.defaultEnabled, hidden: ['calls'] },
      { enabled: false, hidden: ['calls'] },
    ])
  })

  it('фабрика передаёт схему функции в элемент хранения', async () => {
    await createFeatureSettingsItem(SECOND_FEATURE_META).setValue({ enabled: false })
    const migrateEnabledFlag = vi.fn(() => ({ enabled: true }))

    const migratedItem = createFeatureSettingsItem(SECOND_FEATURE_META, {
      version: MIGRATED_VERSION,
      migrations: { [MIGRATED_VERSION]: migrateEnabledFlag },
    })

    await expect(migratedItem.getValue()).resolves.toEqual({ enabled: true })
    expect(migrateEnabledFlag).toHaveBeenCalledTimes(1)
  })

  it('миграция выполняется ровно один раз при следующем старте', async () => {
    await createFeatureSettingsItem(SECOND_FEATURE_META).setValue({ enabled: false })
    const migrateEnabledFlag = vi.fn(() => ({ enabled: true }))
    const migratedSettings: FeatureSettingsDefinition = {
      version: MIGRATED_VERSION,
      migrations: { [MIGRATED_VERSION]: migrateEnabledFlag },
    }
    await createFeatureSettingsItem(SECOND_FEATURE_META, migratedSettings).getValue()
    const storageSnapshot = await fakeBrowser.storage.sync.get(null)

    vi.resetModules()
    const nextSettingsModule = await import('@/shared/settings/feature-settings')
    const nextFakeBrowserModule = await import('wxt/testing/fake-browser')
    if (nextFakeBrowserModule.fakeBrowser !== fakeBrowser) {
      await nextFakeBrowserModule.fakeBrowser.storage.sync.set(storageSnapshot)
    }
    const nextStartValue = await nextSettingsModule
      .createFeatureSettingsItem(SECOND_FEATURE_META, migratedSettings)
      .getValue()

    expect(nextStartValue).toEqual({ enabled: true } satisfies FeatureSettingsValue)
    expect(migrateEnabledFlag).toHaveBeenCalledTimes(1)
  })
})
