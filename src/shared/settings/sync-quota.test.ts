import { describe, expect, it } from 'vitest'
import {
  fitsFeatureSettingsSyncQuota,
  measureSyncItemBytes,
  SYNC_QUOTA_BYTES_PER_ITEM,
  SYNC_QUOTA_SAFETY_MARGIN_BYTES,
} from './sync-quota'

const FEATURE_ID = 'stub-feature'
const STORAGE_KEY = 'feature.stub-feature'
const CYRILLIC_VALUE = 'ж'
const CYRILLIC_LETTER_BYTES = 2
const QUOTE_BYTES = 2
const UUID_LENGTH = 36
const APPROXIMATE_CAPACITY = 200

function createUuidList(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index).padStart(UUID_LENGTH, '0'))
}

describe('sync-quota', () => {
  it('считает ключ и JSON в байтах UTF-8', () => {
    expect(measureSyncItemBytes(STORAGE_KEY, CYRILLIC_VALUE)).toBe(
      STORAGE_KEY.length + QUOTE_BYTES + CYRILLIC_LETTER_BYTES,
    )
  })

  it('около 200 UUID помещаются, а сверх лимита с запасом нет', () => {
    expect(
      fitsFeatureSettingsSyncQuota(FEATURE_ID, {
        enabled: true,
        archivedChatIds: createUuidList(APPROXIMATE_CAPACITY),
      }),
    ).toBe(true)
    const oversizedValue = {
      enabled: true,
      archivedChatIds: createUuidList(SYNC_QUOTA_BYTES_PER_ITEM / UUID_LENGTH),
    }
    expect(fitsFeatureSettingsSyncQuota(FEATURE_ID, oversizedValue)).toBe(false)
  })

  it('граница учитывает запас', () => {
    const limit = SYNC_QUOTA_BYTES_PER_ITEM - SYNC_QUOTA_SAFETY_MARGIN_BYTES
    const fillerLength = limit - measureSyncItemBytes(STORAGE_KEY, '')
    expect(fitsFeatureSettingsSyncQuota(FEATURE_ID, 'a'.repeat(fillerLength))).toBe(true)
    expect(fitsFeatureSettingsSyncQuota(FEATURE_ID, 'a'.repeat(fillerLength + 1))).toBe(false)
  })
})
