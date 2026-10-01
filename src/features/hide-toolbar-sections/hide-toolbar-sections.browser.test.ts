import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { createFeatureStateAttributeName } from '@/shared/feature/feature-scope'
import { siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import {
  BELL_COUNTER_SECTION_ID,
  BELL_SECTION_ID,
  TOOLBAR_SECTIONS,
  TOOLBAR_SECTION_IDS,
} from './settings'
import { featureStyles, SECTION_SELECTOR_BY_ID } from './styles'

const TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-notifications-unread.html'
const NO_BADGE_TOOLBAR_FIXTURE_FILE_NAME = 'toolbar-notifications-none.html'
const CURRENT_CLIENT_FIXTURE_FILE_NAME = 'layout-user-tags.html'
const COLLAPSE_BUTTON_SELECTOR = siteSelectors.toolbarCollapseButton

/**
 * Высота секций со снятой живой страницы v3.72.37: тест проверяет не только display, но и
 * что показанная секция остаётся видимым блоком своих размеров
 */
const siteToolbarStyles = css`
  ${siteSelectors.toolbarSectionMain} {
    height: 44px;
  }
  ${siteSelectors.toolbarSectionChats} {
    height: 48px;
  }
  ${siteSelectors.toolbarSectionContacts} {
    height: 44px;
  }
  ${siteSelectors.toolbarSectionCalls} {
    height: 48px;
  }
  ${siteSelectors.toolbarSectionSmartapps} {
    height: 44px;
  }
  ${siteSelectors.toolbarSmartappSectionBlock} {
    height: 288px;
  }
`

describe('hide-toolbar-sections', () => {
  let fixture: MountedFeatureFixture

  function applyHiddenSections(hiddenSections: readonly string[]): void {
    for (const sectionId of TOOLBAR_SECTION_IDS) {
      const stateAttributeName = createFeatureStateAttributeName(featureMeta.id, sectionId)
      if (hiddenSections.includes(sectionId)) {
        document.documentElement.setAttribute(stateAttributeName, '')
      } else {
        document.documentElement.removeAttribute(stateAttributeName)
      }
    }
  }

  function sectionElement(sectionId: string): Element {
    const selector = SECTION_SELECTOR_BY_ID[sectionId]
    if (selector === undefined) {
      throw new Error(`Селектор секции ${sectionId} не найден`)
    }
    return findRequiredElement(fixture.container, selector)
  }

  beforeEach(() => {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(TOOLBAR_FIXTURE_FILE_NAME)],
      siteStyles: siteToolbarStyles,
      wrapInLayoutPane: true,
    })
  })

  afterEach(() => {
    fixture.unmount()
  })

  it('прячет все секции, когда поставлены все признаки состояния', () => {
    applyHiddenSections(TOOLBAR_SECTION_IDS)
    for (const { id: sectionId } of TOOLBAR_SECTIONS) {
      expect(getComputedStyle(sectionElement(sectionId)).display, sectionId).toBe('none')
    }
  })

  it('показывает секцию, когда снят её признак состояния', () => {
    applyHiddenSections(['main', 'chats', 'contacts'])
    for (const hiddenId of ['main', 'chats', 'contacts']) {
      expect(getComputedStyle(sectionElement(hiddenId)).display, hiddenId).toBe('none')
    }
    for (const shownId of ['calls', 'smartapps', 'smartapps-block']) {
      expect(getComputedStyle(sectionElement(shownId)).display, shownId).not.toBe('none')
    }
    expect(getComputedStyle(sectionElement('calls')).height).toBe('48px')
    expect(getComputedStyle(sectionElement('smartapps')).height).toBe('44px')
    expect(getComputedStyle(sectionElement('smartapps-block')).height).toBe('288px')
  })

  it('прячет только блок умных приложений, не трогая его кнопку', () => {
    applyHiddenSections(['smartapps-block'])
    expect(getComputedStyle(sectionElement('smartapps-block')).display).toBe('none')
    expect(getComputedStyle(sectionElement('smartapps')).display).not.toBe('none')
  })

  it('не трогает колонку настроек и нижнюю колонку при скрытии всех секций', () => {
    applyHiddenSections(TOOLBAR_SECTION_IDS)
    expect(
      getComputedStyle(findRequiredElement(fixture.container, siteSelectors.toolbarSettingsColumn))
        .display,
    ).not.toBe('none')
    expect(
      getComputedStyle(findRequiredElement(fixture.container, siteSelectors.toolbarBottomColumn))
        .display,
    ).not.toBe('none')
  })

  it('прячет только бейдж колокольчика при скрытом счётчике, кнопка остаётся', () => {
    applyHiddenSections([BELL_COUNTER_SECTION_ID])
    expect(getComputedStyle(sectionElement(BELL_COUNTER_SECTION_ID)).display).toBe('none')
    expect(getComputedStyle(sectionElement(BELL_SECTION_ID)).display).not.toBe('none')
  })

  it('прячет кнопку колокольчика целиком, не трогая кнопку сворачивания колонки', () => {
    applyHiddenSections([BELL_SECTION_ID])
    expect(getComputedStyle(sectionElement(BELL_SECTION_ID)).display).toBe('none')
    expect(
      getComputedStyle(findRequiredElement(fixture.container, COLLAPSE_BUTTON_SELECTOR)).display,
    ).not.toBe('none')
  })

  it('не прячет колокольчик и счётчик, пока их признаки не поставлены', () => {
    applyHiddenSections(['main'])
    expect(getComputedStyle(sectionElement(BELL_COUNTER_SECTION_ID)).display).not.toBe('none')
    expect(getComputedStyle(sectionElement(BELL_SECTION_ID)).display).not.toBe('none')
  })

  it('находит колокольчик и кнопку сворачивания на разметке без бейджа и текущей версии клиента', () => {
    for (const fixtureFileName of [
      NO_BADGE_TOOLBAR_FIXTURE_FILE_NAME,
      CURRENT_CLIENT_FIXTURE_FILE_NAME,
    ]) {
      fixture.unmount()
      fixture = mountFeatureFixture({
        featureId: featureMeta.id,
        featureStyles,
        fixtureHtmlList: [loadFixture(fixtureFileName)],
        siteStyles: siteToolbarStyles,
        wrapInLayoutPane: true,
      })
      applyHiddenSections([BELL_SECTION_ID])
      expect(getComputedStyle(sectionElement(BELL_SECTION_ID)).display, fixtureFileName).toBe(
        'none',
      )
      expect(
        getComputedStyle(findRequiredElement(fixture.container, COLLAPSE_BUTTON_SELECTOR)).display,
        fixtureFileName,
      ).not.toBe('none')
    }
  })

  it('возвращает все секции при отключении функции', () => {
    applyHiddenSections(TOOLBAR_SECTION_IDS)
    fixture.setEnabled(false)
    for (const { id: sectionId } of TOOLBAR_SECTIONS) {
      expect(getComputedStyle(sectionElement(sectionId)).display, sectionId).not.toBe('none')
    }
  })
})
