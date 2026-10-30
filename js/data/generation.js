// Вік, покоління та Сила Крові (базова книга, с. 141–142, 153 та 216–218 PDF).
window.VTM = window.VTM || {};

// Старійшини (9-те покоління й нижче) у базовій книзі недоступні гравцям
VTM.ages = [
  {
    id: 'childe',
    name: 'Дитя',
    icon: 'sprout',
    era: 'Залучені впродовж останніх 15 років',
    short: 'Пташенята, що ледь звикли до нежиття. Найближчі до смертного світу.',
    generations: [12, 13],
    thinBloodGenerations: [14, 15, 16],
    bloodPotency: 1,
    xp: 0,
    page: 142,
  },
  {
    id: 'neonate',
    name: 'Неонат',
    icon: 'moon-star',
    era: 'Залучені між 1940 і серединою 2010-х',
    short: 'Визнані кревні, які вже кілька десятиліть знають правила ночі.',
    generations: [12, 13],
    bloodPotency: 1,
    xp: 15,
    page: 142,
  },
  {
    id: 'ancilla',
    name: 'Анцила',
    icon: 'hourglass',
    era: 'Залучені між 1780 і 1940 роками',
    short: 'Досвідчені кревні між старійшинами й неонатами — посередники між двором і вулицею.',
    generations: [10, 11],
    bloodPotency: 2,
    xp: 35,
    advantages: 2,
    flaws: 2,
    humanity: -1,
    page: 142,
  },
];

// Мінімальна й максимальна Сила Крові за поколінням
VTM.generationLimits = {
  10: { min: 1, max: 4 }, 11: { min: 1, max: 4 },
  12: { min: 1, max: 3 }, 13: { min: 1, max: 3 },
  14: { min: 0, max: 0 }, 15: { min: 0, max: 0 }, 16: { min: 0, max: 0 },
};

// Ефекти Сили Крові 0–4 (таблиця, с. 218 PDF)
VTM.bloodPotency = [
  { surge: 1, mend: 1, bonus: 0, rouse: '—', bane: 0, feeding: '—' },
  { surge: 2, mend: 1, bonus: 0, rouse: '1-й рівень', bane: 2, feeding: '—' },
  { surge: 2, mend: 2, bonus: 1, rouse: '1-й рівень', bane: 2, feeding: 'Тваринна та пакетована кров утамовує вдвічі менше Голоду' },
  { surge: 3, mend: 2, bonus: 1, rouse: '2-й рівень і нижче', bane: 3, feeding: 'Тваринна та пакетована кров не втамовує Голод' },
  { surge: 3, mend: 3, bonus: 2, rouse: '2-й рівень і нижче', bane: 3, feeding: 'Тваринна та пакетована кров не втамовує Голод' },
];
