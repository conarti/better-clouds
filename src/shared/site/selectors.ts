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
   * Колонка переписки: сайт задаёт ей max-width с резервом под полную ширину колонки навигации
   * (84px, а в @media screen and (max-width: 1920px) 64px), поэтому при спрятанной клиентом
   * колонке навигации у правого края остаётся пустая полоса (разведка живой страницы v3.70.x)
   */
  layoutPaneCenter: '.layout-pane__center',
  /**
   * Модификатор встроенного полноэкранного режима: в нём сайт считает max-width колонки
   * переписки под другую панель (calc(100% - 340px)), резерва под колонку навигации там нет
   * (разведка живой страницы v3.70.x)
   */
  layoutPaneEmbeddedFull: '.layout-pane--embedded--full',
  /**
   * Модификатор трёхколоночного режима: справа от колонки переписки открыта ещё одна
   * панель, сайт резервирует ей место в формуле max-width колонки (разведка живой страницы v3.70.x)
   */
  layoutPaneThreeColumns: '.layout-pane--three-cols',
  /**
   * Контейнер правой панели трёхколоночного режима: сосед колонки переписки в потоке,
   * не входит в .layout-pane (разведка живой страницы v3.70.x)
   */
  rightPanelContainer: '.right-panel-container',
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
  /**
   * Кнопка колокольчика: первый .icon-with-counter нижней колонки тулбара, второй это кнопка
   * сворачивания колонки (разведка живой страницы v3.72.37 и фикстуры v3.70.53)
   */
  toolbarNotificationsButton:
    '.layout-pane > .toolbar > .column:nth-of-type(8) > .icon-with-counter:first-child',
  /** Кнопка сворачивания колонки: второй .icon-with-counter нижней колонки, бейджа у неё нет */
  toolbarCollapseButton:
    '.layout-pane > .toolbar > .column:nth-of-type(8) > .icon-with-counter:nth-child(2)',
  /**
   * Бейдж непрочитанных именно у колокольчика, а не у соседней кнопки сворачивания;
   * при нуле клиент его не рендерит
   */
  toolbarNotificationsButtonBadge:
    '.layout-pane > .toolbar > .column:nth-of-type(8) > .icon-with-counter:first-child > .icon-with-counter__badge',
  /**
   * Тот же бейдж, но от самого тулбара: для :has(), где абсолютный путь через .layout-pane
   * не работает, так как внутри :has() селектор отсчитывается от тулбара
   */
  toolbarNotificationsButtonBadgeFromToolbar:
    '> .column:nth-of-type(8) > .icon-with-counter:first-child > .icon-with-counter__badge',
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
   * Обёртка вкладки в списке вкладок, прямой ребёнок списка. У обёртки display: contents,
   * поэтому элементом flex-списка выступает кнопка внутри неё (разведка живой страницы v3.72.37)
   */
  chatListTabWrapper: '.react-contextmenu-wrapper',
  /**
   * Кнопка вкладки внутри обёртки. Подчёркивание выбранной вкладки это её ::after с
   * position: absolute, поэтому оно едет вместе с кнопкой (разведка живой страницы v3.72.37)
   */
  chatListTabButton: 'button.tab',
  /** Подпись вкладки внутри кнопки: имя системной вкладки или пользовательского тега */
  chatListTabLabel: 'button.tab > span',
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
  /**
   * Кнопка секции колонки навигации без меню: иконка и заголовок. В селекторе функции
   * секция уточняется позицией: идентификатор секции в разметку не выводится
   * (разведка живой страницы v3.72.37)
   */
  toolbarSectionButton: '.section-button',
  /**
   * Обёртка секции колонки навигации с контекстным меню («Чаты», «Звонки»). Сам блок
   * секции это .section-button внутри обёртки; обёртка прячется целиком, вместе с меню
   * (разведка живой страницы v3.72.37)
   */
  toolbarSectionMenuWrapper: '.react-contextmenu-wrapper',
  /** Блок умных приложений под колонкой навигации; сайт задаёт ему модификатор колонки */
  toolbarSmartappSection: '.column.toolbar__smartapp-section',
  /**
   * Кнопка секции «Main»: вторая колонка внутри тулбара. Идентификатор секции в разметку
   * не выводится, поэтому секция определяется позицией среди восьми детей .toolbar
   * (разведка живой страницы v3.72.37); если сайт изменит порядок, селектор просто не
   * найдёт элемента и ничего не спрячет
   */
  toolbarSectionMain: '.layout-pane > .toolbar > .section-button:nth-of-type(2)',
  /** Секция «Чаты»: обёртка контекстного меню, третий ребёнок тулбара */
  toolbarSectionChats: '.layout-pane > .toolbar > .react-contextmenu-wrapper:nth-of-type(3)',
  /** Секция «Контакты»: четвёртый ребёнок тулбара */
  toolbarSectionContacts: '.layout-pane > .toolbar > .section-button:nth-of-type(4)',
  /** Секция «Звонки»: обёртка контекстного меню, пятый ребёнок тулбара */
  toolbarSectionCalls: '.layout-pane > .toolbar > .react-contextmenu-wrapper:nth-of-type(5)',
  /** Кнопка секции «SmartApps»: шестой ребёнок тулбара */
  toolbarSectionSmartapps: '.layout-pane > .toolbar > .section-button:nth-of-type(6)',
  /**
   * Блок умных приложений под секциями: в отличие от кнопок определяется классом — у него
   * он стабильный модификатор, а не позиция
   */
  toolbarSmartappSectionBlock: '.layout-pane > .toolbar > .column.toolbar__smartapp-section',
  /**
   * Колонка настроек вверху тулбара (аватар и статус): функция секции не трогает её,
   * браузерный тест проверяет это отдельно
   */
  toolbarSettingsColumn: '.layout-pane > .toolbar > .column.settings-button',
  /**
   * Нижняя колонка тулбара (уведомления, сворачивание, версия): определяется позицией —
   * восьмой ребёнок, у неё нет собственного модификатора
   */
  toolbarBottomColumn: '.layout-pane > .toolbar > .column:nth-of-type(8)',
  /** Строка сообщения в переписке; сайт задаёт ей вертикальные отступы */
  chatMessageRow: '.chat-message-row',
  /**
   * Внутренний блок строки сообщения: карман под аватар вырезается отрицательным
   * отступом, текст отодвинут от левого края
   */
  chatMessageInner: '.chat-message-inner',
  /**
   * Время и статус сообщения с одиночной картинкой без подписи: прямой потомок пузыря,
   * сосед .chat-message__content. Клиент ставит его абсолютно поверх превью с тёмной плашкой
   * (разведка живой страницы v3.72.37)
   */
  chatMessageImageTime: '.chat-message__bubble > .chat-message__meta--image',
  /**
   * То же для сообщения с видео. Уточнение через прямого потомка пузыря обязательно: второй
   * блок с модификатором --video, длительность внутри превью, этим селектором не выбирается
   * (разведка живой страницы v3.72.37)
   */
  chatMessageVideoTime: '.chat-message__bubble > .chat-message__meta--video',
  /** Пузырь сообщения: relative, отступ 10px, предок блоков времени и превью (разведка v3.72.37) */
  chatMessageBubble: '.chat-message__bubble',
  /** Блок времени любого сообщения: у текстовых он абсолютный у нижнего правого угла пузыря */
  chatMessageMeta: '.chat-message__meta',
  /** Превью одиночной картинки внутри содержимого сообщения */
  chatMessagePicture: '.chat-message__content > .chat-message__picture',
  /** Превью видео внутри содержимого сообщения */
  chatMessageVideo: '.chat-message__content > .chat-message__video',
  /**
   * Блок длительности видео внутри превью: абсолютный в левом верхнем углу, функция
   * времени под медиа его не трогает (разведка живой страницы v3.72.37)
   */
  chatMessageVideoDuration: '.chat-message__meta--video-duration',
  /** Контейнер аватара в записях списка и в строках сообщений */
  chatAvatar: '.chat-avatar',
  /**
   * Аватар в записи списка чатов. Клиент задаёт его размеры inline-стилями, поэтому
   * компактный режим перебивает их только с !important (разведка живой страницы v3.72.37)
   */
  chatListEntryAvatarInner: '.chat-avatar__inner',
  /** Разделитель дат в переписке; компактный режим его не затрагивает */
  dateSplitter: '.date-splitter',
} as const

/**
 * Имена классов сайта, которые нужны как значения, а не как часть селектора: тесты
 * имитируют ими состояния, которые на живой странице ставит клиент
 */
export const siteClassNames = {
  /** Модификатор непустого поля поиска: редактор Slate не хранит значение в атрибуте */
  chatListSearchInputValue: 'search-filter-panel-input__editor--value',
  /** Модификатор выбранной вкладки списка: им browser-тест выбирает вкладку тега */
  chatListTabSelected: 'tab--selected',
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
