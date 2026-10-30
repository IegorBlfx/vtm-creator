// Типи хижака базової книги V5 (укр. переклад, с. 177–180 PDF).
// specialties: варіанти спеціалізації (custom — гравець вписує деталь сам).
// disciplines: варіанти +1 крапки дисципліни; onlyFor — обмеження за кланом.
// gains: фіксовані бонуси й вади; picks/splits — додаткові вибори гравця.
window.VTM = window.VTM || {};

VTM.predators = [
  {
    id: 'sandman',
    name: 'Дрімко',
    icon: 'moon',
    short: 'Харчуєтеся зі сплячих жертв, часто проникаючи в житло.',
    specialties: [
      { skill: 'Медицина', spec: 'анестезіологія' },
      { skill: 'Непомітність', spec: 'проникнення' },
    ],
    disciplines: ['auspex', 'obfuscate'],
    gains: [
      { kind: 'background', name: 'Ресурси', dots: 1 },
    ],
    page: 177,
  },
  {
    id: 'consensualist',
    name: 'Консенсуаліст',
    icon: 'handshake',
    short: 'Берете кров лише за згодою жертви.',
    specialties: [
      { skill: 'Медицина', spec: 'флеботомія' },
      { skill: 'Переконливість', spec: 'жертви' },
    ],
    disciplines: ['auspex', 'fortitude'],
    humanity: 1,
    gains: [
      { kind: 'flaw', name: 'Темна таємниця (порушник Маскараду)', dots: 1 },
      { kind: 'flaw', name: 'Виняток зі здобичі (незгодні)', dots: 1 },
    ],
    page: 178,
  },
  {
    id: 'sceneQueen',
    name: 'Королева тусовки',
    icon: 'crown',
    short: 'Харчуєтеся з членів субкультури, у якій маєте високий статус.',
    specialties: [
      { skill: 'Етикет', spec: 'конкретна спільнота', custom: true },
      { skill: 'Лідерство', spec: 'конкретна спільнота', custom: true },
      { skill: 'Вуличний досвід', spec: 'конкретна спільнота', custom: true },
    ],
    disciplines: ['dominate', 'potence'],
    gains: [
      { kind: 'background', name: 'Слава', dots: 1 },
      { kind: 'background', name: 'Контакти', dots: 1 },
    ],
    picks: [
      {
        id: 'flaw',
        label: 'Вада на вибір',
        options: [
          { kind: 'flaw', name: 'Неприязнь (за межами вашої субкультури)', dots: 1 },
          { kind: 'flaw', name: 'Виняток зі здобичі (не ваша субкультура)', dots: 1 },
        ],
      },
    ],
    page: 178,
  },
  {
    id: 'osiris',
    name: 'Осіріс',
    icon: 'sun',
    short: 'Харчуєтеся з фанатів, членів культу чи іншої групи, що вас обожнює.',
    specialties: [
      { skill: 'Окультизм', spec: 'конкретна традиція', custom: true },
      { skill: 'Виступ', spec: 'конкретна сфера розваг', custom: true },
    ],
    disciplines: ['bloodSorcery', 'presence'],
    disciplineOnlyFor: { bloodSorcery: 'tremere' },
    gains: [],
    splits: [
      { id: 'backgrounds', label: 'Розподіліть 3 крапки', total: 3, kind: 'background', parts: ['Слава', 'Отара'] },
      { id: 'flaws', label: 'Розподіліть 2 крапки вад', total: 2, kind: 'flaw', parts: ['Мітичні вади', 'Ворог'] },
    ],
    page: 178,
  },
  {
    id: 'bagger',
    name: 'Пакетяр',
    icon: 'package',
    short: 'Дістаєте пакетовану або мертву кров замість полювання на живих.',
    specialties: [
      { skill: 'Крадійство', spec: 'відмикання замків' },
      { skill: 'Вуличний досвід', spec: 'чорний ринок' },
    ],
    disciplines: ['bloodSorcery', 'obfuscate'],
    disciplineOnlyFor: { bloodSorcery: 'tremere' },
    gains: [
      { kind: 'merit', name: 'Залізний шлунок', dots: 3 },
      { kind: 'flaw', name: 'Ворог', dots: 2 },
    ],
    page: 179,
  },
  {
    id: 'alleycat',
    name: 'Приблуда',
    icon: 'cat',
    short: 'Відбираєте кров силою або погрозами.',
    specialties: [
      { skill: 'Залякування', spec: 'пограбування' },
      { skill: 'Боротьба', spec: 'схоплення' },
    ],
    disciplines: ['celerity', 'potence'],
    humanity: -1,
    gains: [
      { kind: 'background', name: 'Контакти (кримінальні)', dots: 3 },
    ],
    page: 179,
  },
  {
    id: 'bloodLeech',
    name: 'П’явка',
    icon: 'droplets',
    short: 'Харчуєтеся з інших вампірів.',
    specialties: [
      { skill: 'Боротьба', spec: 'кревні' },
      { skill: 'Непомітність', spec: 'проти кревних' },
    ],
    disciplines: ['celerity', 'protean'],
    humanity: -1,
    bloodPotency: 1,
    gains: [
      { kind: 'flaw', name: 'Виняток зі здобичі (смертні)', dots: 2 },
    ],
    picks: [
      {
        id: 'flaw',
        label: 'Вада на вибір',
        options: [
          { kind: 'flaw', name: 'Темна таємниця (діаблерист)', dots: 2 },
          { kind: 'flaw', name: 'Вигнання', dots: 2 },
        ],
      },
    ],
    page: 179,
  },
  {
    id: 'siren',
    name: 'Сирена',
    icon: 'heart',
    short: 'Харчуєтеся під прикриттям сексу.',
    specialties: [
      { skill: 'Переконливість', spec: 'зваблення' },
      { skill: 'Хитрість', spec: 'зваблення' },
    ],
    disciplines: ['fortitude', 'presence'],
    gains: [
      // У книзі «Врода (••)», але Врода — це ••••; •• відповідає Привабливості
      { kind: 'merit', name: 'Зовнішність: Привабливість', dots: 2 },
      { kind: 'flaw', name: 'Ворог (знехтуваний коханець або ревнивий партнер)', dots: 1 },
    ],
    page: 179,
  },
  {
    id: 'farmer',
    name: 'Фермер',
    icon: 'rabbit',
    short: 'Харчуєтеся виключно з тварин.',
    specialties: [
      { skill: 'Розуміння тварин', spec: 'конкретний вид', custom: true },
      { skill: 'Виживання', spec: 'полювання' },
    ],
    disciplines: ['animalism', 'protean'],
    humanity: 1,
    gains: [
      { kind: 'flaw', name: 'Фермер', dots: 2 },
    ],
    maxBloodPotency: 2, // недоступно при Силі Крові 3+
    page: 180,
  },
  {
    id: 'cleaver',
    name: 'Щипач',
    icon: 'house',
    short: 'Потайки берете кров у своєї смертної рідні чи друзів.',
    specialties: [
      { skill: 'Переконливість', spec: 'газлайтинг' },
      { skill: 'Хитрість', spec: 'приховування правди' },
    ],
    disciplines: ['dominate', 'animalism'],
    gains: [
      { kind: 'flaw', name: 'Темна таємниця (щипач)', dots: 1 },
      { kind: 'background', name: 'Отара', dots: 2 },
    ],
    page: 180,
  },
  {
    // Рідкокровці й більшість дитят можуть ще не мати типу хижака (с. 151)
    id: 'undecided',
    name: 'Ще не визначився',
    icon: 'sprout',
    short: 'Новий кревний ще не знайшов свого способу полювання. Без бонусів і вад типу хижака.',
    specialties: [],
    disciplines: [],
    gains: [],
    onlyNewKindred: true,
    page: 151,
  },
];
