import type { FeatureContent } from '@/shared/feature/feature-types'

const featureContentModules = import.meta.glob<{ default: FeatureContent }>('./*/content.ts', {
  eager: true,
})

/** Исполняемые части всех функций: импортируется только content script */
export const featureContentRegistry: readonly FeatureContent[] = Object.keys(featureContentModules)
  .sort()
  .map((modulePath) => featureContentModules[modulePath]?.default)
  .filter((featureContent): featureContent is FeatureContent => featureContent !== undefined)
