import { defineFeatureMeta } from '@/shared/feature/define-feature'

export default defineFeatureMeta({
  id: 'compact-mode',
  title: 'Компактный режим',
  description: 'Уменьшает высоту строк в списке чатов и переписке',
  defaultEnabled: true,
})
