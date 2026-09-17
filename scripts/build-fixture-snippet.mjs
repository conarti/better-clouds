import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Печатает сниппет обезличивания разметки для консоли DevTools.
 * Режим по умолчанию `clone` работает с копией узла и возвращает строку HTML,
 * режим `--in-place` применяет те же правила к живому DOM страницы и возвращает число.
 * Правила берутся из общего белого списка tests/fixtures/fixture-privacy-rules.json.
 */

const PROJECT_ROOT_PATH = path.resolve(import.meta.dirname, '..')
const PRIVACY_RULES_RELATIVE_PATH = 'tests/fixtures/fixture-privacy-rules.json'
const UTF8_ENCODING = 'utf8'

const IN_PLACE_FLAG = '--in-place'
const CLONE_MODE = 'clone'
const IN_PLACE_MODE = 'in-place'

const GLOBAL_FUNCTION_NAME = 'betterCloudsFixture'
const CLONE_DEFAULT_ROOT_SELECTOR = '.layout-pane'
const IN_PLACE_DEFAULT_ROOT_SELECTOR = '#app'

const CLASS_ATTRIBUTE_NAME = 'class'
const STYLE_ATTRIBUTE_NAME = 'style'
const HREF_ATTRIBUTE_NAME = 'href'
const HREF_ALLOWED_VALUE = '#'
const PATH_ELEMENT_NAME = 'path'
const PATH_DATA_ATTRIBUTE_NAME = 'd'
const REMOVED_ATTRIBUTE_NAMES = ['src', 'srcset']
const IDENTIFIER_ATTRIBUTE_NAMES = ['id', 'data-open-chat']
const IDENTIFIER_ATTRIBUTE_PREFIX = 'data-rbd-'
const FIXTURE_IDENTIFIER_PREFIX = 'fixture-id-'
const WILDCARD_SUFFIX = '*'
const URL_FUNCTION_MARKER = 'url('
const DECLARATION_SEPARATOR = ';'
const REMOVED_ELEMENT_SELECTOR = 'script, noscript, template, iframe'
const ELEMENT_NODE_TYPE = 1
const COMMENT_NODE_TYPE = 8
const TEXT_NODE_TYPE = 3
const ZERO_WIDTH_CHARACTERS_PATTERN = '[\\u200b-\\u200f\\ufeff]'

const SEARCH_EDITOR_SELECTOR = '.search-filter-panel-input__editor'
const SEARCH_QUERY_TEXT = 'Бот'
const AVATAR_INITIALS_TEXT = 'АБ'
const DEFAULT_PLACEHOLDER_PREFIX = 'Сообщение'

/**
 * Правила выбора заменителя для текстового узла: первый подошедший предок задаёт замену.
 * Порядок важен, более узкие селекторы стоят выше.
 */
const PLACEHOLDER_RULES = [
  { ancestorSelector: SEARCH_EDITOR_SELECTOR, fixedText: SEARCH_QUERY_TEXT },
  { ancestorSelector: '[class*="initials"]', fixedText: AVATAR_INITIALS_TEXT },
  { ancestorSelector: '[class*="avatar"]', fixedText: AVATAR_INITIALS_TEXT },
  { ancestorSelector: '.chat-list-entry__info--catalog', placeholderPrefix: 'Бот' },
  { ancestorSelector: '.chat-list-entry', placeholderPrefix: 'Чат' },
  { ancestorSelector: '.toolbar__smartapp-section', placeholderPrefix: 'Приложение' },
  { ancestorSelector: '.settings-button', placeholderPrefix: 'Пользователь' },
  { ancestorSelector: '.user-status-toolbar', placeholderPrefix: 'Пользователь' },
  { ancestorSelector: '.chats-list-header', placeholderPrefix: 'Организация' },
  { ancestorSelector: '.chat-context-menu', placeholderPrefix: 'Сообщение' },
]

const CHAT_LIST_ENTRY_WRAPPER_SELECTOR = '.react-contextmenu-wrapper'
const CHAT_LIST_ENTRY_SELECTOR = '.chat-list-entry'
const CHAT_LIST_ENTRY_CATALOG_SELECTOR = '.chat-list-entry__info--catalog'
const CHAT_LIST_PINNED_DROPPABLE_SELECTOR = '[data-rbd-droppable-id]'
const MAXIMUM_ENTRY_COUNT = 10
const PINNED_ENTRY_KIND = 'pinned'
const CATALOG_ENTRY_KIND = 'catalog'
const REGULAR_ENTRY_KIND = 'regular'

