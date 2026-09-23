import { css } from '@/shared/feature/css'
import {
  createFeatureScopeSelector,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

/** Видимая полоса колонки в покое: за неё колонка вытягивается наведением */
const EDGE_STRIP_WIDTH_PIXELS = 8

/**
 * Разведка D10: сайт задаёт колонке 84px, а в @media screen and (max-width: 1919px)
 * сужает её до 64px. Ширину мы объявляем сами теми же значениями и на той же границе,
 * а смещение и обрезка считаются из неё, поэтому геометрия остаётся согласованной.
 */
const TOOLBAR_WIDE_WINDOW_WIDTH_PIXELS = 84
const TOOLBAR_NARROW_WINDOW_WIDTH_PIXELS = 64
const TOOLBAR_NARROW_WINDOW_MAX_WIDTH_PIXELS = 1919

/** Точка непрочитанных уведомлений: центр колокольчика в 104px от низа колонки (разведка D5) */
const NOTIFICATION_DOT_SIZE_PIXELS = 8
const NOTIFICATION_DOT_BOTTOM_PIXELS = 100

const TOOLBAR_SHOW_DURATION_MILLISECONDS = 150
const TOOLBAR_HIDE_DURATION_MILLISECONDS = 150
const TOOLBAR_HIDE_DELAY_MILLISECONDS = 400
const INSTANT_DELAY_MILLISECONDS = 0
const DISABLED_ANIMATION_DURATION_MILLISECONDS = 0

/** Разведка D7: выше меню и панелей списка (10 и 15), ниже тостов, тултипов и модальных окон */
const TOOLBAR_Z_INDEX = 20

const TOOLBAR_WIDTH_PROPERTY = '--better-clouds-toolbar-width'
const TOOLBAR_HIDDEN_OFFSET_PROPERTY = '--better-clouds-toolbar-hidden-offset'
const TOOLBAR_SHOW_DURATION_PROPERTY = '--better-clouds-toolbar-show-duration'
const TOOLBAR_HIDE_DURATION_PROPERTY = '--better-clouds-toolbar-hide-duration'
const TOOLBAR_HIDE_DELAY_PROPERTY = '--better-clouds-toolbar-hide-delay'
const NOTIFICATION_DOT_COLOR_PROPERTY = '--better-clouds-notification-dot-color'

const TOOLBAR_EXPANDED_SHADOW = '4px 0 16px rgb(0 0 0 / 12%)'
const TOOLBAR_EXPANDED_CLIP_PATH = 'inset(-100vh -100vw -100vh 0)'
const TRANSITIONED_PROPERTY_LIST = 'left, clip-path, box-shadow'
const SELECTOR_SEPARATOR = ',\n  '

/** Имя состояния и атрибут для JS-ветки: клавиатурная навигация (разведка D6) */
const KEYBOARD_NAVIGATION_STATE_NAME = 'keyboard-navigation'

export const keyboardNavigationAttributeName = createFeatureStateAttributeName(
  featureMeta.id,
  KEYBOARD_NAVIGATION_STATE_NAME,
)

const featureScope = createFeatureScopeSelector(featureMeta.id)
const keyboardNavigationScope = `${featureScope}[${keyboardNavigationAttributeName}]`

/**
 * Три состояния раскрытия: курсор на колонке, фокус пришёл с клавиатуры, открыто меню самой
 * колонки. Псевдокласс :focus-visible не годится (разведка D6), поэтому фокус учитывается
 * только при атрибуте клавиатурной навигации, который ставит content.ts.
 */
const expandedToolbarSelectors = [
  `${featureScope} ${siteSelectors.toolbar}:hover`,
  `${keyboardNavigationScope} ${siteSelectors.toolbar}:focus-within`,
  `${featureScope}:has(${siteSelectors.toolbarOpenMenu}) ${siteSelectors.toolbar}`,
]

const expandedToolbarSelectorList = expandedToolbarSelectors.join(SELECTOR_SEPARATOR)
const expandedToolbarMarkerSelectorList = expandedToolbarSelectors
  .map((expandedSelector) => `${expandedSelector}::before`)
  .join(SELECTOR_SEPARATOR)

/**
 * Длительности живут в переменных, поэтому режим отключённых анимаций обнуляет их одним
 * правилом. Объявления transition-* идут с !important: правило доступности клиента для
 * режима отключённых анимаций объявляет с !important весь набор transition-*, включая
 * transition-property: none (разведка D2 и D13), и иначе отключило бы задержку скрытия.
 */
export const featureStyles = css`
  ${featureScope} {
    ${TOOLBAR_WIDTH_PROPERTY}: ${TOOLBAR_WIDE_WINDOW_WIDTH_PIXELS}px;
    ${TOOLBAR_HIDDEN_OFFSET_PROPERTY}: calc(
      var(${TOOLBAR_WIDTH_PROPERTY}) - ${EDGE_STRIP_WIDTH_PIXELS}px
    );
    ${TOOLBAR_SHOW_DURATION_PROPERTY}: ${TOOLBAR_SHOW_DURATION_MILLISECONDS}ms;
    ${TOOLBAR_HIDE_DURATION_PROPERTY}: ${TOOLBAR_HIDE_DURATION_MILLISECONDS}ms;
    ${TOOLBAR_HIDE_DELAY_PROPERTY}: ${TOOLBAR_HIDE_DELAY_MILLISECONDS}ms;
    ${NOTIFICATION_DOT_COLOR_PROPERTY}: var(${siteCustomPropertyNames.buttonPrimary}, currentColor);
  }
  @media screen and (max-width: ${TOOLBAR_NARROW_WINDOW_MAX_WIDTH_PIXELS}px) {
    ${featureScope} {
      ${TOOLBAR_WIDTH_PROPERTY}: ${TOOLBAR_NARROW_WINDOW_WIDTH_PIXELS}px;
    }
  }
  ${featureScope} ${siteSelectors.toolbar} {
    box-sizing: border-box;
    position: relative;
    z-index: ${TOOLBAR_Z_INDEX};
    width: var(${TOOLBAR_WIDTH_PROPERTY});
    min-width: var(${TOOLBAR_WIDTH_PROPERTY});
    margin-right: calc(-1 * var(${TOOLBAR_HIDDEN_OFFSET_PROPERTY}));
    left: calc(-1 * var(${TOOLBAR_HIDDEN_OFFSET_PROPERTY}));
    clip-path: inset(0 0 0 var(${TOOLBAR_HIDDEN_OFFSET_PROPERTY}));
    transition-property: ${TRANSITIONED_PROPERTY_LIST} !important;
    transition-timing-function: ease-in;
    transition-duration: var(${TOOLBAR_HIDE_DURATION_PROPERTY}) !important;
    transition-delay: var(${TOOLBAR_HIDE_DELAY_PROPERTY}) !important;
  }
  ${expandedToolbarSelectorList} {
    left: 0;
    clip-path: ${TOOLBAR_EXPANDED_CLIP_PATH};
    box-shadow: ${TOOLBAR_EXPANDED_SHADOW};
    transition-duration: var(${TOOLBAR_SHOW_DURATION_PROPERTY}) !important;
    transition-delay: ${INSTANT_DELAY_MILLISECONDS}ms !important;
  }
  ${featureScope} ${siteSelectors.toolbar}:has(${siteSelectors.toolbarNotificationBadge})::before {
    content: '';
    position: absolute;
    right: 0;
    bottom: ${NOTIFICATION_DOT_BOTTOM_PIXELS}px;
    width: ${NOTIFICATION_DOT_SIZE_PIXELS}px;
    height: ${NOTIFICATION_DOT_SIZE_PIXELS}px;
    border-radius: 50%;
    background: var(${NOTIFICATION_DOT_COLOR_PROPERTY});
  }
  ${expandedToolbarMarkerSelectorList} {
    opacity: 0;
  }
  @media (hover: none) {
    ${featureScope} ${siteSelectors.toolbar} {
      margin-right: 0;
      left: 0;
      clip-path: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    ${featureScope} {
      ${TOOLBAR_SHOW_DURATION_PROPERTY}: ${DISABLED_ANIMATION_DURATION_MILLISECONDS}ms;
      ${TOOLBAR_HIDE_DURATION_PROPERTY}: ${DISABLED_ANIMATION_DURATION_MILLISECONDS}ms;
    }
  }
  ${featureScope} ${siteSelectors.reducedAnimationsBody} {
    ${TOOLBAR_SHOW_DURATION_PROPERTY}: ${DISABLED_ANIMATION_DURATION_MILLISECONDS}ms;
    ${TOOLBAR_HIDE_DURATION_PROPERTY}: ${DISABLED_ANIMATION_DURATION_MILLISECONDS}ms;
  }
`
