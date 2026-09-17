import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFeatureRuntime } from './feature-runtime'
import {
  createFeatureAttributeName,
  createFeatureStateAttributeName,
  FEATURE_ATTRIBUTE_PREFIX,
  FEATURE_STYLE_MARKER_ATTRIBUTE_NAME,
  INACTIVE_STYLE_MEDIA_QUERY,
} from './feature-scope'
import type { FeatureContent, FeatureMeta, FeatureMountContext } from './feature-types'
import type { FeatureSettingsSource } from '@/shared/settings/feature-settings'
import type { Logger } from '@/shared/logging/logger'
import { siteSelectors } from '@/shared/site/selectors'

const FIRST_FEATURE_ID = 'first-stub-feature'
const SECOND_FEATURE_ID = 'second-stub-feature'
const STATE_NAME = 'stub-state'
const CLICK_EVENT_NAME = 'click'
const HASH_CHANGE_EVENT_NAME = 'hashchange'
const MEDIA_ATTRIBUTE_NAME = 'media'
const STYLE_ELEMENT_SELECTOR = `style[${FEATURE_STYLE_MARKER_ATTRIBUTE_NAME}]`
const ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS = 10_000
const CONTEXT_VALIDITY_CHECK_INTERVAL_MILLISECONDS = 3000
const STUB_TIMEOUT_DELAY_MILLISECONDS = 500
const STUB_INTERVAL_DELAY_MILLISECONDS = 250
const TOGGLE_CYCLE_COUNT = 100
const CHAT_LIST_ROUTE_HASH = '#/'
const OTHER_ROUTE_HASH = '#/settings/main'
const MISSING_ANCHOR_SELECTOR = '.stub-feature-anchor'
const CLASS_SELECTOR_PREFIX_LENGTH = 1
const STUB_STYLE_TEXT = 'html[data-stub] { color: red; }'
const MOUNT_CALL_COUNT_AFTER_TOGGLE = 2
const MOUNT_FAILURE_ERROR_MESSAGE = 'Монтирование не удалось'

const FAKE_TIMER_METHODS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'Date',
] as const

function createStubFeatureMeta(featureId: string, defaultEnabled = true): FeatureMeta {
  return {
    id: featureId,
    title: `Заглушка ${featureId}`,
    description: 'Функция-заглушка для тестов ядра',
    defaultEnabled,
  }
}

/**
 * Фейк воспроизводит поведение ContentScriptContext из WXT 0.21.4: addEventListener перетирает
 * переданный сигнал своим, а таймеры и кадры на каждый вызов добавляют подписку на инвалидацию.
 */
class FakeContentScriptContext {
  isValid = true
  directInvalidationSubscriptionCount = 0
  invalidationSubscriptionCount = 0
  setIntervalCallCount = 0
  setTimeoutCallCount = 0
  requestAnimationFrameCallCount = 0
  addEventListenerCallCount = 0

  private readonly abortController = new AbortController()
  private readonly invalidationCallbacks = new Set<() => void>()

  onInvalidated(callback: () => void): () => void {
    this.directInvalidationSubscriptionCount += 1
    return this.subscribeToInvalidation(callback)
  }

  setInterval(handler: () => void, intervalMilliseconds = 0): number {
    this.setIntervalCallCount += 1
    const intervalId = setInterval(handler, intervalMilliseconds)
    this.subscribeToInvalidation(() => {
      clearInterval(intervalId)
    })
    return intervalId as unknown as number
  }

  setTimeout(handler: () => void, delayMilliseconds = 0): number {
    this.setTimeoutCallCount += 1
    const timeoutId = setTimeout(handler, delayMilliseconds)
    this.subscribeToInvalidation(() => {
      clearTimeout(timeoutId)
    })
    return timeoutId as unknown as number
  }

  requestAnimationFrame(callback: FrameRequestCallback): number {
    this.requestAnimationFrameCallCount += 1
    const animationFrameId = requestAnimationFrame(callback)
    this.subscribeToInvalidation(() => {
      cancelAnimationFrame(animationFrameId)
    })
    return animationFrameId
  }

  addEventListener(
    target: EventTarget,
    eventName: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    this.addEventListenerCallCount += 1
    target.addEventListener(eventName, listener, {
      ...options,
      signal: this.abortController.signal,
    })
  }

  notifyInvalidated(): void {
    this.isValid = false
    this.abortController.abort()
    for (const invalidationCallback of [...this.invalidationCallbacks]) {
      invalidationCallback()
    }
  }

