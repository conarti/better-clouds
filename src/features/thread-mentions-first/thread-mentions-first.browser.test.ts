import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { css } from '@/shared/feature/css'
import { siteClassNames, siteCustomPropertyNames, siteSelectors } from '@/shared/site/selectors'
import {
  findRequiredElement,
  mountFeatureFixture,
  type MountedFeatureFixture,
} from '@@/tests/helpers/feature-dom'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureMeta from './meta'
import { featureStyles } from './styles'

const THREADS_TAB_FIXTURE_FILE_NAME = 'layout-threads-tab.html'
const ACCENT_COLOR = 'rgb(1, 2, 3)'
const NO_BOX_SHADOW = 'none'
const BLOCK_DISPLAY = 'block'
const FLEX_DISPLAY = 'flex'
const STRIPE_WIDTH = '3px'
const MINIMUM_THREAD_ENTRY_COUNT = 5

/** Вкладки фикстуры: «All chats», «Catalog», «Threads», «Mentioned» и один тег */
const THREADS_TAB_INDEX = 2
const OTHER_TAB_INDEXES = [0, 1, 3, 4]

/** Индекс записи фикстуры со счётчиком упоминаний, вставленным вручную (README фикстур) */
const FIXTURE_MENTIONED_ENTRY_INDEX = 3
/** Индекс записи фикстуры с одним счётчиком непрочитанных: тест добавляет ей упоминание */
const FIXTURE_UNREAD_ENTRY_INDEX = 1

/**
 * Правила клиента из живой проверки v3.72.37: акцентная переменная на корне документа и
 * вертикальные поля записи 2px, которые в блочном контейнере схлопываются. Высота записи
 * у клиента одинаковая, иначе места строк зависели бы от того, какая запись куда встала
 */
const siteThreadListStyles = css`
  :root {
    ${siteCustomPropertyNames.buttonPrimary}: ${ACCENT_COLOR};
  }
  ${siteSelectors.chatListEntry} {
    height: 80px;
    margin: 2px 5px 2px 4px;
    overflow: hidden;
  }
`

const mentionedWrapperSelector = `${siteSelectors.chatList} > ${siteSelectors.chatListItemWrapper}:has(${siteSelectors.threadListEntryMentionCounterPair})`

