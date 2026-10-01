import { defineContentScript } from '#imports'
import { startChatIdMarker } from '@/features/chat-archive/chat-id-marker'
import { CLOUDS_MATCH_PATTERN } from '@/shared/site/site-constants'

/**
 * Скрипт главного мира страницы: только здесь виден React key записи списка, единственный
 * носитель id чата. Скрипт ставит id атрибутом расширения на запись, пока включён архив
 * чатов, и ничего больше не читает. API расширения в главном мире недоступны, разрешений
 * скрипт не добавляет. Верхний уровень модуля не обращается к document и window
 */
export default defineContentScript({
  matches: [CLOUDS_MATCH_PATTERN],
  runAt: 'document_start',
  allFrames: false,
  world: 'MAIN',
  main() {
    startChatIdMarker(document)
  },
})