  private subscribeToInvalidation(callback: () => void): () => void {
    this.invalidationSubscriptionCount += 1
    this.invalidationCallbacks.add(callback)
    return () => {
      this.invalidationCallbacks.delete(callback)
    }
  }
}

interface FakeSettingsSource {
  readonly source: FeatureSettingsSource
  readonly unwatchCallCount: () => number
  setEnabled(featureId: string, isEnabled: boolean): void
}

function createFakeSettingsSource(
  initialEnabledByFeatureId: ReadonlyMap<string, boolean>,
  unwatchImplementation?: () => void,
): FakeSettingsSource {
  const watchers = new Map<string, (isEnabled: boolean) => void>()
  let unwatchCalls = 0

  return {
    source: {
      getAllEnabled: () => Promise.resolve(new Map(initialEnabledByFeatureId)),
      watchEnabled(featureMeta, callback) {
        watchers.set(featureMeta.id, callback)
        return () => {
          unwatchCalls += 1
          watchers.delete(featureMeta.id)
          unwatchImplementation?.()
        }
      },
      setEnabled: () => Promise.resolve(),
    },
    unwatchCallCount: () => unwatchCalls,
    setEnabled(featureId, isEnabled) {
      watchers.get(featureId)?.(isEnabled)
    },
  }
}

function createTestLogger(): Logger {
  return { warn: vi.fn(), error: vi.fn() }
}

function readFeatureAttributeNames(): string[] {
  return document.documentElement
    .getAttributeNames()
    .filter((attributeName) => attributeName.startsWith(FEATURE_ATTRIBUTE_PREFIX))
}

function findStyleElement(featureId: string): Element | null {
  return document.querySelector(`style[${FEATURE_STYLE_MARKER_ATTRIBUTE_NAME}="${featureId}"]`)
}

function isFeatureEnabled(featureId: string): boolean {
  return document.documentElement.hasAttribute(createFeatureAttributeName(featureId))
}

