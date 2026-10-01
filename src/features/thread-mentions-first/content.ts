import { defineFeatureContent } from '@/shared/feature/define-feature'
import { siteSelectors } from '@/shared/site/selectors'
import featureMeta from './meta'
import { featureStyles } from './styles'

export default defineFeatureContent({
  meta: featureMeta,
  styles: featureStyles,
  anchorSelectors: [
    siteSelectors.chatList,
    siteSelectors.chatListTabsList,
    siteSelectors.chatListSearchInput,
  ],
})
