/** Общий префикс всех атрибутов расширения на корне документа */
export const FEATURE_ATTRIBUTE_PREFIX = 'data-better-clouds-'

/**
 * Разделитель между идентификатором функции и именем состояния. В идентификаторе функции
 * подчёркивание запрещено, поэтому уборка по префиксу не задевает атрибуты соседней функции.
 */
export const FEATURE_STATE_SEPARATOR = '_'

/** Маркер собственных элементов со стилями: по нему видно вторую копию расширения на странице */
export const FEATURE_STYLE_MARKER_ATTRIBUTE_NAME = 'data-better-clouds-feature-style'

/** Медиазапрос выключенной функции: правила остаются в документе, но не участвуют в каскаде */
export const INACTIVE_STYLE_MEDIA_QUERY = 'not all'

/** Идентификаторы, занятые ядром и недоступные функциям */
export const RESERVED_FEATURE_IDS = ['site'] as const

/** Идентификатор функции: строчные буквы и цифры через дефис */
export const FEATURE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/**
 * Несуществующий идентификатор в :not(). Каждый повтор добавляет к специфичности (1,0,0),
 * а стили расширения попадают в документ раньше стилей сайта и без запаса проигрывали бы
 * ему при равной специфичности.
 */
export const SPECIFICITY_GUARD_ID = 'better-clouds-specificity-guard'

/**
 * Максимальная специфичность правил сайта для целевых элементов равна (0,1,0) и среди них
 * нет селекторов с идентификатором, поэтому одного повтора достаточно.
 */
export const SPECIFICITY_GUARD_COUNT = 1

const DOCUMENT_ROOT_TAG_NAME = 'html'

/** Имя атрибута включённой функции на корне документа */
export function createFeatureAttributeName(featureId: string): string {
  return `${FEATURE_ATTRIBUTE_PREFIX}${featureId}`
}

/** Имя атрибута состояния функции на корне документа */
export function createFeatureStateAttributeName(featureId: string, stateName: string): string {
  return `${createFeatureAttributeName(featureId)}${FEATURE_STATE_SEPARATOR}${stateName}`
}

/** Начало каждого правила функции: включённость плюс запас специфичности */
export function createFeatureScopeSelector(featureId: string): string {
  const specificityGuard = `:not(#${SPECIFICITY_GUARD_ID})`.repeat(SPECIFICITY_GUARD_COUNT)
  return `${DOCUMENT_ROOT_TAG_NAME}[${createFeatureAttributeName(featureId)}]${specificityGuard}`
}
