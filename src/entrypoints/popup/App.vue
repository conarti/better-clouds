<script lang="ts" setup>
const EXTENSION_TITLE = 'Better Clouds'
</script>

<template>
  <main class="popup">
    <h1 class="popup__title">{{ EXTENSION_TITLE }}</h1>
    <p class="popup__subtitle">Неофициальное расширение</p>
  </main>
</template>

<style scoped>
.popup {
  min-width: 320px;
  padding: 16px;
  font-family: system-ui, sans-serif;
}

.popup__title {
  margin: 0 0 4px;
  font-size: 16px;
}

.popup__subtitle {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}
</style>
