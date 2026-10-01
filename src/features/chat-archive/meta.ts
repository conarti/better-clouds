import { defineFeatureMeta } from '@/shared/feature/define-feature'

export default defineFeatureMeta({
  id: 'chat-archive',
  title: 'Архив чатов',
  description:
    'Пункт «В архив» в меню чата прячет чат из списка, вкладка «Архив» показывает такие чаты',
  defaultEnabled: false,
})
