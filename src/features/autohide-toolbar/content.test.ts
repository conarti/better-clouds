import { afterEach, describe, expect, it } from 'vitest'
import { createLifecycleScope, type LifecycleScope } from '@/shared/feature/lifecycle-scope'
import type { FeatureCleanup } from '@/shared/feature/feature-types'
import featureContent from './content'
import { keyboardNavigationAttributeName } from './styles'

const KEYDOWN_EVENT_NAME = 'keydown'
const POINTER_MOVE_EVENT_NAME = 'pointermove'
const POINTER_DOWN_EVENT_NAME = 'pointerdown'
const TAB_KEY_NAME = 'Tab'
const ESCAPE_KEY_NAME = 'Escape'

let lifecycleScope: LifecycleScope | null = null
let cleanup: FeatureCleanup | null = null

function mountFeature(): void {
  const { mount } = featureContent
  expect(mount).toBeDefined()
  const scope = createLifecycleScope()
  lifecycleScope = scope
  const mountResult = mount?.({
    documentRoot: document,
    signal: scope.signal,
    lifecycle: scope.lifecycle,
  })
  expect(typeof mountResult).toBe('function')
  cleanup = mountResult as FeatureCleanup
}

function unmountFeature(): void {
  lifecycleScope?.dispose()
  cleanup?.()
  lifecycleScope = null
  cleanup = null
}

function pressKey(keyName: string): void {
  document.dispatchEvent(new KeyboardEvent(KEYDOWN_EVENT_NAME, { key: keyName }))
}

function hasKeyboardNavigationAttribute(): boolean {
  return document.documentElement.hasAttribute(keyboardNavigationAttributeName)
}

describe('autohide-toolbar mount', () => {
  afterEach(() => {
    unmountFeature()
    document.documentElement.removeAttribute(keyboardNavigationAttributeName)
  })

  it('отмечает клавиатурную навигацию по Tab', () => {
    mountFeature()
    expect(hasKeyboardNavigationAttribute()).toBe(false)
    pressKey(TAB_KEY_NAME)
    expect(hasKeyboardNavigationAttribute()).toBe(true)
  })

  it('не отмечает навигацию по другим клавишам', () => {
    mountFeature()
    pressKey(ESCAPE_KEY_NAME)
    expect(hasKeyboardNavigationAttribute()).toBe(false)
  })

  it('снимает отметку по движению и нажатию указателя', () => {
    mountFeature()
    pressKey(TAB_KEY_NAME)
    document.dispatchEvent(new Event(POINTER_MOVE_EVENT_NAME))
    expect(hasKeyboardNavigationAttribute()).toBe(false)

    pressKey(TAB_KEY_NAME)
    document.dispatchEvent(new Event(POINTER_DOWN_EVENT_NAME))
    expect(hasKeyboardNavigationAttribute()).toBe(false)
  })

  it('после выключения снимает атрибут и не оставляет слушателей', () => {
    mountFeature()
    pressKey(TAB_KEY_NAME)
    unmountFeature()
    expect(hasKeyboardNavigationAttribute()).toBe(false)

    pressKey(TAB_KEY_NAME)
    expect(hasKeyboardNavigationAttribute()).toBe(false)
  })
})
