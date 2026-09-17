import type { ContentScriptContext } from '#imports'
import {
  createFeatureAttributeName,
  FEATURE_STATE_SEPARATOR,
  FEATURE_STYLE_MARKER_ATTRIBUTE_NAME,
  INACTIVE_STYLE_MEDIA_QUERY,
} from './feature-scope'
import type {
  FeatureCleanup,
  FeatureContent,
  FeatureMeta,
  FeatureMountResult,
} from './feature-types'
import { createLifecycleScope, type LifecycleScope } from './lifecycle-scope'
import type { Logger } from '@/shared/logging/logger'
import type { FeatureSettingsSource } from '@/shared/settings/feature-settings'
import { siteSelectors } from '@/shared/site/selectors'
import { CHAT_LIST_ROUTE_HASH_PATTERN } from '@/shared/site/site-constants'

/** Период проверки, что контекст расширения ещё жив (обновление или выключение расширения) */
const CONTEXT_VALIDITY_CHECK_INTERVAL_MILLISECONDS = 3000

/** Задержка перед диагностикой якорей: клиент успевает отрисовать список чатов */
const ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS = 10_000

const STYLE_ELEMENT_TAG_NAME = 'style'
const MEDIA_ATTRIBUTE_NAME = 'media'
const ENABLED_ATTRIBUTE_VALUE = ''
const VISIBILITY_CHANGE_EVENT_NAME = 'visibilitychange'
const HASH_CHANGE_EVENT_NAME = 'hashchange'

const FOREIGN_STYLE_WARNING =
  'На странице уже есть стили другой копии расширения, копии будут мешать друг другу'
const MOUNT_FAILURE_MESSAGE = 'Функция не смонтировалась и выключена до перезагрузки страницы'
const CLEANUP_FAILURE_MESSAGE = 'Уборка функции завершилась ошибкой'
const UNWATCH_FAILURE_MESSAGE = 'Не удалось отписаться от настройки функции'
const MISSING_ANCHOR_SELECTORS_MESSAGE =
  'Якорные селекторы не найдены, разметка сайта могла измениться'

/**
 * Часть ContentScriptContext, которой пользуется runtime. Хелперы таймеров, кадров и событий
 * сюда не входят: они перетирают переданный сигнал и на каждый вызов добавляют подписку на
 * инвалидацию, которую нельзя снять, поэтому ресурсы runtime и функций живут в своих областях.
 */
export type ContentScriptLifecycle = Pick<ContentScriptContext, 'isValid' | 'onInvalidated'>

export interface FeatureRuntimeOptions {
  readonly featureMetas: readonly FeatureMeta[]
  readonly featureContents: readonly FeatureContent[]
  readonly documentRoot: Document
  readonly settingsSource: FeatureSettingsSource
  readonly contentScriptLifecycle: ContentScriptLifecycle
  readonly logger: Logger
}

export interface FeatureRuntime {
  start(): Promise<void>
  stop(): void
}

interface FeatureActivation {
  readonly scope: LifecycleScope
  cleanup: FeatureCleanup | undefined
  isDisposed: boolean
  isCleanupCalled: boolean
}

