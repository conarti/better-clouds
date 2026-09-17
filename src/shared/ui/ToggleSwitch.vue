<script lang="ts" setup>
const properties = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    label?: string
  }>(),
  { disabled: false, label: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle(): void {
  if (properties.disabled) {
    return
  }
  emit('update:modelValue', !properties.modelValue)
}
</script>

<template>
  <button
    class="toggle-switch"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label || undefined"
    :disabled="disabled"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <span class="toggle-switch__knob" />
  </button>
</template>

<style scoped>
.toggle-switch {
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background-color: var(--toggle-off-color);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.toggle-switch[aria-checked='true'] {
  background-color: var(--toggle-on-color);
}

.toggle-switch:disabled {
  cursor: default;
  opacity: 0.5;
}

.toggle-switch:focus-visible {
  outline: 2px solid var(--toggle-on-color);
  outline-offset: 2px;
}

.toggle-switch__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--toggle-knob-color);
  transition: transform 150ms ease;
}

.toggle-switch[aria-checked='true'] .toggle-switch__knob {
  transform: translateX(16px);
}
</style>
