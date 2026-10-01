/**
 * Общее свойство видимости точки непрочитанных у спрятанной колонки. Его задаёт
 * hide-toolbar-sections, когда колокольчик или его счётчик скрыт (значение 0), а
 * autohide-toolbar берёт из него прозрачность точки (запасное значение 1). Так функции
 * не знают друг о друге и связаны только именем свойства
 */
export const NOTIFICATION_DOT_VISIBILITY_PROPERTY = '--better-clouds-notification-dot-visibility'
