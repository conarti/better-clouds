import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Самопроверка scripts/check-prose.mjs: тексты интерфейса живут не только в шаблоне,
 * но и константами в script setup компонента и в имени с описанием расширения.
 */

/** Vitest запускается из корня проекта, поэтому пути скрипта и файлов считаются от него */
const PROJECT_ROOT_PATH = process.cwd()
const CHECK_PROSE_SCRIPT_PATH = path.join(PROJECT_ROOT_PATH, 'scripts/check-prose.mjs')
const NODE_EXECUTABLE = process.execPath
const UTF8_ENCODING = 'utf8'
const TEMPORARY_DIRECTORY_PREFIX = 'better-clouds-prose-'
const CLEAN_EXIT_CODE = 0
const VIOLATION_EXIT_CODE = 1
const EM_DASH = '—'
const DOUBLE_HYPHEN = '--'

const temporaryDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), TEMPORARY_DIRECTORY_PREFIX))

interface CheckResult {
  readonly exitCode: number
  readonly report: string
}

function runCheckProse(filePaths: readonly string[]): CheckResult {
  const checkProcess = spawnSync(NODE_EXECUTABLE, [CHECK_PROSE_SCRIPT_PATH, ...filePaths], {
    cwd: PROJECT_ROOT_PATH,
    encoding: UTF8_ENCODING,
  })
  if (checkProcess.error !== undefined || checkProcess.status === null) {
    throw new Error(`Проверка текстов не запустилась: ${String(checkProcess.error)}`)
  }
  return { exitCode: checkProcess.status, report: checkProcess.stderr }
}

function writeProbeFile(fileName: string, fileContent: string): string {
  const probeFilePath = path.join(temporaryDirectoryPath, fileName)
  fs.writeFileSync(probeFilePath, fileContent, UTF8_ENCODING)
  return probeFilePath
}

const componentProbeLines = [
  '<script lang="ts" setup>',
  `const BADGE_TEXT = 'Неофициальное ${EM_DASH} расширение'`,
  '</script>',
  '',
  '<template>',
  '  <p>{{ BADGE_TEXT }}</p>',
  '</template>',
]
const BADGE_TEXT_LINE_NUMBER = 2

afterAll(() => {
  fs.rmSync(temporaryDirectoryPath, { recursive: true, force: true })
})

describe('check-prose', () => {
  it('находит запрещённые знаки в константе script setup и указывает её строку', () => {
    const probeFilePath = writeProbeFile('component-probe.vue', componentProbeLines.join('\n'))

    const { exitCode, report } = runCheckProse([probeFilePath])

    expect(exitCode).toBe(VIOLATION_EXIT_CODE)
    expect(report).toContain(`${probeFilePath}:${BADGE_TEXT_LINE_NUMBER}`)
  })

  it('находит двойной дефис в константе файла на TypeScript', () => {
    const probeFilePath = writeProbeFile(
      'config-probe.ts',
      `const EXTENSION_DESCRIPTION = 'Расширение ${DOUBLE_HYPHEN} проба'\n`,
    )

    expect(runCheckProse([probeFilePath]).exitCode).toBe(VIOLATION_EXIT_CODE)
  })

  it('пропускает чистый компонент', () => {
    const probeFilePath = writeProbeFile(
      'clean-probe.vue',
      [
        '<script lang="ts" setup>',
        "const BADGE_TEXT = 'Неофициальное расширение'",
        '</script>',
      ].join('\n'),
    )

    expect(runCheckProse([probeFilePath]).exitCode).toBe(CLEAN_EXIT_CODE)
  })

  it('тексты попапа и манифеста расширения проходят проверку', () => {
    expect(
      runCheckProse(['wxt.config.ts', 'src/entrypoints/popup/components/PopupHeader.vue']).exitCode,
    ).toBe(CLEAN_EXIT_CODE)
  })
})
