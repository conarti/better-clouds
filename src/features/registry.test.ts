import { describe, expect, it } from 'vitest'
import { featureMetaRegistry } from './registry'
import { featureContentRegistry } from './content-registry'
import { featureSettingsRegistry } from './settings-registry'
import { findNestedHasSelector } from '@/shared/feature/css-selector-analysis'
import {
  createFeatureStateAttributeName,
  FEATURE_ID_PATTERN,
  RESERVED_FEATURE_IDS,
} from '@/shared/feature/feature-scope'
import type { FeatureMeta } from '@/shared/feature/feature-types'
import { siteSelectors } from '@/shared/site/selectors'

/** Названия и описания функций из раздела 1 плана: попап и README берут их отсюда */
const EXPECTED_FEATURE_METAS: readonly FeatureMeta[] = [
  {
    id: 'wide-layout',
    title: 'Растянуть на весь экран',
    description: 'Убирает поля по бокам и отступ сверху',
    defaultEnabled: true,
  },
  {
    id: 'autohide-toolbar',
    title: 'Прятать левую колонку',
    description: 'Колонка навигации выезжает при наведении на левый край',
    defaultEnabled: true,
  },
  {
    id: 'hide-catalog-bots',
    title: 'Скрыть ботов из каталога',
    description: 'Не показывает во «Все чаты» ботов, с которыми нет переписки',
    defaultEnabled: true,
  },
  {
    id: 'compact-mode',
    title: 'Компактный режим',
    description: 'Уменьшает высоту строк в списке чатов и переписке',
    defaultEnabled: true,
  },
  {
    id: 'hide-toolbar-sections',
    title: 'Секции тулбара',
    description: 'Скрывает секции колонки навигации по отдельности',
    defaultEnabled: true,
  },
  {
    id: 'media-time-below',
    title: 'Время под картинками и видео',
    description: 'Время и статус сообщения с картинкой или видео выводятся под превью',
    defaultEnabled: false,
  },
  {
    id: 'tag-tabs-first',
    title: 'Теги перед «Все чаты»',
    description: 'Выбранные теги стоят в списке вкладок перед вкладкой «Все чаты»',
    defaultEnabled: false,
  },
  {
    id: 'thread-mentions-first',
    title: 'Треды с упоминаниями наверх',
    description:
      'На вкладке «Обсуждения» треды с упоминанием идут первыми и отмечены полосой слева',
    defaultEnabled: false,
  },
]

/** Функции, которые меняют привычный вид клиента и поэтому выключены по умолчанию */
const DISABLED_BY_DEFAULT_FEATURE_IDS: readonly string[] = [
  'media-time-below',
  'tag-tabs-first',
  'thread-mentions-first',
]

const HAS_PSEUDO_CLASS = ':has('
const FEATURE_DIRECTORY_PATTERN = /^\.\/([^/]+)\//
const PREFIX_SELF_CHECK_IDS = ['wide-layout', 'wide-layout-extra']
const STATE_ATTRIBUTE_SELF_CHECK_ID = 'autohide-toolbar'
const STATE_ATTRIBUTE_SELF_CHECK_NAME = 'keyboard-navigation'
const STATE_ATTRIBUTE_SELF_CHECK_RESULT = 'data-better-clouds-autohide-toolbar_keyboard-navigation'

const featureStylesModules = import.meta.glob<string>('./*/styles.ts', {
  import: 'featureStyles',
  eager: true,
})

function readDirectoryNames(modulePaths: readonly string[]): string[] {
  return modulePaths
    .map((modulePath) => FEATURE_DIRECTORY_PATTERN.exec(modulePath)?.[1])
    .filter((directoryName): directoryName is string => directoryName !== undefined)
    .sort()
}

function findPrefixCollisions(featureIds: readonly string[]): string[][] {
  const collisions: string[][] = []
  for (const [firstIndex, firstId] of featureIds.entries()) {
    for (const secondId of featureIds.slice(firstIndex + 1)) {
      if (firstId.startsWith(secondId) || secondId.startsWith(firstId)) {
        collisions.push([firstId, secondId])
      }
    }
  }
  return collisions
}