/**
 * Проверяет значение по списку строковых шаблонов
 * @param {string} value
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesAnyFixturePattern(value, patterns) {
  return patterns.some((pattern) => new RegExp(pattern).test(value))
}

/**
 * Убирает символы нулевой ширины и внешние пробелы
 * @param {string} text
 * @returns {string}
 */
function normalizeFixtureText(text) {
  return text.replace(new RegExp(ZERO_WIDTH_CHARACTERS_PATTERN, 'g'), '').trim()
}

/**
 * Текст разрешён, если он есть в белом списке UI-строк или уже похож на заменитель
 * @param {string} text
 * @param {{ allowedTexts: string[], placeholderPatterns: string[] }} privacyRules
 * @returns {boolean}
 */
function isAllowedFixtureText(text, privacyRules) {
  return (
    privacyRules.allowedTexts.includes(text) ||
    matchesAnyFixturePattern(text, privacyRules.placeholderPatterns)
  )
}

/**
 * Имя атрибута структурное, если оно есть в белом списке или подходит под шаблон с `*`
 * @param {string} attributeName
 * @param {{ structuralAttributeNames: string[] }} privacyRules
 * @returns {boolean}
 */
function isStructuralFixtureAttributeName(attributeName, privacyRules) {
  return privacyRules.structuralAttributeNames.some((allowedName) =>
    allowedName.endsWith(WILDCARD_SUFFIX)
      ? attributeName.startsWith(allowedName.slice(0, allowedName.length - 1))
      : attributeName === allowedName,
  )
}

/**
 * Подбирает заменитель для текстового узла по ближайшему известному предку
 * @param {Text} textNode
 * @param {Record<string, number>} counters счётчики заменителей
 * @returns {string}
 */
function createFixturePlaceholderText(textNode, counters) {
  const { parentElement } = textNode
  const placeholderRule = PLACEHOLDER_RULES.find((rule) =>
    parentElement?.closest(rule.ancestorSelector),
  )
  if (placeholderRule?.fixedText) {
    return placeholderRule.fixedText
  }
  const placeholderPrefix = placeholderRule?.placeholderPrefix ?? DEFAULT_PLACEHOLDER_PREFIX
  const nextNumber = (counters[placeholderPrefix] || 0) + 1
  counters[placeholderPrefix] = nextNumber
  return `${placeholderPrefix} ${nextNumber}`
}

/**
 * Обезличивает атрибуты одного элемента
 * @param {Element} element
 * @param {object} privacyRules
 * @param {Record<string, number>} counters счётчики заменителей
 * @param {string} mode режим работы
 */
function anonymizeFixtureAttributes(element, privacyRules, counters, mode) {
  for (const attributeName of element.getAttributeNames()) {
    const attributeValue = element.getAttribute(attributeName) || ''
    if (REMOVED_ATTRIBUTE_NAMES.includes(attributeName)) {
      element.removeAttribute(attributeName)
      continue
    }
    if (attributeName === HREF_ATTRIBUTE_NAME) {
      if (attributeValue !== HREF_ALLOWED_VALUE) {
        element.removeAttribute(attributeName)
      }
      continue
    }
    if (element.localName === PATH_ELEMENT_NAME && attributeName === PATH_DATA_ATTRIBUTE_NAME) {
      element.removeAttribute(attributeName)
      continue
    }
    if (!isStructuralFixtureAttributeName(attributeName, privacyRules)) {
      element.removeAttribute(attributeName)
      continue
    }
    if (
      IDENTIFIER_ATTRIBUTE_NAMES.includes(attributeName) ||
      attributeName.startsWith(IDENTIFIER_ATTRIBUTE_PREFIX)
    ) {
      /* На живой странице идентификаторы не трогаются: по ним работают стили и код клиента,
         а на снимке экрана их всё равно не видно */
      if (mode !== CLONE_MODE) {
        continue
      }
      const nextNumber = (counters[FIXTURE_IDENTIFIER_PREFIX] || 0) + 1
      counters[FIXTURE_IDENTIFIER_PREFIX] = nextNumber
      element.setAttribute(attributeName, FIXTURE_IDENTIFIER_PREFIX + nextNumber)
      continue
    }
    if (attributeName === CLASS_ATTRIBUTE_NAME) {
      continue
    }
    if (attributeName === STYLE_ATTRIBUTE_NAME) {
      const safeDeclarations = attributeValue
        .split(DECLARATION_SEPARATOR)
        .filter((declaration) => !declaration.includes(URL_FUNCTION_MARKER))
      element.setAttribute(STYLE_ATTRIBUTE_NAME, safeDeclarations.join(DECLARATION_SEPARATOR))
      continue
    }
    if (
      !matchesAnyFixturePattern(attributeValue, privacyRules.structuralAttributeValuePatterns) &&
      !isAllowedFixtureText(attributeValue, privacyRules)
    ) {
      element.removeAttribute(attributeName)
    }
  }
}

