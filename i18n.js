'use strict';

// ---------------------------------------------------------------------------
// Translation strings for all supported languages
// ---------------------------------------------------------------------------

const TRANSLATIONS = {
  // ---- Portuguese (Portugal) – default ----
  pt: {
    'extension-name':        'Corretor Branco',
    'extension-page-title':  'Corretor Branco - Opções',

    'popup-subtitle':        'Corretor Ortográfico',
    'popup-status-active':   'Ativo',
    'popup-stat-label':      'pares de palavras carregados',
    'popup-btn-manage':      '\uD83D\uDCDD Gerir Palavras',
    'popup-btn-sandbox':     '\uD83E\uDDEA Área de Teste',
    'popup-lang-label':      'Idioma',

    'opts-header-sub':       'Gere a sua lista de correções ortográficas',
    'opts-settings-h2':      'Definições',
    'opts-lang-label':       'Idioma da Interface',
    'opts-lang-desc':        'Selecione o idioma da interface da extensão.',
    'opts-autocap-label':    'Capitalizar automaticamente a primeira palavra de uma frase',
    'opts-autocap-desc':     'Aplica-se no início de um novo parágrafo ou após um símbolo de fim de frase (como «.», «!» ou «?»).',
    'opts-blacklist-label':  'Lista negra de domínios',
    'opts-blacklist-desc':   'Se a página atual pertencer a um domínio desta lista, a extensão não realizará quaisquer correções. Introduza um domínio por linha (ex: exemplo.com).',
    'opts-blacklist-ph':     'exemplo.com\noutrosite.pt',
    'opts-btn-save':         'Guardar',
    'opts-btn-saved':        '\u2713 Guardado',
    'opts-import-h2':        'Importar / Exportar',
    'opts-btn-import':       '\u21B9 Importar CSV',
    'opts-btn-export':       '\u21BB Exportar CSV',
    'opts-add-h2':           'Adicionar Par de Palavras',
    'opts-incorrect-label':  'Palavra com erro',
    'opts-incorrect-ph':     'ex: nao',
    'opts-correct-label':    'Correção',
    'opts-correct-ph':       'ex: não',
    'opts-btn-add':          'Adicionar',
    'opts-wordlist-h2':      'Lista de Palavras',
    'opts-search-ph':        '\uD83D\uDD0D Pesquisar palavras\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 Limpar Tudo',
    'opts-th-incorrect':     'Palavra com Erro',
    'opts-th-correct':       'Correção',
    'opts-th-action':        'Ação',
    'opts-empty-msg':        'Ainda não foram adicionados pares de palavras. Adicione a primeira correção acima!',

    'err-empty-incorrect':   'Por favor, introduza a palavra com erro.',
    'err-empty-correct':     'Por favor, introduza a correção.',
    'err-same-words':        'A palavra com erro e a sua correção não podem ser iguais.',
    'err-no-words-found':    'Nenhum par de palavras encontrado.',
    'err-list-empty':        'A lista de palavras já está vazia.',
    'confirm-clear-all':     'Eliminar TODOS os pares de palavras? Esta ação não pode ser desfeita.',
    'msg-imported':          'Importado(s) {count} par(es) de palavras.',
    'msg-skipped':           'Ignorada(s) {count} linha(s) inválida(s).',
    'err-nothing-to-export': 'Não há pares de palavras para exportar.',
    'btn-delete':            'Eliminar',

    'sandbox-subtitle':      'Teste as suas correções ortográficas em tempo real',
    'sandbox-area-h2':       'Área de Teste',
    'sandbox-btn-clear':     'Limpar',
    'sandbox-hint':          'Escreva texto abaixo. As palavras são corrigidas automaticamente ao escrever um espaço ou pontuação depois delas.',
    'sandbox-area-ph':       'Comece a escrever aqui\u2026 ex: escreva uma palavra com erro e prima Espaço.',
    'sandbox-log-h3':        'Correções aplicadas',
    'sandbox-no-corrections':'Ainda sem correções',
    'sandbox-active-h2':     'Correções ativas',
    'sandbox-no-words':      'Nenhum par de palavras carregado.',
    'sandbox-go-options':    'Adicione palavras na página de opções.',
    'sandbox-th-incorrect':  'Incorreto',
    'sandbox-th-correct':    'Correto',
  },

  // ---- English ----
  en: {
    'extension-name':        'White Out Corrector',
    'extension-page-title':  'White Out Corrector - Options',

    'popup-subtitle':        'Spell Checker',
    'popup-status-active':   'Active',
    'popup-stat-label':      'word pairs loaded',
    'popup-btn-manage':      '\uD83D\uDCDD Manage Words',
    'popup-btn-sandbox':     '\uD83E\uDDEA Test Area',
    'popup-lang-label':      'Language',

    'opts-header-sub':       'Manage your spelling correction list',
    'opts-settings-h2':      'Settings',
    'opts-lang-label':       'Interface Language',
    'opts-lang-desc':        'Select the language for the extension interface.',
    'opts-autocap-label':    'Automatically capitalise the first word of a sentence',
    'opts-autocap-desc':     'Applies at the beginning of a new paragraph or after a sentence-ending symbol (such as «.», «!» or «?»).',
    'opts-blacklist-label':  'Domain blacklist',
    'opts-blacklist-desc':   'If the current page belongs to a domain on this list, the extension will not make any corrections. Enter one domain per line (e.g. example.com).',
    'opts-blacklist-ph':     'example.com\nanothersite.co.uk',
    'opts-btn-save':         'Save',
    'opts-btn-saved':        '\u2713 Saved',
    'opts-import-h2':        'Import / Export',
    'opts-btn-import':       '\u21B9 Import CSV',
    'opts-btn-export':       '\u21BB Export CSV',
    'opts-add-h2':           'Add Word Pair',
    'opts-incorrect-label':  'Incorrect word',
    'opts-incorrect-ph':     'e.g. teh',
    'opts-correct-label':    'Correction',
    'opts-correct-ph':       'e.g. the',
    'opts-btn-add':          'Add',
    'opts-wordlist-h2':      'Word List',
    'opts-search-ph':        '\uD83D\uDD0D Search words\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 Clear All',
    'opts-th-incorrect':     'Incorrect Word',
    'opts-th-correct':       'Correction',
    'opts-th-action':        'Action',
    'opts-empty-msg':        'No word pairs added yet. Add your first correction above!',

    'err-empty-incorrect':   'Please enter the incorrect word.',
    'err-empty-correct':     'Please enter the correction.',
    'err-same-words':        'The incorrect word and its correction cannot be the same.',
    'err-no-words-found':    'No word pairs found.',
    'err-list-empty':        'The word list is already empty.',
    'confirm-clear-all':     'Delete ALL word pairs? This action cannot be undone.',
    'msg-imported':          'Imported {count} word pair(s).',
    'msg-skipped':           'Skipped {count} invalid line(s).',
    'err-nothing-to-export': 'There are no word pairs to export.',
    'btn-delete':            'Delete',

    'sandbox-subtitle':      'Test your spelling corrections in real time',
    'sandbox-area-h2':       'Test Area',
    'sandbox-btn-clear':     'Clear',
    'sandbox-hint':          'Type text below. Words are corrected automatically when you type a space or punctuation after them.',
    'sandbox-area-ph':       'Start typing here\u2026 e.g. type a misspelled word and press Space.',
    'sandbox-log-h3':        'Applied corrections',
    'sandbox-no-corrections':'No corrections yet',
    'sandbox-active-h2':     'Active corrections',
    'sandbox-no-words':      'No word pairs loaded.',
    'sandbox-go-options':    'Add words on the options page.',
    'sandbox-th-incorrect':  'Incorrect',
    'sandbox-th-correct':    'Correct',
  },

  // ---- Spanish ----
  es: {
    'extension-name':       'Corrector Blanco',

    'popup-subtitle':        'Corrector Ortográfico',
    'popup-status-active':   'Activo',
    'popup-stat-label':      'pares de palabras cargados',
    'popup-btn-manage':      '\uD83D\uDCDD Gestionar Palabras',
    'popup-btn-sandbox':     '\uD83E\uDDEA Área de Prueba',
    'popup-lang-label':      'Idioma',

    'opts-header-sub':       'Gestione su lista de correcciones ortográficas',
    'opts-settings-h2':      'Configuración',
    'opts-lang-label':       'Idioma de la Interfaz',
    'opts-lang-desc':        'Seleccione el idioma de la interfaz de la extensión.',
    'opts-autocap-label':    'Capitalizar automáticamente la primera palabra de una oración',
    'opts-autocap-desc':     'Se aplica al inicio de un nuevo párrafo o después de un símbolo de fin de oración (como «.», «!» o «?»).',
    'opts-blacklist-label':  'Lista negra de dominios',
    'opts-blacklist-desc':   'Si la página actual pertenece a un dominio de esta lista, la extensión no realizará ninguna corrección. Introduzca un dominio por línea (ej: ejemplo.com).',
    'opts-blacklist-ph':     'ejemplo.com\notrosite.es',
    'opts-btn-save':         'Guardar',
    'opts-btn-saved':        '\u2713 Guardado',
    'opts-import-h2':        'Importar / Exportar',
    'opts-btn-import':       '\u21B9 Importar CSV',
    'opts-btn-export':       '\u21BB Exportar CSV',
    'opts-add-h2':           'Añadir Par de Palabras',
    'opts-incorrect-label':  'Palabra con error',
    'opts-incorrect-ph':     'ej: qe',
    'opts-correct-label':    'Corrección',
    'opts-correct-ph':       'ej: que',
    'opts-btn-add':          'Añadir',
    'opts-wordlist-h2':      'Lista de Palabras',
    'opts-search-ph':        '\uD83D\uDD0D Buscar palabras\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 Borrar Todo',
    'opts-th-incorrect':     'Palabra con Error',
    'opts-th-correct':       'Corrección',
    'opts-th-action':        'Acción',
    'opts-empty-msg':        'Aún no se han añadido pares de palabras. ¡Añada la primera corrección arriba!',

    'err-empty-incorrect':   'Por favor, introduzca la palabra con error.',
    'err-empty-correct':     'Por favor, introduzca la corrección.',
    'err-same-words':        'La palabra con error y su corrección no pueden ser iguales.',
    'err-no-words-found':    'No se encontraron pares de palabras.',
    'err-list-empty':        'La lista de palabras ya está vacía.',
    'confirm-clear-all':     '¿Eliminar TODOS los pares de palabras? Esta acción no se puede deshacer.',
    'msg-imported':          'Importado(s) {count} par(es) de palabras.',
    'msg-skipped':           'Omitida(s) {count} línea(s) no válida(s).',
    'err-nothing-to-export': 'No hay pares de palabras para exportar.',
    'btn-delete':            'Eliminar',

    'sandbox-subtitle':      'Pruebe sus correcciones ortográficas en tiempo real',
    'sandbox-area-h2':       'Área de Prueba',
    'sandbox-btn-clear':     'Limpiar',
    'sandbox-hint':          'Escriba texto abajo. Las palabras se corrigen automáticamente al escribir un espacio o puntuación después de ellas.',
    'sandbox-area-ph':       'Empiece a escribir aquí\u2026 ej: escriba una palabra con error y pulse Espacio.',
    'sandbox-log-h3':        'Correcciones aplicadas',
    'sandbox-no-corrections':'Aún sin correcciones',
    'sandbox-active-h2':     'Correcciones activas',
    'sandbox-no-words':      'No hay pares de palabras cargados.',
    'sandbox-go-options':    'Añada palabras en la página de opciones.',
    'sandbox-th-incorrect':  'Incorrecto',
    'sandbox-th-correct':    'Correcto',
  },

  // ---- French ----
  fr: {
    'extension-name':       'Correcteur Blanc',

    'popup-subtitle':        'Correcteur Orthographique',
    'popup-status-active':   'Actif',
    'popup-stat-label':      'paires de mots chargées',
    'popup-btn-manage':      '\uD83D\uDCDD Gérer les mots',
    'popup-btn-sandbox':     '\uD83E\uDDEA Zone de test',
    'popup-lang-label':      'Langue',

    'opts-header-sub':       'Gérez votre liste de corrections orthographiques',
    'opts-settings-h2':      'Paramètres',
    'opts-lang-label':       "Langue de l'interface",
    'opts-lang-desc':        "Sélectionnez la langue de l'interface de l'extension.",
    'opts-autocap-label':    "Mettre en majuscule automatiquement le premier mot d'une phrase",
    'opts-autocap-desc':     "S'applique au début d'un nouveau paragraphe ou après un symbole de fin de phrase (comme «.», «!» ou «?»).",
    'opts-blacklist-label':  'Liste noire de domaines',
    'opts-blacklist-desc':   "Si la page actuelle appartient à un domaine de cette liste, l'extension n'effectuera aucune correction. Entrez un domaine par ligne (ex : exemple.com).",
    'opts-blacklist-ph':     'exemple.com\nautresite.fr',
    'opts-btn-save':         'Enregistrer',
    'opts-btn-saved':        '\u2713 Enregistré',
    'opts-import-h2':        'Importer / Exporter',
    'opts-btn-import':       '\u21B9 Importer CSV',
    'opts-btn-export':       '\u21BB Exporter CSV',
    'opts-add-h2':           'Ajouter une paire de mots',
    'opts-incorrect-label':  'Mot incorrect',
    'opts-incorrect-ph':     'ex : avce',
    'opts-correct-label':    'Correction',
    'opts-correct-ph':       'ex : avec',
    'opts-btn-add':          'Ajouter',
    'opts-wordlist-h2':      'Liste de mots',
    'opts-search-ph':        '\uD83D\uDD0D Rechercher des mots\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 Tout effacer',
    'opts-th-incorrect':     'Mot incorrect',
    'opts-th-correct':       'Correction',
    'opts-th-action':        'Action',
    'opts-empty-msg':        "Aucune paire de mots ajoutée pour l'instant. Ajoutez votre première correction ci-dessus !",

    'err-empty-incorrect':   'Veuillez saisir le mot incorrect.',
    'err-empty-correct':     'Veuillez saisir la correction.',
    'err-same-words':        'Le mot incorrect et sa correction ne peuvent pas être identiques.',
    'err-no-words-found':    'Aucune paire de mots trouvée.',
    'err-list-empty':        'La liste de mots est déjà vide.',
    'confirm-clear-all':     'Supprimer TOUTES les paires de mots ? Cette action est irréversible.',
    'msg-imported':          '{count} paire(s) de mots importée(s).',
    'msg-skipped':           '{count} ligne(s) invalide(s) ignorée(s).',
    'err-nothing-to-export': "Il n'y a aucune paire de mots à exporter.",
    'btn-delete':            'Supprimer',

    'sandbox-subtitle':      'Testez vos corrections orthographiques en temps réel',
    'sandbox-area-h2':       'Zone de test',
    'sandbox-btn-clear':     'Effacer',
    'sandbox-hint':          'Tapez du texte ci-dessous. Les mots sont corrigés automatiquement lorsque vous tapez un espace ou une ponctuation après eux.',
    'sandbox-area-ph':       'Commencez à taper ici\u2026 ex : tapez un mot mal orthographié et appuyez sur Espace.',
    'sandbox-log-h3':        'Corrections appliquées',
    'sandbox-no-corrections':'Pas encore de corrections',
    'sandbox-active-h2':     'Corrections actives',
    'sandbox-no-words':      'Aucune paire de mots chargée.',
    'sandbox-go-options':    'Ajoutez des mots sur la page des options.',
    'sandbox-th-incorrect':  'Incorrect',
    'sandbox-th-correct':    'Correct',
  },

  // ---- German ----
  de: {
    'extension-name':       'Weißer Korrektor',

    'popup-subtitle':        'Rechtschreibprüfung',
    'popup-status-active':   'Aktiv',
    'popup-stat-label':      'Wortpaare geladen',
    'popup-btn-manage':      '\uD83D\uDCDD Wörter verwalten',
    'popup-btn-sandbox':     '\uD83E\uDDEA Testbereich',
    'popup-lang-label':      'Sprache',

    'opts-header-sub':       'Verwalten Sie Ihre Rechtschreibkorrekturen',
    'opts-settings-h2':      'Einstellungen',
    'opts-lang-label':       'Oberflächensprache',
    'opts-lang-desc':        'Wählen Sie die Sprache der Erweiterungsoberfläche aus.',
    'opts-autocap-label':    'Erstes Wort eines Satzes automatisch großschreiben',
    'opts-autocap-desc':     'Gilt am Anfang eines neuen Absatzes oder nach einem Satzzeichen (wie «.», «!» oder «?»).',
    'opts-blacklist-label':  'Domain-Sperrliste',
    'opts-blacklist-desc':   'Wenn die aktuelle Seite zu einer Domain auf dieser Liste gehört, nimmt die Erweiterung keine Korrekturen vor. Geben Sie eine Domain pro Zeile ein (z.\u00A0B. beispiel.de).',
    'opts-blacklist-ph':     'beispiel.de\nandereseite.de',
    'opts-btn-save':         'Speichern',
    'opts-btn-saved':        '\u2713 Gespeichert',
    'opts-import-h2':        'Importieren / Exportieren',
    'opts-btn-import':       '\u21B9 CSV importieren',
    'opts-btn-export':       '\u21BB CSV exportieren',
    'opts-add-h2':           'Wortpaar hinzufügen',
    'opts-incorrect-label':  'Falsches Wort',
    'opts-incorrect-ph':     'z.\u00A0B. tpyen',
    'opts-correct-label':    'Korrektur',
    'opts-correct-ph':       'z.\u00A0B. tippen',
    'opts-btn-add':          'Hinzufügen',
    'opts-wordlist-h2':      'Wortliste',
    'opts-search-ph':        '\uD83D\uDD0D Wörter suchen\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 Alles löschen',
    'opts-th-incorrect':     'Falsches Wort',
    'opts-th-correct':       'Korrektur',
    'opts-th-action':        'Aktion',
    'opts-empty-msg':        'Es wurden noch keine Wortpaare hinzugefügt. Fügen Sie Ihre erste Korrektur oben hinzu!',

    'err-empty-incorrect':   'Bitte geben Sie das falsche Wort ein.',
    'err-empty-correct':     'Bitte geben Sie die Korrektur ein.',
    'err-same-words':        'Das falsche Wort und seine Korrektur dürfen nicht identisch sein.',
    'err-no-words-found':    'Keine Wortpaare gefunden.',
    'err-list-empty':        'Die Wortliste ist bereits leer.',
    'confirm-clear-all':     'ALLE Wortpaare löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    'msg-imported':          '{count} Wortpaar(e) importiert.',
    'msg-skipped':           '{count} ungültige Zeile(n) übersprungen.',
    'err-nothing-to-export': 'Es gibt keine Wortpaare zum Exportieren.',
    'btn-delete':            'Löschen',

    'sandbox-subtitle':      'Testen Sie Ihre Rechtschreibkorrekturen in Echtzeit',
    'sandbox-area-h2':       'Testbereich',
    'sandbox-btn-clear':     'Löschen',
    'sandbox-hint':          'Geben Sie unten Text ein. Wörter werden automatisch korrigiert, wenn Sie danach ein Leerzeichen oder ein Satzzeichen eingeben.',
    'sandbox-area-ph':       'Beginnen Sie hier zu tippen\u2026 z.\u00A0B. ein falsch geschriebenes Wort eingeben und Leertaste drücken.',
    'sandbox-log-h3':        'Angewendete Korrekturen',
    'sandbox-no-corrections':'Noch keine Korrekturen',
    'sandbox-active-h2':     'Aktive Korrekturen',
    'sandbox-no-words':      'Keine Wortpaare geladen.',
    'sandbox-go-options':    'Fügen Sie Wörter auf der Optionsseite hinzu.',
    'sandbox-th-incorrect':  'Falsch',
    'sandbox-th-correct':    'Richtig',
  },

  // ---- Chinese (Simplified) ----
  zh: {
    'extension-name':       '白色更正器',

    'popup-subtitle':        '拼写检查器',
    'popup-status-active':   '已启用',
    'popup-stat-label':      '已加载词对',
    'popup-btn-manage':      '\uD83D\uDCDD 管理词汇',
    'popup-btn-sandbox':     '\uD83E\uDDEA 测试区域',
    'popup-lang-label':      '语言',

    'opts-header-sub':       '管理您的拼写更正列表',
    'opts-settings-h2':      '设置',
    'opts-lang-label':       '界面语言',
    'opts-lang-desc':        '选择扩展程序界面的语言。',
    'opts-autocap-label':    '自动将句子首字母大写',
    'opts-autocap-desc':     '在新段落开头或句末符号（如「.」、「!」或「?」）之后应用。',
    'opts-blacklist-label':  '域名黑名单',
    'opts-blacklist-desc':   '如果当前页面属于此列表中的域，扩展程序将不进行任何更正。每行输入一个域名（例如：example.com）。',
    'opts-blacklist-ph':     'example.com\nanothersite.com',
    'opts-btn-save':         '保存',
    'opts-btn-saved':        '\u2713 已保存',
    'opts-import-h2':        '导入 / 导出',
    'opts-btn-import':       '\u21B9 导入 CSV',
    'opts-btn-export':       '\u21BB 导出 CSV',
    'opts-add-h2':           '添加词对',
    'opts-incorrect-label':  '错误词汇',
    'opts-incorrect-ph':     '例如：teh',
    'opts-correct-label':    '更正',
    'opts-correct-ph':       '例如：the',
    'opts-btn-add':          '添加',
    'opts-wordlist-h2':      '词汇列表',
    'opts-search-ph':        '\uD83D\uDD0D 搜索词汇\u2026',
    'opts-btn-clear-all':    '\uD83D\uDDD1 清除全部',
    'opts-th-incorrect':     '错误词汇',
    'opts-th-correct':       '更正',
    'opts-th-action':        '操作',
    'opts-empty-msg':        '尚未添加任何词对。请在上方添加您的第一个更正！',

    'err-empty-incorrect':   '请输入错误词汇。',
    'err-empty-correct':     '请输入更正内容。',
    'err-same-words':        '错误词汇和更正内容不能相同。',
    'err-no-words-found':    '未找到词对。',
    'err-list-empty':        '词汇列表已经为空。',
    'confirm-clear-all':     '删除所有词对？此操作无法撤消。',
    'msg-imported':          '已导入 {count} 个词对。',
    'msg-skipped':           '已跳过 {count} 行无效数据。',
    'err-nothing-to-export': '没有可导出的词对。',
    'btn-delete':            '删除',

    'sandbox-subtitle':      '实时测试您的拼写更正',
    'sandbox-area-h2':       '测试区域',
    'sandbox-btn-clear':     '清除',
    'sandbox-hint':          '在下方输入文字。在输入空格或标点符号后，词汇将自动更正。',
    'sandbox-area-ph':       '从这里开始输入\u2026例如：输入一个错误的词汇然后按空格键。',
    'sandbox-log-h3':        '已应用的更正',
    'sandbox-no-corrections':'暂无更正',
    'sandbox-active-h2':     '当前激活的更正',
    'sandbox-no-words':      '未加载任何词对。',
    'sandbox-go-options':    '请在选项页面添加词汇。',
    'sandbox-th-incorrect':  '错误',
    'sandbox-th-correct':    '正确',
  },
};

