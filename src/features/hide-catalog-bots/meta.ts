import { defineFeatureMeta } from '@/shared/feature/define-feature'

export default defineFeatureMeta({
  id: 'hide-catalog-bots',
  title: 'Скрыть ботов из каталога',
  description: 'Не показывает во «Все чаты» ботов, с которыми нет переписки',
  defaultEnabled: true,
})
