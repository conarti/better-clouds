/** Сериализуемые метаданные функции: читаются попапом и content script */
export interface FeatureMeta {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly defaultEnabled: boolean
}

/** Схема хранения функции из необязательного settings.ts: безопасна для попапа */
export interface FeatureSettingsDefinition {
  readonly version: number
  readonly migrations: Readonly<Record<number, (previousValue: unknown) => unknown>>
}

/** Уборка, которую вернуло монтирование: снимает всё, что создало именно это монтирование */
export type FeatureCleanup = () => void

export type FeatureMountResult = void | FeatureCleanup

/**
 * Хелперы, которые перестают работать при выключении функции и при инвалидации контекста.
 * Хелперы ContentScriptContext для ресурсов функции не годятся: они снимаются только
 * при инвалидации и на каждый вызов добавляют подписку на неё.
 */
export interface FeatureLifecycle {
  setTimeout(handler: () => void, delayMilliseconds: number): void
  setInterval(handler: () => void, intervalMilliseconds: number): void
  requestAnimationFrame(callback: FrameRequestCallback): void
  addEventListener(
    target: EventTarget,
    eventName: string,
    listener: EventListener,
    options?: Omit<AddEventListenerOptions, 'signal'>,
  ): void
}

export interface FeatureMountContext {
  readonly documentRoot: Document
  readonly signal: AbortSignal
  readonly lifecycle: FeatureLifecycle
}

export interface FeatureContent<Meta extends FeatureMeta = FeatureMeta> {
  readonly meta: Meta
  readonly styles?: string
  /** Селекторы, по отсутствию которых видно, что разметка сайта изменилась */
  readonly anchorSelectors?: readonly string[]
  readonly mount?: (
    context: FeatureMountContext,
  ) => FeatureMountResult | Promise<FeatureMountResult>
}
