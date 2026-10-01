import { defineFeatureMeta } from '@/shared/feature/define-feature'

export default defineFeatureMeta({
  id: 'media-time-below',
  title: 'Время под картинками и видео',
  description: 'Время и статус переносятся под картинку или видео, а не лежат поверх превью',
  defaultEnabled: false,
})
