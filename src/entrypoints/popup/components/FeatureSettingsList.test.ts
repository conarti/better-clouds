import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeatureSettingsList from './FeatureSettingsList.vue'
import { featureMetaRegistry } from '@/features/registry'
import type { FeatureMeta } from '@/shared/feature/feature-types'

const STUB_FEATURE_META: FeatureMeta = {
  id: 'stub-feature',
  title: 'Заглушка функции',
  description: 'Строка списка, добавленная тестом',
  defaultEnabled: true,
}

const FEATURE_METAS: readonly FeatureMeta[] = [...featureMetaRegistry, STUB_FEATURE_META]
const SWITCH_SELECTOR = '[role="switch"]'
const ARIA_CHECKED_ATTRIBUTE = 'aria-checked'
const UPDATE_ENABLED_EVENT = 'update:enabled'

function mountList(isLoaded: boolean, enabledByFeatureId: Record<string, boolean>) {
  return mount(FeatureSettingsList, {
    props: { featureMetas: FEATURE_METAS, enabledByFeatureId, isLoaded },
  })
}

describe('FeatureSettingsList', () => {
  it('рисует строку на каждую функцию, включая добавленную тестом', () => {
    const wrapper = mountList(true, { [STUB_FEATURE_META.id]: true })

    expect(wrapper.findAll(SWITCH_SELECTOR)).toHaveLength(FEATURE_METAS.length)
    expect(wrapper.text()).toContain(STUB_FEATURE_META.title)
    expect(wrapper.text()).toContain(STUB_FEATURE_META.description)
  })

  it('по клику сообщает идентификатор функции и новое значение', async () => {
    const wrapper = mountList(true, { [STUB_FEATURE_META.id]: true })
    const stubSwitchIndex = FEATURE_METAS.length - 1

    const stubSwitch = wrapper.findAll(SWITCH_SELECTOR)[stubSwitchIndex]
    expect(stubSwitch?.attributes(ARIA_CHECKED_ATTRIBUTE)).toBe('true')
    await stubSwitch?.trigger('click')

    expect(wrapper.emitted(UPDATE_ENABLED_EVENT)).toEqual([[STUB_FEATURE_META.id, false]])

    await wrapper.setProps({ enabledByFeatureId: { [STUB_FEATURE_META.id]: false } })
    expect(
      wrapper.findAll(SWITCH_SELECTOR)[stubSwitchIndex]?.attributes(ARIA_CHECKED_ATTRIBUTE),
    ).toBe('false')
  })

  it('до загрузки настроек переключатели недоступны', () => {
    const wrapper = mountList(false, {})

    for (const switchElement of wrapper.findAll(SWITCH_SELECTOR)) {
      expect(switchElement.attributes('disabled')).toBeDefined()
    }
  })
})
