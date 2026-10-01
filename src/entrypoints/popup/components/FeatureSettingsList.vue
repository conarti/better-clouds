<script lang="ts" setup>
import FeatureOptionsPanel from './FeatureOptionsPanel.vue'
import FeatureSettingsRow from './FeatureSettingsRow.vue'
import ToolbarSectionsAccordion from './ToolbarSectionsAccordion.vue'
import { featureMetaRegistry } from '@/features/registry'
import { featureSettingsRegistry } from '@/features/settings-registry'
import { TOOLBAR_SECTIONS, resolveHiddenSections } from '@/features/hide-toolbar-sections/settings'
import type { FeatureMeta, FeatureSettingsDefinition } from '@/shared/feature/feature-types'
import type {
  FeatureSettingsOptions,
  FeatureSettingsStoredValue,
} from '@/shared/settings/feature-settings'
import { EMPTY_DISCOVERED_VALUES, type DiscoveredValues } from '@/shared/settings/discovered-values'

const TOOLBAR_SECTIONS_FEATURE_ID = 'hide-toolbar-sections'
const EMPTY_LIST_TEXT = 'Функции появятся в следующей версии'

withDefaults(
  defineProps<{
    featureMetas?: readonly FeatureMeta[]
    enabledByFeatureId: Readonly<Record<string, boolean>>
    storedValuesByFeatureId: Readonly<Record<string, FeatureSettingsStoredValue>>
    discoveredValuesByFeatureId?: Readonly<Record<string, DiscoveredValues>>
    featureSettingsById?: ReadonlyMap<string, FeatureSettingsDefinition>
    isLoaded: boolean
  }>(),
  {
    featureMetas: () => featureMetaRegistry,
    discoveredValuesByFeatureId: () => ({}),
    featureSettingsById: () => featureSettingsRegistry,
  },
)

const emit = defineEmits<{
  'update:enabled': [featureId: string, value: boolean]
  'update:hidden': [featureId: string, sectionIds: string[]]
  'update:options': [featureId: string, optionsPatch: FeatureSettingsOptions]
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
      <FeatureOptionsPanel
        v-if="featureSettingsById.get(featureMeta.id)?.popupOptions"
        :options="featureSettingsById.get(featureMeta.id)?.popupOptions ?? []"
        :stored-value="storedValuesByFeatureId[featureMeta.id]"
        :discovered-values="discoveredValuesByFeatureId[featureMeta.id] ?? EMPTY_DISCOVERED_VALUES"
        :disabled="!isLoaded"
        @update:options="emit('update:options', featureMeta.id, $event)"
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