// Mapping of extension language codes to their proper BCP-47 HTML lang values
const LANG_HTML_CODES = {
  pt: 'pt',
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  zh: 'zh-Hans',
};

// ---------------------------------------------------------------------------
// I18n helper object – available globally to all extension pages
// ---------------------------------------------------------------------------

const I18n = {
  _lang: 'pt',

  /** Translate a key, optionally substituting {placeholder} tokens. */
  t(key, replacements) {
    const dict = TRANSLATIONS[this._lang] || TRANSLATIONS.pt;
    let str = (key in dict ? dict[key] : null);
    if (str === null || str === undefined) str = TRANSLATIONS.pt[key];
    if (str === null || str === undefined) str = key;
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        str = str.replace('{' + k + '}', String(v));
      }
    }
    return str;
  },

  /**
   * Apply the given language to every element carrying a data-i18n or
   * data-i18n-placeholder attribute in the current document.
   */
  apply(lang) {
    this._lang = lang || 'pt';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    document.documentElement.lang = LANG_HTML_CODES[lang] || lang || 'pt';
  },

  /** Load the persisted language from storage and call back with it. */
  load(callback) {
    chrome.storage.local.get('language', (data) => {
      this._lang = data.language || 'pt';
      if (callback) callback(this._lang);
    });
  },
};