describe('thread-mentions-first', () => {
  let fixture: MountedFeatureFixture

  beforeEach(() => {
    fixture = mountFeatureFixture({
      featureId: featureMeta.id,
      featureStyles,
      fixtureHtmlList: [loadFixture(THREADS_TAB_FIXTURE_FILE_NAME)],
      siteStyles: siteThreadListStyles,
    })
  })

  afterEach(() => {
    fixture.unmount()
  })

  function findChatList(): HTMLElement {
    return findRequiredElement(fixture.container, siteSelectors.chatList) as HTMLElement
  }

  function findWrappers(): HTMLElement[] {
    return Array.from(
      findChatList().querySelectorAll<HTMLElement>(`:scope > ${siteSelectors.chatListItemWrapper}`),
    )
  }

  function findWrapperAt(index: number): HTMLElement {
    const wrapper = findWrappers()[index]
    if (wrapper === undefined) {
      throw new Error(`Запись ${String(index)} не найдена`)
    }
    return wrapper
  }

  function findEntry(wrapper: Element): HTMLElement {
    return findRequiredElement(wrapper, siteSelectors.chatListEntry) as HTMLElement
  }

  /** Индексы записей в порядке DOM, отсортированные по вертикальной позиции на экране */
  function readVisualOrder(): number[] {
    return findWrappers()
      .map((wrapper, domIndex) => ({ domIndex, top: wrapper.getBoundingClientRect().top }))
      .sort((first, second) => first.top - second.top)
      .map(({ domIndex }) => domIndex)
  }

  function readDomOrder(): number[] {
    return findWrappers().map((_wrapper, domIndex) => domIndex)
  }

  /** Вертикальные позиции записей по возрастанию: места строк без учёта того, кто где стоит */
  function readEntrySlots(): number[] {
    return findWrappers()
      .map((wrapper) => findEntry(wrapper).getBoundingClientRect().top)
      .sort((first, second) => first - second)
  }

  function addMentionCounter(wrapper: Element): void {
    const unreadCounter = findRequiredElement(wrapper, siteSelectors.threadListEntryCounter)
    const mentionedCounter = findRequiredElement(
      findWrapperAt(FIXTURE_MENTIONED_ENTRY_INDEX),
      siteSelectors.threadListEntryCounter,
    )
    unreadCounter.before(mentionedCounter.cloneNode(true))
  }

  function selectTab(tabIndex: number): void {
    const tabButtons = findRequiredElement(
      fixture.container,
      siteSelectors.chatListTabsList,
    ).querySelectorAll(siteSelectors.chatListTabButton)
    for (const [buttonIndex, tabButton] of tabButtons.entries()) {
      tabButton.classList.toggle(siteClassNames.chatListTabSelected, buttonIndex === tabIndex)
    }
  }

  function expectClientLayout(): void {
    expect(readVisualOrder()).toEqual(readDomOrder())
    expect(getComputedStyle(findChatList()).display).toBe(BLOCK_DISPLAY)
    for (const wrapper of findWrappers()) {
      expect(getComputedStyle(findEntry(wrapper)).boxShadow).toBe(NO_BOX_SHADOW)
    }
  }

  it('фикстура: вкладка тредов активна и в ней ровно один тред с упоминанием', () => {
    expect(findWrappers().length).toBeGreaterThanOrEqual(MINIMUM_THREAD_ENTRY_COUNT)
    expect(findRequiredElement(fixture.container, siteSelectors.chatListThreadsTabActive)).not.toBe(
      null,
    )
    expect(fixture.container.querySelectorAll(mentionedWrapperSelector)).toHaveLength(1)
    expect(findWrappers().indexOf(findWrapperAt(FIXTURE_MENTIONED_ENTRY_INDEX))).toBe(
      FIXTURE_MENTIONED_ENTRY_INDEX,
    )
  })

  it('поднимает тред с упоминанием наверх, остальные в порядке клиента', () => {
    const domOrder = readDomOrder()
    const expectedOrder = [
      FIXTURE_MENTIONED_ENTRY_INDEX,
      ...domOrder.filter((domIndex) => domIndex !== FIXTURE_MENTIONED_ENTRY_INDEX),
    ]
    expect(getComputedStyle(findChatList()).display).toBe(FLEX_DISPLAY)
    expect(readVisualOrder()).toEqual(expectedOrder)
  })

  it('ставит записи на те же места, что у клиента, без сдвига от полей', () => {
    const enabledSlots = readEntrySlots()
    fixture.setEnabled(false)
    expect(enabledSlots).toEqual(readEntrySlots())
  })

  it('отмечает тред с упоминанием акцентной полосой слева', () => {
    const boxShadow = getComputedStyle(
      findEntry(findWrapperAt(FIXTURE_MENTIONED_ENTRY_INDEX)),
    ).boxShadow
    expect(boxShadow).toContain(ACCENT_COLOR)
    expect(boxShadow).toContain(STRIPE_WIDTH)
    expect(boxShadow).toContain('inset')
    expect(getComputedStyle(findEntry(findWrapperAt(0))).boxShadow).toBe(NO_BOX_SHADOW)
  })

  it('сохраняет порядок клиента внутри группы с упоминаниями', () => {
    addMentionCounter(findWrapperAt(FIXTURE_UNREAD_ENTRY_INDEX))
    const mentionedIndexes = [FIXTURE_UNREAD_ENTRY_INDEX, FIXTURE_MENTIONED_ENTRY_INDEX]
    const expectedOrder = [
      ...mentionedIndexes,
      ...readDomOrder().filter((domIndex) => !mentionedIndexes.includes(domIndex)),
    ]
    expect(readVisualOrder()).toEqual(expectedOrder)
  })

  it('не трогает счётчик непрочитанных без упоминания', () => {
    const unreadWrapper = findWrapperAt(FIXTURE_UNREAD_ENTRY_INDEX)
    expect(unreadWrapper.querySelector(siteSelectors.threadListEntryCounter)).not.toBe(null)
    expect(getComputedStyle(findEntry(unreadWrapper)).boxShadow).toBe(NO_BOX_SHADOW)
  })

  it('без треда с упоминанием оставляет контейнер клиента как есть', () => {
    findRequiredElement(
      findWrapperAt(FIXTURE_MENTIONED_ENTRY_INDEX),
      siteSelectors.threadListEntryCounter,
    ).remove()
    expectClientLayout()
  })

  it('на других вкладках ничего не меняет, и снова работает при возврате на треды', () => {
    for (const tabIndex of OTHER_TAB_INDEXES) {
      selectTab(tabIndex)
      expectClientLayout()
    }
    selectTab(THREADS_TAB_INDEX)
    expect(readVisualOrder()[0]).toBe(FIXTURE_MENTIONED_ENTRY_INDEX)
  })

  it('при непустом поле поиска ничего не меняет', () => {
    findRequiredElement(fixture.container, siteSelectors.chatListSearchInput).classList.add(
      siteClassNames.chatListSearchInputValue,
    )
    expectClientLayout()
  })

  it('отключение возвращает порядок и вид клиента', () => {
    fixture.setEnabled(false)
    expectClientLayout()
    fixture.setEnabled(true)
    expect(readVisualOrder()[0]).toBe(FIXTURE_MENTIONED_ENTRY_INDEX)
  })
})
