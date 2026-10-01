<script lang="ts" setup>
import ToggleSwitch from '@/shared/ui/ToggleSwitch.vue'
import {
  FEATURE_OPTION_CHECKLIST_KIND,
  FEATURE_OPTION_CLEARABLE_LIST_KIND,
  type FeatureChecklistOption,
  type FeatureClearableListOption,
  type FeaturePopupOption,
} from '@/shared/feature/feature-types'
import type { FeatureSettingsOptions } from '@/shared/settings/feature-settings'
import type { DiscoveredValues } from '@/shared/settings/discovered-values'

const props = defineProps<{
  options: readonly FeaturePopupOption[]
  storedValue: unknown
  discoveredValues: DiscoveredValues
  disabled: boolean
}>()

const emit = defineEmits<{ 'update:options': [optionsPatch: FeatureSettingsOptions] }>()

function isValueSelected(option: FeatureChecklistOption, value: string): boolean {
  return option.resolveSelectedValues(props.storedValue).includes(value)
}

/**
 * Выбор хранится списком в порядке обнаруженных значений. Выбранные значения, которых на
 * странице больше нет (переименованный или удалённый тег), при правке списка отбрасываются
 */
function setValueSelected(
  option: FeatureChecklistOption,
  value: string,
  isSelected: boolean,
): void {
  const selectedValues = new Set(option.resolveSelectedValues(props.storedValue))
  if (isSelected) {
    selectedValues.add(value)
  } else {
    selectedValues.delete(value)
  }
  emit('update:options', {
    [option.optionKey]: props.discoveredValues.values.filter((discoveredValue) =>
      selectedValues.has(discoveredValue),
    ),
  })
}

function clearValues(option: FeatureClearableListOption): void {
  emit('update:options', { [option.optionKey]: [] })
}
</script>

<template>
  <template v-for="option in options" :key="option.optionKey">
    <li v-if="option.kind === FEATURE_OPTION_CHECKLIST_KIND" class="feature-options">
      <details class="feature-options__details">
        <summary class="feature-options__summary">{{ option.title }}</summary>
        <p v-if="discoveredValues.values.length === 0" class="feature-options__hint">
          {{ option.emptyText }}
        </p>
        <ul v-else class="feature-options__list">
          <li v-for="value in discoveredValues.values" :key="value" class="feature-options__row">
            <span class="feature-options__label">{{ value }}</span>
            <ToggleSwitch
              :model-value="isValueSelected(option, value)"
              :disabled="disabled"
              :label="value"
              @update:model-value="setValueSelected(option, value, $event)"
            />
          </li>
        </ul>
        <p v-if="discoveredValues.isTruncated" class="feature-options__hint">
          {{ option.truncatedText }}
        </p>
      </details>
    </li>
    <li v-else-if="option.kind === FEATURE_OPTION_CLEARABLE_LIST_KIND" class="feature-options">
      <div class="feature-options__details">
        <p class="feature-options__summary">{{ option.title }}</p>
        <p v-if="option.resolveValues(storedValue).length === 0" class="feature-options__hint">
          {{ option.emptyText }}
        </p>
        <div v-else class="feature-options__row">
          <span class="feature-options__label">
            {{ option.describeCount(option.resolveValues(storedValue).length) }}
          </span>
          <button class="feature-options__button" :disabled="disabled" @click="clearValues(option)">
            {{ option.clearButtonText }}
          </button>
        </div>
      </div>
    </li>
  </template>
</template>

<style scoped>
.feature-options {
  list-style: none;
}

.feature-options__details {
  margin: 0 0 10px;
  padding: 6px 12px;
  border: 1px solid var(--separator-color);
  border-radius: 6px;
}

.feature-options__summary {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--secondary-text-color);
  cursor: pointer;
  user-select: none;
}

.feature-options__list {
  display: flex;
  flex-direction: column;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.feature-options__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
}

.feature-options__label {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-options__button {
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid var(--separator-color);
  border-radius: 6px;
  background-color: var(--badge-background-color);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.feature-options__button:disabled {
  cursor: default;
  opacity: 0.5;
}

.feature-options__hint {
  margin: 8px 0 2px;
  font-size: 11px;
  color: var(--secondary-text-color);
}
</style>
