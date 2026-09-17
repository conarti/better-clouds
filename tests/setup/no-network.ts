/**
 * Расширение не делает сетевых запросов. Любая попытка обратиться к сети в unit-тестах
 * должна падать сразу, а не зависеть от окружения.
 */

const NETWORK_ACCESS_ERROR_MESSAGE = 'Сетевые запросы в тестах запрещены'

function throwNetworkAccessError(): never {
  throw new Error(NETWORK_ACCESS_ERROR_MESSAGE)
}

class ForbiddenXMLHttpRequest {
  constructor() {
    throwNetworkAccessError()
  }
}

class ForbiddenWebSocket {
  constructor() {
    throwNetworkAccessError()
  }
}

globalThis.fetch = throwNetworkAccessError
globalThis.XMLHttpRequest = ForbiddenXMLHttpRequest as unknown as typeof XMLHttpRequest
globalThis.WebSocket = ForbiddenWebSocket as unknown as typeof WebSocket