export function createFeatureRuntime({
  featureMetas,
  featureContents,
  documentRoot,
  settingsSource,
  contentScriptLifecycle,
  logger,
}: FeatureRuntimeOptions): FeatureRuntime {
  const featureContentById = new Map(
    featureContents.map((featureContent) => [featureContent.meta.id, featureContent]),
  )
  const featureStyleElements = new Map<string, HTMLStyleElement>()
  const activations = new Map<string, FeatureActivation>()
  const unwatchCallbacks: Array<() => void> = []

  let runtimeScope: LifecycleScope | null = null
  let removeInvalidationListener: (() => void) | undefined
  let isRunning = false
  let isContextSubscribed = false
  let hasWarnedAboutForeignStyles = false
  let hasScheduledAnchorDiagnostics = false

  function createFeatureStyleElements(): void {
    for (const featureContent of featureContents) {
      if (featureContent.styles === undefined) {
        continue
      }
      const styleElement = documentRoot.createElement(STYLE_ELEMENT_TAG_NAME)
      styleElement.setAttribute(FEATURE_STYLE_MARKER_ATTRIBUTE_NAME, featureContent.meta.id)
      styleElement.setAttribute(MEDIA_ATTRIBUTE_NAME, INACTIVE_STYLE_MEDIA_QUERY)
      styleElement.textContent = featureContent.styles
      const styleParent = documentRoot.head ?? documentRoot.documentElement
      styleParent.append(styleElement)
      featureStyleElements.set(featureContent.meta.id, styleElement)
    }
  }

  function warnAboutForeignStyles(): void {
    if (hasWarnedAboutForeignStyles) {
      return
    }
    const foreignStyleElement = documentRoot.querySelector(
      `${STYLE_ELEMENT_TAG_NAME}[${FEATURE_STYLE_MARKER_ATTRIBUTE_NAME}]`,
    )
    if (foreignStyleElement !== null) {
      hasWarnedAboutForeignStyles = true
      logger.warn(FOREIGN_STYLE_WARNING)
    }
  }

  function removeFeatureStateAttributes(featureId: string): void {
    const stateAttributePrefix = `${createFeatureAttributeName(featureId)}${FEATURE_STATE_SEPARATOR}`
    const rootElement = documentRoot.documentElement
    for (const attributeName of rootElement.getAttributeNames()) {
      if (attributeName.startsWith(stateAttributePrefix)) {
        rootElement.removeAttribute(attributeName)
      }
    }
  }

  function runFeatureCleanup(activation: FeatureActivation): void {
    if (activation.isCleanupCalled || activation.cleanup === undefined) {
      return
    }
    activation.isCleanupCalled = true
    try {
      activation.cleanup()
    } catch (cleanupError) {
      logger.error(CLEANUP_FAILURE_MESSAGE, cleanupError)
    }
  }

  function registerFeatureCleanup(
    activation: FeatureActivation,
    mountResult: FeatureMountResult,
  ): void {
    if (typeof mountResult !== 'function') {
      return
    }
    activation.cleanup = mountResult
    if (activation.isDisposed) {
      runFeatureCleanup(activation)
    }
  }

  /**
   * Асинхронное монтирование может отклониться уже после того, как функцию выключили и снова
   * включили, поэтому выключается только та активация, которая монтировалась.
   */
  function handleMountFailure(
    activation: FeatureActivation,
    featureId: string,
    mountError: unknown,
  ): void {
    logger.error(MOUNT_FAILURE_MESSAGE, featureId, mountError)
    if (activations.get(featureId) !== activation) {
      return
    }
    disableFeature(featureId)
  }

  function enableFeature(featureContent: FeatureContent): void {
    const featureId = featureContent.meta.id
    if (activations.has(featureId)) {
      return
    }

    const scope = createLifecycleScope()
    const activation: FeatureActivation = {
      scope,
      cleanup: undefined,
      isDisposed: false,
      isCleanupCalled: false,
    }
    activations.set(featureId, activation)
    featureStyleElements.get(featureId)?.removeAttribute(MEDIA_ATTRIBUTE_NAME)
    documentRoot.documentElement.setAttribute(
      createFeatureAttributeName(featureId),
      ENABLED_ATTRIBUTE_VALUE,
    )

    const { mount } = featureContent
    if (mount === undefined) {
      return
    }

    try {
      const mountResult = mount({
        documentRoot,
        signal: scope.signal,
        lifecycle: scope.lifecycle,
      })
      if (mountResult instanceof Promise) {
        void mountResult.then(
          (cleanup) => {
            registerFeatureCleanup(activation, cleanup)
          },
          (mountError: unknown) => {
            handleMountFailure(activation, featureId, mountError)
          },
        )
        return
      }
      registerFeatureCleanup(activation, mountResult)
    } catch (mountError) {
      handleMountFailure(activation, featureId, mountError)
    }
  }

  function disableFeature(featureId: string): void {
    const activation = activations.get(featureId)
    if (activation === undefined) {
      return
    }
    activations.delete(featureId)
    activation.isDisposed = true
    activation.scope.dispose()
    runFeatureCleanup(activation)
    removeFeatureStateAttributes(featureId)
    featureStyleElements
      .get(featureId)
      ?.setAttribute(MEDIA_ATTRIBUTE_NAME, INACTIVE_STYLE_MEDIA_QUERY)
    documentRoot.documentElement.removeAttribute(createFeatureAttributeName(featureId))
  }

  function applyEnabled(featureId: string, isEnabled: boolean): void {
    const featureContent = featureContentById.get(featureId)
    if (featureContent === undefined) {
      return
    }
    if (isEnabled) {
      enableFeature(featureContent)
      return
    }
    disableFeature(featureId)
  }

  function isChatListRoute(): boolean {
    return CHAT_LIST_ROUTE_HASH_PATTERN.test(documentRoot.location?.hash ?? '')
  }

  function reportMissingAnchorSelectors(): void {
    if (documentRoot.querySelector(siteSelectors.layoutPane) === null) {
      return
    }
    for (const featureContent of featureContents) {
      if (!activations.has(featureContent.meta.id)) {
        continue
      }
      const missingSelectors = (featureContent.anchorSelectors ?? []).filter(
        (anchorSelector) => documentRoot.querySelector(anchorSelector) === null,
      )
      if (missingSelectors.length > 0) {
        logger.warn(MISSING_ANCHOR_SELECTORS_MESSAGE, featureContent.meta.id, missingSelectors)
      }
    }
  }

  function startAnchorDiagnosticsTimer(): void {
    hasScheduledAnchorDiagnostics = true
    runtimeScope?.lifecycle.setTimeout(
      reportMissingAnchorSelectors,
      ANCHOR_DIAGNOSTICS_DELAY_MILLISECONDS,
    )
  }

  function scheduleAnchorDiagnostics(): void {
    if (hasScheduledAnchorDiagnostics || runtimeScope === null) {
      return
    }
    if (isChatListRoute()) {
      startAnchorDiagnosticsTimer()
      return
    }
    const windowTarget = documentRoot.defaultView
    if (windowTarget === null) {
      return
    }
    runtimeScope.lifecycle.addEventListener(windowTarget, HASH_CHANGE_EVENT_NAME, () => {
      if (hasScheduledAnchorDiagnostics || !isChatListRoute()) {
        return
      }
      startAnchorDiagnosticsTimer()
    })
  }

  function checkContextValidity(): void {
    if (!contentScriptLifecycle.isValid) {
      stop()
    }
  }

  /**
   * Подписка и проверка живут в области запуска: интервал снимается вместе с ней, а слушатель
   * инвалидации снимается своим отписчиком, поэтому после stop() ничего не тикает и повторный
   * запуск не копит подписки.
   */
  function subscribeToContentScriptContext(scope: LifecycleScope): void {
    if (isContextSubscribed) {
      return
    }
    isContextSubscribed = true
    removeInvalidationListener = contentScriptLifecycle.onInvalidated(stop)
    scope.lifecycle.setInterval(checkContextValidity, CONTEXT_VALIDITY_CHECK_INTERVAL_MILLISECONDS)
  }

  function unsubscribeFromContentScriptContext(): void {
    if (!isContextSubscribed) {
      return
    }
    isContextSubscribed = false
    removeInvalidationListener?.()
    removeInvalidationListener = undefined
  }

  async function start(): Promise<void> {
    if (isRunning) {
      return
    }
    isRunning = true

    const scope = createLifecycleScope()
    runtimeScope = scope
    subscribeToContentScriptContext(scope)
    warnAboutForeignStyles()
    createFeatureStyleElements()
    scope.lifecycle.addEventListener(
      documentRoot,
      VISIBILITY_CHANGE_EVENT_NAME,
      checkContextValidity,
    )

    const enabledByFeatureId = await settingsSource.getAllEnabled()
    if (!isRunning) {
      return
    }

    for (const featureMeta of featureMetas) {
      applyEnabled(
        featureMeta.id,
        enabledByFeatureId.get(featureMeta.id) ?? featureMeta.defaultEnabled,
      )
    }

    for (const featureMeta of featureMetas) {
      unwatchCallbacks.push(
        settingsSource.watchEnabled(featureMeta, (isEnabled) => {
          applyEnabled(featureMeta.id, isEnabled)
        }),
      )
    }

    scheduleAnchorDiagnostics()
  }

  function stop(): void {
    if (!isRunning) {
      return
    }
    isRunning = false
    unsubscribeFromContentScriptContext()

    for (const unwatch of unwatchCallbacks) {
      try {
        unwatch()
      } catch (unwatchError) {
        logger.warn(UNWATCH_FAILURE_MESSAGE, unwatchError)
      }
    }
    unwatchCallbacks.length = 0

    for (const featureId of [...activations.keys()]) {
      disableFeature(featureId)
    }

    runtimeScope?.dispose()
    runtimeScope = null

    for (const styleElement of featureStyleElements.values()) {
      styleElement.remove()
    }
    featureStyleElements.clear()
  }

  return { start, stop }
}
