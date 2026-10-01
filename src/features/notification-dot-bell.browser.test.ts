import { afterEach, describe, expect, it } from 'vitest'
import {
  createFeatureAttributeName,
  createFeatureStateAttributeName,
} from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import autohideToolbarMeta from './autohide-toolbar/meta'
import { featureStyles as autohideToolbarStyles } from './autohide-toolbar/styles'
import {
  BELL_COUNTER_SECTION_ID,
  BELL_SECTION_ID,
  TOOLBAR_SECTION_IDS,
} from './hide-toolbar-sections/settings'
import hideToolbarSectionsMeta from './hide-toolbar-sections/meta'
import { featureStyles as hideToolbarSectionsStyles } from './hide-toolbar-sections/styles'

const UNREAD_TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-notifications-unread.html'
const VISIBLE_OPACITY_VALUE = '1'
const INVISIBLE_OPACITY_VALUE = '0'
const ENABLED_ATTRIBUTE_VALUE = ''

/**
 * Точка autohide-toolbar и секции колокольчика hide-toolbar-sections это две независимые
 * функции, связанные общим кастомным свойством; тест держит обе включёнными на одной
 * разметке, поэтому лежит над папками функций
 */
describe('точка непрочитанных и скрытие колокольчика', () => {
  let fixture: MountedFeatureFixture

  function mountBothFeatures(): void {
    fixture = mountFeatureFixture({
      featureId: autohideToolbarMeta.id,
      featureStyles: autohideToolbarStyles,
      fixtureHtmlList: [loadFixture(UNREAD_TOOLBAR_FIXTURE_FILE_NAME)],
      wrapInLayoutPane: true,
    })
    fixture.addStyles(hideToolbarSectionsStyles)
    document.documentElement.setAttribute(
      createFeatureAttributeName(hideToolbarSectionsMeta.id),
      ENABLED_ATTRIBUTE_VALUE,
    )
  }

  function readDotOpacity(): string {
    return getComputedStyle(
      findRequiredElement(fixture.container, siteSelectors.toolbar),
      '::before',
    ).opacity
  }

  function hideSections(sectionIds: readonly string[]): void {
    for (const sectionId of sectionIds) {
      document.documentElement.setAttribute(
        createFeatureStateAttributeName(hideToolbarSectionsMeta.id, sectionId),
        ENABLED_ATTRIBUTE_VALUE,
      )
    }
  }

  afterEach(() => {
    for (const sectionId of TOOLBAR_SECTION_IDS) {
      document.documentElement.removeAttribute(
        createFeatureStateAttributeName(hideToolbarSectionsMeta.id, sectionId),
      )
    }
    document.documentElement.removeAttribute(createFeatureAttributeName(hideToolbarSectionsMeta.id))
    fixture.unmount()
  })

  it('показывает точку, пока колокольчик и его счётчик не скрыты', () => {
    mountBothFeatures()
    expect(readDotOpacity()).toBe(VISIBLE_OPACITY_VALUE)
    hideSections(['main', 'chats'])
    expect(readDotOpacity()).toBe(VISIBLE_OPACITY_VALUE)
  })

  it('гасит точку при скрытом счётчике колокольчика', () => {
    mountBothFeatures()
    hideSections([BELL_COUNTER_SECTION_ID])
    expect(readDotOpacity()).toBe(INVISIBLE_OPACITY_VALUE)
  })

  it('гасит точку при скрытом колокольчике', () => {
    mountBothFeatures()
    hideSections([BELL_SECTION_ID])
    expect(readDotOpacity()).toBe(INVISIBLE_OPACITY_VALUE)
  })

  it('возвращает точку, когда hide-toolbar-sections отключён', () => {
    mountBothFeatures()
    hideSections([BELL_SECTION_ID])
    document.documentElement.removeAttribute(createFeatureAttributeName(hideToolbarSectionsMeta.id))
    expect(readDotOpacity()).toBe(VISIBLE_OPACITY_VALUE)
  })
})
