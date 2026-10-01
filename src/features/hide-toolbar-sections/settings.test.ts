import { describe, expect, it } from 'vitest'
import {
  BELL_COUNTER_SECTION_ID,
  BELL_SECTION_ID,
  DEFAULT_HIDDEN_SECTION_IDS,
  resolveHiddenSections,
  TOOLBAR_SECTIONS,
} from './settings'

const SAVED_HIDDEN_SECTION_ID = 'main'
const UNKNOWN_SECTION_ID = 'unknown-section'
const EXPECTED_SECTION_COUNT = 8

describe('resolveHiddenSections', () => {
  it('содержит восемь секций, колокольчик и его счётчик в конце', () => {
    expect(TOOLBAR_SECTIONS).toHaveLength(EXPECTED_SECTION_COUNT)
    expect(TOOLBAR_SECTIONS.slice(-2).map((section) => section.id)).toEqual([
      BELL_COUNTER_SECTION_ID,
      BELL_SECTION_ID,
    ])
  })

  it('сохранённый список не дополняет новыми секциями', () => {
    expect(resolveHiddenSections({ enabled: true, hidden: [SAVED_HIDDEN_SECTION_ID] })).toEqual([
      SAVED_HIDDEN_SECTION_ID,
    ])
  })

  it('без поля hidden скрывает шесть прежних секций, колокольчик остаётся видимым', () => {
    for (const storedValue of [undefined, null, {}, { enabled: true }, { hidden: 'main' }]) {
      const hiddenSections = resolveHiddenSections(storedValue)
      expect(hiddenSections).toEqual(DEFAULT_HIDDEN_SECTION_IDS)
      expect(hiddenSections).toHaveLength(EXPECTED_SECTION_COUNT - 2)
      expect(hiddenSections).not.toContain(BELL_SECTION_ID)
      expect(hiddenSections).not.toContain(BELL_COUNTER_SECTION_ID)
    }
  })

  it('отбрасывает неизвестные идентификаторы и не строки', () => {
    expect(
      resolveHiddenSections({
        hidden: [UNKNOWN_SECTION_ID, BELL_SECTION_ID, 42, SAVED_HIDDEN_SECTION_ID],
      }),
    ).toEqual([BELL_SECTION_ID, SAVED_HIDDEN_SECTION_ID])
  })
})
