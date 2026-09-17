import type { FeatureMeta } from '@/shared/feature/feature-types'
import wideLayoutMeta from './wide-layout/meta'
import autohideToolbarMeta from './autohide-toolbar/meta'
import hideCatalogBotsMeta from './hide-catalog-bots/meta'

/**
 * Порядок строк задаёт порядок тумблеров в попапе. Новая функция это папка в src/features
 * и одна строка здесь; ядро при этом не меняется.
 */
export const featureMetaRegistry = [
  wideLayoutMeta,
  autohideToolbarMeta,
  hideCatalogBotsMeta,
] as const satisfies readonly FeatureMeta[]

export type FeatureId = (typeof featureMetaRegistry)[number]['id']