/**
 * Убирает узлы комментариев: клиент разделяет ими соседние текстовые узлы,
 * из-за чего без склейки один видимый текст дал бы несколько заменителей подряд
 * @param {Element} rootElement
 */
function removeFixtureCommentNodes(rootElement) {
  const pendingNodes = [rootElement]
  while (pendingNodes.length > 0) {
    const currentNode = pendingNodes.pop()
    for (const childNode of Array.from(currentNode.childNodes)) {
      if (childNode.nodeType === COMMENT_NODE_TYPE) {
        childNode.remove()
        continue
      }
      if (childNode.nodeType === ELEMENT_NODE_TYPE) {
        pendingNodes.push(childNode)
      }
    }
  }
}

/**
 * Обходит дерево, обезличивая атрибуты и тексты, после удаления скриптов и комментариев
 * @param {Element} rootElement
 * @param {object} privacyRules
 * @param {Record<string, number>} counters счётчики заменителей
 * @param {string} mode режим работы
 * @returns {number} число обработанных элементов
 */
function anonymizeFixtureTree(rootElement, privacyRules, counters, mode) {
  for (const removedElement of rootElement.querySelectorAll(REMOVED_ELEMENT_SELECTOR)) {
    removedElement.remove()
  }
  removeFixtureCommentNodes(rootElement)
  rootElement.normalize()
  let processedElementCount = 0
  const pendingNodes = [rootElement]
  while (pendingNodes.length > 0) {
    const currentNode = pendingNodes.pop()
    anonymizeFixtureAttributes(currentNode, privacyRules, counters, mode)
    processedElementCount += 1
    const childElements = []
    for (const childNode of Array.from(currentNode.childNodes)) {
      if (childNode.nodeType === COMMENT_NODE_TYPE) {
        childNode.remove()
        continue
      }
      if (childNode.nodeType === TEXT_NODE_TYPE) {
        const normalizedText = normalizeFixtureText(childNode.nodeValue || '')
        if (normalizedText.length === 0) {
          childNode.nodeValue = ''
          continue
        }
        childNode.nodeValue = isAllowedFixtureText(normalizedText, privacyRules)
          ? normalizedText
          : createFixturePlaceholderText(childNode, counters)
        continue
      }
      if (childNode.nodeType === ELEMENT_NODE_TYPE) {
        childElements.push(childNode)
      }
    }
    childElements.reverse()
    for (const childElement of childElements) {
      pendingNodes.push(childElement)
    }
  }
  return processedElementCount
}

/**
 * Оставляет не больше десяти записей каждого типа: закреплённых, каталожных и обычных
 * @param {Element} rootElement
 */
function trimFixtureChatListEntries(rootElement) {
  const entryCounts = {}
  for (const entryWrapper of rootElement.querySelectorAll(CHAT_LIST_ENTRY_WRAPPER_SELECTOR)) {
    if (!entryWrapper.querySelector(CHAT_LIST_ENTRY_SELECTOR)) {
      continue
    }
    let entryKind = REGULAR_ENTRY_KIND
    if (entryWrapper.closest(CHAT_LIST_PINNED_DROPPABLE_SELECTOR)) {
      entryKind = PINNED_ENTRY_KIND
    } else if (entryWrapper.querySelector(CHAT_LIST_ENTRY_CATALOG_SELECTOR)) {
      entryKind = CATALOG_ENTRY_KIND
    }
    entryCounts[entryKind] = (entryCounts[entryKind] || 0) + 1
    if (entryCounts[entryKind] > MAXIMUM_ENTRY_COUNT) {
      entryWrapper.remove()
    }
  }
}

/**
 * Готовит обезличенный фрагмент разметки
 * @param {string | Element} rootSelectorOrElement селектор корня или сам элемент
 * @param {object} privacyRules
 * @param {string} mode режим работы
 * @returns {string | number | null} разметка в режиме clone, число элементов в режиме in-place
 */
