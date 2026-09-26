import type { FeatureSettingsDefinition } from '@/shared/feature/feature-types'

/**
 * Описание секции колонки навигации для попапа: идентификатор хранится в настройках,
 * заголовок показывается в аккордеоне. Список совпадает с позициями селекторов
 * в src/shared/site/selectors.ts (разведка живой страницы v3.72.37)
 */
export interface ToolbarSectionDefinition {
  readonly id: string
  readonly title: string
}

export const TOOLBAR_SECTIONS: readonly ToolbarSectionDefinition[] = [
  { id: 'main', title: '«Main»' },
  { id: 'chats', title: '«Чаты»' },
  { id: 'contacts', title: 'Контакты' },
  { id: 'calls', title: 'Звонки' },
  { id: 'smartapps', title: 'SmartApps' },
  { id: 'smartapps-block', title: 'Блок умных приложений' },
] as const

export const TOOLBAR_SECTION_IDS: readonly string[] = TOOLBAR_SECTIONS.map((section) => section.id)

const KNOWN_SECTION_ID_SET = new Set<string>(TOOLBAR_SECTION_IDS)

/**
 * Схема настроек функции. Поле hidden это список идентификаторов скрытых секций;
 * версия 2 вводит его поверх значения {enabled} предыдущих сборок
 */
export const featureSettings = {
  version: 2,
  migrations: {
    2: (previousValue: unknown) => ({
      ...(typeof previousValue === 'object' && previousValue !== null ? previousValue : {}),
      hidden: resolveHiddenSections(previousValue),
    }),
  },
} satisfies FeatureSettingsDefinition

/**
 * Список скрытых секций из сохранённого значения. Значение без поля hidden это новый
 * профиль или доперенос: по умолчанию скрыты все секции, каждую включает пользователь
 * отдельно. Неизвестные идентификаторы (новая версия клиента) отбрасываются
 */
export function resolveHiddenSections(storedValue: unknown): readonly string[] {
  if (typeof storedValue !== 'object' || storedValue === null) {
    return TOOLBAR_SECTION_IDS
  }
  const { hidden } = storedValue as { hidden?: unknown }
  if (!Array.isArray(hidden)) {
    return TOOLBAR_SECTION_IDS
  }
  return hidden.filter(
    (sectionId): sectionId is string =>
      typeof sectionId === 'string' && KNOWN_SECTION_ID_SET.has(sectionId),
  )
}

export default featureSettings
