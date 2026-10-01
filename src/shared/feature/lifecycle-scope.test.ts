import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLifecycleScope } from './lifecycle-scope'

const TIMEOUT_DELAY_MILLISECONDS = 100
const INTERVAL_DELAY_MILLISECONDS = 50
const ANIMATION_FRAME_DELAY_MILLISECONDS = 20
const CLICK_EVENT_NAME = 'click'
const OBSERVED_ELEMENT_TAG_NAME = 'div'
const CHILD_LIST_OPTIONS: MutationObserverInit = { childList: true }

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

  describe('observeMutations', () => {
    let observedElement: HTMLElement

    beforeEach(() => {
      /* Шпионы кадров из тестов выше подменяют поддельный requestAnimationFrame */
      vi.restoreAllMocks()
      vi.useFakeTimers({ toFake: [...FAKE_TIMER_METHODS] })
      observedElement = document.createElement(OBSERVED_ELEMENT_TAG_NAME)
      document.body.append(observedElement)
    })

    afterEach(() => {
      observedElement.remove()
    })

    async function appendChildAndFlush(): Promise<void> {
      observedElement.append(document.createElement(OBSERVED_ELEMENT_TAG_NAME))
      await Promise.resolve()
      vi.advanceTimersByTime(ANIMATION_FRAME_DELAY_MILLISECONDS)
    }

    it('сводит изменения одного кадра к одному вызову', async () => {
      const scope = createLifecycleScope()
      const callback = vi.fn()

      scope.lifecycle.observeMutations(observedElement, callback, CHILD_LIST_OPTIONS)
      observedElement.append(document.createElement(OBSERVED_ELEMENT_TAG_NAME))
      await Promise.resolve()
      observedElement.append(document.createElement(OBSERVED_ELEMENT_TAG_NAME))
      await Promise.resolve()
      expect(callback).not.toHaveBeenCalled()
      vi.advanceTimersByTime(ANIMATION_FRAME_DELAY_MILLISECONDS)

      expect(callback).toHaveBeenCalledTimes(1)
      await appendChildAndFlush()
      expect(callback).toHaveBeenCalledTimes(2)
      scope.dispose()
    })

    it('отключается при dispose, включая запланированный кадр', async () => {
      const scope = createLifecycleScope()
      const callback = vi.fn()

      scope.lifecycle.observeMutations(observedElement, callback, CHILD_LIST_OPTIONS)
      observedElement.append(document.createElement(OBSERVED_ELEMENT_TAG_NAME))
      await Promise.resolve()
      scope.dispose()
      vi.advanceTimersByTime(ANIMATION_FRAME_DELAY_MILLISECONDS)
      await appendChildAndFlush()

      expect(callback).not.toHaveBeenCalled()
    })

    it('отключается возвращённой функцией, остальные наблюдатели работают', async () => {
      const scope = createLifecycleScope()
      const disconnectedCallback = vi.fn()
      const activeCallback = vi.fn()

      const disconnect = scope.lifecycle.observeMutations(
        observedElement,
        disconnectedCallback,
        CHILD_LIST_OPTIONS,
      )
      scope.lifecycle.observeMutations(observedElement, activeCallback, CHILD_LIST_OPTIONS)
      observedElement.append(document.createElement(OBSERVED_ELEMENT_TAG_NAME))
      await Promise.resolve()
      disconnect()
      vi.advanceTimersByTime(ANIMATION_FRAME_DELAY_MILLISECONDS)

      expect(disconnectedCallback).not.toHaveBeenCalled()
      expect(activeCallback).toHaveBeenCalledTimes(1)
      scope.dispose()
    })

    it('после dispose не наблюдает и отдаёт безопасное отключение', async () => {
      const scope = createLifecycleScope()
      const callback = vi.fn()

      scope.dispose()
      const disconnect = scope.lifecycle.observeMutations(
        observedElement,
        callback,
        CHILD_LIST_OPTIONS,
      )
      await appendChildAndFlush()

      expect(callback).not.toHaveBeenCalled()
      expect(() => {
        disconnect()
      }).not.toThrow()
    })

    it('новая область после dispose прежней наблюдает заново', async () => {
      const firstScope = createLifecycleScope()
      const firstCallback = vi.fn()
      firstScope.lifecycle.observeMutations(observedElement, firstCallback, CHILD_LIST_OPTIONS)
      firstScope.dispose()

      const secondScope = createLifecycleScope()
      const secondCallback = vi.fn()
      secondScope.lifecycle.observeMutations(observedElement, secondCallback, CHILD_LIST_OPTIONS)
      await appendChildAndFlush()

      expect(firstCallback).not.toHaveBeenCalled()
      expect(secondCallback).toHaveBeenCalledTimes(1)
      secondScope.dispose()
    })
  })
})
