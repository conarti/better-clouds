import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME } from '@/shared/feature/feature-scope'
import { createLifecycleScope, type LifecycleScope } from '@/shared/feature/lifecycle-scope'
import type { FeatureCleanup } from '@/shared/feature/feature-types'
import { createDiscoveredValuesItem } from '@/shared/settings/discovered-values'
import { createFeatureSettingsItem } from '@/shared/settings/feature-settings'
import { siteSelectors } from '@/shared/site/selectors'
import { loadFixture } from '@@/tests/helpers/load-fixture'
import featureContent from './content'
import featureMeta from './meta'
import { featureSettings, resolveSelectedTagNames } from './settings'
import { createTabPositionAttributeName, MAXIMUM_TAB_POSITION_COUNT } from './styles'
import { computeSelectedTabPositions, findUserTagTabs } from './tag-tabs'

const USER_TAGS_FIXTURE_FILE_NAME = 'layout-user-tags.html'
/** Имя тега в фикстуре: заменитель санитайзера */
const FIXTURE_TAG_NAME = 'Тег 1'
/** Вкладка тега в фикстуре пятая: после четырёх системных */
const FIXTURE_TAG_POSITION = 5
const SECOND_TAG_NAME = 'Работа'
const RENAMED_TAG_NAME = 'Семья'
const MISSING_TAG_NAME = 'Удалённый тег'
const OWNED_TAB_NAME = 'Архив'
const OWNED_ATTRIBUTE_VALUE = 'chat-archive:stub-instance'
const ELEMENT_TAG_NAME = 'div'
const QUIET_PERIOD_MILLISECONDS = 50

let lifecycleScope: LifecycleScope | null = null
let cleanup: FeatureCleanup | null = null

function findTabsList(): Element {
  const tabsList = document.querySelector(siteSelectors.chatListTabsList)
  if (tabsList === null) {
    throw new Error('В фикстуре нет списка вкладок')
  }
  return tabsList
}

/** Копия вкладки тега из фикстуры с другим именем: разметка та же, что у клиента */
function appendTagTab(tagName: string, isOwned = false): Element {
  const tabsList = findTabsList()
  const fixtureTagWrapper = tabsList.children.item(FIXTURE_TAG_POSITION - 1)
  if (fixtureTagWrapper === null) {
    throw new Error('В фикстуре нет вкладки тега')
  }
  const tabWrapper = fixtureTagWrapper.cloneNode(true) as Element
  const label = tabWrapper.querySelector(siteSelectors.chatListTabLabel)
  if (label === null) {
    throw new Error('У вкладки нет подписи')
  }
  label.textContent = tagName
  if (isOwned) {
    tabWrapper.setAttribute(FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME, OWNED_ATTRIBUTE_VALUE)
  }
  tabsList.append(tabWrapper)
  return tabWrapper
}

function readPositionAttributes(): number[] {
  const positions: number[] = []
  for (let position = 1; position <= MAXIMUM_TAB_POSITION_COUNT; position++) {
    if (document.documentElement.hasAttribute(createTabPositionAttributeName(position))) {
      positions.push(position)
    }
  }
  return positions
}

async function storeSelectedTagNames(selectedTagNames: readonly string[]): Promise<void> {
  await createFeatureSettingsItem(featureMeta, featureSettings).setValue({
    enabled: true,
    selectedTagNames: [...selectedTagNames],
  })
}

async function readStoredDiscoveredNames(): Promise<readonly string[]> {
  return (await createDiscoveredValuesItem(featureMeta).getValue()).values
}

async function mountFeature(): Promise<void> {
  const scope = createLifecycleScope()
  lifecycleScope = scope
  const mountResult = await featureContent.mount?.({
    documentRoot: document,
    signal: scope.signal,
    lifecycle: scope.lifecycle,
  })
  expect(typeof mountResult).toBe('function')
  cleanup = mountResult as FeatureCleanup
}

function unmountFeature(): void {
  lifecycleScope?.dispose()
  cleanup?.()
  lifecycleScope = null
  cleanup = null
}

