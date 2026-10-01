const FIXTURE_PATH_SEPARATOR = '/'

const fixtureModules = import.meta.glob<string>('../fixtures/clouds-v*/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * Обезличенные фрагменты разметки клиента по имени файла из всех папок версий.
 * Имена файлов должны быть уникальны между папками, иначе фрагмент одной версии молча заменил бы другой.
 */
export const clientFixturesByFileName: ReadonlyMap<string, string> = createFixturesByFileName()

function createFixturesByFileName(): Map<string, string> {
  const fixturesByFileName = new Map<string, string>()
  for (const [modulePath, fixtureHtml] of Object.entries(fixtureModules)) {
    const fixtureFileName = modulePath.split(FIXTURE_PATH_SEPARATOR).at(-1) ?? modulePath
    if (fixturesByFileName.has(fixtureFileName)) {
      throw new Error(`Фрагмент разметки ${fixtureFileName} встречается в нескольких папках версий`)
    }
    fixturesByFileName.set(fixtureFileName, fixtureHtml)
  }
  return fixturesByFileName
}

export function loadFixture(fixtureFileName: string): string {
  const fixtureHtml = clientFixturesByFileName.get(fixtureFileName)
  if (fixtureHtml === undefined) {
    throw new Error(`Фрагмент разметки ${fixtureFileName} не найден`)
  }
  return fixtureHtml
}
