import { FEATURE_SETTINGS_KEY_PREFIX } from './feature-settings'

/** Лимит chrome.storage.sync на один элемент: ключ плюс JSON значения в UTF-8 */
export const SYNC_QUOTA_BYTES_PER_ITEM = 8192

/** Запас под служебные поля WXT и погрешность подсчёта браузера */
export const SYNC_QUOTA_SAFETY_MARGIN_BYTES = 256

const STORAGE_AREA_SEPARATOR = ':'

/** Ключ элемента настроек функции в chrome.storage, без префикса области WXT */
function createSyncStorageKey(featureId: string): string {
  const prefixWithoutArea = FEATURE_SETTINGS_KEY_PREFIX.slice(
    FEATURE_SETTINGS_KEY_PREFIX.indexOf(STORAGE_AREA_SEPARATOR) + STORAGE_AREA_SEPARATOR.length,
  )
  return `${prefixWithoutArea}${featureId}`
}

/** Размер элемента так, как его считает браузер: ключ плюс JSON значения в UTF-8 */
export function measureSyncItemBytes(storageKey: string, value: unknown): number {
  return new TextEncoder().encode(`${storageKey}${JSON.stringify(value)}`).length
}

/**
 * Поместится ли значение настроек функции в один элемент sync. Проверка до записи нужна,
 * чтобы переполнение было понятной ошибкой функции, а не отказом браузера
 */
export function fitsFeatureSettingsSyncQuota(featureId: string, value: unknown): boolean {
  return (
    measureSyncItemBytes(createSyncStorageKey(featureId), value) <=
    SYNC_QUOTA_BYTES_PER_ITEM - SYNC_QUOTA_SAFETY_MARGIN_BYTES
  )
}
