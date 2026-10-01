import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Разведка живой страницы v3.72.37: время сообщения с картинкой или видео без подписи
 * лежит абсолютно внутри пузыря (position: relative) поверх превью, с тёмной плашкой и белым
 * текстом. Здесь оно возвращается в поток под превью и прижимается к правому краю,
 * плашка снимается, цвет берётся как у времени текстовых сообщений.
 * Блок длительности видео лежит внутри превью и не входит в селекторы.
 */
const timeBelowDeclarations = css`
  position: static;
  width: fit-content;
  margin: 4px 0 0 auto;
  padding: 0;
  background: none;
  color: var(${siteCustomPropertyNames.textSecondary});
`

/**
 * Белые под плашку значки статуса под превью сливались бы с пузырём, поэтому им
 * возвращается обычный цвет значка статуса. У счётчика просмотров своей переменной нет,
 * он берёт цвет времени
 */
const iconColorDeclarations = css`
  color: var(${siteCustomPropertyNames.messageStatusIconColor}, currentColor);
`

export const featureStyles = css`
  ${featureScope} ${siteSelectors.chatMessageImageTime} {
    ${timeBelowDeclarations}
  }
  ${featureScope} ${siteSelectors.chatMessageVideoTime} {
    ${timeBelowDeclarations}
  }
  ${featureScope} ${siteSelectors.chatMessageMediaTime} {
    ${timeBelowDeclarations}
  }
  ${featureScope} ${siteSelectors.chatMessageImageTime} ${siteSelectors.chatMessageMediaTimeLightIcon} {
    ${iconColorDeclarations}
  }
  ${featureScope} ${siteSelectors.chatMessageVideoTime} ${siteSelectors.chatMessageMediaTimeLightIcon} {
    ${iconColorDeclarations}
  }
`