describe('findUserTagTabs и computeSelectedTabPositions', () => {
  beforeEach(() => {
    document.body.innerHTML = loadFixture(USER_TAGS_FIXTURE_FILE_NAME)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('находит тег после системных вкладок с позицией как в :nth-child', () => {
    expect(findUserTagTabs(findTabsList())).toEqual([
      { name: FIXTURE_TAG_NAME, position: FIXTURE_TAG_POSITION },
    ])
  })

  it('пропускает узлы расширения, в том числе вложенный маркер', () => {
    appendTagTab(OWNED_TAB_NAME, true)
    const wrapperWithOwnedChild = appendTagTab(SECOND_TAG_NAME)
    wrapperWithOwnedChild.append(document.createElement(ELEMENT_TAG_NAME))
    wrapperWithOwnedChild.lastElementChild?.setAttribute(
      FEATURE_OWNED_ELEMENT_ATTRIBUTE_NAME,
      OWNED_ATTRIBUTE_VALUE,
    )
    appendTagTab(RENAMED_TAG_NAME)

    expect(findUserTagTabs(findTabsList())).toEqual([
      { name: FIXTURE_TAG_NAME, position: FIXTURE_TAG_POSITION },
      { name: RENAMED_TAG_NAME, position: FIXTURE_TAG_POSITION + 3 },
    ])
  })

  it('позиции выбранных тегов идут в порядке клиента, лишние имена не совпадают', () => {
    const userTagTabs = [
      { name: FIXTURE_TAG_NAME, position: FIXTURE_TAG_POSITION },
      { name: SECOND_TAG_NAME, position: FIXTURE_TAG_POSITION + 1 },
      { name: RENAMED_TAG_NAME, position: FIXTURE_TAG_POSITION + 2 },
    ]

    expect(
      computeSelectedTabPositions(userTagTabs, [
        RENAMED_TAG_NAME,
        MISSING_TAG_NAME,
        FIXTURE_TAG_NAME,
      ]),
    ).toEqual([FIXTURE_TAG_POSITION, FIXTURE_TAG_POSITION + 2])
    expect(computeSelectedTabPositions(userTagTabs, [])).toEqual([])
  })
})

describe('resolveSelectedTagNames', () => {
  it('без поля или с полем чужого формата ни один тег не выбран', () => {
    expect(resolveSelectedTagNames(undefined)).toEqual([])
    expect(resolveSelectedTagNames({ enabled: true })).toEqual([])
    expect(resolveSelectedTagNames({ enabled: true, selectedTagNames: FIXTURE_TAG_NAME })).toEqual(
      [],
    )
  })

  it('отбрасывает не строки и повторы, сохраняет порядок', () => {
    expect(
      resolveSelectedTagNames({
        selectedTagNames: [SECOND_TAG_NAME, 1, FIXTURE_TAG_NAME, SECOND_TAG_NAME],
      }),
    ).toEqual([SECOND_TAG_NAME, FIXTURE_TAG_NAME])
  })
})

describe('tag-tabs-first mount', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    document.body.innerHTML = loadFixture(USER_TAGS_FIXTURE_FILE_NAME)
  })

  afterEach(() => {
    unmountFeature()
    for (let position = 1; position <= MAXIMUM_TAB_POSITION_COUNT; position++) {
      document.documentElement.removeAttribute(createTabPositionAttributeName(position))
    }
    document.body.innerHTML = ''
  })

  it('сохраняет имена тегов в storage.local и ставит позицию выбранного тега', async () => {
    await storeSelectedTagNames([FIXTURE_TAG_NAME])
    await mountFeature()

    expect(readPositionAttributes()).toEqual([FIXTURE_TAG_POSITION])
    await vi.waitFor(async () => {
      expect(await readStoredDiscoveredNames()).toEqual([FIXTURE_TAG_NAME])
    })
  })

  it('пишет снимок только при изменении набора тегов', async () => {
    const discoveredValuesItem = createDiscoveredValuesItem(featureMeta)
    await discoveredValuesItem.setValue({ values: [FIXTURE_TAG_NAME], isTruncated: false })
    const setItemSpy = vi.spyOn(fakeBrowser.storage.local, 'set')

    await mountFeature()
    expect(setItemSpy).not.toHaveBeenCalled()

    appendTagTab(SECOND_TAG_NAME)
    await vi.waitFor(async () => {
      expect(await readStoredDiscoveredNames()).toEqual([FIXTURE_TAG_NAME, SECOND_TAG_NAME])
    })
    expect(setItemSpy).toHaveBeenCalledTimes(1)
    setItemSpy.mockRestore()
  })

  it('выбор в настройках применяется без перезагрузки', async () => {
    appendTagTab(SECOND_TAG_NAME)
    await mountFeature()
    expect(readPositionAttributes()).toEqual([])

    await storeSelectedTagNames([SECOND_TAG_NAME])
    await vi.waitFor(() => {
      expect(readPositionAttributes()).toEqual([FIXTURE_TAG_POSITION + 1])
    })

    await storeSelectedTagNames([])
    await vi.waitFor(() => {
      expect(readPositionAttributes()).toEqual([])
    })
  })

  it('переименованный и удалённый тег просто перестают применяться', async () => {
    const secondTabWrapper = appendTagTab(SECOND_TAG_NAME)
    await storeSelectedTagNames([FIXTURE_TAG_NAME, SECOND_TAG_NAME])
    await mountFeature()
    expect(readPositionAttributes()).toEqual([FIXTURE_TAG_POSITION, FIXTURE_TAG_POSITION + 1])

    const secondLabel = secondTabWrapper.querySelector(siteSelectors.chatListTabLabel)
    if (secondLabel === null) {
      throw new Error('У вкладки нет подписи')
    }
    secondLabel.textContent = RENAMED_TAG_NAME
    await vi.waitFor(() => {
      expect(readPositionAttributes()).toEqual([FIXTURE_TAG_POSITION])
    })

    secondTabWrapper.remove()
    findTabsList().lastElementChild?.remove()
    await vi.waitFor(async () => {
      expect(readPositionAttributes()).toEqual([])
      expect(await readStoredDiscoveredNames()).toEqual([])
    })
  })

  it('вкладка расширения не попадает в снимок', async () => {
    await mountFeature()
    appendTagTab(OWNED_TAB_NAME, true)
    appendTagTab(SECOND_TAG_NAME)

    await vi.waitFor(async () => {
      expect(await readStoredDiscoveredNames()).toEqual([FIXTURE_TAG_NAME, SECOND_TAG_NAME])
    })
  })

  it('после выключения наблюдатель и подписка сняты', async () => {
    await storeSelectedTagNames([FIXTURE_TAG_NAME])
    await mountFeature()
    unmountFeature()
    document.documentElement.removeAttribute(createTabPositionAttributeName(FIXTURE_TAG_POSITION))

    appendTagTab(SECOND_TAG_NAME)
    await storeSelectedTagNames([FIXTURE_TAG_NAME, SECOND_TAG_NAME])
    await new Promise((resolve) => {
      setTimeout(resolve, QUIET_PERIOD_MILLISECONDS)
    })

    expect(readPositionAttributes()).toEqual([])
    expect(await readStoredDiscoveredNames()).toEqual([FIXTURE_TAG_NAME])
  })
})
