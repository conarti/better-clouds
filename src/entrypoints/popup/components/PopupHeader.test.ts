import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PopupHeader from './PopupHeader.vue'

const EXTENSION_VERSION = '0.1.0'

describe('PopupHeader', () => {
  it('показывает название, версию и пометку о неофициальности', () => {
    const wrapper = mount(PopupHeader, { props: { version: EXTENSION_VERSION } })

    expect(wrapper.text()).toContain('Better Clouds')
    expect(wrapper.text()).toContain(`v${EXTENSION_VERSION}`)
    expect(wrapper.text()).toContain('Неофициальное расширение')
  })
})
