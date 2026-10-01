import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Разведка живой страницы v3.72.37: время сообщения с картинкой или видео без подписи
 * лежит абсолютно внутри пузыря (position: relative) поверх превью, с тёмной плашкой и белым
 * текстом. Здесь оно возвращается в поток под превью и прижимается к правому краю,
 * плашка снимается, цвет приглушается как у времени текстовых сообщений.
 * Блок длительности видео лежит внутри превью и не входит в селекторы.
 */
const timeBelowDeclarations = css`
  position: static;
  width: fit-content;
  margin: 4px 0 0 auto;
  padding: 0;
  background: none;
  color: inherit;
  opacity: 0.5;
`

export const featureStyles = css`
  ${featureScope} ${siteSelectors.chatMessageImageTime} {
    ${timeBelowDeclarations}
  }
  ${featureScope} ${siteSelectors.chatMessageVideoTime} {
    ${timeBelowDeclarations}
  }
`
