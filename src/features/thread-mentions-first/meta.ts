import { defineFeatureMeta } from '@/shared/feature/define-feature'

export default defineFeatureMeta({
  id: 'thread-mentions-first',
  title: 'Треды с упоминаниями наверх',
  description: 'На вкладке «Обсуждения» треды с упоминанием идут первыми и отмечены полосой слева',
  defaultEnabled: false,
})
