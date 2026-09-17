import type { FeatureContent, FeatureMeta } from './feature-types'

/** Метаданные функции: только данные, поэтому попап импортирует meta.ts без CSS и DOM */
export function defineFeatureMeta<const Meta extends FeatureMeta>(featureMeta: Meta): Meta {
  return featureMeta
}

/** Исполняемая часть функции: стили и монтирование, живёт только в content script */
export function defineFeatureContent<Meta extends FeatureMeta>(
  featureContent: FeatureContent<Meta>,
): FeatureContent<Meta> {
  return featureContent
}
