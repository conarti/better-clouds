/** Сериализуемые метаданные функции: читаются попапом и content script */
export interface FeatureMeta {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly defaultEnabled: boolean
}

/**
 * Вид опции попапа: список переключателей по значениям, которые content script обнаружил
 * на странице. Значение с префиксом, чтобы не совпасть с классом сайта
 */
export const FEATURE_OPTION_CHECKLIST_KIND = 'feature-option-checklist'

/** Источник значений опции: снимок, который content script записал в storage.local */
export const DISCOVERED_VALUES_SOURCE = 'discovered'

/** Не больше стольких обнаруженных значений хранится и показывается в попапе */
export const MAXIMUM_DISCOVERED_VALUE_COUNT = 50

/**
 * Значения длиннее этого не сохраняются: выбранные значения лежат в sync, где на элемент
 * отведено 8192 байт, и 50 значений по 64 символа кириллицы туда помещаются
 */
export const MAXIMUM_DISCOVERED_VALUE_LENGTH = 64

/** Опция попапа: выбор нескольких значений из обнаруженных на странице */
export interface FeatureChecklistOption {
  readonly kind: typeof FEATURE_OPTION_CHECKLIST_KIND
  readonly source: typeof DISCOVERED_VALUES_SOURCE
  /** Ключ параметра в хранимом значении функции, туда пишется список выбранных значений */
  readonly optionKey: string
  readonly title: string
  /** Подсказка, пока ни одного значения не обнаружено */
  readonly emptyText: string
  /** Подсказка, когда часть значений не поместилась в лимиты */
  readonly truncatedText: string
  /** Выбранные значения из хранимого значения функции, интерпретирует владелец схемы */
  resolveSelectedValues(storedValue: unknown): readonly string[]
}

export type FeaturePopupOption = FeatureChecklistOption

/** Схема хранения функции из необязательного settings.ts: безопасна для попапа */
export interface FeatureSettingsDefinition {
  readonly version: number
  readonly migrations: Readonly<Record<number, (previousValue: unknown) => unknown>>
  /** Опции, которые попап рисует под тумблером функции общим компонентом */
  readonly popupOptions?: readonly FeaturePopupOption[]
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
  /**
   * Наблюдатель изменений, вызывающий обработчик не чаще раза за кадр. Наблюдатель снимается
   * при выключении функции или возвращённой функцией отключения
   */
  observeMutations(target: Node, callback: () => void, options: MutationObserverInit): () => void
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
