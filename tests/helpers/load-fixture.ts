const FIXTURE_PATH_SEPARATOR = '/'

const fixtureModules = import.meta.glob<string>('../fixtures/clouds-v3.70.53/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Обезличенные фрагменты разметки клиента по имени файла */
export const clientFixturesByFileName: ReadonlyMap<string, string> = new Map(
  Object.entries(fixtureModules).map(([modulePath, fixtureHtml]) => [
    modulePath.split(FIXTURE_PATH_SEPARATOR).at(-1) ?? modulePath,
    fixtureHtml,
  ]),
)

export function loadFixture(fixtureFileName: string): string {
  const fixtureHtml = clientFixturesByFileName.get(fixtureFileName)
  if (fixtureHtml === undefined) {
    throw new Error(`Фрагмент разметки ${fixtureFileName} не найден`)
  }
  return fixtureHtml
}
