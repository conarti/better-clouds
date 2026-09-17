import { describe, expect, it } from 'vitest'
import { findNestedHasSelector, splitTopLevelSelectorList } from './css-selector-analysis'

describe('splitTopLevelSelectorList', () => {
  it('делит список по запятым верхнего уровня', () => {
    expect(splitTopLevelSelectorList('html[data-a] .first, html[data-a] .second')).toEqual([
      'html[data-a] .first',
      'html[data-a] .second',
    ])
  })

  it('не делит по запятым внутри :not() и :is()', () => {
    expect(
      splitTopLevelSelectorList('.first:not(.second, .third), .fourth:is(.fifth, .sixth)'),
    ).toEqual(['.first:not(.second, .third)', '.fourth:is(.fifth, .sixth)'])
  })

  it('не делит по запятым внутри значения атрибута', () => {
    expect(splitTopLevelSelectorList('[data-value="first, second"], .other')).toEqual([
      '[data-value="first, second"]',
      '.other',
    ])
  })

  it('отбрасывает пустые части и лишние пробелы', () => {
    expect(splitTopLevelSelectorList('  .first ,, .second  ')).toEqual(['.first', '.second'])
  })
})

describe('findNestedHasSelector', () => {
  it('находит :has() внутри аргумента другого :has()', () => {
    expect(findNestedHasSelector('.first:has(.second:has(.third)) { color: red; }')).toEqual([
      ':has(.third)',
    ])
  })

  it('не считает вложенными соседние :has() в одном списке', () => {
    expect(
      findNestedHasSelector('.first:has(.second), .third:has(.fourth) { color: red; }'),
    ).toEqual([])
  })

  it('не считает вложенным :has() после закрытия предыдущего аргумента', () => {
    expect(findNestedHasSelector('.first:has(.second) .third:has(.fourth)')).toEqual([])
  })

  it('видит :has() внутри :not() внутри :has()', () => {
    expect(findNestedHasSelector('.first:has(:not(.second:has(.third)))')).toEqual([':has(.third)'])
  })

  it('не срабатывает на строку :has( внутри кавычек', () => {
    expect(findNestedHasSelector('.first:has([data-value=":has("])')).toEqual([])
  })
})
