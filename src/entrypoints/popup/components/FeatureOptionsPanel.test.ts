import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FeatureOptionsPanel from './FeatureOptionsPanel.vue'
import FeatureSettingsList from './FeatureSettingsList.vue'
import {
  DISCOVERED_VALUES_SOURCE,
  FEATURE_OPTION_CHECKLIST_KIND,
  type FeatureChecklistOption,
  type FeatureMeta,
  type FeatureSettingsDefinition,
} from '@/shared/feature/feature-types'
import type { DiscoveredValues } from '@/shared/settings/discovered-values'

const OPTION_KEY = 'selectedStubValues'
const FIRST_VALUE = 'Работа'
const SECOND_VALUE = 'Семья'
const THIRD_VALUE = 'Проекты'
const STALE_VALUE = 'Удалённый тег'
const ARIA_CHECKED_ATTRIBUTE = 'aria-checked'
const UPDATE_OPTIONS_EVENT = 'update:options'

const CHECKLIST_OPTION: FeatureChecklistOption = {
  kind: FEATURE_OPTION_CHECKLIST_KIND,
  source: DISCOVERED_VALUES_SOURCE,
  optionKey: OPTION_KEY,
  title: 'Значения',
  emptyText: 'Значений пока нет',
  truncatedText: 'Показаны не все значения',
  resolveSelectedValues(storedValue) {
    const { selectedStubValues } = (storedValue ?? {}) as { selectedStubValues?: string[] }
    return selectedStubValues ?? []
  },
}

const DISCOVERED_VALUES: DiscoveredValues = {
  values: [FIRST_VALUE, SECOND_VALUE, THIRD_VALUE],
  isTruncated: false,
}

function mountPanel(storedValue: unknown, discoveredValues: DiscoveredValues = DISCOVERED_VALUES) {
  return mount(FeatureOptionsPanel, {
    props: { options: [CHECKLIST_OPTION], storedValue, discoveredValues, disabled: false },
  })
}

function switchCheckedStates(wrapper: ReturnType<typeof mountPanel>): (string | undefined)[] {
  return wrapper
    .findAll('[role="switch"]')
    .map((toggle) => toggle.attributes(ARIA_CHECKED_ATTRIBUTE))
}

describe('FeatureOptionsPanel', () => {
  it('рисует переключатель на каждое обнаруженное значение с отметкой выбранных', () => {
    const wrapper = mountPanel({ enabled: true, [OPTION_KEY]: [SECOND_VALUE] })

    expect(wrapper.text()).toContain(CHECKLIST_OPTION.title)
    expect(wrapper.text()).toContain(FIRST_VALUE)
    expect(switchCheckedStates(wrapper)).toEqual(['false', 'true', 'false'])
  })

  it('выбор сообщает список в порядке обнаруженных значений', async () => {
    const wrapper = mountPanel({ enabled: true, [OPTION_KEY]: [THIRD_VALUE] })

    await wrapper.find(`[role="switch"][aria-label="${FIRST_VALUE}"]`).trigger('click')

    expect(wrapper.emitted(UPDATE_OPTIONS_EVENT)).toEqual([
      [{ [OPTION_KEY]: [FIRST_VALUE, THIRD_VALUE] }],
    ])
  })

  it('снятие выбора убирает значение и отбрасывает исчезнувшие со страницы', async () => {
    const wrapper = mountPanel({
      enabled: true,
      [OPTION_KEY]: [STALE_VALUE, SECOND_VALUE, FIRST_VALUE],
    })

    await wrapper.find(`[role="switch"][aria-label="${SECOND_VALUE}"]`).trigger('click')

    expect(wrapper.emitted(UPDATE_OPTIONS_EVENT)).toEqual([[{ [OPTION_KEY]: [FIRST_VALUE] }]])
  })

  it('без обнаруженных значений показывает подсказку и ни одного переключателя', () => {
    const wrapper = mountPanel({ enabled: false }, { values: [], isTruncated: false })

    expect(wrapper.text()).toContain(CHECKLIST_OPTION.emptyText)
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(0)
  })

  it('неполный снимок отмечается подсказкой', () => {
    const wrapper = mountPanel({ enabled: true }, { ...DISCOVERED_VALUES, isTruncated: true })

    expect(wrapper.text()).toContain(CHECKLIST_OPTION.truncatedText)
  })
})

describe('FeatureSettingsList с опциями функции', () => {
  const STUB_FEATURE_META: FeatureMeta = {
    id: 'stub-feature',
    title: 'Заглушка функции',
    description: 'Строка списка с опцией из обнаруженного',
    defaultEnabled: false,
  }
  const STUB_SETTINGS: FeatureSettingsDefinition = {
    version: 1,
    migrations: {},
    popupOptions: [CHECKLIST_OPTION],
  }

  it('рисует панель опций под строкой функции и передаёт патч с идентификатором', async () => {
    const wrapper = mount(FeatureSettingsList, {
      props: {
        featureMetas: [STUB_FEATURE_META],
        enabledByFeatureId: { [STUB_FEATURE_META.id]: true },
        storedValuesByFeatureId: { [STUB_FEATURE_META.id]: { enabled: true } },
        discoveredValuesByFeatureId: { [STUB_FEATURE_META.id]: DISCOVERED_VALUES },
        featureSettingsById: new Map([[STUB_FEATURE_META.id, STUB_SETTINGS]]),
        isLoaded: true,
      },
    })

    await wrapper.find(`[role="switch"][aria-label="${SECOND_VALUE}"]`).trigger('click')

    expect(wrapper.emitted(UPDATE_OPTIONS_EVENT)).toEqual([
      [STUB_FEATURE_META.id, { [OPTION_KEY]: [SECOND_VALUE] }],
    ])
  })
})
