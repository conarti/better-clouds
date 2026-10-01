import {
  DISCOVERED_VALUES_SOURCE,
  FEATURE_OPTION_CHECKLIST_KIND,
  MAXIMUM_DISCOVERED_VALUE_COUNT,
  type FeatureSettingsDefinition,
} from '@/shared/feature/feature-types'

/** Ключ списка выбранных тегов в хранимом значении функции */
export const SELECTED_TAG_NAMES_OPTION_KEY = 'selectedTagNames'

const TAG_LIST_TITLE = 'Теги'
const EMPTY_TAG_LIST_TEXT =
  'Тегов пока нет. Включите функцию и откройте Клаудс, чтобы расширение увидело теги'
const TRUNCATED_TAG_LIST_TEXT = `Показаны не все теги: в списке до ${MAXIMUM_DISCOVERED_VALUE_COUNT} тегов с короткими именами`

/**
 * Выбранные теги из сохранённого значения. Хранятся имена: у вкладки тега нет другого
 * признака. Переименованный или удалённый тег остаётся в списке, но просто ни с чем не
 * совпадает. Не строки и повторы отбрасываются, длина ограничена лимитом обнаруженных тегов
 */
export function resolveSelectedTagNames(storedValue: unknown): readonly string[] {
  if (typeof storedValue !== 'object' || storedValue === null) {
    return []
  }
  const { selectedTagNames } = storedValue as { selectedTagNames?: unknown }
  if (!Array.isArray(selectedTagNames)) {
    return []
  }
  const tagNames = selectedTagNames.filter(
    (tagName, index): tagName is string =>
      typeof tagName === 'string' && selectedTagNames.indexOf(tagName) === index,
  )
  return tagNames.slice(0, MAXIMUM_DISCOVERED_VALUE_COUNT)
}

/** Значение {enabled, selectedTagNames}; без поля selectedTagNames ни один тег не выбран */
export const featureSettings = {
  version: 1,
  migrations: {},
  popupOptions: [
    {
      kind: FEATURE_OPTION_CHECKLIST_KIND,
      source: DISCOVERED_VALUES_SOURCE,
      optionKey: SELECTED_TAG_NAMES_OPTION_KEY,
      title: TAG_LIST_TITLE,
      emptyText: EMPTY_TAG_LIST_TEXT,
      truncatedText: TRUNCATED_TAG_LIST_TEXT,
      resolveSelectedValues: resolveSelectedTagNames,
    },
  ],
} satisfies FeatureSettingsDefinition

export default featureSettings
