const LOG_PREFIX = '[better-clouds]'

/** Минимальный журнал: runtime и настройки получают его параметром, чтобы тесты подставляли свой */
export interface Logger {
  warn(message: string, ...details: unknown[]): void
  error(message: string, ...details: unknown[]): void
}

export const logger: Logger = {
  warn(message, ...details) {
    console.warn(LOG_PREFIX, message, ...details)
  },
  error(message, ...details) {
    console.error(LOG_PREFIX, message, ...details)
  },
}
