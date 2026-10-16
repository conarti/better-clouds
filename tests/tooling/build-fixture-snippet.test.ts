import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Самопроверка scripts/build-fixture-snippet.mjs: выполняется ровно тот текст, который
 * вставляют в консоль DevTools, поэтому пропуск константы или функции в сборке сниппета
 * роняет тест так же, как упал бы сниппет в консоли.
 */

interface FixtureSnippetWindow {
  betterCloudsFixture?: (rootSelectorOrElement?: string | Element) => string | number | null
}

/** Vitest запускается из корня проекта, поэтому путь скрипта считается от него */
const PROJECT_ROOT_PATH = process.cwd()
const FIXTURE_SNIPPET_SCRIPT_PATH = path.join(
  PROJECT_ROOT_PATH,
  'scripts/build-fixture-snippet.mjs',
)
const NODE_EXECUTABLE = process.execPath
const UTF8_ENCODING = 'utf8'
const CLEAN_EXIT_CODE = 0
const IN_PLACE_FLAG = '--in-place'

const IN_PLACE_ROOT_SELECTOR = '#app'
const CLONE_ROOT_SELECTOR = '.layout-pane'
const IMAGE_SELECTOR = 'img'
const AVATAR_IMAGE_SELECTOR = '.chat-avatar__img'
const PREVIEW_IMAGE_SELECTOR = '.chat-message__status--img-preview img'
const ICON_IMAGE_SELECTOR = '.smart-app-icon img'
const IMAGE_SOURCE_SELECTOR = '[src], [srcset]'
/** Корень вместе со всеми потомками: сниппет обрабатывает и сам корень */
const PROCESSED_ELEMENT_SELECTOR = `${IN_PLACE_ROOT_SELECTOR}, ${IN_PLACE_ROOT_SELECTOR} *`
const EXPECTED_IMAGE_COUNT = 3

const SOURCE_ATTRIBUTE_NAME = 'src'
const SOURCE_SET_ATTRIBUTE_NAME = 'srcset'
const XMLNS_ATTRIBUTE_NAME = 'xmlns'
const SVG_SIZE_ATTRIBUTE_NAMES = ['viewBox', 'width', 'height']
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const SVG_ELEMENT_NAME = 'svg'
const SVG_MEDIA_TYPE = 'image/svg+xml'
const HTML_MEDIA_TYPE = 'text/html'
const SVG_DATA_URI_SCHEME = `data:${SVG_MEDIA_TYPE}`
const SVG_DATA_URI_PREFIX = `${SVG_DATA_URI_SCHEME},`
const EXTERNAL_ADDRESS_PATTERN = /https?:\/\//
const NUMBER_TYPE_NAME = 'number'
const STRING_TYPE_NAME = 'string'

/** Внешние адреса только на зарезервированном домене, который никогда не разрешается */
const AVATAR_SOURCE_ADDRESS = 'https://example.invalid/avatar.png'
const PREVIEW_SOURCE_ADDRESS = 'https://example.invalid/preview.png'
const ICON_SOURCE_ADDRESS = 'https://example.invalid/icon.png'
const ORIGINAL_IMAGE_SOURCES = [AVATAR_SOURCE_ADDRESS, PREVIEW_SOURCE_ADDRESS, ICON_SOURCE_ADDRESS]

/**
 * Разметка повторяет живую страницу: у аватара `src` идёт раньше `srcset`, у превью наоборот,
 * у иконки приложения только `src`; рядом фон через `url(`, внешняя ссылка и инлайновый SVG
 */
const SYNTHETIC_MARKUP = [
  '<div class="chat-avatar__inner">',
  `<img class="chat-avatar__img" src="${AVATAR_SOURCE_ADDRESS}" srcset="https://example.invalid/avatar-2x.png 2x">`,
  '</div>',
  '<span class="chat-message__status--img-preview">',
  `<img width="16px" height="16px" srcset="https://example.invalid/preview-2x.png 2x" src="${PREVIEW_SOURCE_ADDRESS}">`,
  '</span>',
  `<div class="smart-app-icon"><img src="${ICON_SOURCE_ADDRESS}"></div>`,
  '<div style="background-image: url(https://example.invalid/b.png); color: red"></div>',
  '<a href="https://example.invalid/"></a>',
  `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"></path></svg>`,
].join('')

