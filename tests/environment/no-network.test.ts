import { describe, expect, it } from 'vitest'

const TEST_URL = 'https://example.com/'

describe('окружение unit-проекта', () => {
  it('запрещает fetch', () => {
    expect(() => fetch(TEST_URL)).toThrow()
  })

  it('запрещает XMLHttpRequest', () => {
    expect(() => new XMLHttpRequest()).toThrow()
  })

  it('запрещает WebSocket', () => {
    expect(() => new WebSocket(TEST_URL)).toThrow()
  })
})
