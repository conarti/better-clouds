import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Гейт приватности: ни один обезличенный фрагмент разметки не должен содержать
 * персональных данных, ссылок на внешние ресурсы и атрибутов вне общего белого списка.
 * Самопроверка снизу подтверждает, что гейт действительно ловит персональные данные.
 */

interface FixturePrivacyRules {
  readonly structuralAttributeNames: readonly string[]
  readonly structuralAttributeValuePatterns: readonly string[]
  readonly allowedTexts: readonly string[]
  readonly placeholderPatterns: readonly string[]
}

const PROJECT_ROOT_PATH = path.resolve(import.meta.dirname, '..', '..')
const PRIVACY_RULES_RELATIVE_PATH = 'tests/fixtures/fixture-privacy-rules.json'
const FIXTURES_RELATIVE_PATH = 'tests/fixtures/clouds-v3.70.53'
const FIXTURE_FILE_EXTENSION = '.html'
const UTF8_ENCODING = 'utf8'

const EXPECTED_FIXTURE_COUNT = 8
const MAXIMUM_FIXTURE_SIZE_BYTES = 150 * 1024

const HTML_MEDIA_TYPE = 'text/html'
const ELEMENT_NODE_TYPE = 1
const TEXT_NODE_TYPE = 3

const CLASS_ATTRIBUTE_NAME = 'class'
const STYLE_ATTRIBUTE_NAME = 'style'
const HREF_ATTRIBUTE_NAME = 'href'
const HREF_ALLOWED_VALUE = '#'
const FORBIDDEN_ATTRIBUTE_NAMES = ['src', 'srcset']
const WILDCARD_SUFFIX = '*'
const URL_FUNCTION_MARKER = 'url('
const ZERO_WIDTH_CHARACTERS_PATTERN = new RegExp('[\\u200b-\\u200f\\ufeff]', 'g')
const SCRIPT_ELEMENT_PATTERN = /<script/i

const PERSONAL_DATA_PATTERNS = [
  { name: 'адрес почты', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: 'телефон', pattern: /\+?\d[\d\s()-]{9,}/ },
  {
    name: 'идентификатор UUID',
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  },
  { name: 'шесть и более цифр подряд', pattern: /\d{6}/ },
  { name: 'начало токена', pattern: /eyJ/ },
]

const PERSONAL_DATA_FRAGMENT =
  '<div data-name="Иван"><span aria-description="переписка с коллегой">Личное сообщение</span>' +
  '<button aria-label="Иван Петров" type="button">ОК</button></div>'

const STRUCTURAL_FRAGMENT =
  '<div aria-hidden="true" role="presentation">' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px">' +
  '<path fill="#fff"></path></svg>' +
  '<input type="text" value="Бот"></div>'

const privacyRules = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT_PATH, PRIVACY_RULES_RELATIVE_PATH), UTF8_ENCODING),
) as FixturePrivacyRules

const fixturesDirectoryPath = path.join(PROJECT_ROOT_PATH, FIXTURES_RELATIVE_PATH)

/** Имена файлов обезличенных фрагментов разметки */
function readFixtureFileNames(): string[] {
  return fs
    .readdirSync(fixturesDirectoryPath)
    .filter((fileName) => fileName.endsWith(FIXTURE_FILE_EXTENSION))
    .sort()
}

/** Проверяет значение по списку строковых шаблонов */
function matchesAnyPattern(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => new RegExp(pattern).test(value))
}

/** Текст разрешён, если он есть в белом списке UI-строк или похож на заменитель */
function isAllowedText(text: string): boolean {
  return (
    privacyRules.allowedTexts.includes(text) ||
    matchesAnyPattern(text, privacyRules.placeholderPatterns)
  )
}

/** Имя атрибута структурное, если оно есть в белом списке или подходит под шаблон с `*` */
function isStructuralAttributeName(attributeName: string): boolean {
  return privacyRules.structuralAttributeNames.some((allowedName) =>
    allowedName.endsWith(WILDCARD_SUFFIX)
      ? attributeName.startsWith(allowedName.slice(0, allowedName.length - 1))
      : attributeName === allowedName,
  )
}

/** Ищет в строке следы персональных данных; location описывает место находки в отчёте */
function findPersonalDataViolations(value: string, location: string): string[] {
  return PERSONAL_DATA_PATTERNS.filter(({ pattern }) => pattern.test(value)).map(
    ({ name }) => `${location}: ${name}`,
  )
}