/** Эмодзи в сообщениях клиента: картинка без источника, как после обезличивания копии */
const SOURCELESS_IMAGE_SELECTOR = '.emoji-icon'
const SOURCELESS_IMAGE_MARKUP =
  '<img class="emoji-icon" height="16" role="presentation" width="16">'

const fixtureSnippetWindow = window as unknown as FixtureSnippetWindow

/**
 * Печатает сниппет в нужном режиме тем же скриптом, что и `pnpm fixture:snippet`
 * @param modeFlags флаги режима
 */
function buildFixtureSnippetSource(modeFlags: readonly string[]): string {
  const snippetProcess = spawnSync(NODE_EXECUTABLE, [FIXTURE_SNIPPET_SCRIPT_PATH, ...modeFlags], {
    cwd: PROJECT_ROOT_PATH,
    encoding: UTF8_ENCODING,
  })
  if (snippetProcess.error !== undefined || snippetProcess.status !== CLEAN_EXIT_CODE) {
    throw new Error(
      `Сниппет не собрался: ${String(snippetProcess.error)}, код ${String(snippetProcess.status)}, stderr: ${snippetProcess.stderr}`,
    )
  }
  return snippetProcess.stdout
}

/** Выполняет текст сниппета так же, как консоль DevTools: в глобальной области окна */
function runFixtureSnippetSource(snippetSource: string): void {
  new Function(snippetSource)()
}

function queryImageElements(rootSelector: string): HTMLImageElement[] {
  return Array.from(
    document.querySelectorAll<HTMLImageElement>(`${rootSelector} ${IMAGE_SELECTOR}`),
  )
}

function readImageSource(imageSelector: string): string | null {
  return (
    document
      .querySelector(`${IN_PLACE_ROOT_SELECTOR} ${imageSelector}`)
      ?.getAttribute(SOURCE_ATTRIBUTE_NAME) ?? null
  )
}

/** Текст каждого режима собирается один раз на файл */
const inPlaceSnippetSource = buildFixtureSnippetSource([IN_PLACE_FLAG])
const cloneSnippetSource = buildFixtureSnippetSource([])

afterEach(() => {
  document.body.replaceChildren()
  delete fixtureSnippetWindow.betterCloudsFixture
})