describe('createFeatureRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_METHODS] })
    window.location.hash = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    for (const attributeName of readFeatureAttributeNames()) {
      document.documentElement.removeAttribute(attributeName)
    }
    for (const styleElement of document.querySelectorAll(STYLE_ELEMENT_SELECTOR)) {
      styleElement.remove()
    }
    document.body.innerHTML = ''
  })

  it('применяет настройки при старте и держит стили выключенной функции вне каскада', async () => {
    const firstFeatureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const secondFeatureMeta = createStubFeatureMeta(SECOND_FEATURE_ID, false)
    const featureContents: FeatureContent[] = [
      { meta: firstFeatureMeta, styles: STUB_STYLE_TEXT },
      { meta: secondFeatureMeta, styles: STUB_STYLE_TEXT },
    ]
    const settings = createFakeSettingsSource(
      new Map([
        [FIRST_FEATURE_ID, true],
        [SECOND_FEATURE_ID, false],
      ]),
    )
    const featureRuntime = createFeatureRuntime({
      featureMetas: [firstFeatureMeta, secondFeatureMeta],
      featureContents,
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger: createTestLogger(),
    })

    await featureRuntime.start()

    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(true)
    expect(isFeatureEnabled(SECOND_FEATURE_ID)).toBe(false)
    expect(findStyleElement(FIRST_FEATURE_ID)?.hasAttribute(MEDIA_ATTRIBUTE_NAME)).toBe(false)
    expect(findStyleElement(SECOND_FEATURE_ID)?.getAttribute(MEDIA_ATTRIBUTE_NAME)).toBe(
      INACTIVE_STYLE_MEDIA_QUERY,
    )

    featureRuntime.stop()
  })

  it('переключает функцию по наблюдению за настройкой без перезапуска', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID, false)
    const mount = vi.fn()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, false]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT, mount }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    settings.setEnabled(FIRST_FEATURE_ID, true)
    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(true)
    expect(findStyleElement(FIRST_FEATURE_ID)?.hasAttribute(MEDIA_ATTRIBUTE_NAME)).toBe(false)

    settings.setEnabled(FIRST_FEATURE_ID, true)
    expect(mount).toHaveBeenCalledTimes(1)

    settings.setEnabled(FIRST_FEATURE_ID, false)
    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(false)
    expect(findStyleElement(FIRST_FEATURE_ID)?.getAttribute(MEDIA_ATTRIBUTE_NAME)).toBe(
      INACTIVE_STYLE_MEDIA_QUERY,
    )

    featureRuntime.stop()
  })

  it('при выключении прерывает сигнал, вызывает уборку один раз и снимает атрибуты состояния', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const cleanup = vi.fn()
    let mountSignal: AbortSignal | undefined
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [
        {
          meta: featureMeta,
          styles: STUB_STYLE_TEXT,
          mount: (mountContext: FeatureMountContext) => {
            mountSignal = mountContext.signal
            mountContext.documentRoot.documentElement.setAttribute(
              createFeatureStateAttributeName(FIRST_FEATURE_ID, STATE_NAME),
              '',
            )
            return cleanup
          },
        },
      ],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    settings.setEnabled(FIRST_FEATURE_ID, false)
    settings.setEnabled(FIRST_FEATURE_ID, false)

    expect(mountSignal?.aborted).toBe(true)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(readFeatureAttributeNames()).toEqual([])

    featureRuntime.stop()
  })

  it('не копит слушатели и таймеры за сто циклов включения и выключения', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID, false)
    const clickListener = vi.fn()
    const fakeContentScriptContext = new FakeContentScriptContext()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, false]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [
        {
          meta: featureMeta,
          styles: STUB_STYLE_TEXT,
          mount: ({ documentRoot, lifecycle }: FeatureMountContext) => {
            lifecycle.addEventListener(documentRoot, CLICK_EVENT_NAME, clickListener)
            lifecycle.setTimeout(() => {}, STUB_TIMEOUT_DELAY_MILLISECONDS)
            lifecycle.setInterval(() => {}, STUB_INTERVAL_DELAY_MILLISECONDS)
            lifecycle.requestAnimationFrame(() => {})
          },
        },
      ],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: fakeContentScriptContext,
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    const timerCountBeforeCycles = vi.getTimerCount()
    const invalidationSubscriptionCountBeforeCycles =
      fakeContentScriptContext.invalidationSubscriptionCount

    for (let cycleIndex = 0; cycleIndex < TOGGLE_CYCLE_COUNT; cycleIndex += 1) {
      settings.setEnabled(FIRST_FEATURE_ID, true)
      settings.setEnabled(FIRST_FEATURE_ID, false)
    }

    document.dispatchEvent(new Event(CLICK_EVENT_NAME))
    expect(clickListener).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(timerCountBeforeCycles)

    settings.setEnabled(FIRST_FEATURE_ID, true)
    document.dispatchEvent(new Event(CLICK_EVENT_NAME))
    expect(clickListener).toHaveBeenCalledTimes(1)

    expect(fakeContentScriptContext.directInvalidationSubscriptionCount).toBe(1)
    expect(fakeContentScriptContext.invalidationSubscriptionCount).toBe(
      invalidationSubscriptionCountBeforeCycles,
    )
    expect(fakeContentScriptContext.setIntervalCallCount).toBe(1)
    expect(fakeContentScriptContext.setTimeoutCallCount).toBe(0)
    expect(fakeContentScriptContext.requestAnimationFrameCallCount).toBe(0)
    expect(fakeContentScriptContext.addEventListenerCallCount).toBe(0)

    featureRuntime.stop()
  })

  it('повторный запуск не добавляет вторую подписку на инвалидацию и второй интервал', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const fakeContentScriptContext = new FakeContentScriptContext()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: fakeContentScriptContext,
      logger: createTestLogger(),
    })

    await featureRuntime.start()
    featureRuntime.stop()
    await featureRuntime.start()

    expect(fakeContentScriptContext.directInvalidationSubscriptionCount).toBe(1)
    expect(fakeContentScriptContext.setIntervalCallCount).toBe(1)
    expect(document.querySelectorAll(STYLE_ELEMENT_SELECTOR)).toHaveLength(1)

    featureRuntime.stop()
  })

  it('отклонённое монтирование не выключает новое включение той же функции', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const logger = createTestLogger()
    const rejectMountCallbacks: Array<(mountError: Error) => void> = []
    const mountPromises: Array<Promise<void>> = []
    const mount = vi.fn(() => {
      const mountPromise = new Promise<void>((_resolve, reject) => {
        rejectMountCallbacks.push(reject)
      })
      mountPromises.push(mountPromise)
      return mountPromise
    })
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT, mount }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger,
    })
    await featureRuntime.start()

    settings.setEnabled(FIRST_FEATURE_ID, false)
    settings.setEnabled(FIRST_FEATURE_ID, true)
    expect(mount).toHaveBeenCalledTimes(MOUNT_CALL_COUNT_AFTER_TOGGLE)

    const [rejectFirstMount] = rejectMountCallbacks as [(mountError: Error) => void]
    const [firstMountPromise] = mountPromises as [Promise<void>]
    rejectFirstMount(new Error(MOUNT_FAILURE_ERROR_MESSAGE))
    await firstMountPromise.catch(() => undefined)

    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(true)
    expect(findStyleElement(FIRST_FEATURE_ID)?.hasAttribute(MEDIA_ATTRIBUTE_NAME)).toBe(false)

    featureRuntime.stop()
  })

  it('вызывает уборку асинхронного монтирования, если функцию выключили раньше', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const cleanup = vi.fn()
    let resolveMount: (() => void) | undefined
    const mountPromise = new Promise<() => void>((resolve) => {
      resolveMount = () => {
        resolve(cleanup)
      }
    })
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT, mount: () => mountPromise }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    settings.setEnabled(FIRST_FEATURE_ID, false)
    resolveMount?.()
    await mountPromise

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(readFeatureAttributeNames()).toEqual([])

    featureRuntime.stop()
  })

  it('ошибка монтирования выключает только свою функцию', async () => {
    const failingFeatureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const workingFeatureMeta = createStubFeatureMeta(SECOND_FEATURE_ID)
    const logger = createTestLogger()
    const settings = createFakeSettingsSource(
      new Map([
        [FIRST_FEATURE_ID, true],
        [SECOND_FEATURE_ID, true],
      ]),
    )
    const featureRuntime = createFeatureRuntime({
      featureMetas: [failingFeatureMeta, workingFeatureMeta],
      featureContents: [
        {
          meta: failingFeatureMeta,
          styles: STUB_STYLE_TEXT,
          mount: () => {
            throw new Error('Монтирование не удалось')
          },
        },
        { meta: workingFeatureMeta, styles: STUB_STYLE_TEXT },
      ],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger,
    })

    await featureRuntime.start()

    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(false)
    expect(isFeatureEnabled(SECOND_FEATURE_ID)).toBe(true)
    expect(logger.error).toHaveBeenCalledTimes(1)

    featureRuntime.stop()
  })

  it('отклонённое монтирование выключает только свою функцию', async () => {
    const failingFeatureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const workingFeatureMeta = createStubFeatureMeta(SECOND_FEATURE_ID)
    const logger = createTestLogger()
    const mountRejection = Promise.reject(new Error('Монтирование не удалось'))
    const settings = createFakeSettingsSource(
      new Map([
        [FIRST_FEATURE_ID, true],
        [SECOND_FEATURE_ID, true],
      ]),
    )
    const featureRuntime = createFeatureRuntime({
      featureMetas: [failingFeatureMeta, workingFeatureMeta],
      featureContents: [
        { meta: failingFeatureMeta, styles: STUB_STYLE_TEXT, mount: () => mountRejection },
        { meta: workingFeatureMeta, styles: STUB_STYLE_TEXT },
      ],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger,
    })

    await featureRuntime.start()
    await mountRejection.catch(() => undefined)

    expect(isFeatureEnabled(FIRST_FEATURE_ID)).toBe(false)
    expect(isFeatureEnabled(SECOND_FEATURE_ID)).toBe(true)
    expect(logger.error).toHaveBeenCalledTimes(1)

    featureRuntime.stop()
  })

  it('остановка убирает свои атрибуты и элементы стилей, но не трогает чужие', async () => {
    const foreignStyleElement = document.createElement('style')
    foreignStyleElement.setAttribute(FEATURE_STYLE_MARKER_ATTRIBUTE_NAME, 'foreign-feature')
    document.head.append(foreignStyleElement)

    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const logger = createTestLogger()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger,
    })

    await featureRuntime.start()
    expect(logger.warn).toHaveBeenCalledTimes(1)

    featureRuntime.stop()

    expect(readFeatureAttributeNames()).toEqual([])
    expect(findStyleElement(FIRST_FEATURE_ID)).toBeNull()
    expect(foreignStyleElement.isConnected).toBe(true)
    expect(settings.unwatchCallCount()).toBe(1)
  })

  it('инвалидация контекста выполняет ту же уборку, что остановка', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const cleanup = vi.fn()
    const fakeContentScriptContext = new FakeContentScriptContext()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT, mount: () => cleanup }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: fakeContentScriptContext,
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    fakeContentScriptContext.notifyInvalidated()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(readFeatureAttributeNames()).toEqual([])
    expect(document.querySelectorAll(STYLE_ELEMENT_SELECTOR)).toHaveLength(0)
  })

  it('остановка при бросающем отписчике не бросает', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]), () => {
      throw new Error('Хранилище недоступно')
    })
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    expect(() => {
      featureRuntime.stop()
    }).not.toThrow()
    expect(readFeatureAttributeNames()).toEqual([])
  })

  it('останавливается сам, когда контекст расширения перестал быть валидным', async () => {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const fakeContentScriptContext = new FakeContentScriptContext()
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    const featureRuntime = createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [{ meta: featureMeta, styles: STUB_STYLE_TEXT }],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: fakeContentScriptContext,
      logger: createTestLogger(),
    })
    await featureRuntime.start()

    fakeContentScriptContext.isValid = false
    vi.advanceTimersByTime(CONTEXT_VALIDITY_CHECK_INTERVAL_MILLISECONDS)

    expect(readFeatureAttributeNames()).toEqual([])
    expect(document.querySelectorAll(STYLE_ELEMENT_SELECTOR)).toHaveLength(0)
  })
})