/** Проверяет атрибуты одного элемента */
function findAttributeViolations(element: Element): string[] {
  const violations: string[] = []
  for (const attributeName of element.getAttributeNames()) {
    const attributeValue = element.getAttribute(attributeName) ?? ''
    const location = `${element.localName}[${attributeName}]`
    violations.push(...findPersonalDataViolations(attributeValue, location))
    if (FORBIDDEN_ATTRIBUTE_NAMES.includes(attributeName)) {
      violations.push(`${location}: ссылка на внешний ресурс`)
      continue
    }
    if (attributeName === HREF_ATTRIBUTE_NAME && attributeValue !== HREF_ALLOWED_VALUE) {
      violations.push(`${location}: ссылка на внешний ресурс`)
      continue
    }
    if (!isStructuralAttributeName(attributeName)) {
      violations.push(`${location}: атрибут вне белого списка`)
      continue
    }
    if (attributeName === STYLE_ATTRIBUTE_NAME) {
      if (attributeValue.includes(URL_FUNCTION_MARKER)) {
        violations.push(`${location}: ссылка на внешний ресурс в стиле`)
      }
      continue
    }
    if (attributeName === CLASS_ATTRIBUTE_NAME) {
      continue
    }
    if (
      !matchesAnyPattern(attributeValue, privacyRules.structuralAttributeValuePatterns) &&
      !isAllowedText(attributeValue)
    ) {
      violations.push(`${location}: значение вне белого списка`)
    }
  }
  return violations
}

/** Проверяет обезличенный фрагмент разметки */
function findPrivacyViolations(fixtureHtml: string): string[] {
  const violations: string[] = []
  if (SCRIPT_ELEMENT_PATTERN.test(fixtureHtml)) {
    violations.push('фрагмент: элемент script')
  }
  const fixtureDocument = new DOMParser().parseFromString(fixtureHtml, HTML_MEDIA_TYPE)
  const pendingNodes: Node[] = [fixtureDocument.body]
  while (pendingNodes.length > 0) {
    const currentNode = pendingNodes.pop()
    if (!currentNode) {
      continue
    }
    if (currentNode.nodeType === ELEMENT_NODE_TYPE) {
      violations.push(...findAttributeViolations(currentNode as Element))
    }
    for (const childNode of Array.from(currentNode.childNodes)) {
      if (childNode.nodeType === TEXT_NODE_TYPE) {
        const text = (childNode.nodeValue ?? '').replace(ZERO_WIDTH_CHARACTERS_PATTERN, '').trim()
        if (text.length === 0) {
          continue
        }
        violations.push(...findPersonalDataViolations(text, 'текст'))
        if (!isAllowedText(text)) {
          violations.push(`текст вне белого списка: ${text}`)
        }
        continue
      }
      if (childNode.nodeType === ELEMENT_NODE_TYPE) {
        pendingNodes.push(childNode)
      }
    }
  }
  return violations
}

describe('гейт приватности обезличенных фрагментов', () => {
  const fixtureFileNames = readFixtureFileNames()

  it('фрагментов ровно столько, сколько описано в процедуре снятия', () => {
    expect(fixtureFileNames).toHaveLength(EXPECTED_FIXTURE_COUNT)
  })

  it.each(fixtureFileNames)('%s не содержит персональных данных', (fixtureFileName) => {
    const fixtureHtml = fs.readFileSync(
      path.join(fixturesDirectoryPath, fixtureFileName),
      UTF8_ENCODING,
    )
    expect(findPrivacyViolations(fixtureHtml)).toEqual([])
  })

  it.each(fixtureFileNames)('%s укладывается в лимит размера', (fixtureFileName) => {
    const fixtureSizeBytes = fs.statSync(path.join(fixturesDirectoryPath, fixtureFileName)).size
    expect(fixtureSizeBytes).toBeLessThanOrEqual(MAXIMUM_FIXTURE_SIZE_BYTES)
  })
})

describe('самопроверка гейта приватности', () => {
  it('падает на фрагменте с персональными данными', () => {
    const violations = findPrivacyViolations(PERSONAL_DATA_FRAGMENT)
    expect(violations).toContain('div[data-name]: атрибут вне белого списка')
    expect(violations).toContain('span[aria-description]: атрибут вне белого списка')
    expect(violations).toContain('button[aria-label]: атрибут вне белого списка')
    expect(violations).toContain('текст вне белого списка: Личное сообщение')
  })

  it('пропускает фрагмент со структурными атрибутами', () => {
    expect(findPrivacyViolations(STRUCTURAL_FRAGMENT)).toEqual([])
  })

  it('ловит элемент script, внешние ссылки и след токена', () => {
    expect(findPrivacyViolations('<div><script>1</script></div>')).toContain(
      'фрагмент: элемент script',
    )
    expect(findPrivacyViolations('<img src="https://example.com/a.png">')).toContain(
      'img[src]: ссылка на внешний ресурс',
    )
    expect(findPrivacyViolations('<a href="https://example.com/">Чат 1</a>')).toContain(
      'a[href]: ссылка на внешний ресурс',
    )
    expect(
      findPrivacyViolations('<div style="background: url(https://example.com/a.png)"></div>'),
    ).toContain('div[style]: ссылка на внешний ресурс в стиле')
    expect(findPrivacyViolations('<div class="eyJhbGciOiJIUzI1NiJ9"></div>')).toContain(
      'div[class]: начало токена',
    )
  })
})
