import { storage, type StorageItemKey, type WxtStorageItem } from '#imports'
import {
  MAXIMUM_DISCOVERED_VALUE_COUNT,
  MAXIMUM_DISCOVERED_VALUE_LENGTH,
  type FeatureMeta,
} from '@/shared/feature/feature-types'

/**
 * Обнаруженное на странице это снимок устройства, а не настройка: он лежит в storage.local
 * отдельным элементом и не тратит квоту sync
 */
const DISCOVERED_VALUES_KEY_PREFIX = 'local:feature.'

const DISCOVERED_VALUES_KEY_SUFFIX = '.discovered'

/** Последний снимок значений, которые content script видел на странице */
export interface DiscoveredValues {
  readonly values: readonly string[]
  /** Часть значений не вошла в снимок: их больше лимита или они слишком длинные */
  readonly isTruncated: boolean
}

export const EMPTY_DISCOVERED_VALUES: DiscoveredValues = { values: [], isTruncated: false }

/**
 * Приводит найденные значения к снимку: обрезает пробелы, отбрасывает пустые, слишком
 * длинные и повторы, сохраняет порядок и не больше MAXIMUM_DISCOVERED_VALUE_COUNT значений
 */
export function normalizeDiscoveredValues(rawValues: readonly unknown[]): DiscoveredValues {
  const values: string[] = []
  let isTruncated = false
  for (const rawValue of rawValues) {
    if (typeof rawValue !== 'string') {
      continue
    }
    const value = rawValue.trim()
    if (value.length === 0 || values.includes(value)) {
      continue
    }
    if (value.length > MAXIMUM_DISCOVERED_VALUE_LENGTH) {
      isTruncated = true
      continue
    }
    if (values.length >= MAXIMUM_DISCOVERED_VALUE_COUNT) {
      isTruncated = true
      break
    }
    values.push(value)
  }
  return { values, isTruncated }
}

/** Читает снимок из хранилища: значение чужого формата даёт пустой снимок, а не ошибку */
export function readDiscoveredValues(storedValue: unknown): DiscoveredValues {
  if (typeof storedValue !== 'object' || storedValue === null) {
    return EMPTY_DISCOVERED_VALUES
  }
  const { values, isTruncated } = storedValue as { values?: unknown; isTruncated?: unknown }
  if (!Array.isArray(values)) {
    return EMPTY_DISCOVERED_VALUES
  }
  const normalizedValues = normalizeDiscoveredValues(values)
  return {
    values: normalizedValues.values,
    isTruncated: normalizedValues.isTruncated || isTruncated === true,
  }
}

export function areDiscoveredValuesEqual(
  firstValues: DiscoveredValues,
  secondValues: DiscoveredValues,
): boolean {
  return (
    firstValues.isTruncated === secondValues.isTruncated &&
    firstValues.values.length === secondValues.values.length &&
    firstValues.values.every((value, index) => value === secondValues.values[index])
  )
}

/** Элемент снимка функции: local:feature.<id>.discovered */
export function createDiscoveredValuesItem(
  featureMeta: FeatureMeta,
): WxtStorageItem<DiscoveredValues, Record<string, unknown>> {
  const storageKey: StorageItemKey = `${DISCOVERED_VALUES_KEY_PREFIX}${featureMeta.id}${DISCOVERED_VALUES_KEY_SUFFIX}`
  return storage.defineItem<DiscoveredValues>(storageKey, { fallback: EMPTY_DISCOVERED_VALUES })
}
