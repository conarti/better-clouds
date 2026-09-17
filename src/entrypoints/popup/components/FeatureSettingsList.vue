<script lang="ts" setup>
import FeatureSettingsRow from './FeatureSettingsRow.vue'
import { featureMetaRegistry } from '@/features/registry'
import type { FeatureMeta } from '@/shared/feature/feature-types'

const EMPTY_LIST_TEXT = 'Функции появятся в следующей версии'

withDefaults(
  defineProps<{
    featureMetas?: readonly FeatureMeta[]
    enabledByFeatureId: Readonly<Record<string, boolean>>
    isLoaded: boolean
  }>(),
  { featureMetas: () => featureMetaRegistry },
)

const emit = defineEmits<{ 'update:enabled': [featureId: string, value: boolean] }>()
</script>

<template>
  <ul v-if="featureMetas.length > 0" class="feature-list">
    <FeatureSettingsRow
      v-for="featureMeta in featureMetas"
      :key="featureMeta.id"
      :feature-meta="featureMeta"
      :enabled="enabledByFeatureId[featureMeta.id] ?? featureMeta.defaultEnabled"
      :disabled="!isLoaded"
      @update:enabled="emit('update:enabled', featureMeta.id, $event)"
    />
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
