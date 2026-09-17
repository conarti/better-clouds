/**
 * Единственное место, где живут имена DOM сайта Клаудс. Значения получены чтением живой
 * страницы клиента v3.70.53 и подтверждены на обезличенных фрагментах разметки в tests/fixtures.
 * Тест tests/architecture/selectors-isolation.test.ts следит, чтобы они не расползались по коду.
 */
export const siteSelectors = {
  /** Корень React-приложения, к нему привязан фон страницы */
  appRoot: '#app',
  /** Центральная колонка приложения с полями по бокам и скруглениями */
  layoutPane: '.layout-pane',
  /** Левая колонка со списком чатов, ширина из переменной сайта --left-column-width */
  layoutPaneLeft: '.layout-pane__left',
  /** Левая колонка в свёрнутом режиме (кнопка сворачивания в нижней группе колонки) */
  layoutPaneLeftMinimized: '.layout-pane__left--minimized',
  /** Область открытой переписки справа от списка */
  layoutCenter: '.layout-center',
  /**
   * Колонка навигации слева. Уточнение через родителя обязательно: класс .toolbar встречается
   * и у вспомогательных узлов контекстного меню внутри записей списка
   */
  toolbar: '.layout-pane > .toolbar',
  /** Секция smart apps внутри колонки навигации */
  toolbarSmartAppSection: '.toolbar__smartapp-section',
  /** Бейдж непрочитанных у колокольчика; при нуле клиент его не рендерит */
  toolbarNotificationBadge: '.icon-with-counter__badge',
  /** Кнопки нижней группы колонки: колокольчик и сворачивание списка */
  toolbarCollapseToggle: '.toolbar .icon-with-counter',
  /**
   * Открытое меню, вызванное из колонки навигации. Порталов у таких меню нет, поэтому
   * достаточно уточнения через .toolbar; контекстное меню чата под этот селектор не попадает
   */
  toolbarOpenMenu:
    '.toolbar nav.react-contextmenu.react-contextmenu--visible, .toolbar .dropdown__wrapper--opened',
  /** Контекстное меню записи чата: лежит внутри .layout-pane, а не в колонке навигации */
  chatContextMenu: '.layout-pane > nav.react-contextmenu.chat-context-menu',
  /** Список вкладок над списком чатов: «Все чаты», «Каталог», «Обсуждения», «Упоминания» */
  chatListTabsList: '.layout-pane__search .tabs__list',
  /**
   * Активная вкладка «Все чаты». Идентификатор вкладки в разметку не выводится, поэтому
   * вкладка определяется позицией: она всегда первая в списке
   */
  chatListAllChatsTabActive:
    '.layout-pane__search .tabs__list > .react-contextmenu-wrapper:first-child > .tab--selected',
  /** Поле поиска над списком чатов: редактор Slate, а не input */
  chatListSearchInput: '.search-filter-panel--chat .search-filter-panel-input__editor',
  /**
   * Пустое поле поиска. Псевдокласс :placeholder-shown неприменим, так как поле это
   * contenteditable; признак непустого поля это модификатор --value
   */
  chatListSearchInputEmpty:
    '.search-filter-panel--chat .search-filter-panel-input__editor:not(.search-filter-panel-input__editor--value)',
  /** Контейнер записей списка чатов, в нём же рендерятся результаты поиска */
  chatList: '.layout-pane__chat-list .scroll-custom__content',
  /** Прокручиваемая область списка чатов */
  chatListScrollContent: '.layout-pane__chat-list .scroll-custom__scroller',
  /** Обёртка записи списка, она же носитель контекстного меню записи */
  chatListItemWrapper: '.react-contextmenu-wrapper',
  /** Запись списка чатов */
  chatListEntry: '.chat-list-entry',
  /**
   * Признак каталожной записи: у чата нет переписки, клиент показывает описание из каталога.
   * В свёрнутом режиме списка модификатор не выводится, поэтому скрытие там не действует
   */
  chatListEntryCatalogInfo: '.chat-list-entry__info--catalog',
  /** Область закреплённых чатов с перетаскиванием */
  chatListPinnedDroppable: '[data-rbd-droppable-id]',
  /** Оверлей модального окна клиента */
  modalOverlay: '.modal-overlay',
  /** Корень документа с выбранной темой */
  themeRoot: 'html[theme]',
  /**
   * Режим отключённых анимаций. Правило сайта для этого состояния объявляет transition-*
   * с !important, поэтому наши переходы в нём требуют собственного !important
   */
  reducedAnimationsBody: 'body[reduced_animations]',
} as const

/** Имена атрибутов сайта, которые не начинаются с data- */
export const siteAttributeNames = {
  theme: 'theme',
  reducedAnimations: 'reduced_animations',
} as const

/** Значения атрибута темы на корне документа */
export const siteThemeValues = {
  default: 'default',
  dark: 'dark',
  yellow: 'yellow',
  yellowDark: 'yellow-dark',
} as const

/**
 * Переменные сайта, пригодные для наших стилей: читаются на корне документа и уже
 * содержат значение текущей темы, поэтому вариантов под каждую тему не требуется
 */
export const siteCustomPropertyNames = {
  borderPrimary: '--border-primary',
  buttonPrimary: '--button-primary',
  textAccent: '--text-accent',
  leftColumnWidth: '--left-column-width',
  appTopPaddingHeight: '--app-top-padding-height',
} as const
