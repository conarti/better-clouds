import type { FeatureLifecycle } from './feature-types'

type TimerId = ReturnType<typeof setTimeout>

/**
 * Область жизни ресурсов одного включения функции или одного запуска runtime.
 * Собственный AbortController нужен потому, что ContentScriptContext перетирает переданный
 * сигнал своим, а его таймеры снимаются только при инвалидации контекста. AbortSignal.any
 * не используется: он появился в Chrome 116, а минимум расширения это Chrome 111.
 */
export interface LifecycleScope {
  readonly lifecycle: FeatureLifecycle
  readonly signal: AbortSignal
  dispose(): void
}

export function createLifecycleScope(): LifecycleScope {
  const abortController = new AbortController()
  const { signal } = abortController
  const timeoutIds = new Set<TimerId>()
  const intervalIds = new Set<TimerId>()
  const animationFrameIds = new Set<number>()

  const lifecycle: FeatureLifecycle = {
    setTimeout(handler, delayMilliseconds) {
      if (signal.aborted) {
        return
      }
      const timeoutId: TimerId = setTimeout(() => {
        timeoutIds.delete(timeoutId)
        handler()
      }, delayMilliseconds)
      timeoutIds.add(timeoutId)
    },

    setInterval(handler, intervalMilliseconds) {
      if (signal.aborted) {
        return
      }
      intervalIds.add(setInterval(handler, intervalMilliseconds))
    },

    requestAnimationFrame(callback) {
      if (signal.aborted) {
        return
      }
      const animationFrameId = requestAnimationFrame((timestampMilliseconds) => {
        animationFrameIds.delete(animationFrameId)
        callback(timestampMilliseconds)
      })
      animationFrameIds.add(animationFrameId)
    },

    addEventListener(target, eventName, listener, options) {
      if (signal.aborted) {
        return
      }
      target.addEventListener(eventName, listener, { ...options, signal })
    },
  }

  function dispose(): void {
    abortController.abort()
    for (const timeoutId of timeoutIds) {
      clearTimeout(timeoutId)
    }
    for (const intervalId of intervalIds) {
      clearInterval(intervalId)
    }
    for (const animationFrameId of animationFrameIds) {
      cancelAnimationFrame(animationFrameId)
    }
    timeoutIds.clear()
    intervalIds.clear()
    animationFrameIds.clear()
  }

  return { lifecycle, signal, dispose }
}
