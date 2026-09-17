import { describe, expect, it } from 'vitest'

const CHROME_USER_AGENT_MARKER = 'Chrome'
const HAS_SELECTOR_SUPPORT_QUERY = 'selector(:has(> a > b))'
const NTH_CHILD_OF_SELECTOR_SUPPORT_QUERY = 'selector(:nth-child(1 of .x))'

describe('окружение browser-проекта', () => {
  it('работает в настоящем Chromium', () => {
    expect(navigator.userAgent).toContain(CHROME_USER_AGENT_MARKER)
  })

  it('поддерживает :has()', () => {
    expect(CSS.supports(HAS_SELECTOR_SUPPORT_QUERY)).toBe(true)
  })

  it('поддерживает :nth-child(of S)', () => {
    expect(CSS.supports(NTH_CHILD_OF_SELECTOR_SUPPORT_QUERY)).toBe(true)
  })
})
