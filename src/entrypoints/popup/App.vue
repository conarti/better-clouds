<script lang="ts" setup>
import { browser } from '#imports'
import FeatureSettingsList from './components/FeatureSettingsList.vue'
import PopupHeader from './components/PopupHeader.vue'
import { useFeatureSettings } from './composables/useFeatureSettings'

const FOOTER_TEXT = 'Изменения применяются сразу на открытых вкладках Клаудс'

const extensionVersion = browser.runtime.getManifest().version
const {
  enabledByFeatureId,
  isLoaded,
  storedValuesByFeatureId,
  discoveredValuesByFeatureId,
  setFeatureEnabled,
  setFeatureOptions,
} = useFeatureSettings()

function handleHiddenSectionsChange(featureId: string, sectionIds: string[]): void {
  void setFeatureOptions(featureId, { hidden: sectionIds })
}
</script>

<template>
  <main class="popup">
    <PopupHeader :version="extensionVersion" />
    <FeatureSettingsList
      :enabled-by-feature-id="enabledByFeatureId"
      :stored-values-by-feature-id="storedValuesByFeatureId"
      :discovered-values-by-feature-id="discoveredValuesByFeatureId"
      :is-loaded="isLoaded"
      @update:enabled="setFeatureEnabled"
      @update:hidden="handleHiddenSectionsChange"
      @update:options="setFeatureOptions"
    />
    <p class="popup__footer">{{ FOOTER_TEXT }}</p>
  </main>
</template>

<style>
:root {
  --text-color: #1b1f24;
  --secondary-text-color: #5c6873;
  --background-color: #ffffff;
  --badge-background-color: #eef2f6;
  --separator-color: #e4e8ed;
  --toggle-off-color: #c8d0d8;
  --toggle-on-color: #4799e3;
  --toggle-knob-color: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #e8ecf1;
    --secondary-text-color: #9aa5b1;
    --background-color: #23262b;
    --badge-background-color: #2f333a;
    --separator-color: #383d45;
    --toggle-off-color: #4a505a;
    --toggle-on-color: #5aa0e0;
    --toggle-knob-color: #e8ecf1;
  }
}

body {
  margin: 0;
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: system-ui, sans-serif;
}
</style>

<style scoped>
.popup {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 340px;
  box-sizing: border-box;
  padding: 16px;
}

.popup__footer {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--separator-color);
  font-size: 11px;
  color: var(--secondary-text-color);
}
</style>