describe('сниппет фикстур в режиме in-place', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="app">${SYNTHETIC_MARKUP}</div>`
    runFixtureSnippetSource(inPlaceSnippetSource)
  })

  it('сохраняет все картинки страницы', () => {
    expect(queryImageElements(IN_PLACE_ROOT_SELECTOR)).toHaveLength(EXPECTED_IMAGE_COUNT)
  })

  it('ставит каждой картинке заглушку data:image/svg+xml и убирает srcset', () => {
    for (const imageElement of queryImageElements(IN_PLACE_ROOT_SELECTOR)) {
      const imageSource = imageElement.getAttribute(SOURCE_ATTRIBUTE_NAME) ?? ''
      expect(imageSource.startsWith(SVG_DATA_URI_SCHEME)).toBe(true)
      expect(imageElement.hasAttribute(SOURCE_SET_ATTRIBUTE_NAME)).toBe(false)
    }
  })

  it('не оставляет внешних адресов в атрибутах, кроме пространства имён SVG', () => {
    const processedElements = Array.from(document.querySelectorAll(PROCESSED_ELEMENT_SELECTOR))
    const externalAttributes = processedElements.flatMap((element) =>
      element
        .getAttributeNames()
        .map((attributeName) => ({
          attributeName,
          attributeValue: element.getAttribute(attributeName) ?? '',
        }))
        .filter(
          ({ attributeName, attributeValue }) =>
            EXTERNAL_ADDRESS_PATTERN.test(attributeValue) &&
            !(attributeName === XMLNS_ATTRIBUTE_NAME && attributeValue === SVG_NAMESPACE),
        ),
    )
    expect(externalAttributes).toEqual([])
  })

  it('рисует аватару силуэт, а превью и иконке приложения общий значок картинки', () => {
    const avatarSource = readImageSource(AVATAR_IMAGE_SELECTOR)
    const previewSource = readImageSource(PREVIEW_IMAGE_SELECTOR)
    const iconSource = readImageSource(ICON_IMAGE_SELECTOR)

    expect(avatarSource).not.toBe(previewSource)
    expect(avatarSource).not.toBe(iconSource)
    expect(previewSource).toBe(iconSource)
  })

  it('заглушки разбираются как SVG с пространством имён и размерами', () => {
    for (const imageElement of queryImageElements(IN_PLACE_ROOT_SELECTOR)) {
      const imageSource = imageElement.getAttribute(SOURCE_ATTRIBUTE_NAME) ?? ''
      expect(imageSource.startsWith(SVG_DATA_URI_PREFIX)).toBe(true)
      const svgMarkup = decodeURIComponent(imageSource.slice(SVG_DATA_URI_PREFIX.length))
      const { documentElement } = new DOMParser().parseFromString(svgMarkup, SVG_MEDIA_TYPE)

      expect(documentElement.localName).toBe(SVG_ELEMENT_NAME)
      expect(documentElement.namespaceURI).toBe(SVG_NAMESPACE)
      for (const sizeAttributeName of SVG_SIZE_ATTRIBUTE_NAMES) {
        expect(documentElement.hasAttribute(sizeAttributeName)).toBe(true)
      }
    }
  })

  it('повторный запуск возвращает число и не меняет заглушки', () => {
    const sourcesBeforeRepeat = queryImageElements(IN_PLACE_ROOT_SELECTOR).map((imageElement) =>
      imageElement.getAttribute(SOURCE_ATTRIBUTE_NAME),
    )

    const repeatResult = fixtureSnippetWindow.betterCloudsFixture?.()

    expect(typeof repeatResult).toBe(NUMBER_TYPE_NAME)
    expect(
      queryImageElements(IN_PLACE_ROOT_SELECTOR).map((imageElement) =>
        imageElement.getAttribute(SOURCE_ATTRIBUTE_NAME),
      ),
    ).toEqual(sourcesBeforeRepeat)
  })
})

describe('сниппет фикстур в режиме in-place на картинке без источника', () => {
  it('ставит заглушку и картинке, у которой src не было', () => {
    document.body.innerHTML = `<div id="app">${SOURCELESS_IMAGE_MARKUP}</div>`
    runFixtureSnippetSource(inPlaceSnippetSource)

    const imageSource = readImageSource(SOURCELESS_IMAGE_SELECTOR) ?? ''
    expect(imageSource.startsWith(SVG_DATA_URI_SCHEME)).toBe(true)
  })
})

describe('сниппет фикстур в режиме clone', () => {
  let fixtureResult: string | number | null | undefined

  beforeEach(() => {
    document.body.innerHTML = `<div class="layout-pane">${SYNTHETIC_MARKUP}</div>`
    runFixtureSnippetSource(cloneSnippetSource)
    fixtureResult = fixtureSnippetWindow.betterCloudsFixture?.(CLONE_ROOT_SELECTOR)
  })

  it('возвращает разметку без src и srcset', () => {
    expect(typeof fixtureResult).toBe(STRING_TYPE_NAME)
    const fixtureDocument = new DOMParser().parseFromString(String(fixtureResult), HTML_MEDIA_TYPE)

    expect(fixtureDocument.querySelectorAll(IMAGE_SOURCE_SELECTOR)).toHaveLength(0)
  })

  it('не вставляет заглушки в копию', () => {
    expect(String(fixtureResult)).not.toContain(SVG_DATA_URI_SCHEME)
  })

  it('не меняет картинки на странице', () => {
    expect(
      queryImageElements(CLONE_ROOT_SELECTOR).map((imageElement) =>
        imageElement.getAttribute(SOURCE_ATTRIBUTE_NAME),
      ),
    ).toEqual(ORIGINAL_IMAGE_SOURCES)
  })
})
