import { defineContentScript } from '#imports'
import { featureContentRegistry } from '@/features/content-registry'
import { featureMetaRegistry } from '@/features/registry'
import { featureSettingsRegistry } from '@/features/settings-registry'
import { createFeatureRuntime } from '@/shared/feature/feature-runtime'
import { logger } from '@/shared/logging/logger'
import { createFeatureSettingsSource } from '@/shared/settings/feature-settings'
import { CLOUDS_MATCH_PATTERN } from '@/shared/site/site-constants'

/**
 * Верхний уровень этого модуля и всех content.ts функций не обращается к document, window и
 * browser: eager glob выполняет верхний уровень каждой функции при загрузке этого модуля,
 * а сборщик может выполнить его вне страницы. Все обращения только внутри main и mount.
 */
export default defineContentScript({
  matches: [CLOUDS_MATCH_PATTERN],
  runAt: 'document_start',
  allFrames: false,
  cssInjectionMode: 'ui',
  main(contentScriptContext) {
    const featureRuntime = createFeatureRuntime({
      featureMetas: featureMetaRegistry,
      featureContents: featureContentRegistry,
      documentRoot: document,
      settingsSource: createFeatureSettingsSource({
        featureMetas: featureMetaRegistry,
        featureSettingsById: featureSettingsRegistry,
        logger,
      }),
      contentScriptLifecycle: contentScriptContext,
      logger,
    })

    void featureRuntime.start()
  },
})
