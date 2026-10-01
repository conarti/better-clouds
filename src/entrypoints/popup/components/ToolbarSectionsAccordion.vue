<script lang="ts" setup>
import ToggleSwitch from '@/shared/ui/ToggleSwitch.vue'
import type { ToolbarSectionDefinition } from '@/features/hide-toolbar-sections/settings'

const props = defineProps<{
  sections: readonly ToolbarSectionDefinition[]
  hiddenSectionIds: readonly string[]
  disabled: boolean
}>()

const emit = defineEmits<{ 'update:hidden': [sectionIds: string[]] }>()

function setSectionShown(sectionId: string, isShown: boolean): void {
  const nextHiddenIds = new Set(props.hiddenSectionIds)
  if (isShown) {
    nextHiddenIds.delete(sectionId)
  } else {
    nextHiddenIds.add(sectionId)
  }
  /* Порядок списка секций, а не Set: выдача стабильна для хранилища и тестов */
  const sectionIds = props.sections
    .map((section) => section.id)
    .filter((id) => nextHiddenIds.has(id))
  emit('update:hidden', sectionIds)
}
</script>

<template>
  <li class="section-accordion">
    <details class="section-accordion__details">
      <summary class="section-accordion__summary">Секции</summary>
      <ul class="section-accordion__list">
        <li v-for="section in sections" :key="section.id" class="section-accordion__row">
          <span class="section-accordion__label">{{ section.title }}</span>
          <ToggleSwitch
            :model-value="!hiddenSectionIds.includes(section.id)"
            :disabled="disabled"
            :label="section.title"
            @update:model-value="setSectionShown(section.id, $event)"
          />
        </li>
      </ul>
    </details>
  </li>
</template>

<style scoped>
.section-accordion {
  list-style: none;
}

.section-accordion__details {
  margin: 0 0 10px;
  padding: 6px 12px;
  border: 1px solid var(--separator-color);
  border-radius: 6px;
}

.section-accordion__summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--secondary-text-color);
  cursor: pointer;
  user-select: none;
}

.section-accordion__list {
  display: flex;
  flex-direction: column;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.section-accordion__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
}

.section-accordion__label {
  font-size: 13px;
}
</style>
