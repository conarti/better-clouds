const SELECTOR_LIST_SEPARATOR = ','
const OPENING_BRACKETS = '(['
const CLOSING_BRACKETS = ')]'
const QUOTE_CHARACTERS = '"\''
const ESCAPE_CHARACTER = '\\'
const HAS_PSEUDO_CLASS = ':has('
const OPENING_PARENTHESIS = '('
const CLOSING_PARENTHESIS = ')'

/**
 * Делит список селекторов по запятым верхнего уровня: запятые внутри :not(), :is() и
 * атрибутов остаются частью одного селектора.
 */
export function splitTopLevelSelectorList(selectorText: string): string[] {
  const selectors: string[] = []
  let currentSelector = ''
  let bracketDepth = 0
  let openQuoteCharacter: string | null = null

  for (let characterIndex = 0; characterIndex < selectorText.length; characterIndex += 1) {
    const character = selectorText[characterIndex] ?? ''

    if (openQuoteCharacter !== null) {
      currentSelector += character
      if (character === ESCAPE_CHARACTER) {
        currentSelector += selectorText[characterIndex + 1] ?? ''
        characterIndex += 1
      } else if (character === openQuoteCharacter) {
        openQuoteCharacter = null
      }
      continue
    }

    if (QUOTE_CHARACTERS.includes(character)) {
      openQuoteCharacter = character
      currentSelector += character
      continue
    }

    if (OPENING_BRACKETS.includes(character)) {
      bracketDepth += 1
    } else if (CLOSING_BRACKETS.includes(character)) {
      bracketDepth -= 1
    } else if (character === SELECTOR_LIST_SEPARATOR && bracketDepth === 0) {
      selectors.push(currentSelector.trim())
      currentSelector = ''
      continue
    }

    currentSelector += character
  }

  selectors.push(currentSelector.trim())
  return selectors.filter((selector) => selector.length > 0)
}

/**
 * Находит :has() внутри аргумента другого :has(). Chrome такие правила молча выбрасывает,
 * а в тестовых движках они выглядят валидными, поэтому проверка нужна на уровне текста.
 */
export function findNestedHasSelector(cssText: string): string[] {
  const nestedSelectors: string[] = []
  const parenthesisStack: boolean[] = []
  let hasArgumentDepth = 0
  let openQuoteCharacter: string | null = null

  for (let characterIndex = 0; characterIndex < cssText.length; characterIndex += 1) {
    const character = cssText[characterIndex] ?? ''

    if (openQuoteCharacter !== null) {
      if (character === ESCAPE_CHARACTER) {
        characterIndex += 1
      } else if (character === openQuoteCharacter) {
        openQuoteCharacter = null
      }
      continue
    }

    if (QUOTE_CHARACTERS.includes(character)) {
      openQuoteCharacter = character
      continue
    }

    if (cssText.startsWith(HAS_PSEUDO_CLASS, characterIndex)) {
      if (hasArgumentDepth > 0) {
        nestedSelectors.push(readBalancedFragment(cssText, characterIndex))
      }
      parenthesisStack.push(true)
      hasArgumentDepth += 1
      characterIndex += HAS_PSEUDO_CLASS.length - 1
      continue
    }

    if (character === OPENING_PARENTHESIS) {
      parenthesisStack.push(false)
    } else if (character === CLOSING_PARENTHESIS && parenthesisStack.pop() === true) {
      hasArgumentDepth -= 1
    }
  }

  return nestedSelectors
}

/** Читает фрагмент от начала :has( до парной закрывающей скобки */
function readBalancedFragment(cssText: string, startIndex: number): string {
  let parenthesisDepth = 0

  for (let characterIndex = startIndex; characterIndex < cssText.length; characterIndex += 1) {
    const character = cssText[characterIndex]
    if (character === OPENING_PARENTHESIS) {
      parenthesisDepth += 1
    } else if (character === CLOSING_PARENTHESIS) {
      parenthesisDepth -= 1
      if (parenthesisDepth === 0) {
        return cssText.slice(startIndex, characterIndex + 1)
      }
    }
  }

  return cssText.slice(startIndex)
}
