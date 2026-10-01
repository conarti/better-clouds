import {
  FEATURE_OPTION_CLEARABLE_LIST_KIND,
  type FeatureSettingsDefinition,
} from '@/shared/feature/feature-types'

/** Ключ списка архивных чатов в хранимом значении функции */
export const ARCHIVED_CHAT_IDS_OPTION_KEY = 'archivedChatIds'

/**
 * Примерная вместимость архива: id чата это UUID из 36 символов, вместе с кавычками и
 * запятой 39 байт, а элементу sync отведено 8192 байт минус запас
 */
export const APPROXIMATE_ARCHIVE_CAPACITY = 200

/**
 * Допустимый вид id: буквы, цифры и дефис. Значение попадает в селектор CSS в кавычках,
 * поэтому всё прочее отбрасывается и экранирование не требуется
 */
export const CHAT_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

const ARCHIVE_OPTION_TITLE = 'Архив'
const CLEAR_ARCHIVE_TEXT = 'Вернуть все'
const EMPTY_ARCHIVE_TEXT =
  'В архиве пока нет чатов. Пункт «В архив» есть в меню правого клика по чату'

/** Число чатов в архиве с вместимостью: при переполнении пункт меню сообщает об ошибке */
function describeArchivedChatCount(chatCount: number): string {
  return `В архиве чатов: ${chatCount} из примерно ${APPROXIMATE_ARCHIVE_CAPACITY}`
}

/**
 * Архивные чаты из сохранённого значения: только строки допустимого вида, без повторов,
 * в порядке добавления. Значение чужого формата даёт пустой архив
 */
export function resolveArchivedChatIds(storedValue: unknown): readonly string[] {
  if (typeof storedValue !== 'object' || storedValue === null) {
    return []
  }
  const { archivedChatIds } = storedValue as { archivedChatIds?: unknown }
  if (!Array.isArray(archivedChatIds)) {
    return []
  }
  return archivedChatIds.filter(
    (chatId, index): chatId is string =>
      typeof chatId === 'string' &&
      CHAT_ID_PATTERN.test(chatId) &&
      archivedChatIds.indexOf(chatId) === index,
  )
}

/** Значение {enabled, archivedChatIds}; без поля archivedChatIds архив пуст */
export const featureSettings = {
  version: 1,
  migrations: {},
  popupOptions: [
    {
      kind: FEATURE_OPTION_CLEARABLE_LIST_KIND,
      optionKey: ARCHIVED_CHAT_IDS_OPTION_KEY,
      title: ARCHIVE_OPTION_TITLE,
      clearButtonText: CLEAR_ARCHIVE_TEXT,
      emptyText: EMPTY_ARCHIVE_TEXT,
      describeCount: describeArchivedChatCount,
      resolveValues: resolveArchivedChatIds,
    },
  ],
} satisfies FeatureSettingsDefinition

export default featureSettings
