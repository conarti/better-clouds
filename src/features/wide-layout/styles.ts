import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Разведка D2: сайт задаёт центральной колонке max-width, margin: 0 auto, padding-top и рамку
 * по бокам правилом специфичности (0,1,0), без inline-стилей и без !important. Поэтому здесь
 * хватает обычных объявлений, а запас специфичности даёт guard в featureScope.
 *
 * Отступ сверху колонки нельзя занулить самим padding-top: сайт также вычитает переменную
 * appTopPaddingHeight из высоты тела колонки (siteSelectors.layoutPaneBody), поэтому при
 * обнулённом только padding тело колонки заканчивается на 16px выше окна (разведка живой
 * страницы v3.70.x). Обнуление переменной на самом featureScope убирает и отступ, и вычет разом.
 */
export const featureStyles = css`
  ${featureScope} {
    ${siteCustomPropertyNames.appTopPaddingHeight}: 0px;
  }
  ${featureScope} ${siteSelectors.layoutPane} {
    max-width: none;
    margin: 0;
    border-left-width: 0;
    border-right-width: 0;
  }
  ${featureScope} ${siteSelectors.layoutPaneLeft} {
    border-top-left-radius: 0;
  }
`
