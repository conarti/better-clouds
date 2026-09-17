/** Склеивает CSS из шаблонной строки: интерполяции это селекторы и константы, не разметка */
export function css(cssParts: TemplateStringsArray, ...interpolations: unknown[]): string {
  return cssParts.reduce(
    (accumulatedCss, cssPart, partIndex) =>
      accumulatedCss + String(interpolations[partIndex - 1] ?? '') + cssPart,
  )
}
