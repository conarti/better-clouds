import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteClassNames, siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { createTabPositionAttributeName, featureStyles } from './styles'

const USER_TAGS_FIXTURE_FILE_NAME = 'layout-user-tags.html'
const STATE_ATTRIBUTE_VALUE = ''
const AFTER_PSEUDO_ELEMENT = '::after'
const ABSOLUTE_POSITION = 'absolute'
const ZERO_PIXELS = '0px'

/** Подписи вкладок фикстуры: системные (английская локаль) и заменитель имени тега */
const SYSTEM_TAB_LABELS = ['All chats', 'Catalog', 'Threads', 'Mentioned']
const FIXTURE_TAG_LABEL = 'Тег 1'
/** Ещё два тега копируются из вкладки фикстуры: у пользователя при съёмке был один */
const SECOND_TAG_LABEL = 'Тег 2'
const THIRD_TAG_LABEL = 'Тег 3'
const FIXTURE_TAG_POSITION = 5
const THIRD_TAG_POSITION = 7

const CLIENT_ORDER_LABELS = [
  ...SYSTEM_TAB_LABELS,
  FIXTURE_TAG_LABEL,
  SECOND_TAG_LABEL,
  THIRD_TAG_LABEL,
]

/**
 * Правила клиента для вкладок из разведки живой страницы v3.72.37: список flex в строку,
 * обёртка вкладки display: contents, подчёркивание выбранной вкладки это её ::after
 * (absolute, bottom: -1px, высота 2px, ширина вкладки)
 */
const siteTabStyles = css`
  ${siteSelectors.chatListTabsList} {
    display: flex;
    flex-direction: row;
    width: 900px;
  }
  ${siteSelectors.chatListTabsList} > ${siteSelectors.chatListTabWrapper} {
    display: contents;
  }
  ${siteSelectors.chatListTabButton} {
    position: relative;
    padding: 0 12px;
    border: none;
    font-size: 14px;
  }
  ${siteSelectors.chatListTabButton}.${siteClassNames.chatListTabSelected}${AFTER_PSEUDO_ELEMENT} {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background-color: rgb(0, 0, 255);
  }
`

describe('tag-tabs-first', () => {
  let fixture: MountedFeatureFixture

  function findTabsList(): Element {
    return findRequiredElement(fixture.container, siteSelectors.chatListTabsList)
  }

  function findTabButtons(): HTMLElement[] {
    return Array.from(findTabsList().querySelectorAll<HTMLElement>(siteSelectors.chatListTabButton))
  }

  function findTabButton(label: string): HTMLElement {
    const tabButton = findTabButtons().find((button) => button.textContent === label)
    if (tabButton === undefined) {
      throw new Error(`Вкладка ${label} не найдена`)
    }
    return tabButton
  }

  /** Подписи вкладок слева направо, как их видит пользователь */
  function readVisualOrderLabels(): string[] {
    return findTabButtons()
      .sort(
        (firstButton, secondButton) =>
          firstButton.getBoundingClientRect().left - secondButton.getBoundingClientRect().left,
      )
      .map((button) => button.textContent ?? '')
  }

  function appendTagTab(label: string): void {
    const fixtureTagWrapper = findTabsList().children.item(FIXTURE_TAG_POSITION - 1)
    if (fixtureTagWrapper === null) {
      throw new Error('В фикстуре нет вкладки тега')
    }
    const tagWrapper = fixtureTagWrapper.cloneNode(true) as Element
    findRequiredElement(tagWrapper, siteSelectors.chatListTabLabel).textContent = label
    findTabsList().append(tagWrapper)
  }

  function selectTabPositions(positions: readonly number[]): void {
    for (const position of positions) {
      document.documentElement.setAttribute(
        createTabPositionAttributeName(position),
        STATE_ATTRIBUTE_VALUE,
      )
    }
  }

  function selectTab(label: string): void {
    for (const tabButton of findTabButtons()) {
      tabButton.classList.toggle(
        siteClassNames.chatListTabSelected,
        tabButton.textContent === label,
      )
    }
  }

  beforeEach(() => {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(USER_TAGS_FIXTURE_FILE_NAME)],
      siteStyles: siteTabStyles,
    })
    appendTagTab(SECOND_TAG_LABEL)
    appendTagTab(THIRD_TAG_LABEL)
  })

  afterEach(() => {
    for (const position of [FIXTURE_TAG_POSITION, THIRD_TAG_POSITION]) {
      document.documentElement.removeAttribute(createTabPositionAttributeName(position))
    }
    fixture.unmount()
  })

  it('без выбранных тегов вкладки в порядке клиента', () => {
    expect(readVisualOrderLabels()).toEqual(CLIENT_ORDER_LABELS)
  })

  it('выбранные теги стоят перед «Все чаты» в порядке клиента, остальные на местах', () => {
    selectTabPositions([THIRD_TAG_POSITION, FIXTURE_TAG_POSITION])

    expect(readVisualOrderLabels()).toEqual([
      FIXTURE_TAG_LABEL,
      THIRD_TAG_LABEL,
      ...SYSTEM_TAB_LABELS,
      SECOND_TAG_LABEL,
    ])
  })

  it('выключение функции возвращает порядок клиента', () => {
    selectTabPositions([FIXTURE_TAG_POSITION])
    fixture.setEnabled(false)

    expect(readVisualOrderLabels()).toEqual(CLIENT_ORDER_LABELS)
  })

  it('подчёркивание выбранного тега едет вместе с вкладкой', () => {
    selectTabPositions([THIRD_TAG_POSITION])
    selectTab(THIRD_TAG_LABEL)
    const tagButton = findTabButton(THIRD_TAG_LABEL)
    const tagButtonRect = tagButton.getBoundingClientRect()
    const underlineStyle = getComputedStyle(tagButton, AFTER_PSEUDO_ELEMENT)

    expect(tagButtonRect.left).toBeLessThan(
      findTabButton(SYSTEM_TAB_LABELS[0] ?? '').getBoundingClientRect().left,
    )
    expect(underlineStyle.position).toBe(ABSOLUTE_POSITION)
    expect(underlineStyle.left).toBe(ZERO_PIXELS)
    expect(Number.parseFloat(underlineStyle.width)).toBeCloseTo(tagButtonRect.width, 1)
  })

  it('выбранная «Все чаты» по-прежнему находится позиционным селектором', () => {
    selectTabPositions([FIXTURE_TAG_POSITION])
    selectTab(SYSTEM_TAB_LABELS[0] ?? '')

    expect(fixture.container.querySelector(siteSelectors.chatListAllChatsTabActive)).toBe(
      findTabButton(SYSTEM_TAB_LABELS[0] ?? ''),
    )
  })
})
