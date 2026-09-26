import { css } from '@/shared/feature/css'
import { createFeatureScopeSelector } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'

const featureScope = createFeatureScopeSelector(featureMeta.id)

/**
 * Разведка живой страницы v3.72.37: запись списка чатов держит высоту 64px и отступы 8px
 * стилями сайта (inline у записи только flex-свойства), поэтому их перебивают обычные
 * объявления под guard'ом. Аватар в записи клиент задаёт inline-размерами 48px,
 * их можно перебить только с !important.
 *
 * Строки переписки сжимаются отступами: карман под аватар сообщения остаётся 48px,
 * сжимается только вертикальное дыхание строк. Разделители дат не затрагиваются.
 */
export const featureStyles = css`
  ${featureScope} ${siteSelectors.chatListEntry} {
    height: 48px;
    padding: 4px;
  }
  ${featureScope} ${siteSelectors.chatListEntry} ${siteSelectors.chatListEntryAvatarInner} {
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
  }
  ${featureScope} ${siteSelectors.chatMessageRow} {
    margin-top: 4px;
    margin-bottom: 2px;
  }
  ${featureScope} ${siteSelectors.chatMessageInner} {
    padding-left: 36px;
  }
`
