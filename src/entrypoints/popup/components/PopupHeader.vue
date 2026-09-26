<script lang="ts" setup>
defineProps<{ version: string }>()

const EXTENSION_TITLE = 'Better Clouds'
</script>

<template>
  <header class="popup-header">
    <div class="popup-header__title-row">
      <h1 class="popup-header__title">{{ EXTENSION_TITLE }}</h1>
      <span class="popup-header__version">v{{ version }}</span>
    </div>
  </header>
</template>

<style scoped>
.popup-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.popup-header__title-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.popup-header__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.popup-header__version {
  font-size: 12px;
  color: var(--secondary-text-color);
}
</style>
