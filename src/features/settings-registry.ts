import type { FeatureSettingsDefinition } from '@/shared/feature/feature-types'

const FEATURE_DIRECTORY_PATTERN = /^\.\/([^/]+)\//

const featureSettingsModules = import.meta.glob<{ default: FeatureSettingsDefinition }>(
  './*/settings.ts',
  { eager: true },
)

/**
 * Схемы хранения функций по имени папки. В первой версии ни одна функция не объявляет
 * собственную схему, но контракт и агрегатор уже есть, чтобы первая опция не правила ядро.
 */
export const featureSettingsRegistry: ReadonlyMap<string, FeatureSettingsDefinition> = new Map(
  Object.entries(featureSettingsModules).map(([modulePath, settingsModule]) => [
    FEATURE_DIRECTORY_PATTERN.exec(modulePath)?.[1] ?? modulePath,
    settingsModule.default,
  ]),
)
