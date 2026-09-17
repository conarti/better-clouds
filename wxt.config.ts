import { defineConfig } from 'wxt'

/**
 * Публичный ключ фиксирует ID распакованного расширения, чтобы при переустановке
 * в ту же папку сохранялись настройки. Приватный ключ не хранится: для распакованной
 * установки он не нужен. В dev-сборку ключ не попадает, поэтому у неё отдельный ID.
 */
const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4ldzCapfGsLXP0QTshkGAgwnLRZliDvQUmK88dc+FaN3CPbFo5cZRPDR9hFTGFTnVilSRR0uktVBXQYn5FXaqJbRjc0wK0Cj9c0RQHS7Vdt8tQg+Ec2uZHY3atYH+74vSaQ4FaM/yXRRmpxFirBmrDpnizMBHGV8Ij9SXK/b5Bto9bl7FdH/ivSTuah84RuPDR/CiJZKc3LeQRrmjSVmJ0XsnPVzCgTxWFRiOYUY5BzvIH6dZUzhcJwcnB2viLUspBc6yz4fKORQ8flR2+J53ij7MvIi99NKSB8hV+rKQ6vcbehV3koX84EvU6Lg6/5hUZ3GnBmDoneeiaH1IAQfwIDAQAB'

const PRODUCTION_BUILD_MODE = 'production'

const EXTENSION_NAME = 'Better Clouds'

const EXTENSION_DESCRIPTION =
  'Неофициальное расширение для web-клиента Клаудс: широкий режим, скрытая панель навигации, скрытие каталожных ботов'

/** `:has()` поддерживается с Chrome 105, `:nth-child(of S)` с Chrome 111 */
const MINIMUM_CHROME_VERSION = '111'

export default defineConfig({
  srcDir: 'src',
  imports: false,
  modules: ['@wxt-dev/module-vue'],
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  manifest: ({ mode }) => ({
    name: EXTENSION_NAME,
    description: EXTENSION_DESCRIPTION,
    permissions: ['storage'],
    minimum_chrome_version: MINIMUM_CHROME_VERSION,
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: EXTENSION_NAME,
    },
    ...(mode === PRODUCTION_BUILD_MODE ? { key: EXTENSION_PUBLIC_KEY } : {}),
  }),
})