describe('диагностика якорных селекторов', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...FAKE_TIMER_METHODS] })
    window.location.hash = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    for (const attributeName of readFeatureAttributeNames()) {
      document.documentElement.removeAttribute(attributeName)
    }
    for (const styleElement of document.querySelectorAll(STYLE_ELEMENT_SELECTOR)) {
      styleElement.remove()
    }
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  function createDiagnosticsRuntime(logger: Logger) {
    const featureMeta = createStubFeatureMeta(FIRST_FEATURE_ID)
    const settings = createFakeSettingsSource(new Map([[FIRST_FEATURE_ID, true]]))
    return createFeatureRuntime({
      featureMetas: [featureMeta],
      featureContents: [
        {
          meta: featureMeta,
          styles: STUB_STYLE_TEXT,
          anchorSelectors: [MISSING_ANCHOR_SELECTOR],
        },
      ],
      documentRoot: document,
      settingsSource: settings.source,
      contentScriptLifecycle: new FakeContentScriptContext(),
      logger,
    })
  }

  function renderLayoutPane(): void {
    const layoutPaneElement = document.createElement('div')
    layoutPaneElement.className = siteSelectors.layoutPane.slice(CLASS_SELECTOR_PREFIX_LENGTH)
    document.body.append(layoutPaneElement)
  }

  it('пишет одно предупреждение на роуте списка чатов', async () => {
    renderLayoutPane()
    window.location.hash = CHAT_LIST_ROUTE_HASH
    const logger = createTestLogger()
    const featureRuntime = createDiagnosticsRuntime(logger)

    await featureRuntime.start()
    vi.advanceTimersByTime(ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS)
    vi.advanceTimersByTime(ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS)

    expect(logger.warn).toHaveBeenCalledTimes(1)

    featureRuntime.stop()
  })

  it('молчит, когда левой колонки на странице нет', async () => {
    window.location.hash = CHAT_LIST_ROUTE_HASH
    const logger = createTestLogger()
    const featureRuntime = createDiagnosticsRuntime(logger)

    await featureRuntime.start()
    vi.advanceTimersByTime(ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS)

    expect(logger.warn).not.toHaveBeenCalled()

    featureRuntime.stop()
  })

  it('молчит на другом роуте и предупреждает один раз после перехода к списку чатов', async () => {
    renderLayoutPane()
    window.location.hash = OTHER_ROUTE_HASH
    const logger = createTestLogger()
    const featureRuntime = createDiagnosticsRuntime(logger)

    await featureRuntime.start()
    vi.advanceTimersByTime(ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS)
    expect(logger.warn).not.toHaveBeenCalled()

    window.location.hash = CHAT_LIST_ROUTE_HASH
    window.dispatchEvent(new Event(HASH_CHANGE_EVENT_NAME))
    window.dispatchEvent(new Event(HASH_CHANGE_EVENT_NAME))
    vi.advanceTimersByTime(ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS)

    expect(logger.warn).toHaveBeenCalledTimes(1)

    featureRuntime.stop()
  })
})
