import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLifecycleScope } from './lifecycle-scope'

const TIMEOUT_DELAY_MILLISECONDS = 100
const INTERVAL_DELAY_MILLISECONDS = 50
const ANIMATION_FRAME_DELAY_MILLISECONDS = 20
const CLICK_EVENT_NAME = 'click'

const FAKE_TIMER_METHODS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Date',
] as const

describe('createLifecycleScope', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_METHODS] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('снимает таймаут, интервал и кадр при dispose', () => {
    const scope = createLifecycleScope()
    const timeoutHandler = vi.fn()
    const intervalHandler = vi.fn()
    const animationFrameHandler = vi.fn()

    scope.lifecycle.setTimeout(timeoutHandler, TIMEOUT_DELAY_MILLISECONDS)
    scope.lifecycle.setInterval(intervalHandler, INTERVAL_DELAY_MILLISECONDS)
    scope.lifecycle.requestAnimationFrame(animationFrameHandler)
    scope.dispose()
    vi.advanceTimersByTime(TIMEOUT_DELAY_MILLISECONDS)

    expect(timeoutHandler).not.toHaveBeenCalled()
    expect(intervalHandler).not.toHaveBeenCalled()
    expect(animationFrameHandler).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(scope.signal.aborted).toBe(true)
  })

  it('снимает слушатель при dispose', () => {
    const scope = createLifecycleScope()
    const listener = vi.fn()

    scope.lifecycle.addEventListener(document, CLICK_EVENT_NAME, listener)
    document.dispatchEvent(new Event(CLICK_EVENT_NAME))
    scope.dispose()
    document.dispatchEvent(new Event(CLICK_EVENT_NAME))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('игнорирует вызовы хелперов после dispose', () => {
    const scope = createLifecycleScope()
    const listener = vi.fn()
    const timeoutHandler = vi.fn()

    scope.dispose()
    scope.lifecycle.setTimeout(timeoutHandler, TIMEOUT_DELAY_MILLISECONDS)
    scope.lifecycle.setInterval(timeoutHandler, INTERVAL_DELAY_MILLISECONDS)
    scope.lifecycle.requestAnimationFrame(timeoutHandler)
    scope.lifecycle.addEventListener(document, CLICK_EVENT_NAME, listener)
    vi.advanceTimersByTime(TIMEOUT_DELAY_MILLISECONDS)
    document.dispatchEvent(new Event(CLICK_EVENT_NAME))

    expect(vi.getTimerCount()).toBe(0)
    expect(timeoutHandler).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it('удаляет из набора идентификатор сработавшего таймаута', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const scope = createLifecycleScope()

    scope.lifecycle.setTimeout(vi.fn(), TIMEOUT_DELAY_MILLISECONDS)
    const timeoutId = setTimeoutSpy.mock.results[0]?.value
    vi.advanceTimersByTime(TIMEOUT_DELAY_MILLISECONDS)

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    scope.dispose()

    expect(timeoutId).toBeDefined()
    expect(clearTimeoutSpy).not.toHaveBeenCalledWith(timeoutId)
  })

  it('удаляет из набора идентификатор сработавшего кадра', () => {
    const requestAnimationFrameSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    const scope = createLifecycleScope()

    scope.lifecycle.requestAnimationFrame(vi.fn())
    const animationFrameId = requestAnimationFrameSpy.mock.results[0]?.value
    vi.advanceTimersByTime(ANIMATION_FRAME_DELAY_MILLISECONDS)

    const cancelAnimationFrameSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    scope.dispose()

    expect(animationFrameId).toBeDefined()
    expect(cancelAnimationFrameSpy).not.toHaveBeenCalledWith(animationFrameId)
  })

  it('повторный dispose не бросает', () => {
    const scope = createLifecycleScope()

    scope.dispose()

    expect(() => {
      scope.dispose()
    }).not.toThrow()
  })
})
