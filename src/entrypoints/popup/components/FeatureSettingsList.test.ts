import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeatureSettingsList from './FeatureSettingsList.vue'
import { featureMetaRegistry } from '@/features/registry'
import { TOOLBAR_SECTIONS } from '@/features/hide-toolbar-sections/settings'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import type { FeatureSettingsStoredValue } from '@/shared/settings/feature-settings'

const STUB_FEATURE_META: FeatureMeta = {
  id: 'stub-feature',
  title: 'Заглушка функции',
  description: 'Строка списка, добавленная тестом',
  defaultEnabled: true,
}

const FEATURE_METAS: readonly FeatureMeta[] = [...featureMetaRegistry, STUB_FEATURE_META]
const ARIA_CHECKED_ATTRIBUTE = 'aria-checked'
const UPDATE_ENABLED_EVENT = 'update:enabled'
const UPDATE_HIDDEN_EVENT = 'update:hidden'

function mountList(
  isLoaded: boolean,
  enabledByFeatureId: Record<string, boolean>,
  storedValuesByFeatureId: Record<string, FeatureSettingsStoredValue> = {},
) {
  return mount(FeatureSettingsList, {
    props: {
      featureMetas: FEATURE_METAS,
      enabledByFeatureId,
      storedValuesByFeatureId,
      isLoaded,
    },
  })
}

function switchByLabel(wrapper: VueWrapper, label: string) {
  return wrapper.find(`[role="switch"][aria-label="${label}"]`)
}

describe('FeatureSettingsList', () => {
  it('рисует строку на каждую функцию, включая добавленную тестом', () => {
    const wrapper = mountList(true, { [STUB_FEATURE_META.id]: true })

    expect(wrapper.findAll('[role="switch"]')).toHaveLength(
      FEATURE_METAS.length + TOOLBAR_SECTIONS.length,
    )
    expect(wrapper.text()).toContain(STUB_FEATURE_META.title)
    expect(wrapper.text()).toContain(STUB_FEATURE_META.description)
  })

  it('по клику сообщает идентификатор функции и новое значение', async () => {
    const wrapper = mountList(true, { [STUB_FEATURE_META.id]: true })
    const stubSwitch = switchByLabel(wrapper, STUB_FEATURE_META.title)

    expect(stubSwitch.attributes(ARIA_CHECKED_ATTRIBUTE)).toBe('true')
    await stubSwitch.trigger('click')

    expect(wrapper.emitted(UPDATE_ENABLED_EVENT)).toEqual([[STUB_FEATURE_META.id, false]])

    await wrapper.setProps({ enabledByFeatureId: { [STUB_FEATURE_META.id]: false } })
    expect(switchByLabel(wrapper, STUB_FEATURE_META.title).attributes(ARIA_CHECKED_ATTRIBUTE)).toBe(
      'false',
    )
  })

  it('до загрузки настроек переключатели недоступны', () => {
    const wrapper = mountList(false, {})

    for (const switchElement of wrapper.findAll('[role="switch"]')) {
      expect(switchElement.attributes('disabled')).toBeDefined()
    }
  })

  it('по умолчанию все секции тулбара скрыты', () => {
    const wrapper = mountList(true, { 'hide-toolbar-sections': true })

    for (const section of TOOLBAR_SECTIONS) {
      expect(
        switchByLabel(wrapper, section.title).attributes(ARIA_CHECKED_ATTRIBUTE),
        section.title,
      ).toBe('false')
    }
  })

  it('аккордеон по клику сообщает новый список скрытых секций', async () => {
    const wrapper = mountList(
      true,
      { 'hide-toolbar-sections': true },
      {
        'hide-toolbar-sections': { enabled: true, hidden: ['main'] },
      },
    )

    for (const section of TOOLBAR_SECTIONS) {
      const isChecked =
        switchByLabel(wrapper, section.title).attributes(ARIA_CHECKED_ATTRIBUTE) === 'true'
      expect(isChecked, section.title).toBe(section.id !== 'main')
    }

    await switchByLabel(wrapper, '«Main»').trigger('click')

    expect(wrapper.emitted(UPDATE_HIDDEN_EVENT)).toEqual([['hide-toolbar-sections', []]])
  })
})
