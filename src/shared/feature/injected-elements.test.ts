import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '@/shared/logging/logger'
import { FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME } from './feature-scope'
import {
  createInjectedElementKeeper,
  createOwnedElementMarkerValue,
  findForeignOwnedChild,
  isOwnElement,
  markOwnedElement,
  removeOwnElements,
} from './injected-elements'
import { createLifecycleScope, type LifecycleScope } from './lifecycle-scope'

const FEATURE_ID = 'stub-feature'
const OTHER_FEATURE_ID = 'other-feature'
const FOREIGN_MARKER_VALUE = `${FEATURE_ID}:foreign-instance`
const ELEMENT_TAG_NAME = 'div'

let scope: LifecycleScope | null = null

function createLogger(): Logger {
  return { warn: vi.fn(), error: vi.fn() }
}

function createElement(): HTMLElement {
  return document.createElement(ELEMENT_TAG_NAME)
}

function createForeignElement(): HTMLElement {
  const element = createElement()
  element.setAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME, FOREIGN_MARKER_VALUE)
  return element
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })
}

afterEach(() => {
  scope?.dispose()
  scope = null
  document.body.innerHTML = ''
})

describe('маркер владения', () => {
  it('содержит идентификатор функции и экземпляра', () => {
    const element = markOwnedElement(createElement(), FEATURE_ID)
    const markerValue = element.getAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME)
    expect(markerValue).toBe(createOwnedElementMarkerValue(FEATURE_ID))
    expect(markerValue?.startsWith(`${FEATURE_ID}:`)).toBe(true)
    expect(isOwnElement(element, FEATURE_ID)).toBe(true)
    expect(isOwnElement(createForeignElement(), FEATURE_ID)).toBe(false)
  })

  it('уборка удаляет только узлы своей копии', () => {
    const container = createElement()
    const ownElement = markOwnedElement(createElement(), FEATURE_ID)
    const foreignElement = createForeignElement()
    const otherFeatureElement = markOwnedElement(createElement(), OTHER_FEATURE_ID)
    container.append(ownElement, foreignElement, otherFeatureElement)

    removeOwnElements(container, FEATURE_ID)

    expect([...container.children]).toEqual([foreignElement, otherFeatureElement])
  })

  it('находит узел той же функции другой копии', () => {
    const container = createElement()
    const foreignElement = createForeignElement()
    container.append(markOwnedElement(createElement(), FEATURE_ID), foreignElement)
    expect(findForeignOwnedChild(container, FEATURE_ID)).toBe(foreignElement)
    expect(findForeignOwnedChild(container, OTHER_FEATURE_ID)).toBeNull()
  })
})

describe('createInjectedElementKeeper', () => {
  function createKeeper(element: Element, logger: Logger = createLogger()) {
    scope = createLifecycleScope()
    return createInjectedElementKeeper({
      featureId: FEATURE_ID,
      element,
      lifecycle: scope.lifecycle,
      logger,
    })
  }

  it('добавляет узел в конец и возвращает его туда после вставки клиента', () => {
    const container = createElement()
    container.append(createElement())
    const element = markOwnedElement(createElement(), FEATURE_ID)
    const keeper = createKeeper(element)

    keeper.keep(container)
    expect(container.lastElementChild).toBe(element)

    container.append(createElement())
    keeper.keep(container)
    expect(container.lastElementChild).toBe(element)
    expect(container.children).toHaveLength(3)
  })

  it('возвращает узел, который убрала перерисовка, и не падает без контейнера', () => {
    const container = createElement()
    const element = markOwnedElement(createElement(), FEATURE_ID)
    const keeper = createKeeper(element)
    keeper.keep(null)
    keeper.keep(container)
    element.remove()
    keeper.keep(container)
    expect(container.lastElementChild).toBe(element)
  })

  it('при чужом узле ждёт кадр, затем вставляет свой с одним предупреждением', async () => {
    const container = createElement()
    container.append(createForeignElement())
    const element = markOwnedElement(createElement(), FEATURE_ID)
    const logger = createLogger()
    const keeper = createKeeper(element, logger)

    keeper.keep(container)
    expect(element.parentElement).toBeNull()

    await waitForAnimationFrame()
    await waitForAnimationFrame()
    expect(container.lastElementChild).toBe(element)
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('если чужой узел убран за кадр, свой вставляется без предупреждения', async () => {
    const container = createElement()
    const foreignElement = createForeignElement()
    container.append(foreignElement)
    const element = markOwnedElement(createElement(), FEATURE_ID)
    const logger = createLogger()
    const keeper = createKeeper(element, logger)

    keeper.keep(container)
    foreignElement.remove()
    await waitForAnimationFrame()
    await waitForAnimationFrame()

    expect(container.lastElementChild).toBe(element)
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
