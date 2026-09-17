import { defineFeatureContent } from '@/shared/feature/define-feature'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { featureStyles, keyboardNavigationAttributeName } from './styles'

const KEYDOWN_EVENT_NAME = 'keydown'
const POINTER_MOVE_EVENT_NAME = 'pointermove'
const POINTER_DOWN_EVENT_NAME = 'pointerdown'
const TAB_KEY_NAME = 'Tab'
const STATE_ATTRIBUTE_VALUE = ''

/**
 * Единственная JS-ветка функции. Разведка D6: в Chromium 153 элемент, сфокусированный мышью,
 * начинает соответствовать :focus-visible после любого нажатия клавиши, поэтому колонка
 * осталась бы раскрытой после Escape. Признак «фокус пришёл с клавиатуры» ставится здесь.
 */
export default defineFeatureContent({
  meta: featureMeta,
  styles: featureStyles,
  anchorSelectors: [siteSelectors.toolbar],
  mount({ documentRoot, lifecycle }) {
    const rootElement = documentRoot.documentElement

    function rememberKeyboardNavigation(event: Event): void {
      if ((event as KeyboardEvent).key === TAB_KEY_NAME) {
        rootElement.setAttribute(keyboardNavigationAttributeName, STATE_ATTRIBUTE_VALUE)
      }
    }

    function forgetKeyboardNavigation(): void {
      rootElement.removeAttribute(keyboardNavigationAttributeName)
    }

    lifecycle.addEventListener(documentRoot, KEYDOWN_EVENT_NAME, rememberKeyboardNavigation, {
      capture: true,
    })
    lifecycle.addEventListener(documentRoot, POINTER_MOVE_EVENT_NAME, forgetKeyboardNavigation, {
      capture: true,
      passive: true,
    })
    lifecycle.addEventListener(documentRoot, POINTER_DOWN_EVENT_NAME, forgetKeyboardNavigation, {
      capture: true,
      passive: true,
    })

    return forgetKeyboardNavigation
  },
})
