import type { Logger } from '@/shared/logging/logger'
import { FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME } from './feature-scope'
import type { FeatureLifecycle } from './feature-types'

const INSTANCE_ID_RADIX = 36
const INSTANCE_ID_START_INDEX = 2
const INSTANCE_ID_END_INDEX = 10

/** Разделитель идентификатора функции и идентификатора экземпляра в маркере владения */
export const OWNED_ELEMENT_MARKER_SEPARATOR = ':'

const FOREIGN_COPY_MESSAGE =
  'Узел функции от другой копии расширения не убран за кадр, добавлен собственный'

/**
 * Идентификатор этой копии content script. Две копии расширения (dev и release) получают
 * разные значения, поэтому каждая убирает только свои узлы
 */
const instanceId = Math.random()
  .toString(INSTANCE_ID_RADIX)
  .slice(INSTANCE_ID_START_INDEX, INSTANCE_ID_END_INDEX)

/** Значение маркера владения узлов функции этой копии: `<featureId>:<instanceId>` */
export function createOwnedElementMarkerValue(featureId: string): string {
  return `${featureId}${OWNED_ELEMENT_MARKER_SEPARATOR}${instanceId}`
}

/** Помечает узел как собственный узел функции этой копии */
export function markOwnedElement<ElementType extends Element>(
  element: ElementType,
  featureId: string,
): ElementType {
  element.setAttribute(
    FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME,
    createOwnedElementMarkerValue(featureId),
  )
  return element
}

function isOwnedByFeature(element: Element, featureId: string): boolean {
  const markerValue = element.getAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME)
  return markerValue?.startsWith(`${featureId}${OWNED_ELEMENT_MARKER_SEPARATOR}`) === true
}

/** Узел функции, добавленный этой копией */
export function isOwnElement(element: Element, featureId: string): boolean {
  return (
    element.getAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME) ===
    createOwnedElementMarkerValue(featureId)
  )
}

/** Прямой ребёнок контейнера, который добавила та же функция другой копии расширения */
export function findForeignOwnedChild(container: Element, featureId: string): Element | null {
  return (
    Array.from(container.children).find(
      (child) => isOwnedByFeature(child, featureId) && !isOwnElement(child, featureId),
    ) ?? null
  )
}

/** Удаляет узлы функции этой копии; узлы другой копии остаются на месте */
export function removeOwnElements(root: ParentNode, featureId: string): void {
  const ownSelector = `[${FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME}="${createOwnedElementMarkerValue(featureId)}"]`
  for (const element of root.querySelectorAll(ownSelector)) {
    element.remove()
  }
}

export interface InjectedElementKeeperOptions {
  readonly featureId: string
  readonly element: Element
  readonly lifecycle: FeatureLifecycle
  readonly logger: Logger
}

/** Держит собственный узел последним ребёнком контейнера, который перерисовывает React */
export interface InjectedElementKeeper {
  keep(container: Element | null): void
}

/**
 * Узел добавляется только в конец контейнера: так он не сдвигает позиционные селекторы
 * детей клиента. Если в контейнере уже есть узел той же функции от другой копии, вставка
 * откладывается на кадр: та копия могла как раз убирать свой узел. Если чужой узел пережил
 * перепроверку, он считается устаревшим, и свой узел вставляется с предупреждением
 */
export function createInjectedElementKeeper({
  featureId,
  element,
  lifecycle,
  logger,
}: InjectedElementKeeperOptions): InjectedElementKeeper {
  const recheckedForeignElements = new WeakSet<Element>()
  let isForeignCopyReported = false

  function keep(container: Element | null): void {
    if (container === null || container.lastElementChild === element) {
      return
    }
    const foreignElement = findForeignOwnedChild(container, featureId)
    if (foreignElement !== null) {
      if (!recheckedForeignElements.has(foreignElement)) {
        recheckedForeignElements.add(foreignElement)
        lifecycle.requestAnimationFrame(() => {
          keep(container)
        })
        return
      }
      if (!isForeignCopyReported) {
        isForeignCopyReported = true
        logger.warn(FOREIGN_COPY_MESSAGE, featureId)
      }
    }
    container.append(element)
  }

  return { keep }
}
