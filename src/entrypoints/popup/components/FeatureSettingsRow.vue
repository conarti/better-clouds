<script lang="ts" setup>
import ToggleSwitch from '@/shared/ui/ToggleSwitch.vue'
import type { FeatureMeta } from '@/shared/feature/feature-types'

defineProps<{
  featureMeta: FeatureMeta
  enabled: boolean
  disabled: boolean
}>()

const emit = defineEmits<{ 'update:enabled': [value: boolean] }>()
</script>

<template>
  <li class="feature-row">
    <div class="feature-row__text">
      <p class="feature-row__title">{{ featureMeta.title }}</p>
      <p class="feature-row__description">{{ featureMeta.description }}</p>
    </div>
    <ToggleSwitch
      :model-value="enabled"
      :disabled="disabled"
      :label="featureMeta.title"
      @update:model-value="emit('update:enabled', $event)"
    />
  </li>
</template>

<style scoped>
.feature-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.feature-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-row__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.feature-row__description {
  margin: 0;
  font-size: 12px;
  color: var(--secondary-text-color);
}
</style>