function createBetterCloudsFixture(rootSelectorOrElement, privacyRules, mode) {
  const sourceElement =
    typeof rootSelectorOrElement === 'string'
      ? document.querySelector(rootSelectorOrElement)
      : rootSelectorOrElement
  if (!sourceElement) {
    return null
  }
  const targetElement = mode === CLONE_MODE ? sourceElement.cloneNode(true) : sourceElement
  const counters = {}
  trimFixtureChatListEntries(targetElement)
  const processedElementCount = anonymizeFixtureTree(targetElement, privacyRules, counters, mode)
  return mode === CLONE_MODE ? targetElement.outerHTML : processedElementCount
}

const SNIPPET_FUNCTIONS = [
  matchesAnyFixturePattern,
  removeFixtureCommentNodes,
  normalizeFixtureText,
  isAllowedFixtureText,
  isStructuralFixtureAttributeName,
  createFixturePlaceholderText,
  anonymizeFixtureAttributes,
  anonymizeFixtureTree,
  trimFixtureChatListEntries,
  createBetterCloudsFixture,
]

const SNIPPET_CONSTANTS = {
  CLONE_MODE,
  CLASS_ATTRIBUTE_NAME,
  STYLE_ATTRIBUTE_NAME,
  HREF_ATTRIBUTE_NAME,
  HREF_ALLOWED_VALUE,
  PATH_ELEMENT_NAME,
  PATH_DATA_ATTRIBUTE_NAME,
  REMOVED_ATTRIBUTE_NAMES,
  IDENTIFIER_ATTRIBUTE_NAMES,
  IDENTIFIER_ATTRIBUTE_PREFIX,
  FIXTURE_IDENTIFIER_PREFIX,
  WILDCARD_SUFFIX,
  URL_FUNCTION_MARKER,
  DECLARATION_SEPARATOR,
  REMOVED_ELEMENT_SELECTOR,
  ELEMENT_NODE_TYPE,
  COMMENT_NODE_TYPE,
  TEXT_NODE_TYPE,
  ZERO_WIDTH_CHARACTERS_PATTERN,
  DEFAULT_PLACEHOLDER_PREFIX,
  PLACEHOLDER_RULES,
  CHAT_LIST_ENTRY_WRAPPER_SELECTOR,
  CHAT_LIST_ENTRY_SELECTOR,
  CHAT_LIST_ENTRY_CATALOG_SELECTOR,
  CHAT_LIST_PINNED_DROPPABLE_SELECTOR,
  MAXIMUM_ENTRY_COUNT,
  PINNED_ENTRY_KIND,
  CATALOG_ENTRY_KIND,
  REGULAR_ENTRY_KIND,
}

/**
 * Собирает текст сниппета для консоли DevTools
 * @param {object} privacyRules
 * @param {string} mode режим работы
 * @returns {string}
 */
function buildFixtureSnippetSource(privacyRules, mode) {
  const defaultRootSelector =
    mode === CLONE_MODE ? CLONE_DEFAULT_ROOT_SELECTOR : IN_PLACE_DEFAULT_ROOT_SELECTOR
  const constantDeclarations = Object.entries(SNIPPET_CONSTANTS).map(
    ([constantName, constantValue]) => `const ${constantName} = ${JSON.stringify(constantValue)}`,
  )
  return [
    ';(() => {',
    `const PRIVACY_RULES = ${JSON.stringify(privacyRules)}`,
    `const DEFAULT_ROOT_SELECTOR = ${JSON.stringify(defaultRootSelector)}`,
    `const FIXTURE_MODE = ${JSON.stringify(mode)}`,
    ...constantDeclarations,
    ...SNIPPET_FUNCTIONS.map((snippetFunction) => snippetFunction.toString()),
    `window.${GLOBAL_FUNCTION_NAME} = (rootSelectorOrElement) =>`,
    `  createBetterCloudsFixture(rootSelectorOrElement || DEFAULT_ROOT_SELECTOR, PRIVACY_RULES, FIXTURE_MODE)`,
    mode === CLONE_MODE
      ? `return window.${GLOBAL_FUNCTION_NAME}`
      : `return window.${GLOBAL_FUNCTION_NAME}()`,
    '})()',
  ].join('\n')
}

/** @returns {object} белый список правил обезличивания */
function readFixturePrivacyRules() {
  return JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT_PATH, PRIVACY_RULES_RELATIVE_PATH), UTF8_ENCODING),
  )
}

const selectedMode = process.argv.includes(IN_PLACE_FLAG) ? IN_PLACE_MODE : CLONE_MODE

process.stdout.write(buildFixtureSnippetSource(readFixturePrivacyRules(), selectedMode) + '\n')