/* Пока registry пуст, элементы кортежа выводятся как never, поэтому нужен явный тип */
const registryFeatureMetas: readonly FeatureMeta[] = featureMetaRegistry
const registryFeatureIds = registryFeatureMetas.map((featureMeta) => featureMeta.id)
const metaDirectoryNames = readDirectoryNames(Object.keys(import.meta.glob('./*/meta.ts')))
const contentDirectoryNames = readDirectoryNames(Object.keys(import.meta.glob('./*/content.ts')))
const settingsDirectoryNames = readDirectoryNames(Object.keys(import.meta.glob('./*/settings.ts')))

describe('registry', () => {
  it('идентификаторы уникальны', () => {
    expect(new Set(registryFeatureIds).size).toBe(registryFeatureIds.length)
  })

  it('идентификаторы соответствуют шаблону и не заняты ядром', () => {
    for (const featureId of registryFeatureIds) {
      expect(featureId).toMatch(FEATURE_ID_PATTERN)
      expect(RESERVED_FEATURE_IDS).not.toContain(featureId)
    }
  })

  it('ни один идентификатор не является префиксом другого', () => {
    expect(findPrefixCollisions(registryFeatureIds)).toEqual([])
  })

  it('самопроверка: пара с общим началом считается столкновением', () => {
    expect(findPrefixCollisions(PREFIX_SELF_CHECK_IDS)).toEqual([PREFIX_SELF_CHECK_IDS])
  })

  it('папки функций и строки registry совпадают', () => {
    expect(metaDirectoryNames).toEqual([...registryFeatureIds].sort())
  })

  it('у каждой функции ровно один content.ts, и его метаданные совпадают с папкой', () => {
    expect(contentDirectoryNames).toEqual(metaDirectoryNames)
    expect(featureContentRegistry.map((featureContent) => featureContent.meta.id).sort()).toEqual(
      contentDirectoryNames,
    )
  })

  it('схемы хранения объявлены только существующими функциями', () => {
    for (const directoryName of settingsDirectoryNames) {
      expect(registryFeatureIds).toContain(directoryName)
    }
    expect([...featureSettingsRegistry.keys()].sort()).toEqual(settingsDirectoryNames)
  })

  it('названия и описания совпадают с таблицей функций', () => {
    const expectedById = new Map(
      EXPECTED_FEATURE_METAS.map((featureMeta) => [featureMeta.id, featureMeta]),
    )
    for (const featureMeta of registryFeatureMetas) {
      expect(expectedById.get(featureMeta.id)).toEqual(featureMeta)
    }
    expect(registryFeatureIds.every((featureId) => expectedById.has(featureId))).toBe(true)
  })

  it('функции включены по умолчанию, кроме перечисленных исключений', () => {
    for (const featureMeta of registryFeatureMetas) {
      expect(featureMeta.defaultEnabled).toBe(
        !DISABLED_BY_DEFAULT_FEATURE_IDS.includes(featureMeta.id),
      )
    }
  })

  it('в стилях функций нет вложенного :has()', () => {
    for (const featureStyles of Object.values(featureStylesModules)) {
      expect(findNestedHasSelector(featureStyles)).toEqual([])
    }
  })

  it('селекторы сайта не содержат :has()', () => {
    for (const siteSelector of Object.values(siteSelectors)) {
      expect(siteSelector).not.toContain(HAS_PSEUDO_CLASS)
    }
  })

  it('имя атрибута состояния строится из идентификатора функции и имени состояния', () => {
    expect(
      createFeatureStateAttributeName(
        STATE_ATTRIBUTE_SELF_CHECK_ID,
        STATE_ATTRIBUTE_SELF_CHECK_NAME,
      ),
    ).toBe(STATE_ATTRIBUTE_SELF_CHECK_RESULT)
  })
})
