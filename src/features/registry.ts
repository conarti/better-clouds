import type { FeatureMeta } from '@/shared/feature/feature-types'

/**
 * Порядок строк задаёт порядок тумблеров в попапе. Новая функция это папка в src/features
 * и одна строка здесь; ядро при этом не меняется.
 */
export const featureMetaRegistry = [] as const satisfies readonly FeatureMeta[]

export type FeatureId = (typeof featureMetaRegistry)[number]['id']
