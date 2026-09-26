<script lang="ts" setup>
import FeatureSettingsRow from './FeatureSettingsRow.vue'
import ToolbarSectionsAccordion from './ToolbarSectionsAccordion.vue'
import { featureMetaRegistry } from '@/features/registry'
import { TOOLBAR_SECTIONS, resolveHiddenSections } from '@/features/hide-toolbar-sections/settings'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import type { FeatureSettingsStoredValue } from '@/shared/settings/feature-settings'

const TOOLBAR_SECTIONS_FEATURE_ID = 'hide-toolbar-sections'
const EMPTY_LIST_TEXT = 'Функции появятся в следующей версии'

withDefaults(
  defineProps<{
    featureMetas?: readonly FeatureMeta[]
    enabledByFeatureId: Readonly<Record<string, boolean>>
    storedValuesByFeatureId: Readonly<Record<string, FeatureSettingsStoredValue>>
    isLoaded: boolean
  }>(),
  { featureMetas: () => featureMetaRegistry },
)

const emit = defineEmits<{
  'update:enabled': [featureId: string, value: boolean]
  'update:hidden': [featureId: string, sectionIds: string[]]
}>()
</script>

<template>
  <ul v-if="featureMetas.length > 0" class="feature-list">
    <template v-for="featureMeta in featureMetas" :key="featureMeta.id">
      <FeatureSettingsRow
        :feature-meta="featureMeta"
        :enabled="enabledByFeatureId[featureMeta.id] ?? featureMeta.defaultEnabled"
        :disabled="!isLoaded"
        @update:enabled="emit('update:enabled', featureMeta.id, $event)"
      />
      <ToolbarSectionsAccordion
        v-if="featureMeta.id === TOOLBAR_SECTIONS_FEATURE_ID"
        :sections="TOOLBAR_SECTIONS"
        :hidden-section-ids="
          resolveHiddenSections(storedValuesByFeatureId[TOOLBAR_SECTIONS_FEATURE_ID])
        "
        :disabled="!isLoaded"
        @update:hidden="emit('update:hidden', featureMeta.id, $event)"
      />
    </template>
  </ul>
  <p v-else class="feature-list__empty">{{ EMPTY_LIST_TEXT }}</p>
</template>

<style scoped>
.feature-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.feature-list__empty {
  margin: 0;
  font-size: 12px;
  color: var(--secondary-text-color);
}
</style>
