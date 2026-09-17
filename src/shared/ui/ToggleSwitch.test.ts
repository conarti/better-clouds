import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToggleSwitch from './ToggleSwitch.vue'

const SWITCH_SELECTOR = '[role="switch"]'
const ARIA_CHECKED_ATTRIBUTE = 'aria-checked'
const SWITCH_LABEL = 'Тестовый переключатель'
const MODEL_VALUE_EVENT = 'update:modelValue'

describe('ToggleSwitch', () => {
  it('объявляет роль переключателя и текущее состояние', () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: true, label: SWITCH_LABEL } })

    const switchElement = wrapper.get(SWITCH_SELECTOR)
    expect(switchElement.attributes(ARIA_CHECKED_ATTRIBUTE)).toBe('true')
    expect(switchElement.attributes('aria-label')).toBe(SWITCH_LABEL)
  })

  it('по клику сообщает противоположное значение', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false } })

    await wrapper.get(SWITCH_SELECTOR).trigger('click')

    expect(wrapper.emitted(MODEL_VALUE_EVENT)).toEqual([[true]])
  })

  it('выключенный переключатель не сообщает об изменении', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false, disabled: true } })

    await wrapper.get(SWITCH_SELECTOR).trigger('click')

    expect(wrapper.emitted(MODEL_VALUE_EVENT)).toBeUndefined()
  })

  it('переключается клавишами пробел и ввод', async () => {
    const wrapper = mount(ToggleSwitch, { props: { modelValue: false } })

    const switchElement = wrapper.get(SWITCH_SELECTOR)
    await switchElement.trigger('keydown.space')
    await switchElement.trigger('keydown.enter')

    expect(wrapper.emitted(MODEL_VALUE_EVENT)).toEqual([[true], [true]])
  })
})
