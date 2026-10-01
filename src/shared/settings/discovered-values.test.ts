import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  areDiscoveredValuesEqual,
  createDiscoveredValuesItem,
  EMPTY_DISCOVERED_VALUES,
  normalizeDiscoveredValues,
  readDiscoveredValues,
} from './discovered-values'
import {
  MAXIMUM_DISCOVERED_VALUE_COUNT,
  MAXIMUM_DISCOVERED_VALUE_LENGTH,
  type FeatureMeta,
} from '@/shared/feature/feature-types'

const STUB_FEATURE_META: FeatureMeta = {
  id: 'stub-feature',
  title: 'Заглушка функции',
  description: 'Функция-заглушка для тестов снимка',
  defaultEnabled: false,
}

const LOCAL_STORAGE_KEY = `feature.${STUB_FEATURE_META.id}.discovered`
const FIRST_VALUE = 'Работа'
const SECOND_VALUE = 'Семья'
const LONG_VALUE = 'я'.repeat(MAXIMUM_DISCOVERED_VALUE_LENGTH + 1)
const EXTRA_VALUE_COUNT = 5

function createNumberedValues(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Тег ${index + 1}`)
}

describe('normalizeDiscoveredValues', () => {
  it('обрезает пробелы, отбрасывает пустые, повторы и не строки, сохраняет порядок', () => {
    expect(
      normalizeDiscoveredValues([` ${SECOND_VALUE} `, '', FIRST_VALUE, SECOND_VALUE, 42, null]),
    ).toEqual({ values: [SECOND_VALUE, FIRST_VALUE], isTruncated: false })
  })

  it('отбрасывает слишком длинные значения и отмечает неполный снимок', () => {
    expect(normalizeDiscoveredValues([LONG_VALUE, FIRST_VALUE])).toEqual({
      values: [FIRST_VALUE],
      isTruncated: true,
    })
  })

  it('оставляет не больше лимита значений и отмечает неполный снимок', () => {
    const rawValues = createNumberedValues(MAXIMUM_DISCOVERED_VALUE_COUNT + EXTRA_VALUE_COUNT)
    const discoveredValues = normalizeDiscoveredValues(rawValues)

    expect(discoveredValues.values).toEqual(rawValues.slice(0, MAXIMUM_DISCOVERED_VALUE_COUNT))
    expect(discoveredValues.isTruncated).toBe(true)
  })

  it('ровно лимит значений помещается полностью', () => {
    const rawValues = createNumberedValues(MAXIMUM_DISCOVERED_VALUE_COUNT)

    expect(normalizeDiscoveredValues(rawValues)).toEqual({ values: rawValues, isTruncated: false })
  })
})

describe('readDiscoveredValues', () => {
  it('значение чужого формата даёт пустой снимок', () => {
    expect(readDiscoveredValues(undefined)).toEqual(EMPTY_DISCOVERED_VALUES)
    expect(readDiscoveredValues({ values: FIRST_VALUE })).toEqual(EMPTY_DISCOVERED_VALUES)
  })

  it('нормализует сохранённые значения и сохраняет отметку неполного снимка', () => {
    expect(readDiscoveredValues({ values: [FIRST_VALUE, FIRST_VALUE], isTruncated: true })).toEqual(
      { values: [FIRST_VALUE], isTruncated: true },
    )
  })
})

describe('areDiscoveredValuesEqual', () => {
  it('сравнивает значения по порядку и отметку неполного снимка', () => {
    const snapshot = { values: [FIRST_VALUE, SECOND_VALUE], isTruncated: false }

    expect(areDiscoveredValuesEqual(snapshot, { ...snapshot })).toBe(true)
    expect(
      areDiscoveredValuesEqual(snapshot, {
        values: [SECOND_VALUE, FIRST_VALUE],
        isTruncated: false,
      }),
    ).toBe(false)
    expect(areDiscoveredValuesEqual(snapshot, { ...snapshot, isTruncated: true })).toBe(false)
  })
})

describe('createDiscoveredValuesItem', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('хранит снимок в storage.local отдельным элементом, а не в sync', async () => {
    const item = createDiscoveredValuesItem(STUB_FEATURE_META)
    expect(await item.getValue()).toEqual(EMPTY_DISCOVERED_VALUES)

    await item.setValue({ values: [FIRST_VALUE], isTruncated: false })

    const localRecord = await fakeBrowser.storage.local.get(LOCAL_STORAGE_KEY)
    const syncRecord = await fakeBrowser.storage.sync.get(LOCAL_STORAGE_KEY)
    expect(localRecord[LOCAL_STORAGE_KEY]).toEqual({ values: [FIRST_VALUE], isTruncated: false })
    expect(syncRecord[LOCAL_STORAGE_KEY]).toBeUndefined()
  })
})
