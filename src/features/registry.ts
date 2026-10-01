import type { FeatureMeta } from '@/shared/feature/feature-types'
import wideLayoutMeta from './wide-layout/meta'
import autohideToolbarMeta from './autohide-toolbar/meta'
import hideCatalogBotsMeta from './hide-catalog-bots/meta'
import compactModeMeta from './compact-mode/meta'
import hideToolbarSectionsMeta from './hide-toolbar-sections/meta'
import mediaTimeBelowMeta from './media-time-below/meta'
import tagTabsFirstMeta from './tag-tabs-first/meta'
import threadMentionsFirstMeta from './thread-mentions-first/meta'

/**
 * Порядок строк задаёт порядок тумблеров в попапе. Новая функция это папка в src/features
 * и одна строка здесь; ядро при этом не меняется.
 */
export const featureMetaRegistry = [
  wideLayoutMeta,
  autohideToolbarMeta,
  hideCatalogBotsMeta,
  compactModeMeta,
  hideToolbarSectionsMeta,
  mediaTimeBelowMeta,
  tagTabsFirstMeta,
  threadMentionsFirstMeta,
] as const satisfies readonly FeatureMeta[]

export type FeatureId = (typeof featureMetaRegistry)[number]['id']
