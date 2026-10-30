// Переваги й вади (базова книга, с. 181–196 PDF). Описи стислі, своїми словами за книгою.
// kind: merit (чеснота) | background (надбання) | flaw (вада) | tbMerit / tbFlaw (рідкокровців, без крапок).
// dots — дозволені рівні; multi — можна брати кілька разів; group — лише одна з групи;
// requires / excludes — залежності від інших записів (id); note — підказка для поля «уточнення».
window.VTM = window.VTM || {};

// Стартовий бюджет (с. 136): 7 крапок переваг і 2 крапки вад, анцили — ще по 2.
// Рідкокровці не беруть Мавлу, Послідовників і Статус під час створення (с. 151).
VTM.advantageBudget = { merits: 7, flaws: 2 };

VTM.advantages = [
  // ---------- Чесноти й вади ----------
  { id: 'linguistics', kind: 'merit', cat: 'Знання мов', name: 'Знання мов', dots: [1, 2, 3, 4, 5], short: 'Кожна крапка — ще одна мова, якою ви вільно говорите, читаєте й пишете.', note: 'Які мови?' },
  { id: 'illiterate', kind: 'flaw', cat: 'Знання мов', name: 'Неписьменність', dots: [2], short: 'Не вмієте читати й писати. Знання й Наука не вище 1.' },

  { id: 'beautiful', kind: 'merit', cat: 'Зовнішність', name: 'Привабливість', dots: [2], group: 'looks', short: '+1 кістка до відповідних соціальних наборів, коли вас видно.', forbidClans: ['nosferatu'] },
  { id: 'stunning', kind: 'merit', cat: 'Зовнішність', name: 'Врода', dots: [4], group: 'looks', short: '+2 кістки до відповідних соціальних наборів, коли вас видно.', forbidClans: ['nosferatu'] },
  { id: 'ugly', kind: 'flaw', cat: 'Зовнішність', name: 'Потворність', dots: [1], group: 'looks', short: '−1 кістка до відповідних соціальних наборів.' },
  { id: 'repulsive', kind: 'flaw', cat: 'Зовнішність', name: 'Відразливість', dots: [2], group: 'looks', short: '−2 кістки до відповідних соціальних наборів.' },

  { id: 'highFunctioning', kind: 'merit', cat: 'Вживання речовин', name: 'Ефективність попри залежність', dots: [1], short: '+1 кістка до обраного типу наборів, якщо остання жертва була під дією вашої речовини.', note: 'Яка речовина й тип наборів?' },
  { id: 'addiction', kind: 'flaw', cat: 'Вживання речовин', name: 'Залежність', dots: [1], group: 'addiction', short: '−1 кістка до всіх наборів, якщо остання жертва не була під дією речовини.', note: 'Яка речовина?' },
  { id: 'hopelessAddiction', kind: 'flaw', cat: 'Вживання речовин', name: 'Безнадійна залежність', dots: [2], group: 'addiction', short: '−2 кістки до всіх наборів, якщо остання жертва не була під дією речовини.', note: 'Яка речовина?' },

  { id: 'anachronism', kind: 'flaw', cat: 'Старизна', name: 'Застарілість', dots: [2], onlyAges: ['ancilla'], short: 'Не користуєтеся комп’ютерами й телефонами, Технології завжди 0.' },
  { id: 'livingInPast', kind: 'flaw', cat: 'Старизна', name: 'Життя в минулому', dots: [1], onlyAges: ['ancilla'], short: 'Маєте застаріле переконання. −1 кістка до соціальних наборів, пов’язаних із ним.' },

  { id: 'bondResistance', kind: 'merit', cat: 'Пута', name: 'Опір Путам', dots: [1, 2, 3], short: '+1 кістка за рівень до опору Кровним путам.' },
  { id: 'shortBond', kind: 'merit', cat: 'Пута', name: 'Короткотривалі Пута', dots: [2], short: 'Пута на вас слабшають кожні два тижні без оновлення.' },
  { id: 'unbondable', kind: 'merit', cat: 'Пута', name: 'Нескованість', dots: [5], short: 'На вас неможливо накласти Кровні пута.' },
  { id: 'bondslave', kind: 'flaw', cat: 'Пута', name: 'Раб Пут', dots: [2], short: 'Вас скуває одне вживання чужої віте, а не три.' },
  { id: 'bondJunkie', kind: 'flaw', cat: 'Пута', name: 'Насолода від Пут', dots: [1], short: '−1 кістка до всіх дій проти Кровних пут.' },
  { id: 'longBond', kind: 'flaw', cat: 'Пута', name: 'Довготривалі Пута', dots: [1], short: 'Пута на вас слабшають лише раз на три місяці.' },

  { id: 'bloodhound', kind: 'merit', cat: 'Харчування', name: 'Чуття крові', dots: [1], short: 'Відчуваєте Резонанс крові за запахом, не куштуючи її.' },
  { id: 'ironGullet', kind: 'merit', cat: 'Харчування', name: 'Залізний шлунок', dots: [3], short: 'Можете харчуватися холодною чи зіпсованою кров’ю (без Резонансу).', forbidClans: ['ventrue'] },
  { id: 'farmerFlaw', kind: 'flaw', cat: 'Харчування', name: 'Фермер', dots: [2], short: 'П’єте лише кров тварин. Людська кров коштує 2 очки сили волі.', forbidClans: ['ventrue'] },
  { id: 'organovore', kind: 'flaw', cat: 'Харчування', name: 'Органожер', dots: [2], short: 'Втамовуєте Голод лише людською плоттю й органами.' },
  { id: 'methuselahThirst', kind: 'flaw', cat: 'Харчування', name: 'Спрага мафусаїла', dots: [1], short: 'Повністю втамувати Голод можна лише кров’ю надприродних істот.' },
  { id: 'preyExclusion', kind: 'flaw', cat: 'Харчування', name: 'Виняток зі здобичі', dots: [1], multi: true, short: 'Не полюєте на певний тип здобичі; харчування нею дає Плями.', note: 'На кого не полюєте?' },

  { id: 'eatFood', kind: 'merit', cat: 'Мітичні', name: 'Вживання їжі', dots: [2], short: 'Можете їсти звичайну їжу (вона не живить, її треба позбутися до ранку).' },
  { id: 'stakeBait', kind: 'flaw', cat: 'Мітичні', name: 'Вразливість до кілків', dots: [2], short: 'Кілок у серці — остаточна смерть, а не заціпеніння.' },
  { id: 'folkloricBane', kind: 'flaw', cat: 'Мітичні', name: 'Народний засіб', dots: [1], multi: true, short: 'Важкі ушкодження від ультрафіолету, срібла чи святої води.', note: 'Який засіб?' },
  { id: 'folkloricBlock', kind: 'flaw', cat: 'Мітичні', name: 'Народна перешкода', dots: [1], multi: true, short: 'Мусите відступити чи витратити силу волі: святий символ, часник, поріг без запрошення…', note: 'Яка перешкода?' },
  { id: 'stigmata', kind: 'flaw', cat: 'Мітичні', name: 'Стигмати', dots: [1], short: 'При Голоді 4 на долонях, стопах і лобі відкриваються криваві рани.' },

  // ---------- Надбання ----------
  { id: 'influence', kind: 'background', cat: 'Вплив', name: 'Вплив', dots: [1, 2, 3, 4, 5], short: 'Політична сила серед смертних у певній групі чи районі міста.', note: 'Яка група чи район?' },
  { id: 'despised', kind: 'flaw', cat: 'Вплив', name: 'Ненависть', dots: [2], short: 'Група чи район міста активно вам заважає. −2 кістки до спроб здобути підтримку.' },
  { id: 'disliked', kind: 'flaw', cat: 'Вплив', name: 'Неприязнь', dots: [1], short: '−1 кістка до соціальних перевірок з групами міста, крім лояльних до вас.' },

  { id: 'contacts', kind: 'background', cat: 'Контакти', name: 'Контакти', dots: [1, 2, 3], multi: true, short: 'Смертний, що добуває інформацію чи речі: від дилера (•) до лейтенанта поліції (•••).', note: 'Хто це?' },

  { id: 'mawla', kind: 'background', cat: 'Мавла', name: 'Мавла', dots: [1, 2, 3, 4, 5], multi: true, short: 'Кревний-покровитель: від неоната (•) до Принца чи Барона (•••••).', note: 'Хто це?', forbidClans: ['thinblood'] },
  { id: 'adversary', kind: 'flaw', cat: 'Мавла', name: 'Суперник', dots: [1, 2, 3], multi: true, short: 'Кревний, що бажає зла вам, вашому сіру чи наставнику.', note: 'Хто це?' },

  { id: 'mask', kind: 'background', cat: 'Маска', name: 'Маска', dots: [1, 2], short: 'Фальшива особистість із документами: • — перевірка рівня штату, •• — національна.' },
  { id: 'zeroed', kind: 'background', cat: 'Маска', name: 'Обнулення', dots: [1], requires: { id: 'mask', dots: 2 }, short: 'Усі ваші реальні дані стерто — офіційно вас не існує.' },
  { id: 'cobbler', kind: 'background', cat: 'Маска', name: 'Підробник', dots: [1], requires: { id: 'mask', dots: 2 }, short: 'Можете створювати чи діставати Маски для інших.' },
  { id: 'knownCorpse', kind: 'flaw', cat: 'Маска', name: 'Встановлений мрець', dots: [1], short: 'Усі знають, що ви нещодавно загинули.' },
  { id: 'knownBlankbody', kind: 'flaw', cat: 'Маска', name: 'Встановлений порожньотілий', dots: [2], short: 'Ви в базах розвідок як потенційний терорист; інквізитори зрозуміють, хто ви.' },

  { id: 'herd', kind: 'background', cat: 'Отара', name: 'Отара', dots: [1, 2, 3, 4, 5], short: 'Група вмістилищ: щотижня без кидка втамовує Голод на значення надбання.', note: 'Хто ці люди?' },
  { id: 'obviousPredator', kind: 'flaw', cat: 'Отара', name: 'Явний хижак', dots: [2], excludes: ['herd'], short: 'Люди інстинктивно вас бояться. −2 кістки до полювання; не можете мати Отару.' },

  { id: 'retainers', kind: 'background', cat: 'Послідовники', name: 'Послідовники', dots: [1, 2, 3], multi: true, short: 'Віддані слуги: від фаната (•) до компетентного гуля (•••).', note: 'Хто це?', forbidClans: ['thinblood'] },
  { id: 'stalkers', kind: 'flaw', cat: 'Послідовники', name: 'Переслідувачі', dots: [1], short: 'Вас постійно переслідують надто віддані шанувальники.' },

  { id: 'haven', kind: 'background', cat: 'Прихисток', name: 'Прихисток', dots: [1, 2, 3], short: 'Безпечне місце для денного сну: від склепу (•) до станції метро (•••).', note: 'Що це за місце?' },
  { id: 'havenWards', kind: 'background', cat: 'Прихисток', name: 'Бар’єр', dots: [1, 2, 3], requires: { id: 'haven' }, short: 'Магічний захист: +1 кістка за крапку до опору надприродному стеженню.' },
  { id: 'havenLibrary', kind: 'background', cat: 'Прихисток', name: 'Бібліотека', dots: [1, 2, 3], requires: { id: 'haven' }, short: '+1 кістка за крапку до досліджень в одній спеціалізації.' },
  { id: 'havenGuards', kind: 'background', cat: 'Прихисток', name: 'Вартові', dots: [1, 2, 3], requires: { id: 'haven' }, short: 'За крапку — 4 охоронці й 1 талановитий лідер.' },
  { id: 'havenCell', kind: 'background', cat: 'Прихисток', name: 'Камера', dots: [1, 2, 3], requires: { id: 'haven', dots: 2 }, short: 'Замкнене приміщення для в’язнів (не для маленьких прихистків).' },
  { id: 'havenLab', kind: 'background', cat: 'Прихисток', name: 'Лабораторія', dots: [1, 2, 3], requires: { id: 'haven', dots: 2 }, short: '+1 кістка за крапку до однієї спеціалізації науки чи технологій.' },
  { id: 'havenSurgery', kind: 'background', cat: 'Прихисток', name: 'Операційна', dots: [1], requires: { id: 'haven', dots: 2 }, short: '+2 кістки до медицини в прихистку.' },
  { id: 'havenArmory', kind: 'background', cat: 'Прихисток', name: 'Прихований арсенал', dots: [1, 2, 3], requires: { id: 'haven' }, short: 'За крапку — стійка з пістолетом, довгоствольною зброєю й набоями.' },
  { id: 'havenLuxury', kind: 'background', cat: 'Прихисток', name: 'Розкіш', dots: [1], requires: { id: 'haven' }, short: '+2 кістки до соціальних перевірок зі смертними гостями.' },
  { id: 'havenLocation', kind: 'background', cat: 'Прихисток', name: 'Розташування', dots: [1], requires: { id: 'haven' }, short: 'Престижний чи вигідний район: +2 кістки до пов’язаних кидків.' },
  { id: 'havenSecurity', kind: 'background', cat: 'Прихисток', name: 'Система охорони', dots: [1, 2, 3], requires: { id: 'haven' }, short: '+1 кістка за крапку до опору проникненню.' },
  { id: 'havenExit', kind: 'background', cat: 'Прихисток', name: 'Таємний вхід', dots: [1, 2, 3], requires: { id: 'haven' }, short: 'Прихований вихід: +1 кістка за крапку до спроб утекти непоміченим.' },
  { id: 'noHaven', kind: 'flaw', cat: 'Прихисток', name: 'Без прихистку', dots: [1], excludes: ['haven'], short: 'Щоранку доводиться шукати нове місце для денного сну.' },
  { id: 'havenCompromised', kind: 'flaw', cat: 'Прихисток', name: 'Скомпрометований', dots: [2], requires: { id: 'haven' }, short: 'Прихисток уже під наглядом: нападники отримують +2 кістки.' },
  { id: 'havenCreepy', kind: 'flaw', cat: 'Прихисток', name: 'Моторошний', dots: [1], requires: { id: 'haven' }, short: 'Схожий на лігво маніяка: −2 кістки, щоб заспокоїти смертних гостей.' },
  { id: 'havenHaunted', kind: 'flaw', cat: 'Прихисток', name: 'Дім із привидами', dots: [1, 2, 3], requires: { id: 'haven' }, short: 'У прихистку діє незрозуміла надприродна сила.' },

  { id: 'resources', kind: 'background', cat: 'Ресурси', name: 'Ресурси', dots: [1, 2, 3, 4, 5], short: 'Статки: від життя від зарплати до зарплати (•) до еліти (•••••).', note: 'Звідки гроші?' },
  { id: 'destitute', kind: 'flaw', cat: 'Ресурси', name: 'Злидар', dots: [1], excludes: ['resources'], short: 'Немає ані грошей, ані житла.' },

  { id: 'fame', kind: 'background', cat: 'Слава', name: 'Слава', dots: [1, 2, 3, 4, 5], short: 'Вас знають смертні: від субкультури (•) до світової зірки (•••••).', note: 'Чим ви відомі?' },
  { id: 'infamy', kind: 'flaw', cat: 'Слава', name: 'Лиха слава', dots: [1, 2, 3, 4, 5], short: 'Ви відомі чимось жахливим; реакція оточення гірша на рівень вади.' },
  { id: 'darkSecret', kind: 'flaw', cat: 'Слава', name: 'Темна таємниця', dots: [1, 2], multi: true, short: 'Таємниця, що знищить вас, якщо розкриється: борги (•), кровне полювання (••)…', note: 'Яка таємниця?' },

  { id: 'allies', kind: 'background', cat: 'Союзники', name: 'Союзники', dots: [2, 3, 4, 5, 6], multi: true, short: 'Смертні, що допомагають вам. Вартість = ефективність + надійність.', note: 'Хто це?' },
  { id: 'enemy', kind: 'flaw', cat: 'Союзники', name: 'Ворог', dots: [1, 2], multi: true, short: 'Смертні, що діють проти вас. Рівень на 2 менший за їхню силу.', note: 'Хто це?' },

  { id: 'status', kind: 'background', cat: 'Статус', name: 'Статус', dots: [1, 2, 3, 4, 5], short: 'Положення серед кревних секти: від визнаного неоната (•) до прімогена (•••••).', note: 'У якій секті?', forbidClans: ['caitiff', 'thinblood'] },
  { id: 'shunned', kind: 'flaw', cat: 'Статус', name: 'Вигнання', dots: [2], multi: true, short: 'Секта вас геть не приймає й діятиме проти вас.', note: 'Яка секта?' },
  { id: 'suspect', kind: 'flaw', cat: 'Статус', name: 'Недовіра', dots: [1], multi: true, short: '−2 кістки до соціальних перевірок з ображеною сектою.', note: 'Яка секта?' },

  // ---------- Рідкокровців (без крапок, с. 184–186) ----------
  { id: 'babyTeeth', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Молочні зуби', short: 'Ікол немає: кров доводиться добувати ножем чи шприцом.' },
  { id: 'bestialTemper', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Звіриний норов', short: 'Звір сильний, як у повноцінного вампіра: перевірки шаленства за звичайними правилами.' },
  { id: 'branded', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Тавро Камарильї', short: 'Незагойне тавро; Камарилья пильно стежить за вами.' },
  { id: 'clanCurse', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Кланове прокляття', short: 'Маєте прокляття клану сіра зі згубністю 1.', note: 'Чиє прокляття?' },
  { id: 'deadFlesh', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Мертва плоть', excludes: ['lifelike'], short: 'Плоть розкладається: −1 кістка до соціальних перевірок зі смертними.' },
  { id: 'mortalFrailty', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Кволість смертного', excludes: ['vampiricResilience'], short: 'Не зцілюєтеся Кров’ю — лише як смертні.' },
  { id: 'anarchShame', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Зневага анархів', excludes: ['anarchComrades'], short: 'Анархи вас знають і не люблять.' },
  { id: 'vitaeDependency', kind: 'tbFlaw', cat: 'Вади рідкокровців', name: 'Залежність від віте', short: 'Без щотижневої вампірської Крові втрачаєте дисципліни.' },
  { id: 'anarchComrades', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Товариші-анархи', short: 'Котерія анархів опікується вами — як однокрапковий мавла.' },
  { id: 'camarillaContact', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Контакт із Камарильї', requires: { id: 'branded' }, short: 'Рекрутер Камарильї — як однокрапковий мавла, що ставиться до вас погано.' },
  { id: 'catenatingBlood', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Чіпка Кров', short: 'Можете створювати Кровні пута й Залучати, як звичайні вампіри.' },
  { id: 'dayDrinker', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Денний мисливець', short: 'Сонце лише вдвічі зменшує здоров’я й забирає вампірські вміння.' },
  { id: 'disciplineAffinity', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Талант до дисципліни', short: '1 крапка в обраній дисципліні з розвитком як у позакланової.', note: 'Яка дисципліна?' },
  { id: 'lifelike', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Немов живий', short: 'Серцебиття, їжа, секс — як у смертного.' },
  { id: 'thinBloodAlchemist', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Рідкокровець-алхімік', short: '1 крапка й один рецепт Алхімії рідкокровців.' },
  { id: 'vampiricResilience', kind: 'tbMerit', cat: 'Чесноти рідкокровців', name: 'Вампірична непохитність', short: 'Ушкодження як у звичайного вампіра.' },
];
