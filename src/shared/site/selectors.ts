/**
 * Единственное место, где живут имена DOM сайта Клаудс. Значения получены чтением живой
 * страницы клиента v3.70.53 и подтверждены на обезличенных фрагментах разметки в tests/fixtures.
 * Тест tests/architecture/selectors-isolation.test.ts следит, чтобы они не расползались по коду.
 */
export const siteSelectors = {
  /**
   * Корень React-приложения, к нему привязан фон страницы. Нужен браузерным тестам:
   * tests/helpers/feature-dom.ts собирает им контейнер страницы
   */
  appRoot: '#app',
  /** Центральная колонка приложения с полями по бокам и скруглениями */
  layoutPane: '.layout-pane',
  /** Левая колонка со списком чатов, ширина из переменной сайта --left-column-width */
  layoutPaneLeft: '.layout-pane__left',
  /**
   * Тело колонки (левой и центральной): высота считается через calc от 100dvh с вычетом переменной
   * --app-top-padding-height (разведка живой страницы v3.70.x)
   */
  layoutPaneBody: '.layout-pane__body',
  /**
   * Колонка навигации слева. Уточнение через родителя обязательно: класс .toolbar встречается
   * и у вспомогательных узлов контекстного меню внутри записей списка
   */
  toolbar: '.layout-pane > .toolbar',
  /** Бейдж непрочитанных у колокольчика; при нуле клиент его не рендерит */
  toolbarNotificationBadge: '.icon-with-counter__badge',
  /**
   * Открытое меню, вызванное из колонки навигации. Порталов у таких меню нет, поэтому
   * достаточно уточнения через .toolbar; контекстное меню чата под этот селектор не попадает
   */
  toolbarOpenMenu:
    '.toolbar nav.react-contextmenu.react-contextmenu--visible, .toolbar .dropdown__wrapper--opened',
  /**
   * Контекстное меню записи чата: лежит внутри .layout-pane, а не в колонке навигации.
   * Нужен браузерному тесту autohide-toolbar: им проверяется, что такое меню колонку не раскрывает
   */
  chatContextMenu: '.layout-pane > nav.react-contextmenu.chat-context-menu',
  /** Список вкладок над списком чатов: «Все чаты», «Каталог», «Обсуждения», «Упоминания» */
  chatListTabsList: '.layout-pane__search .tabs__list',
  /**
   * Активная вкладка «Все чаты». Идентификатор вкладки в разметку не выводится, поэтому
   * вкладка определяется позицией: она всегда первая в списке
   */
  chatListAllChatsTabActive:
    '.layout-pane__search .tabs__list > .react-contextmenu-wrapper:first-child > .tab--selected',
  /**
   * Поле поиска над списком чатов: редактор Slate, а не input. Нужен браузерному тесту
   * hide-catalog-bots: им тест имитирует ввод в поиск
   */
  chatListSearchInput: '.search-filter-panel--chat .search-filter-panel-input__editor',
  /**
   * Пустое поле поиска. Псевдокласс :placeholder-shown неприменим, так как поле это
   * contenteditable; признак непустого поля это модификатор --value
   */
  chatListSearchInputEmpty:
    '.search-filter-panel--chat .search-filter-panel-input__editor:not(.search-filter-panel-input__editor--value)',
  /** Контейнер записей списка чатов, в нём же рендерятся результаты поиска */
  chatList: '.layout-pane__chat-list .scroll-custom__content',
  /** Обёртка записи списка, она же носитель контекстного меню записи */
  chatListItemWrapper: '.react-contextmenu-wrapper',
  /** Запись списка чатов */
  chatListEntry: '.chat-list-entry',
  /**
   * Признак каталожной записи: у чата нет переписки, клиент показывает описание из каталога.
   * В свёрнутом режиме списка модификатор не выводится, поэтому скрытие там не действует
   */
  chatListEntryCatalogInfo: '.chat-list-entry__info--catalog',
  /**
   * Область закреплённых чатов с перетаскиванием. Нужен браузерному тесту hide-catalog-bots:
   * им тест считает закреплённые записи
   */
  chatListPinnedDroppable: '[data-rbd-droppable-id]',
  /**
   * Режим отключённых анимаций. Правило сайта для этого состояния объявляет transition-*
   * с !important, поэтому наши переходы в нём требуют собственного !important
   */
  reducedAnimationsBody: 'body[reduced_animations]',
} as const

/**
 * Имена классов сайта, которые нужны как значения, а не как часть селектора: тесты
 * имитируют ими состояния, которые на живой странице ставит клиент
 */
export const siteClassNames = {
  /** Модификатор непустого поля поиска: редактор Slate не хранит значение в атрибуте */
  chatListSearchInputValue: 'search-filter-panel-input__editor--value',
} as const

/** Имена атрибутов сайта, которые не начинаются с data- */
export const siteAttributeNames = {
  /** Режим отключённых анимаций: им browser-тест autohide-toolbar включает правило клиента */
  reducedAnimations: 'reduced_animations',
} as const

/**
 * Переменные сайта, пригодные для наших стилей: читаются на корне документа и уже
 * содержат значение текущей темы, поэтому вариантов под каждую тему не требуется
 */
export const siteCustomPropertyNames = {
  /** Цвет точки непрочитанных у спрятанной колонки */
  buttonPrimary: '--button-primary',
  /**
   * Отступ сверху центральной колонки: сайт вычитает его же из высоты .layout-pane__body
   * (разведка живой страницы v3.70.x: :root задаёт 16px, .layout-pane берёт его в padding-top,
   * .layout-pane__body вычитает его из calc(100dvh - 60px - var(...)))
   */
  appTopPaddingHeight: '--app-top-padding-height',
} as const
