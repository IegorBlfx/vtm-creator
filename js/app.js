(function () {
  'use strict';

  const STORAGE_KEY = 'vtm5-character-v1';
  const BASE_HUMANITY = 7;
  // Якщо всі гравці — дитята, Оповідач може дозволити старт із Людяністю 8 (с. 151)
  const baseHumanity = () => BASE_HUMANITY + (state.age === 'childe' && state.humanity8 ? 1 : 0);

  const clanById = (id) => VTM.clans.find((c) => c.id === id) || null;
  const ageById = (id) => VTM.ages.find((a) => a.id === id) || null;
  const predById = (id) => VTM.predators.find((p) => p.id === id) || null;
  const discName = (id) => (VTM.disciplines[id] ? VTM.disciplines[id].name : id);

  // ---------- Стан ----------

  const emptyPredatorChoices = () => ({ specialty: null, specialtyDetail: '', discipline: null, picks: {}, splits: {} });
  const emptyConcept = () => ({ name: '', concept: '', chronicle: '', sire: '', ambition: '', desire: '', notes: '' });
  const emptyState = () => ({
    step: 0, clan: null, age: null, generation: null, predator: null, pred: emptyPredatorChoices(),
    concept: emptyConcept(), attrs: {},
    skillDist: null, skills: {}, specs: { auto: {}, freeSkill: null, freeText: '' },
    discDots: {}, powers: {}, ritual: null,
    advs: [], advTab: 'background',
    views: [{ uid: 'v1', conviction: '', touchstone: '', touchstoneWho: '' }],
    xp: emptyXp(),
    story: emptyStory(), humanity8: false,
  });
  // Зв'язки та історія (с. 136, 142–153): мапа зв'язків, Маска, секта, уточнення клану
  function emptyStory() {
    return {
      sect: '', sectOther: '', maskName: '', kindredName: '', nightJob: '',
      sire: { name: '', clan: '', year: '', position: '', embrace: '' },
      sectNpcs: [{ name: '', clan: '', year: '', position: '', relation: '' }, { name: '', clan: '', year: '', position: '', relation: '' }],
      coterie: [{ name: '', relation: '' }, { name: '', relation: '' }],
      people: {}, ventruePrey: '', malkDisorder: '', malkCategory: '', appearance: '', quirks: '',
    };
  }
  // Покупки за досвід зберігаємо окремо від стартового розподілу
  function emptyXp() {
    return { attrs: {}, skills: {}, discs: {}, powers: {}, specs: [], advs: [], bp: 0, rituals: [] };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') return Object.assign(emptyState(), saved);
    } catch (e) { /* немає сховища — працюємо без нього */ }
    return emptyState();
  }

  let state = loadState();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  // render: false — для полів вводу, щоб не втрачати фокус
  function update(patch, opts) {
    state = Object.assign({}, state, patch);
    save();
    if (opts && opts.render === false) renderChrome();
    else render();
  }

  // ---------- Правила ----------

  const isThinBlood = (clan) => !!clan && clan.id === 'thinblood';

  function generationOptions(age, clan) {
    return isThinBlood(clan) ? age.thinBloodGenerations || [] : age.generations;
  }

  function ageAvailability(age, clan) {
    if (isThinBlood(clan) && !age.thinBloodGenerations) return { ok: false, reason: 'Рідкокровці можуть бути лише дитятами' };
    return { ok: true };
  }

  function baseBloodPotency() {
    const age = ageById(state.age);
    if (!age) return null;
    return isThinBlood(clanById(state.clan)) ? 0 : age.bloodPotency;
  }

  // Сила Крові з урахуванням типу хижака, але не вище максимуму покоління
  function finalBloodPotency() {
    const base = baseBloodPotency();
    if (base == null) return null;
    const pred = predById(state.predator);
    const limits = VTM.generationLimits[state.generation] || { max: base };
    return Math.min(base + ((pred && pred.bloodPotency) || 0), limits.max);
  }

  function predatorAvailability(pred, clan) {
    if (clan && clan.forbiddenPredators && clan.forbiddenPredators.includes(pred.id)) {
      return { ok: false, reason: `Недоступно для клану ${clan.name}` };
    }
    if (pred.onlyNewKindred && state.age !== 'childe' && !isThinBlood(clan)) {
      return { ok: false, reason: 'Лише для дитят і рідкокровців' };
    }
    const bp = baseBloodPotency();
    if (pred.maxBloodPotency != null && bp != null && bp > pred.maxBloodPotency) {
      return { ok: false, reason: `Недоступно при Силі Крові ${pred.maxBloodPotency + 1}+` };
    }
    return { ok: true };
  }

  function disciplineAllowed(pred, discId, clan) {
    const only = pred.disciplineOnlyFor && pred.disciplineOnlyFor[discId];
    return !only || (clan && clan.id === only);
  }

  function generationMissing() {
    const age = ageById(state.age);
    if (!age) return 'Оберіть вік';
    if (!generationOptions(age, clanById(state.clan)).includes(state.generation)) return 'Оберіть покоління';
    return null;
  }

  function predatorMissing() {
    const pred = predById(state.predator);
    if (!pred) return 'Оберіть тип хижака';
    if (!predatorAvailability(pred, clanById(state.clan)).ok) return 'Оберіть інший тип хижака';
    const c = state.pred;
    if (pred.specialties.length && c.specialty == null) return 'Оберіть спеціалізацію';
    const spec = pred.specialties[c.specialty];
    if (spec && spec.custom && !c.specialtyDetail.trim()) return 'Уточніть спеціалізацію';
    if (pred.disciplines.length && !c.discipline) return 'Оберіть дисципліну';
    for (const pick of pred.picks || []) {
      if (c.picks[pick.id] == null) return pick.label;
    }
    for (const split of pred.splits || []) {
      const vals = c.splits[split.id] || [];
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum !== split.total) return `${split.label} (${sum}/${split.total})`;
    }
    return null;
  }

  function conceptMissing() {
    if (!state.concept.name.trim()) return 'Вкажіть ім’я';
    if (!state.concept.concept.trim()) return 'Опишіть концепт';
    return null;
  }

  const attrValue = (id) => state.attrs[id] || 0;

  // Скільки характеристик уже має кожне значення: { 4: n, 3: n, ... }
  function attributeCounts() {
    const counts = {};
    Object.keys(VTM.attributeDistribution).forEach((v) => { counts[v] = 0; });
    VTM.attributes.forEach((a) => { if (attrValue(a.id)) counts[attrValue(a.id)]++; });
    return counts;
  }

  function attributesMissing() {
    const left = VTM.attributes.filter((a) => !attrValue(a.id)).length;
    return left ? `Розподіліть ще ${left} ${plural(left, 'характеристику', 'характеристики', 'характеристик')}` : null;
  }

  const skillById = (id) => VTM.skills.find((s) => s.id === id) || null;
  const skillByName = (name) => VTM.skills.find((s) => s.name === name) || null;
  const distById = (id) => VTM.skillDistributions.find((d) => d.id === id) || null;
  const skillValue = (id) => state.skills[id] || 0;

  function skillCounts(dist) {
    const counts = {};
    Object.keys(dist.counts).forEach((v) => { counts[v] = 0; });
    VTM.skills.forEach((s) => { if (skillValue(s.id)) counts[skillValue(s.id)]++; });
    return counts;
  }

  // Спеціалізація від типу хижака у вигляді { skill, text }
  function predatorSpecialty() {
    const pred = predById(state.predator);
    const spec = pred && pred.specialties[state.pred.specialty];
    if (!spec) return null;
    const skill = skillByName(spec.skill);
    return skill ? { skill: skill.id, text: spec.custom ? state.pred.specialtyDetail.trim() : spec.spec } : null;
  }

  // Немає крапок у навичці спеціалізації типу хижака — натомість +1 крапка в цій навичці (с. 151)
  function predatorBonusSkill() {
    const ps = predatorSpecialty();
    return ps && state.skillDist && !skillValue(ps.skill) ? ps.skill : null;
  }

  // Навичка після стартового розподілу з урахуванням крапки від типу хижака
  const skillBase = (id) => skillValue(id) + (predatorBonusSkill() === id ? 1 : 0);

  // Усі спеціалізації персонажа: від типу хижака, безплатні за навички й одна на вибір
  function specialtyList(withXp) {
    const list = [];
    const ps = predatorSpecialty();
    if (ps && skillValue(ps.skill)) list.push(Object.assign({ source: 'predator' }, ps));
    VTM.freeSpecialtySkills.forEach((id) => {
      if (skillValue(id)) list.push({ source: 'auto', skill: id, text: (state.specs.auto[id] || '').trim() });
    });
    if (state.specs.freeSkill) list.push({ source: 'free', skill: state.specs.freeSkill, text: state.specs.freeText.trim() });
    if (withXp) state.xp.specs.forEach((s) => { if (s.skill) list.push({ source: 'xp', skill: s.skill, text: s.text.trim() }); });
    return list;
  }

  function skillsMissing() {
    const dist = distById(state.skillDist);
    if (!dist) return 'Оберіть розподіл навичок';
    const total = Object.values(dist.counts).reduce((a, b) => a + b, 0);
    const assigned = VTM.skills.filter((s) => skillValue(s.id)).length;
    if (assigned < total) {
      const left = total - assigned;
      return `Розподіліть ще ${left} ${plural(left, 'навичку', 'навички', 'навичок')}`;
    }
    const specs = specialtyList();
    const emptyAuto = specs.find((s) => s.source === 'auto' && !s.text);
    if (emptyAuto) return `Вкажіть безплатну спеціалізацію: ${skillById(emptyAuto.skill).name}`;
    const free = specs.find((s) => s.source === 'free');
    if (!free || !skillValue(free.skill) || !free.text) return 'Оберіть безплатну спеціалізацію';
    const over = VTM.skills.find((s) => !VTM.unlimitedSpecialtySkills.includes(s.id)
      && specs.filter((x) => x.skill === s.id).length > skillValue(s.id));
    if (over) return `Забагато спеціалізацій у навичці ${over.name} (не більше, ніж крапок)`;
    return null;
  }

  // ---------- Правила дисциплін ----------

  const powerById = (id) => VTM.powers.find((p) => p.id === id) || null;
  const ritualById = (id) => VTM.rituals.find((r) => r.id === id) || null;

  // Дисципліни, з яких можна розподіляти стартові крапки
  function creationDisciplines(clan) {
    if (!clan || isThinBlood(clan)) return [];
    if (clan.anyDisciplines) return Object.keys(VTM.disciplines).filter((d) => d !== 'thinBloodAlchemy');
    return clan.disciplines;
  }

  // Підсумкові крапки: стартові + 1 від типу хижака
  function disciplineDots(id) {
    const extra = state.pred.discipline === id && !isThinBlood(clanById(state.clan)) ? 1 : 0;
    return (state.discDots[id] || 0) + extra;
  }

  function ownedDisciplines() {
    return Object.keys(VTM.disciplines).filter((d) => disciplineDots(d) > 0);
  }

  const chosenPowers = (disc) => state.powers[disc] || [];

  // За k-ту крапку можна взяти силу рівня не вище k
  function powerLevelsValid(levels) {
    return levels.slice().sort((a, b) => a - b).every((lvl, i) => lvl <= i + 1);
  }

  // Чому силу не можна взяти (або null, якщо можна)
  function powerBlocker(power) {
    if (power.amalgam && disciplineDots(power.amalgam.discipline) < power.amalgam.level) {
      return `Потрібно: ${discName(power.amalgam.discipline)} ${power.amalgam.level}`;
    }
    if (power.requires && !chosenPowers(power.discipline).includes(power.requires)) {
      return `Потрібна сила «${powerById(power.requires).name}»`;
    }
    return null;
  }

  function disciplinesMissing() {
    const clan = clanById(state.clan);
    if (isThinBlood(clan)) return null;
    const vals = Object.values(state.discDots);
    if (!vals.includes(2) || !vals.includes(1)) return 'Розподіліть крапки: одна дисципліна ●●, інша ●';
    for (const d of ownedDisciplines()) {
      const chosen = chosenPowers(d);
      const dots = disciplineDots(d);
      if (chosen.length !== dots) return `Оберіть сили: ${discName(d)} (${chosen.length}/${dots})`;
      if (!powerLevelsValid(chosen.map((id) => powerById(id).level))) return `${discName(d)}: потрібна сила нижчого рівня`;
      const blocked = chosen.map(powerById).find((p) => powerBlocker(p));
      if (blocked) return `${blocked.name}: ${powerBlocker(blocked).toLowerCase()}`;
    }
    if (disciplineDots('bloodSorcery') && !state.ritual) return 'Оберіть ритуал Чарів Крові';
    return null;
  }

  // ---------- Правила переваг і вад ----------

  const advById = (id) => VTM.advantages.find((a) => a.id === id) || null;
  const advByName = (name) => {
    const base = name.replace(/^Зовнішність:\s*/, '').split(' (')[0].trim();
    return VTM.advantages.find((a) => a.name === base) || null;
  };
  const isMeritKind = (kind) => kind === 'merit' || kind === 'background';

  // Те, що персонаж отримує без вибору: від типу хижака й клану. У бюджет не входить.
  function autoAdvantages() {
    const list = [];
    const r = predatorResult();
    if (r) r.items.forEach((it) => list.push(Object.assign({ source: `тип хижака · ${r.pred.name}`, adv: advByName(it.name) }, it)));
    const clan = clanById(state.clan);
    if (clan && clan.id === 'caitiff') list.push({ kind: 'flaw', name: 'Недовіра', dots: 1, source: 'клан · Каїтифи', adv: advById('suspect') });
    if (clan && clan.id === 'nosferatu') list.push({ kind: 'flaw', name: 'Відразливість', dots: 2, source: 'прокляття Носферату', adv: advById('repulsive') });
    return list;
  }

  function advantageBudget() {
    const age = ageById(state.age) || {};
    return { merits: VTM.advantageBudget.merits + (age.advantages || 0), flaws: VTM.advantageBudget.flaws + (age.flaws || 0) };
  }

  function advantageSpent() {
    const spent = { merits: 0, flaws: 0, tbMerits: 0, tbFlaws: 0 };
    state.advs.forEach((x) => {
      const a = advById(x.id);
      if (isMeritKind(a.kind)) spent.merits += x.dots;
      else if (a.kind === 'flaw') spent.flaws += x.dots;
      else if (a.kind === 'tbMerit') spent.tbMerits++;
      else spent.tbFlaws++;
    });
    return spent;
  }

  // Найвищий рівень запису серед обраного й автоматичного (0 — немає)
  function ownedDots(id, ignoreUid, withXp) {
    let best = 0;
    const own = withXp ? state.advs.concat(state.xp.advs) : state.advs;
    own.forEach((x) => { if (x.id === id && x.uid !== ignoreUid) best = Math.max(best, x.dots || 1); });
    autoAdvantages().forEach((x) => { if (x.adv && x.adv.id === id) best = Math.max(best, x.dots || 1); });
    return best;
  }

  // Чому запис не можна взяти (або null). ignoreUid — для перевірки вже взятого
  function advBlocker(a, ignoreUid, withXp) {
    const clan = clanById(state.clan);
    if ((a.kind === 'tbMerit' || a.kind === 'tbFlaw') && !isThinBlood(clan)) return 'Лише для рідкокровців';
    if (a.forbidClans && clan && a.forbidClans.includes(clan.id)) return `Недоступно для клану ${clan.name}`;
    if (a.onlyAges && !a.onlyAges.includes(state.age)) return 'Лише для анцил і старших';
    if (a.requires && ownedDots(a.requires.id, ignoreUid, withXp) < (a.requires.dots || 1)) {
      const req = advById(a.requires.id);
      return `Потрібно: ${req.name}${a.requires.dots ? ' ' + dots(a.requires.dots) : ''}`;
    }
    const conflict = VTM.advantages.find((o) => o.id !== a.id && ownedDots(o.id, ignoreUid, withXp)
      && ((a.excludes || []).includes(o.id) || (o.excludes || []).includes(a.id) || (a.group && o.group === a.group)));
    if (conflict) return `Несумісно з «${conflict.name}»`;
    return null;
  }

  function advantagesMissing() {
    const budget = advantageBudget();
    const spent = advantageSpent();
    if (spent.merits !== budget.merits) return `Переваги: ${spent.merits} / ${budget.merits} крапок`;
    if (spent.flaws !== budget.flaws) return `Вади: ${spent.flaws} / ${budget.flaws} крапок`;
    if (isThinBlood(clanById(state.clan))) {
      if (spent.tbMerits < 1 || spent.tbMerits > 3) return 'Оберіть 1–3 чесноти рідкокровців';
      if (spent.tbFlaws !== spent.tbMerits) return `Вад рідкокровців має бути стільки ж, скільки чеснот (${spent.tbFlaws}/${spent.tbMerits})`;
    }
    const broken = state.advs.find((x) => advBlocker(advById(x.id), x.uid));
    if (broken) return `${advById(broken.id).name}: ${advBlocker(advById(broken.id), broken.uid).toLowerCase()}`;
    return null;
  }

  // ---------- Правила досвіду (таблиця вартості, с. 153 PDF) ----------

  const xpAvailable = () => (ageById(state.age) || {}).xp || 0;
  const finalAttr = (id) => attrValue(id) + (state.xp.attrs[id] || 0);
  const finalSkill = (id) => skillBase(id) + (state.xp.skills[id] || 0);
  const totalDisciplineDots = (id) => disciplineDots(id) + (state.xp.discs[id] || 0);
  const xpPowers = (d) => state.xp.powers[d] || [];
  const allPowers = (d) => (disciplineDots(d) ? chosenPowers(d) : []).concat(xpPowers(d));
  const characterBloodPotency = () => finalBloodPotency() + (state.xp.bp || 0);

  // Вартість підвищення з from на from+extra: сума «новий рівень × множник»
  function ladderCost(from, extra, mult) {
    let cost = 0;
    for (let lvl = from + 1; lvl <= from + extra; lvl++) cost += lvl * mult;
    return cost;
  }

  // Кланова × 5, каїтифська × 6, позакланова × 7
  function disciplineXpRate(d) {
    const clan = clanById(state.clan);
    if (clan.anyDisciplines) return 6;
    return clan.disciplines.includes(d) ? 5 : 7;
  }

  // Дисципліни, які можна купувати за досвід (Чари Крові — лише Тремі й каїтифи)
  function xpDisciplineOptions() {
    const clan = clanById(state.clan);
    if (!clan || isThinBlood(clan)) return [];
    return Object.keys(VTM.disciplines).filter((d) => d !== 'thinBloodAlchemy'
      && (d !== 'bloodSorcery' || clan.id === 'tremere' || clan.anyDisciplines));
  }

  function xpSpent() {
    const x = state.xp;
    let total = 0;
    Object.keys(x.attrs).forEach((id) => { total += ladderCost(attrValue(id), x.attrs[id], 5); });
    Object.keys(x.skills).forEach((id) => { total += ladderCost(skillBase(id), x.skills[id], 3); });
    Object.keys(x.discs).forEach((d) => { total += ladderCost(disciplineDots(d), x.discs[d], disciplineXpRate(d)); });
    total += x.specs.length * 3;
    total += x.advs.reduce((sum, a) => sum + a.dots * 3, 0);
    total += ladderCost(finalBloodPotency(), x.bp || 0, 10);
    total += x.rituals.reduce((sum, id) => sum + ritualById(id).level * 3, 0);
    return total;
  }

  function xpPowerBlocker(power, d) {
    if (power.amalgam && totalDisciplineDots(power.amalgam.discipline) < power.amalgam.level) {
      return `Потрібно: ${discName(power.amalgam.discipline)} ${power.amalgam.level}`;
    }
    if (power.requires && !allPowers(d).includes(power.requires)) return `Потрібна сила «${powerById(power.requires).name}»`;
    return null;
  }

  function xpMissing() {
    const available = xpAvailable();
    if (!available) return null;
    const spent = xpSpent();
    if (spent > available) return `Перевитрата досвіду: ${spent} / ${available}`;
    for (const d of Object.keys(state.xp.discs)) {
      const list = allPowers(d);
      const need = totalDisciplineDots(d);
      if (list.length !== need) return `Оберіть нові сили: ${discName(d)} (${list.length}/${need})`;
      if (!powerLevelsValid(list.map((id) => powerById(id).level))) return `${discName(d)}: потрібна сила нижчого рівня`;
      const blocked = xpPowers(d).map(powerById).find((p) => xpPowerBlocker(p, d));
      if (blocked) return `${blocked.name}: ${xpPowerBlocker(blocked, d).toLowerCase()}`;
    }
    const badSpec = state.xp.specs.find((s) => !s.skill || !s.text.trim());
    if (badSpec) return 'Заповніть спеціалізацію, куплену за досвід';
    const specs = specialtyList(true);
    const over = VTM.skills.find((s) => !VTM.unlimitedSpecialtySkills.includes(s.id)
      && specs.filter((x) => x.skill === s.id).length > finalSkill(s.id));
    if (over) return `Забагато спеціалізацій у навичці ${over.name}`;
    const badAdv = state.xp.advs.find((x) => advBlocker(advById(x.id), x.uid, true));
    if (badAdv) return `${advById(badAdv.id).name}: ${advBlocker(advById(badAdv.id), badAdv.uid, true).toLowerCase()}`;
    const badRitual = state.xp.rituals.find((id) => ritualById(id).level > totalDisciplineDots('bloodSorcery'));
    if (badRitual) return `Ритуал «${ritualById(badRitual).name}» вищий за рівень Чарів Крові`;
    return null;
  }

  // ---------- Правила зв'язків ----------

  const SECTS = [
    { id: 'camarilla', name: 'Камарилья' },
    { id: 'anarchs', name: 'Рух анархів' },
    { id: 'autarkis', name: 'Автарк (вольний)' },
    { id: 'other', name: 'Інше' },
  ];
  const sectName = () => {
    const sect = SECTS.find((x) => x.id === state.story.sect);
    if (!sect) return '';
    return sect.id === 'other' ? state.story.sectOther.trim() : sect.name;
  };

  // Переваги й вади, за якими стоять конкретні люди: їх треба внести на мапу зв'язків (с. 137, 151)
  const PEOPLE_ADVS = {
    contacts: { label: 'контакт' },
    allies: { label: 'союзник' },
    retainers: { label: 'послідовник' },
    herd: { label: 'отара' },
    enemy: { label: 'ворог' },
    mawla: { label: 'мавла', kin: true },
    adversary: { label: 'суперник', kin: true },
    anarchComrades: { label: 'товариші-анархи', kin: true },
    camarillaContact: { label: 'рекрутер Камарильї', kin: true },
  };

  function peopleList() {
    const list = [];
    state.advs.concat(state.xp.advs).forEach((x) => {
      const meta = PEOPLE_ADVS[x.id];
      if (meta) list.push({ key: x.uid, uid: x.uid, title: advById(x.id).name, dots: x.dots, name: (x.note || '').trim(), kin: !!meta.kin, label: meta.label });
    });
    autoAdvantages().forEach((x, i) => {
      const meta = x.adv && PEOPLE_ADVS[x.adv.id];
      if (!meta) return;
      const key = `auto-${i}-${x.adv.id}`;
      list.push({ key, auto: true, title: x.name, source: x.source, dots: x.dots, name: (state.story.people[key] || '').trim(), kin: !!meta.kin, label: meta.label });
    });
    return list;
  }

  function storyMissing() {
    const st = state.story;
    if (!st.sect || (st.sect === 'other' && !st.sectOther.trim())) return 'Оберіть секту';
    if (!st.sire.name.trim()) return 'Вкажіть сіра';
    if (!st.sire.embrace.trim()) return 'Опишіть обставини Залучення';
    // Зв'язки в секті має кожен, крім наймолодших дитят (с. 146)
    if (state.age !== 'childe') {
      const idx = st.sectNpcs.findIndex((n) => !n.name.trim() || !n.relation.trim());
      if (idx !== -1) return `Вампір секти ${idx + 1}: ${st.sectNpcs[idx].name.trim() ? 'опишіть ставлення' : 'вкажіть ім’я'}`;
    }
    const nameless = peopleList().find((p) => !p.name);
    if (nameless) return `Хто ваш ${nameless.label}? (${nameless.title})`;
    if (state.clan === 'ventrue' && !st.ventruePrey.trim()) return 'Вентру: якою кров’ю ви живитеся?';
    if (state.clan === 'malkavian') {
      if (!st.malkDisorder.trim()) return 'Малкавіан: опишіть розлад';
      if (!st.malkCategory) return 'Малкавіан: оберіть категорію штрафу';
    }
    return null;
  }

  function viewsMissing() {
    const idx = state.views.findIndex((v) => !v.conviction.trim() || !v.touchstone.trim());
    if (idx === -1) return null;
    const v = state.views[idx];
    return `Переконання ${idx + 1}: ${v.conviction.trim() ? 'вкажіть опору' : 'сформулюйте переконання'}`;
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // Усе, що тип хижака дає персонажу, — одним списком
  function predatorResult() {
    const pred = predById(state.predator);
    if (!pred) return null;
    const c = state.pred;
    const spec = pred.specialties[c.specialty];
    const items = pred.gains.slice();
    for (const pick of pred.picks || []) {
      if (c.picks[pick.id] != null) items.push(pick.options[c.picks[pick.id]]);
    }
    for (const split of pred.splits || []) {
      (c.splits[split.id] || []).forEach((dots, i) => {
        if (dots > 0) items.push({ kind: split.kind, name: split.parts[i], dots });
      });
    }
    return {
      pred,
      specialty: spec ? `${spec.skill} (${spec.custom ? c.specialtyDetail.trim() || spec.spec : spec.spec})` : null,
      discipline: c.discipline,
      items,
      humanity: pred.humanity || 0,
    };
  }

  // Примітки до типу хижака, що залежать від клану й Сили Крові
  function predatorNotes(pred, clan) {
    const notes = [];
    const base = baseBloodPotency();
    if (pred.bloodPotency && base != null) {
      const final = finalBloodPotency();
      if (isThinBlood(clan)) notes.push('Сила Крові рідкокровців завжди 0 — бонус до Сили Крові не діє.');
      else if (final < base + pred.bloodPotency) notes.push(`Сила Крові не може перевищити максимум для ${state.generation}-го покоління (${final}).`);
    }
    if (['farmer', 'bagger'].includes(pred.id) && base != null) {
      const bp = base + (pred.bloodPotency || 0);
      const feeding = VTM.bloodPotency[bp] && VTM.bloodPotency[bp].feeding;
      if (feeding && feeding !== '—') notes.push(`Зверніть увагу: при Силі Крові ${bp} — ${feeding.toLowerCase()}.`);
    }
    if (isThinBlood(clan)) notes.push(clan.note);
    return notes;
  }

  // ---------- Кроки ----------

  const STEPS = [
    { id: 'clan', title: 'Клан', render: renderClanStep, missing: () => (state.clan ? null : 'Оберіть клан') },
    { id: 'generation', title: 'Покоління', render: renderGenerationStep, missing: generationMissing },
    { id: 'predator', title: 'Тип хижака', render: renderPredatorStep, missing: predatorMissing },
    { id: 'concept', title: 'Концепт', render: renderConceptStep, missing: conceptMissing },
    { id: 'attributes', title: 'Атрибути', render: renderAttributesStep, missing: attributesMissing },
    { id: 'skills', title: 'Навички', render: renderSkillsStep, missing: skillsMissing },
    { id: 'disciplines', title: 'Дисципліни', render: renderDisciplinesStep, missing: disciplinesMissing },
    { id: 'advantages', title: 'Переваги', render: renderAdvantagesStep, missing: advantagesMissing },
    { id: 'views', title: 'Погляди', render: renderViewsStep, missing: viewsMissing },
    { id: 'xp', title: 'Досвід', render: renderXpStep, missing: xpMissing },
    { id: 'story', title: 'Зв’язки', render: renderStoryStep, missing: storyMissing },
    { id: 'summary', title: 'Підсумок', render: renderSummary, missing: () => null },
  ];
  const UPCOMING = [];

  function canOpenStep(i) {
    for (let k = 0; k < i; k++) if (STEPS[k].missing()) return false;
    return true;
  }

  // ---------- Утиліти розмітки ----------

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const dots = (n) => '●'.repeat(n);
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VTM.icons[name] || ''}</svg>`;
  const KIND_LABEL = { merit: 'Чеснота', background: 'Надбання', flaw: 'Вада' };
  const KIND_TERM = { merit: 'merit', background: 'background', flaw: 'flaw' };

  // ---------- Словник і підказки ----------

  // Дисципліни теж показуємо у словнику
  const GLOSSARY = VTM.glossary.concat(Object.keys(VTM.disciplines).map((id) => ({
    id: 'disc-' + id, group: 'disciplines', term: VTM.disciplines[id].name, text: VTM.disciplines[id].short,
  })));
  const glossaryById = {};
  const glossaryByTerm = {};
  GLOSSARY.forEach((g) => {
    glossaryById[g.id] = g;
    glossaryByTerm[g.term.toLowerCase()] = g;
  });

  const LINKABLE = GLOSSARY.filter((g) => g.match);
  const LINK_RE = new RegExp(`(?<![\\p{L}’'])(?:${LINKABLE.map((g) => `(${g.match}\\p{L}*)`).join('|')})`, 'giu');

  // Підсвічує терміни словника в тексті (кожен — лише перший раз)
  function linkify(text, skip) {
    const used = new Set(skip || []);
    return esc(text).replace(LINK_RE, (m, ...groups) => {
      const idx = groups.findIndex((g, i) => i < LINKABLE.length && g !== undefined);
      const entry = LINKABLE[idx];
      if (!entry || used.has(entry.id)) return m;
      used.add(entry.id);
      return termLink(entry.id, m);
    });
  }

  const termLink = (id, label) => `<button type="button" class="term" data-term="${id}">${label}</button>`;
  const hint = (id) => (glossaryById[id] ? `<button type="button" class="hint" data-term="${id}" aria-label="Що це: ${esc(glossaryById[id].term)}">?</button>` : '');

  // «Ворог (знехтуваний коханець)» → запис «Ворог»
  function termForName(name) {
    const base = name.replace(/^Зовнішність:\s*/, '').split(' (')[0].trim().toLowerCase();
    return glossaryByTerm[base] || null;
  }

  function nameWithHint(name) {
    const entry = termForName(name);
    return entry ? termLink(entry.id, esc(name)) : esc(name);
  }

  function gainRow(item) {
    return `<li><span><span class="tag tag-${item.kind}">${KIND_LABEL[item.kind]}</span>${nameWithHint(item.name)}</span><span class="dots">${dots(item.dots)}</span></li>`;
  }

  const sectionTitle = (title, termId) => `<h3>${esc(title)}${termId ? hint(termId) : ''}</h3>`;

  // Спливаюча підказка: наведення на десктопі, тап на телефоні
  const popover = document.createElement('div');
  popover.className = 'popover';
  popover.setAttribute('role', 'tooltip');
  popover.hidden = true;
  document.body.appendChild(popover);
  let popoverAnchor = null;
  let popoverPinned = false;

  function showPopover(anchor, pinned) {
    const entry = glossaryById[anchor.dataset.term];
    if (!entry) return;
    popoverAnchor = anchor;
    popoverPinned = pinned;
    popover.innerHTML = `<div class="popover-group">${esc(VTM.glossaryGroups[entry.group])}</div><b>${esc(entry.term)}</b><p>${esc(entry.text)}</p>`;
    popover.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = popover.offsetWidth;
    const h = popover.offsetHeight;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    const top = r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8;
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  }

  function hidePopover() {
    popover.hidden = true;
    popoverAnchor = null;
    popoverPinned = false;
  }

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('[data-term]');
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();
      if (popoverAnchor === anchor && popoverPinned) hidePopover();
      else showPopover(anchor, true);
    } else if (!e.target.closest('.popover')) {
      hidePopover();
    }
  }, true);
  document.addEventListener('mouseover', (e) => {
    if (!finePointer.matches || popoverPinned) return;
    const anchor = e.target.closest('[data-term]');
    if (anchor) showPopover(anchor, false);
  });
  document.addEventListener('mouseout', (e) => {
    if (popoverPinned || !popoverAnchor) return;
    if (!e.relatedTarget || !popoverAnchor.contains(e.relatedTarget)) hidePopover();
  });
  window.addEventListener('scroll', hidePopover, { passive: true });
  window.addEventListener('resize', hidePopover);

  // Вікно словника з пошуком
  function openGlossary() {
    hidePopover();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="Словник">
        <div class="modal-head">
          <h2>Словник</h2>
          <button type="button" class="modal-close" aria-label="Закрити">✕</button>
        </div>
        <input class="text-input" type="search" placeholder="Пошук: діаблері, отара, харизма…" autocomplete="off">
        <div class="modal-body"></div>
      </div>`;
    document.body.appendChild(modal);
    document.body.classList.add('no-scroll');
    const input = modal.querySelector('input');
    const body = modal.querySelector('.modal-body');

    function draw() {
      const q = input.value.trim().toLowerCase();
      const html = Object.keys(VTM.glossaryGroups).map((group) => {
        const entries = GLOSSARY
          .filter((g) => g.group === group && (!q || g.term.toLowerCase().includes(q) || g.text.toLowerCase().includes(q)))
          .sort((a, b) => a.term.localeCompare(b.term, 'uk'));
        if (!entries.length) return '';
        return `<section class="gloss-group"><h3>${esc(VTM.glossaryGroups[group])}</h3><dl>${entries.map((g) => `<dt>${esc(g.term)}</dt><dd>${esc(g.text)}</dd>`).join('')}</dl></section>`;
      }).join('');
      body.innerHTML = html || '<p class="aside-empty">Нічого не знайдено</p>';
    }

    function close() {
      modal.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    input.addEventListener('input', draw);
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', onKey);
    draw();
    input.focus();
  }

  document.getElementById('btnGlossary').innerHTML = `${icon('book-open')}<span>Словник</span>`;

  // ---------- Вступ: Світ Пітьми для гравців ----------

  function loreBlock(block) {
    if (block.list) return `<ul class="lore-list">${block.list.map((x) => `<li>${linkify(x)}</li>`).join('')}</ul>`;
    if (block.quote) return `<blockquote class="lore-quote">${esc(block.quote)}${block.cite ? `<cite>${esc(block.cite)}</cite>` : ''}</blockquote>`;
    if (block.note) return `<div class="callout">${linkify(block.note)}</div>`;
    return `<p>${linkify(block.p)}</p>`;
  }

  // Ілюстрація вступу: вбудована збіркою або з img/lore; якщо файлу немає — блок зникає
  function loreFigure(id, cls) {
    const embedded = window.VTM_LORE_ART && window.VTM_LORE_ART[id];
    if (window.VTM_NO_ART && !embedded) return '';
    const src = embedded || `img/lore/${id}.jpg`;
    // Рамка прихована, доки картинка не завантажиться: відсутні файли не лишають порожніх місць
    return `<figure class="${cls} is-pending"><img src="${src}" alt="" data-lore-img></figure>`;
  }

  function openLore(sectionId) {
    hidePopover();
    const lore = VTM.lore;
    const panel = document.createElement('div');
    panel.className = 'lore';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', lore.title);
    panel.innerHTML = `
      <div class="lore-bar">
        <span class="lore-bar-title">${esc(lore.title)}</span>
        <button type="button" class="btn" data-lore-close>Закрити</button>
      </div>
      <div class="lore-wrap">
        <nav class="lore-toc" aria-label="Зміст">
          <div class="lore-toc-title">Зміст</div>
          ${lore.sections.map((sec) => `<a href="#lore-${sec.id}" data-lore-go="${sec.id}">${esc(sec.title)}</a>`).join('')}
        </nav>
        <article class="lore-body">
          <header class="lore-hero">
            ${loreFigure('hero', 'lore-cover')}
            <div class="lore-eyebrow">${esc(lore.eyebrow)}</div>
            <h1>${esc(lore.title)}</h1>
            <p class="lore-lead">${linkify(lore.lead)}</p>
          </header>
          ${lore.sections.map((sec) => `
            <section class="lore-section" id="lore-${sec.id}">
              <h2>${esc(sec.title)}</h2>
              ${loreFigure(sec.id, 'lore-figure')}
              ${sec.blocks.map(loreBlock).join('')}
              ${sec.pages ? `<div class="page-ref">Базова книга (PDF), с. ${esc(sec.pages)}</div>` : ''}
            </section>`).join('')}
          <footer class="lore-end">
            <p>${esc(lore.outro)}</p>
            <button type="button" class="btn btn-primary" data-lore-close>До створення персонажа</button>
          </footer>
        </article>
      </div>`;
    document.body.appendChild(panel);
    document.body.classList.add('no-scroll');
    const scroller = panel.querySelector('.lore-wrap');

    function close() {
      panel.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape' && !document.querySelector('.popover:not([hidden])')) close(); }

    panel.querySelectorAll('[data-lore-close]').forEach((b) => b.addEventListener('click', close));
    panel.querySelectorAll('[data-lore-go]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      panel.querySelector(`#lore-${a.dataset.loreGo}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    scroller.addEventListener('scroll', hidePopover, { passive: true });
    document.addEventListener('keydown', onKey);
    if (sectionId) panel.querySelector(`#lore-${sectionId}`).scrollIntoView({ block: 'start' });
    panel.querySelector('[data-lore-close]').focus();
  }

  // ---------- Фонова музика (генеративний ембієнт, js/ambient.js) ----------

  const MUSIC_KEY = 'vtm5-music';
  const btnMusic = document.getElementById('btnMusic');
  const musicPref = () => { try { return localStorage.getItem(MUSIC_KEY) === 'on'; } catch (e) { return false; } };
  const setMusicPref = (on) => { try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ } };

  function renderMusicBtn() {
    const on = VTM.ambient.isPlaying();
    btnMusic.innerHTML = `${icon(on ? 'music' : 'volume-x')}<span>Музика</span>`;
    btnMusic.classList.toggle('is-on', on);
    btnMusic.setAttribute('aria-pressed', String(on));
    btnMusic.title = on ? 'Вимкнути фонову музику' : 'Увімкнути фонову музику';
  }

  if (VTM.ambient && VTM.ambient.supported) {
    btnMusic.hidden = false;
    renderMusicBtn();
    btnMusic.addEventListener('click', async () => {
      if (VTM.ambient.isPlaying()) {
        VTM.ambient.stop();
        setMusicPref(false);
      } else {
        await VTM.ambient.start();
        setMusicPref(true);
      }
      renderMusicBtn();
    });
    // Браузери не дають сайту вмикати звук самостійно: якщо гравець раніше ввімкнув музику,
    // запускаємо її з першою його дією на сторінці
    if (musicPref()) {
      const kick = (e) => {
        if (btnMusic.contains(e.target)) return;
        document.removeEventListener('pointerdown', kick, true);
        document.removeEventListener('keydown', kick, true);
        if (!VTM.ambient.isPlaying()) VTM.ambient.start().then(renderMusicBtn);
      };
      document.addEventListener('pointerdown', kick, true);
      document.addEventListener('keydown', kick, true);
    }
    // На прихованій вкладці музика стає на паузу
    let resumeOnVisible = false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && VTM.ambient.isPlaying()) {
        resumeOnVisible = true;
        VTM.ambient.stop();
      } else if (!document.hidden && resumeOnVisible) {
        resumeOnVisible = false;
        VTM.ambient.start().then(renderMusicBtn);
      }
    });
  }

  document.getElementById('btnLore').innerHTML = `${icon('scroll-text')}<span>Світ гри</span>`;
  document.getElementById('btnLore').addEventListener('click', () => openLore());
  document.getElementById('btnGlossary').addEventListener('click', openGlossary);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopover(); });

  const $view = document.getElementById('view');

  // Портрет клану: згенерований (img/art або вбудований збіркою) → з книги (лише локально) → кольорова заглушка
  const CLAN_HUES = { brujah: 4, ventrue: 222, gangrel: 28, malkavian: 280, nosferatu: 150, toreador: 335, tremere: 250, caitiff: 40, thinblood: 190 };
  function clanArt(clan, lazy, placeholder) {
    const loading = lazy ? ' loading="lazy"' : '';
    const embedded = window.VTM_ART && window.VTM_ART[clan.id];
    if (embedded && !placeholder) return `<img src="${embedded}" alt=""${loading}>`;
    if (!window.VTM_NO_ART && !placeholder) {
      return `<img src="img/art/${clan.id}.jpg" alt=""${loading} data-art-clan="${clan.id}">`;
    }
    return `<span class="clan-art" style="--hue:${CLAN_HUES[clan.id] || 0}" aria-hidden="true"><span>${esc(clan.name.charAt(0))}</span></span>`;
  }

  // Портрета немає: спершу пробуємо ілюстрацію з книги (є лише в локальній копії), далі — заглушка.
  // Слухач замість inline onerror, щоб працювало під суворою CSP на сайті.
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.dataset.loreImg !== undefined) img.closest('figure').classList.remove('is-pending');
  }, true);
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.dataset.loreImg !== undefined) {
      img.closest('figure').remove();
      return;
    }
    if (!(img instanceof HTMLImageElement) || !img.dataset.artClan) return;
    const clan = clanById(img.dataset.artClan);
    if (!img.dataset.triedBook) {
      img.dataset.triedBook = '1';
      img.src = `img/clans/${clan.id}.jpg`;
    } else {
      img.outerHTML = clanArt(clan, false, true);
    }
  }, true);

  // ---------- Крок 1: клан ----------

  function renderClanStep() {
    const selected = clanById(state.clan);
    const cards = VTM.clans.map((c) => `
      <button type="button" class="clan-card${c.id === state.clan ? ' is-selected' : ''}" data-clan="${c.id}" aria-pressed="${c.id === state.clan}">
        ${clanArt(c, true)}
        <span class="check">✓</span>
        <span class="clan-card-body">
          <span class="clan-card-name">${esc(c.name)}</span>
          <span class="clan-card-nick" style="display:block">${esc(c.nickname)}</span>
          <span class="clan-card-short" style="display:block">${esc(c.short)}</span>
        </span>
      </button>`).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Оберіть клан</h1>
        <p>${termLink('clan', 'Клан')} визначає кланові дисципліни, ${termLink('bane', 'прокляття')} та ${termLink('compulsion', 'примус')} вашого вампіра. Натисніть на портрет, щоб переглянути деталі.</p>
        <div class="lore-invite">
          <span>${icon('scroll-text')}</span>
          <div><b>Вперше в «Маскараді»?</b> Прочитайте короткий вступ: хто такі кревні, що таке Звір, Камарилья, анархи й Друга Інквізиція.</div>
          <button type="button" class="btn" id="btnLoreInvite">Читати вступ</button>
        </div>
        <button type="button" class="link-btn" id="btnImport">Завантажити персонажа з файлу</button>
        <p class="disclaimer">Неофіційний фан-інструмент для гравців. «Vampire: The Masquerade» — торгова марка Paradox Interactive AB; правила за українським перекладом базової книги 5-ї редакції.</p>
      </div>
      <div class="layout">
        <div class="clan-grid">${cards}</div>
        <aside class="aside" id="detail">${selected ? clanDetail(selected) : '<div class="aside-empty">Оберіть клан, щоб побачити його дисципліни, прокляття й примус</div>'}</aside>
      </div>`;

    $view.querySelectorAll('[data-clan]').forEach((el) => el.addEventListener('click', () => selectClan(el.dataset.clan)));
    document.getElementById('btnImport').addEventListener('click', importCharacter);
    document.getElementById('btnLoreInvite').addEventListener('click', () => openLore());
  }

  function clanDetail(c) {
    const discs = c.anyDisciplines
      ? '<p>Будь-які дисципліни на вибір.</p>'
      : `<ul class="disc-list">${c.disciplines.map((d) => `<li><b>${esc(discName(d))}</b><span>${esc(VTM.disciplines[d].short)}</span></li>`).join('')}</ul>`;
    return `
      <h2 class="detail-title">${esc(c.name)}</h2>
      <div class="detail-sub">${esc(c.nickname)}</div>
      <div class="detail-section"><p>${linkify(c.short)}</p></div>
      <div class="detail-section">${sectionTitle('Дисципліни', 'discipline')}${discs}</div>
      <div class="detail-section">${sectionTitle('Прокляття', 'bane')}<p>${linkify(c.bane)}</p></div>
      ${c.compulsion ? `<div class="detail-section">${sectionTitle(`Примус · ${c.compulsion.name}`, 'compulsion')}<p>${linkify(c.compulsion.text)}</p></div>` : ''}
      ${c.note ? `<div class="callout">${linkify(c.note)}</div>` : ''}
      <div class="page-ref">Базова книга (PDF), с. ${c.page}</div>`;
  }

  function selectClan(id) {
    const clan = clanById(id);
    const patch = { clan: id };
    // Кланові дисципліни залежать від клану — розподіл починаємо заново
    if (id !== state.clan) Object.assign(patch, { discDots: {}, powers: {}, ritual: null, xp: emptyXp() });
    // Рідкокровці мають інші покоління — скидаємо несумісний вік
    const age = ageById(state.age);
    if (age) {
      if (!ageAvailability(age, clan).ok) {
        patch.age = null;
        patch.generation = null;
      } else if (!generationOptions(age, clan).includes(state.generation)) {
        patch.generation = generationOptions(age, clan)[0];
      }
    }
    // Якщо новий клан не дозволяє обраний тип хижака чи дисципліну — скидаємо
    const pred = predById(state.predator);
    if (pred) {
      if (!predatorAvailability(pred, clan).ok) {
        patch.predator = null;
        patch.pred = emptyPredatorChoices();
      } else if (state.pred.discipline && !disciplineAllowed(pred, state.pred.discipline, clan)) {
        patch.pred = Object.assign({}, state.pred, { discipline: null });
      }
    }
    update(patch);
    scrollDetailOnMobile();
  }

  // ---------- Крок 2: покоління ----------

  function renderGenerationStep() {
    const clan = clanById(state.clan);
    const selected = ageById(state.age);
    const cards = VTM.ages.map((a) => {
      const av = ageAvailability(a, clan);
      const gens = generationOptions(a, clan);
      const bp = isThinBlood(clan) ? 0 : a.bloodPotency;
      const chips = av.ok
        ? [`${gens[0]}–${gens[gens.length - 1]} покоління`, `Сила Крові ${bp}`, a.xp ? `${a.xp} XP` : null].filter(Boolean)
        : [];
      return `
        <button type="button" class="pred-card${a.id === state.age ? ' is-selected' : ''}" data-age="${a.id}" ${av.ok ? '' : 'disabled'} aria-pressed="${a.id === state.age}">
          <span class="pred-icon">${icon(a.icon)}</span>
          <span>
            <span class="pred-name" style="display:block">${esc(a.name)}</span>
            <span class="pred-era" style="display:block">${esc(a.era)}</span>
            <span class="pred-short" style="display:block">${esc(a.short)}</span>
            <span class="chips">${chips.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</span>
            ${av.ok ? '' : `<span class="pred-lock" style="display:block">${esc(av.reason)}</span>`}
          </span>
        </button>`;
    }).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Вік і покоління</h1>
        <p>Коли вашого вампіра було ${termLink('embrace', 'Залучено')} і наскільки він далекий від Каїна. ${termLink('generation', 'Покоління')} визначає ${termLink('bloodPotency', 'Силу Крові')}, а вік — стартові ${termLink('xp', 'очки досвіду')}.</p>
      </div>
      <div class="layout">
        <div class="pred-grid pred-grid-wide">${cards}</div>
        <aside class="aside" id="detail">${selected ? ageDetail(selected, clan) : '<div class="aside-empty">Оберіть вік, щоб побачити покоління та Силу Крові</div>'}</aside>
      </div>`;

    $view.querySelectorAll('[data-age]').forEach((el) => el.addEventListener('click', () => {
      if (el.dataset.age === state.age) return;
      const age = ageById(el.dataset.age);
      update({ age: age.id, generation: generationOptions(age, clan)[0] });
      scrollDetailOnMobile();
    }));
    const root = document.getElementById('detail');
    root.querySelectorAll('input[name="gen"]').forEach((el) => el.addEventListener('change', () => update({ generation: Number(el.value) })));
    const h8 = document.getElementById('humanity8');
    if (h8) h8.addEventListener('change', () => update({ humanity8: h8.checked }));
  }

  function ageDetail(a, clan) {
    const gens = generationOptions(a, clan).map((g) => `
      <label class="option${state.generation === g ? ' is-checked' : ''}">
        <input type="radio" name="gen" value="${g}" ${state.generation === g ? 'checked' : ''}>
        <span>${g}-те покоління</span>
      </label>`).join('');

    const bp = isThinBlood(clan) ? 0 : a.bloodPotency;
    const fx = VTM.bloodPotency[bp];
    const gains = [`<li><span><span class="tag tag-stat">${termLink('bloodPotency', 'Сила Крові')}</span></span><span class="dots">${dots(bp) || '0'}</span></li>`];
    if (a.xp) gains.push(`<li><span><span class="tag tag-stat">${termLink('xp', 'Досвід')}</span>витратити на розвиток</span><span>${a.xp} XP</span></li>`);
    if (a.advantages) gains.push(`<li><span><span class="tag tag-merit">${termLink('advantages', 'Переваги')}</span>додатково</span><span class="dots">${dots(a.advantages)}</span></li>`);
    if (a.flaws) gains.push(`<li><span><span class="tag tag-flaw">${termLink('flaw', 'Вади')}</span>додатково</span><span class="dots">${dots(a.flaws)}</span></li>`);
    if (a.humanity) gains.push(`<li><span><span class="tag tag-stat">${termLink('humanity', 'Людяність')}</span>${a.humanity}</span><span>${baseHumanity() + a.humanity}</span></li>`);

    const rows = [
      ['surge', 'Сплеск Крові', `+${fx.surge} ${fx.surge === 1 ? 'кістка' : 'кістки'}`],
      ['rouse', 'Зцілення за звірку Збурення', `${fx.mend} ${fx.mend === 1 ? 'легке' : 'легкі'}`],
      ['discipline', 'Бонус до сил дисциплін', fx.bonus ? `+${fx.bonus}` : '—'],
      ['rouse', 'Перекид звірки Збурення', fx.rouse],
      ['baneSeverity', 'Згубність прокляття', String(fx.bane)],
      ['hunger', 'Обмеження харчування', fx.feeding],
    ].map(([id, label, value]) => `<tr><th>${termLink(id, label)}</th><td>${esc(value)}</td></tr>`).join('');

    return `
      <h2 class="detail-title">${esc(a.name)}</h2>
      <div class="detail-sub">${esc(a.era)}</div>
      <div class="detail-section"><p>${linkify(a.short)}</p></div>
      <div class="detail-section">${sectionTitle('Покоління', 'generation')}<div class="options">${gens}</div></div>
      <div class="detail-section">${sectionTitle('Ви отримуєте')}<ul class="gain-list">${gains.join('')}</ul></div>
      <div class="detail-section">${sectionTitle(`Сила Крові ${bp}: ефекти`, 'bloodPotency')}<table class="bp-table">${rows}</table></div>
      ${a.id === 'childe' ? `
        <div class="detail-section">${sectionTitle('Людяність', 'humanity')}
          <label class="option${state.humanity8 ? ' is-checked' : ''}">
            <input type="checkbox" id="humanity8" ${state.humanity8 ? 'checked' : ''}>
            <span>Оповідач дозволив почати з Людяністю 8 <small>можливо, якщо всі гравці грають дитятами (с. 151)</small></span>
          </label>
        </div>` : ''}
      <div class="callout">Зазвичай усі персонажі гравців належать до одного покоління — узгодьте це з групою та Оповідачем.</div>
      ${isThinBlood(clan) ? `<div class="callout">${linkify('Рідкокровці належать до 14–16 покоління, їхня Сила Крові завжди 0.')}</div>` : ''}
      <div class="page-ref">Базова книга (PDF), с. ${a.page}, 216–218</div>`;
  }

  // ---------- Крок 3: тип хижака ----------

  function renderPredatorStep() {
    const clan = clanById(state.clan);
    const selected = predById(state.predator);
    const cards = VTM.predators.map((p) => {
      const av = predatorAvailability(p, clan);
      const discs = p.disciplines.map((d) => `<span class="chip">${esc(discName(d))}</span>`).join('');
      return `
        <button type="button" class="pred-card${p.id === state.predator ? ' is-selected' : ''}" data-pred="${p.id}" ${av.ok ? '' : 'disabled'} aria-pressed="${p.id === state.predator}">
          <span class="pred-icon">${icon(p.icon)}</span>
          <span>
            <span class="pred-name" style="display:block">${esc(p.name)}</span>
            <span class="pred-short" style="display:block">${esc(p.short)}</span>
            <span class="chips">${discs}</span>
            ${av.ok ? '' : `<span class="pred-lock" style="display:block">${esc(av.reason)}</span>`}
          </span>
        </button>`;
    }).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Оберіть тип хижака</h1>
        <p>Як ваш вампір зазвичай полює. ${termLink('predatorType', 'Тип хижака')} дає ${termLink('specialty', 'спеціалізацію')}, крапку дисципліни, ${termLink('advantages', 'переваги')} та ${termLink('flaw', 'вади')}.</p>
      </div>
      <div class="layout">
        <div class="pred-grid">${cards}</div>
        <aside class="aside" id="detail">${selected ? predatorDetail(selected, clan) : '<div class="aside-empty">Оберіть тип хижака, щоб налаштувати його бонуси</div>'}</aside>
      </div>`;

    $view.querySelectorAll('[data-pred]').forEach((el) => el.addEventListener('click', () => {
      if (el.dataset.pred === state.predator) return;
      update({ predator: el.dataset.pred, pred: autoChoices(predById(el.dataset.pred), clan) });
      scrollDetailOnMobile();
    }));
    bindPredatorDetail();
  }

  // Якщо варіант лише один — обираємо його одразу
  function autoChoices(pred, clan) {
    const c = emptyPredatorChoices();
    const discs = pred.disciplines.filter((d) => disciplineAllowed(pred, d, clan));
    if (discs.length === 1) c.discipline = discs[0];
    if (pred.specialties.length === 1) c.specialty = 0;
    for (const split of pred.splits || []) c.splits[split.id] = split.parts.map(() => 0);
    return c;
  }

  function predatorDetail(p, clan) {
    const c = state.pred;

    // Поле уточнення стоїть одразу під обраним варіантом і підсвічується, доки порожнє
    const specs = p.specialties.map((s, i) => {
      const checked = c.specialty === i;
      const detail = checked && s.custom ? `
        <div class="spec-detail${c.specialtyDetail.trim() ? '' : ' needs-input'}">
          <label class="spec-detail-label" for="specDetail">Уточніть: ${esc(s.spec)} <span class="req">*</span></label>
          <input class="text-input" id="specDetail" type="text" placeholder="наприклад, ${esc(SPEC_DETAIL_EXAMPLES[s.spec] || s.spec)}" value="${esc(c.specialtyDetail)}" maxlength="60" aria-required="true">
        </div>` : '';
      return `
      <label class="option${checked ? ' is-checked' : ''}${s.custom ? ' is-custom' : ''}">
        <input type="radio" name="spec" value="${i}" ${checked ? 'checked' : ''}>
        <span>${esc(s.skill)}${hint(termForName(s.skill) && termForName(s.skill).id)} <small>${esc(s.spec)}${s.custom ? ' · треба вписати' : ''}</small></span>
      </label>${detail}`;
    }).join('');

    const discs = p.disciplines.map((d) => {
      const ok = disciplineAllowed(p, d, clan);
      const inClan = clan && (clan.anyDisciplines || clan.disciplines.includes(d));
      const note = !ok ? 'лише для Тремі' : inClan ? 'кланова' : 'позакланова';
      return `
        <label class="option${c.discipline === d ? ' is-checked' : ''}${ok ? '' : ' is-disabled'}">
          <input type="radio" name="disc" value="${d}" ${c.discipline === d ? 'checked' : ''} ${ok ? '' : 'disabled'}>
          <span>${esc(discName(d))}${hint('disc-' + d)} <small>${note}</small></span>
        </label>`;
    }).join('');

    const picks = (p.picks || []).map((pick) => `
      <div class="detail-section">${sectionTitle(pick.label, 'flaw')}<div class="options">
        ${pick.options.map((o, i) => `
          <label class="option${c.picks[pick.id] === i ? ' is-checked' : ''}">
            <input type="radio" name="pick-${pick.id}" data-pick="${pick.id}" value="${i}" ${c.picks[pick.id] === i ? 'checked' : ''}>
            <span>${esc(o.name)}${hint(termForName(o.name) && termForName(o.name).id)} <span class="dots">${dots(o.dots)}</span></span>
          </label>`).join('')}
      </div></div>`).join('');

    const splits = (p.splits || []).map((split) => {
      const vals = c.splits[split.id] || split.parts.map(() => 0);
      const left = split.total - vals.reduce((a, b) => a + b, 0);
      return `
        <div class="detail-section"><h3>${esc(split.label)}${hint(KIND_TERM[split.kind])} <span class="split-left">· лишилось ${left}</span></h3><div class="split">
          ${split.parts.map((name, i) => `
            <div class="split-row">
              <span>${nameWithHint(name)}</span>
              <span class="stepper-ctl">
                <button type="button" data-split="${split.id}" data-idx="${i}" data-delta="-1" ${vals[i] <= 0 ? 'disabled' : ''} aria-label="Менше">−</button>
                <span class="dots" style="min-width:3.5em;text-align:center">${dots(vals[i]) || '—'}</span>
                <button type="button" data-split="${split.id}" data-idx="${i}" data-delta="1" ${left <= 0 ? 'disabled' : ''} aria-label="Більше">+</button>
              </span>
            </div>`).join('')}
        </div></div>`;
    }).join('');

    const stats = [];
    if (p.humanity) stats.push(`<li><span><span class="tag tag-stat">${termLink('humanity', 'Людяність')}</span>${p.humanity > 0 ? '+' : '−'}${Math.abs(p.humanity)}</span><span></span></li>`);
    if (p.bloodPotency) stats.push(`<li><span><span class="tag tag-stat">${termLink('bloodPotency', 'Сила Крові')}</span>+${p.bloodPotency}</span><span></span></li>`);
    const fixed = stats.join('') + p.gains.map(gainRow).join('');

    return `
      <h2 class="detail-title">${esc(p.name)}</h2>
      <div class="detail-section"><p>${linkify(p.short)}</p></div>
      ${p.specialties.length ? `<div class="detail-section">${sectionTitle('Спеціалізація', 'specialty')}<div class="options">${specs}</div></div>` : ''}
      ${p.disciplines.length ? `<div class="detail-section">${sectionTitle('+1 крапка дисципліни', 'discipline')}<div class="options">${discs}</div></div>` : ''}
      ${picks}
      ${splits}
      ${fixed ? `<div class="detail-section">${sectionTitle('Ви отримуєте', 'advantages')}<ul class="gain-list">${fixed}</ul></div>` : ''}
      ${predatorNotes(p, clan).map((n) => `<div class="callout">${linkify(n)}</div>`).join('')}
      <div class="page-ref">Базова книга (PDF), с. ${p.page}</div>`;
  }

  // Приклади для спеціалізацій, які гравець вписує сам
  const SPEC_DETAIL_EXAMPLES = {
    'конкретна спільнота': 'готи, кіберспорт',
    'конкретна традиція': 'вуду, таро',
    'конкретна сфера розваг': 'стендап, стрімінг',
    'конкретний вид': 'собаки, щури',
  };

  function setPred(patch, opts) {
    update({ pred: Object.assign({}, state.pred, patch) }, opts);
  }

  function bindPredatorDetail() {
    const root = document.getElementById('detail');
    if (!root) return;
    root.querySelectorAll('input[name="spec"]').forEach((el) => el.addEventListener('change', () => {
      setPred({ specialty: Number(el.value), specialtyDetail: '' });
      // Якщо варіант треба уточнити — одразу ставимо курсор у поле
      const field = document.getElementById('specDetail');
      if (field) field.focus();
    }));
    root.querySelectorAll('input[name="disc"]').forEach((el) => el.addEventListener('change', () => setPred({ discipline: el.value })));
    root.querySelectorAll('input[data-pick]').forEach((el) => el.addEventListener('change', () => {
      setPred({ picks: Object.assign({}, state.pred.picks, { [el.dataset.pick]: Number(el.value) }) });
    }));
    root.querySelectorAll('button[data-split]').forEach((el) => el.addEventListener('click', () => {
      const pred = predById(state.predator);
      const split = pred.splits.find((s) => s.id === el.dataset.split);
      const vals = (state.pred.splits[split.id] || split.parts.map(() => 0)).slice();
      vals[Number(el.dataset.idx)] += Number(el.dataset.delta);
      setPred({ splits: Object.assign({}, state.pred.splits, { [split.id]: vals }) });
    }));
    const detail = document.getElementById('specDetail');
    if (detail) detail.addEventListener('input', () => {
      setPred({ specialtyDetail: detail.value }, { render: false });
      detail.parentElement.classList.toggle('needs-input', !detail.value.trim());
    });
  }

  // ---------- Крок 4: концепт ----------

  const CONCEPT_FIELDS = [
    { key: 'name', label: 'Ім’я', placeholder: 'Як вашого персонажа звуть тепер', required: true },
    { key: 'concept', label: 'Концепт', placeholder: 'Хто він кількома словами', required: true, term: 'concept' },
    { key: 'ambition', label: 'Амбіція', placeholder: 'Довгострокова мета: «Стати Принцом міста»', term: 'ambition' },
    { key: 'desire', label: 'Бажання', placeholder: 'Мета на сесію: «Дізнатися, кому служить мій сір»', term: 'desire' },
    { key: 'sire', label: 'Сір', placeholder: 'Хто вас Залучив', term: 'sire' },
    { key: 'chronicle', label: 'Хроніка', placeholder: 'Назва хроніки чи місто', term: 'chronicle' },
    { key: 'notes', label: 'Історія та нотатки', placeholder: 'Ким ви були за життя? Де і як вас Залучили? Чим займаєтеся тепер?', textarea: true },
  ];

  function renderConceptStep() {
    const c = state.concept;
    const clan = clanById(state.clan);
    const pred = predById(state.predator);
    const fields = CONCEPT_FIELDS.map((f) => {
      const id = `f-${f.key}`;
      const label = `<label class="field-label" for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}${f.term ? hint(f.term) : ''}</label>`;
      const control = f.textarea
        ? `<textarea class="text-input" id="${id}" data-field="${f.key}" rows="4" placeholder="${esc(f.placeholder)}">${esc(c[f.key])}</textarea>`
        : `<input class="text-input" id="${id}" data-field="${f.key}" type="text" maxlength="120" placeholder="${esc(f.placeholder)}" value="${esc(c[f.key])}">`;
      const examples = f.key === 'concept'
        ? `<div class="chips chips-btn">${VTM.conceptExamples.map((e) => `<button type="button" class="chip chip-btn" data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>`
        : '';
      return `<div class="field${f.textarea ? ' field-wide' : ''}">${label}${control}${examples}</div>`;
    }).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Концепт</h1>
        <p>Хто ваш вампір — ${esc(clan.name)}, ${esc(pred.name.toLowerCase())}? Ім’я та концепт обов’язкові, решту можна дописати пізніше.</p>
      </div>
      <div class="layout">
        <div class="form-card">${fields}</div>
        <aside class="aside" id="detail">
          <h2 class="detail-title">Основний задум</h2>
          <div class="detail-section">${sectionTitle('Запитайте себе')}
            <ul class="prompt-list">
              <li>Як звали вашого персонажа за життя? Чим він займався?</li>
              <li>Де і коли його Залучили? Хто був сіром?</li>
              <li>Як його звати тепер? Чим він тепер займається?</li>
            </ul>
          </div>
          <div class="detail-section">${sectionTitle('Амбіція й бажання')}
            <p>${termLink('ambition', 'Амбіція')} — довга мета на всю хроніку. ${termLink('desire', 'Бажання')} — коротка мета на сесію, і воно має стосуватися когось конкретного: не «хочу мазераті», а «хочу мазераті Цитереї».</p>
          </div>
          <div class="callout">Не намагайтеся створити «найкращого можливого» персонажа — це гра про виживання, жах і трагедію.</div>
          <div class="page-ref">Базова книга (PDF), с. 136, 174–177</div>
        </aside>
      </div>`;

    $view.querySelectorAll('[data-field]').forEach((el) => el.addEventListener('input', () => {
      update({ concept: Object.assign({}, state.concept, { [el.dataset.field]: el.value }) }, { render: false });
    }));
    $view.querySelectorAll('[data-example]').forEach((el) => el.addEventListener('click', () => {
      update({ concept: Object.assign({}, state.concept, { concept: el.dataset.example }) });
    }));
  }

  // ---------- Розподіл значень (атрибути й навички) ----------

  // Кнопки 1…max; значення з вичерпаною квотою недоступні
  function pipButtons(kind, trait, val, counts, quota, levelText) {
    const max = Math.max(...Object.keys(quota).map(Number));
    let html = '';
    for (let v = 1; v <= max; v++) {
      const full = counts[v] >= quota[v] && val !== v;
      html += `<button type="button" class="pip${v <= val ? ' is-on' : ''}${v === val ? ' is-value' : ''}" data-${kind}="${trait.id}" data-val="${v}" ${full ? 'disabled' : ''} title="${v}: ${esc(levelText(v))}" aria-label="${esc(trait.name)} ${v}">${v}</button>`;
    }
    return html;
  }

  function quotaList(counts, quota) {
    return Object.keys(quota).map(Number).sort((a, b) => b - a).map((v) => {
      const done = counts[v] === quota[v];
      return `<li class="${done ? 'is-done' : ''}"><span class="dots">${dots(v)}</span><span>${counts[v]} / ${quota[v]}${done ? ' ✓' : ''}</span></li>`;
    }).join('');
  }

  // Клік по вже обраному значенню скасовує його
  function bindPips(kind, stateKey) {
    $view.querySelectorAll(`[data-${kind}]`).forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset[kind];
      const v = Number(el.dataset.val);
      const values = Object.assign({}, state[stateKey]);
      if (values[id] === v) delete values[id];
      else values[id] = v;
      update({ [stateKey]: values });
    }));
  }

  // ---------- Крок 5: атрибути ----------

  function renderAttributesStep() {
    const counts = attributeCounts();
    const quota = VTM.attributeDistribution;

    const groups = Object.keys(VTM.attributeGroups).map((group) => {
      const rows = VTM.attributes.filter((a) => a.group === group).map((a) => {
        const val = attrValue(a.id);
        const pips = pipButtons('attr', a, val, counts, quota, (v) => a.levels[v - 1]);
        return `
          <div class="attr-row${val ? '' : ' is-empty'}">
            <div class="attr-head"><span class="attr-name">${termLink(a.id, esc(a.name))}</span><span class="pips">${pips}</span></div>
            <div class="attr-level">${val ? esc(a.levels[val - 1]) : 'Оберіть значення'}</div>
          </div>`;
      }).join('');
      return `<section class="attr-group"><h3>${esc(VTM.attributeGroups[group])}</h3>${rows}</section>`;
    }).join('');

    const quotaRows = quotaList(counts, quota);

    const stamina = attrValue('stamina');
    const willpower = attrValue('composure') && attrValue('resolve') ? attrValue('composure') + attrValue('resolve') : null;

    $view.innerHTML = `
      <div class="step-head">
        <h1>Атрибути</h1>
        <p>Розподіліть значення: одна характеристика — 4, три — 3, чотири — 2, одна — 1. Натисніть на число — під характеристикою з’явиться, що воно означає. Повторне натискання скасовує вибір.</p>
      </div>
      <div class="layout">
        <div class="attr-groups">${groups}</div>
        <aside class="aside" id="detail">
          <div class="detail-section" style="margin-top:0">${sectionTitle('Розподіл')}<ul class="quota-list">${quotaRows}</ul></div>
          <div class="detail-section">${sectionTitle('Похідні значення')}
            <ul class="gain-list">
              <li><span>${termLink('health', 'Здоров’я')} <small class="muted">Витривалість + 3</small></span><b>${stamina ? stamina + 3 : '—'}</b></li>
              <li><span>${termLink('willpower', 'Сила волі')} <small class="muted">Витримка + Рішучість</small></span><b>${willpower || '—'}</b></li>
            </ul>
          </div>
          <div class="callout">Значення 2 — середнє для людини, 3 — помітно вище за середнє, 4 — видатне.</div>
          <div class="sheet-actions"><button type="button" class="btn" id="btnAttrReset" ${Object.keys(state.attrs).length ? '' : 'disabled'}>Скинути розподіл</button></div>
          <div class="page-ref">Базова книга (PDF), с. 136, 157–160</div>
        </aside>
      </div>`;

    bindPips('attr', 'attrs');
    document.getElementById('btnAttrReset').addEventListener('click', () => update({ attrs: {} }));
  }

  // ---------- Крок 6: навички ----------

  function countsLabel(counts) {
    return Object.keys(counts).map(Number).sort((a, b) => b - a)
      .map((v) => `<span>${counts[v]} × <span class="dots">${dots(v)}</span></span>`).join('');
  }

  const SPEC_SOURCE = { predator: 'тип хижака', auto: 'безплатна', free: 'на вибір' };

  function specLineHtml(skillId) {
    return specialtyList()
      .filter((s) => s.skill === skillId && s.text)
      .map((s) => `<span class="spec-chip" title="Спеціалізація: ${SPEC_SOURCE[s.source]}">${esc(s.text)}</span>`).join('');
  }

  // Оновлює рядки спеціалізацій без повного перерендеру (щоб не втрачати фокус у полях)
  function refreshSpecLines() {
    $view.querySelectorAll('[data-spec-line]').forEach((el) => { el.innerHTML = specLineHtml(el.dataset.specLine); });
  }

  function renderSkillsStep() {
    const dist = distById(state.skillDist);
    const distCards = VTM.skillDistributions.map((d) => `
      <button type="button" class="dist-card${d.id === state.skillDist ? ' is-selected' : ''}" data-dist="${d.id}" aria-pressed="${d.id === state.skillDist}">
        <span class="dist-name">${esc(d.name)}</span>
        <span class="dist-short">${esc(d.short)}</span>
        <span class="dist-counts">${countsLabel(d.counts)}</span>
      </button>`).join('');

    let body = '<div class="aside-empty">Спершу оберіть варіант розподілу навичок</div>';
    let aside = '<div class="aside-empty">Тут з’являться квоти й спеціалізації</div>';

    if (dist) {
      const counts = skillCounts(dist);
      const groups = Object.keys(VTM.attributeGroups).map((group) => {
        const rows = VTM.skills.filter((s) => s.group === group).map((s) => {
          const val = skillValue(s.id);
          const freeTag = (VTM.freeSpecialtySkills.includes(s.id) ? '<span class="mini-tag" title="Дає безплатну спеціалізацію, щойно є крапка">+спец.</span>' : '')
            + (predatorBonusSkill() === s.id ? '<span class="mini-tag" title="Крапка від типу хижака замість спеціалізації">+1 хижак</span>' : '');
          return `
            <div class="skill-row${val ? '' : ' is-empty'}">
              <div class="attr-head">
                <span class="skill-name">${termLink(s.id, esc(s.name))}${freeTag}</span>
                <span class="pips pips-sm">${pipButtons('skill', s, val, counts, dist.counts, (v) => VTM.skillLevels[v - 1])}</span>
              </div>
              <div class="spec-line" data-spec-line="${s.id}">${specLineHtml(s.id)}</div>
            </div>`;
        }).join('');
        return `<section class="attr-group"><h3>${esc(VTM.attributeGroups[group])}</h3>${rows}</section>`;
      }).join('');
      body = `<div class="attr-groups">${groups}</div>`;

      const ps = predatorSpecialty();
      const predItem = ps ? `
        <div class="spec-item">
          <span class="spec-src">Від типу хижака</span>
          <span><b>${esc(skillById(ps.skill).name)}</b> (${esc(ps.text)})</span>
          ${skillValue(ps.skill) ? '' : `<span class="muted">У навичці ${esc(skillById(ps.skill).name)} немає крапок — натомість ви отримаєте 1 крапку в ній, без спеціалізації (с. 151).</span>`}
        </div>` : '';

      const autoSkills = VTM.freeSpecialtySkills.filter((id) => skillValue(id));
      const autoItems = autoSkills.length
        ? autoSkills.map((id) => `
          <label class="spec-item">
            <span class="spec-src">Безплатна · ${esc(skillById(id).name)}</span>
            <input class="text-input" type="text" list="dl-${id}" data-auto="${id}" maxlength="60" placeholder="наприклад, ${esc(skillById(id).specialties[0])}" value="${esc(state.specs.auto[id] || '')}">
          </label>`).join('')
        : '<p class="muted">Знання, Ремесло, Виступ і Наука дають безплатну спеціалізацію, щойно в них є крапка.</p>';

      const withDots = VTM.skills.filter((s) => skillValue(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
      const freeSkill = state.specs.freeSkill;
      const freeItem = `
        <div class="spec-item">
          <span class="spec-src">Ще одна на вибір</span>
          <select class="text-input" data-free-skill>
            <option value="">— навичка —</option>
            ${withDots.map((s) => `<option value="${s.id}" ${s.id === freeSkill ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            ${freeSkill && !skillValue(freeSkill) ? `<option value="${freeSkill}" selected>${esc(skillById(freeSkill).name)} (немає крапок)</option>` : ''}
          </select>
          ${freeSkill ? `<input class="text-input" type="text" list="dl-${freeSkill}" data-free-text maxlength="60" placeholder="наприклад, ${esc(skillById(freeSkill).specialties[0])}" value="${esc(state.specs.freeText)}">` : ''}
        </div>`;

      const datalists = VTM.skills.map((s) => `<datalist id="dl-${s.id}">${s.specialties.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`).join('');

      aside = `
        <div class="detail-section" style="margin-top:0">${sectionTitle(`Розподіл · ${dist.name}`)}<ul class="quota-list">${quotaList(counts, dist.counts)}</ul></div>
        <div class="detail-section">${sectionTitle('Спеціалізації', 'specialty')}<div class="spec-items">${predItem}${autoItems}${freeItem}</div></div>
        <div class="callout">Спеціалізацій у навичці не більше, ніж крапок (крім Ремесла). Підказки з’являються під час введення.</div>
        <div class="sheet-actions"><button type="button" class="btn" id="btnSkillReset" ${Object.keys(state.skills).length ? '' : 'disabled'}>Скинути навички</button></div>
        <div class="page-ref">Базова книга (PDF), с. 136, 160–173</div>
        ${datalists}`;
    }

    $view.innerHTML = `
      <div class="step-head">
        <h1>Навички</h1>
        <p>Оберіть, наскільки широко чи вузько навчений ваш персонаж, і розподіліть крапки. Навички без крапок — це нормально.</p>
      </div>
      <div class="dist-grid">${distCards}</div>
      <div class="layout">
        <div>${body}</div>
        <aside class="aside" id="detail">${aside}</aside>
      </div>`;

    $view.querySelectorAll('[data-dist]').forEach((el) => el.addEventListener('click', () => {
      if (el.dataset.dist === state.skillDist) return;
      const apply = () => update({ skillDist: el.dataset.dist, skills: {} });
      if (!Object.keys(state.skills).length) apply();
      else askConfirm('Змінити розподіл? Уже розставлені навички буде скинуто.', 'Змінити').then((ok) => { if (ok) apply(); });
    }));
    if (!dist) return;

    bindPips('skill', 'skills');
    $view.querySelectorAll('[data-auto]').forEach((el) => el.addEventListener('input', () => {
      const auto = Object.assign({}, state.specs.auto, { [el.dataset.auto]: el.value });
      update({ specs: Object.assign({}, state.specs, { auto }) }, { render: false });
      refreshSpecLines();
    }));
    const freeSelect = $view.querySelector('[data-free-skill]');
    freeSelect.addEventListener('change', () => {
      update({ specs: Object.assign({}, state.specs, { freeSkill: freeSelect.value || null, freeText: '' }) });
    });
    const freeText = $view.querySelector('[data-free-text]');
    if (freeText) freeText.addEventListener('input', () => {
      update({ specs: Object.assign({}, state.specs, { freeText: freeText.value }) }, { render: false });
      refreshSpecLines();
    });
    document.getElementById('btnSkillReset').addEventListener('click', () => update({ skills: {} }));
  }

  // ---------- Крок 7: дисципліни ----------

  function renderDisciplinesStep() {
    const clan = clanById(state.clan);

    if (isThinBlood(clan)) {
      $view.innerHTML = `
        <div class="step-head">
          <h1>Дисципліни</h1>
          <p>${linkify('Рідкокровний персонаж не має власних дисциплін. Можливості Алхімії рідкокровців узгодьте з Оповідачем (базова книга, с. 246).')}</p>
        </div>
        <div class="callout">${linkify(clan.note)}</div>`;
      return;
    }

    const options = creationDisciplines(clan);
    const predDisc = state.pred.discipline;
    const allocCards = options.map((d) => {
      const val = state.discDots[d] || 0;
      const seg = [0, 1, 2].map((v) => `<button type="button" class="seg-btn${val === v ? ' is-active' : ''}" data-ddisc="${d}" data-dval="${v}" aria-label="${esc(discName(d))}: ${v}">${v ? dots(v) : '—'}</button>`).join('');
      const bonus = predDisc === d ? '<span class="mini-tag" title="Крапка від типу хижака">+1 хижак</span>' : '';
      return `
        <div class="disc-card${val ? ' is-on' : ''}">
          <div class="disc-card-head"><b>${termLink('disc-' + d, esc(discName(d)))}</b>${bonus}</div>
          <p class="disc-card-short">${esc(VTM.disciplines[d].short)}</p>
          <div class="seg">${seg}</div>
        </div>`;
    }).join('');

    // Крапка типу хижака в позакланову дисципліну — показуємо окремо
    const outOfClan = predDisc && !options.includes(predDisc)
      ? `<div class="callout">Тип хижака дає 1 крапку позакланової дисципліни: <b>${esc(discName(predDisc))}</b>. Для неї теж треба обрати силу.</div>`
      : '';

    const groups = ownedDisciplines().map((d) => {
      const total = disciplineDots(d);
      const chosen = chosenPowers(d);
      const full = chosen.length >= total;
      const levels = [];
      for (let lvl = 1; lvl <= Math.min(total, 5); lvl++) {
        const items = VTM.powers.filter((p) => p.discipline === d && p.level === lvl).map((p) => {
          const checked = chosen.includes(p.id);
          let reason = checked ? null : powerBlocker(p);
          if (!checked && !reason && !full && !powerLevelsValid(chosen.map((id) => powerById(id).level).concat(lvl))) {
            reason = 'Спершу візьміть силу нижчого рівня';
          }
          const disabled = !checked && (full || reason);
          const tag = p.amalgam ? `<span class="mini-tag" title="Змішана сила">${esc(discName(p.amalgam.discipline))} ${p.amalgam.level}</span>` : '';
          return `
            <label class="power${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}">
              <input type="checkbox" data-power="${p.id}" data-pdisc="${d}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
              <span class="power-body">
                <span class="power-name">${esc(p.name)}${tag}</span>
                <span class="power-short">${esc(p.short)}</span>
                ${reason ? `<span class="power-block">${esc(reason)}</span>` : ''}
              </span>
            </label>`;
        }).join('');
        levels.push(`<div class="power-level">${lvl}-й рівень</div><div class="power-list">${items}</div>`);
      }
      return `
        <section class="power-group">
          <header class="power-head">
            <h2>${esc(discName(d))} <span class="dots">${dots(total)}</span></h2>
            <span class="power-count${chosen.length === total ? ' is-done' : ''}">Сили: ${chosen.length} / ${total}</span>
          </header>
          ${levels.join('')}
        </section>`;
    }).join('');

    const ritual = disciplineDots('bloodSorcery') ? `
      <section class="power-group">
        <header class="power-head"><h2>Ритуал${hint('ritual')}</h2><span class="power-count${state.ritual ? ' is-done' : ''}">${state.ritual ? '1 / 1' : '0 / 1'}</span></header>
        <div class="power-list">
          ${VTM.rituals.filter((r) => r.level === 1).map((r) => `
            <label class="power${state.ritual === r.id ? ' is-checked' : ''}">
              <input type="radio" name="ritual" data-ritual="${r.id}" ${state.ritual === r.id ? 'checked' : ''}>
              <span class="power-body"><span class="power-name">${esc(r.name)}</span><span class="power-short">${esc(r.short)}</span></span>
            </label>`).join('')}
        </div>
      </section>` : '';

    const overview = ownedDisciplines().map((d) => `
      <li><span>${esc(discName(d))}<small class="muted"> ${chosenPowers(d).map((id) => powerById(id).name).join(', ') || '—'}</small></span><span class="dots">${dots(disciplineDots(d))}</span></li>`).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Дисципліни</h1>
        <p>${clan.anyDisciplines ? 'Каїтиф обирає дві будь-які дисципліни' : 'Оберіть дві з трьох кланових дисциплін'}: одна отримує ●●, інша ●. Потім за кожну крапку візьміть одну ${termLink('power', 'силу')} цього рівня або нижчого.</p>
      </div>
      <div class="layout">
        <div>
          <div class="disc-grid${clan.anyDisciplines ? ' disc-grid-many' : ''}">${allocCards}</div>
          ${outOfClan}
          ${groups || '<div class="aside-empty">Розподіліть крапки, щоб обрати сили</div>'}
          ${ritual}
        </div>
        <aside class="aside" id="detail">
          ${sectionTitle('Ваші дисципліни', 'discipline')}
          ${overview ? `<ul class="gain-list">${overview}</ul>` : '<p class="muted">Поки порожньо</p>'}
          <div class="callout">Сили 2-го рівня доступні лише з другою крапкою. ${termLink('amalgam', 'Змішані сили')} вимагають крапок в іншій дисципліні.</div>
          ${disciplineDots('bloodSorcery') ? `<div class="callout">${linkify('З Чарами Крові на старті обирається 1 ритуал 1-го рівня.')}</div>` : ''}
          <div class="page-ref">Базова книга (PDF), с. 136, 246–289</div>
        </aside>
      </div>`;

    $view.querySelectorAll('[data-ddisc]').forEach((el) => el.addEventListener('click', () => {
      const d = el.dataset.ddisc;
      const v = Number(el.dataset.dval);
      const discDots = Object.assign({}, state.discDots);
      const powers = Object.assign({}, state.powers);
      // Кожне значення (●● і ●) має лише одна дисципліна
      Object.keys(discDots).forEach((k) => {
        if (k !== d && v && discDots[k] === v) { delete discDots[k]; delete powers[k]; }
      });
      if (v) discDots[d] = v;
      else delete discDots[d];
      if ((discDots[d] || 0) < (state.discDots[d] || 0)) delete powers[d];
      update({ discDots, powers });
    }));
    $view.querySelectorAll('[data-power]').forEach((el) => el.addEventListener('change', () => {
      const d = el.dataset.pdisc;
      let list = chosenPowers(d).filter((id) => id !== el.dataset.power);
      if (el.checked) list.push(el.dataset.power);
      // Прибираємо сили, які спиралися на щойно зняту
      list = list.filter((id) => !powerById(id).requires || list.includes(powerById(id).requires));
      update({ powers: Object.assign({}, state.powers, { [d]: list }) });
    }));
    $view.querySelectorAll('[data-ritual]').forEach((el) => el.addEventListener('change', () => update({ ritual: el.dataset.ritual })));
  }

  // ---------- Крок 8: переваги й вади ----------

  const ADV_TABS = [
    { id: 'background', label: 'Надбання', kinds: ['background'] },
    { id: 'merit', label: 'Чесноти', kinds: ['merit'] },
    { id: 'flaw', label: 'Вади', kinds: ['flaw'] },
    { id: 'thin', label: 'Рідкокровців', kinds: ['tbMerit', 'tbFlaw'], thinOnly: true },
  ];
  const ADV_KIND = { merit: 'Чеснота', background: 'Надбання', flaw: 'Вада', tbMerit: 'Чеснота', tbFlaw: 'Вада' };
  let advQuery = '';

  const newUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function budgetBar(label, spent, total, termId) {
    const pct = total ? Math.min(100, (spent / total) * 100) : 0;
    const state_ = spent === total ? 'is-done' : spent > total ? 'is-over' : '';
    return `
      <div class="budget ${state_}">
        <div class="budget-head"><span>${termLink(termId, esc(label))}</span><b>${spent} / ${total}</b></div>
        <div class="budget-bar"><span style="width:${pct}%"></span></div>
      </div>`;
  }

  function renderAdvantagesStep() {
    const clan = clanById(state.clan);
    const thin = isThinBlood(clan);
    const tabs = ADV_TABS.filter((t) => !t.thinOnly || thin);
    const tab = tabs.find((t) => t.id === state.advTab) || tabs[0];
    const budget = advantageBudget();
    const spent = advantageSpent();
    const autos = autoAdvantages();

    const entries = VTM.advantages.filter((a) => tab.kinds.includes(a.kind));
    const cats = [...new Set(entries.map((a) => a.cat))];
    const cards = cats.map((cat) => {
      const items = entries.filter((a) => a.cat === cat).map((a) => {
        const mine = state.advs.filter((x) => x.id === a.id);
        const blocker = mine.length ? null : advBlocker(a);
        const isTb = a.kind === 'tbMerit' || a.kind === 'tbFlaw';
        const pool = isMeritKind(a.kind) ? 'merits' : 'flaws';
        let controls;
        if (isTb) {
          controls = `<button type="button" class="adv-btn${mine.length ? ' is-on' : ''}" data-adv="${a.id}" data-dots="0" ${blocker ? 'disabled' : ''}>${mine.length ? '✓ Узято' : 'Узяти'}</button>`;
        } else {
          controls = a.dots.map((n) => {
            // Скільки крапок звільниться, якщо замінити наявний рівень (для одиничних записів)
            const current = !a.multi && mine.length ? mine[0].dots : 0;
            const over = spent[pool] - current + n > budget[pool];
            const active = !a.multi && current === n;
            const disabled = !active && (blocker || over);
            return `<button type="button" class="adv-btn${active ? ' is-on' : ''}" data-adv="${a.id}" data-dots="${n}" ${disabled ? 'disabled' : ''} title="${over && !active ? 'Не вистачає крапок' : ''}">${dots(n)}</button>`;
          }).join('');
        }
        const count = a.multi && mine.length ? `<span class="adv-count">узято: ${mine.length}</span>` : '';
        return `
          <div class="adv-card${mine.length ? ' is-owned' : ''}${blocker ? ' is-blocked' : ''}" data-search="${esc((a.name + ' ' + a.short + ' ' + a.cat).toLowerCase())}">
            <div class="adv-head"><b>${esc(a.name)}</b><span class="tag tag-${a.kind.replace('tb', '').toLowerCase()}">${ADV_KIND[a.kind]}</span>${count}</div>
            <p class="adv-short">${linkify(a.short)}</p>
            <div class="adv-controls">${controls}</div>
            ${blocker ? `<span class="power-block">${esc(blocker)}</span>` : ''}
          </div>`;
      }).join('');
      return `<section class="adv-cat" data-cat><h3>${esc(cat)}</h3><div class="adv-grid">${items}</div></section>`;
    }).join('');

    const autoRows = autos.map((x) => `
      <li><span><span class="tag tag-${x.kind}">${ADV_KIND[x.kind]}</span>${nameWithHint(x.name)}<small class="muted adv-src">${esc(x.source)}</small></span><span class="dots">${dots(x.dots)}</span></li>`).join('');

    const mineRows = state.advs.map((x) => {
      const a = advById(x.id);
      return `
        <li class="mine-row">
          <div class="mine-head">
            <span><span class="tag tag-${a.kind.replace('tb', '').toLowerCase()}">${ADV_KIND[a.kind]}</span>${esc(a.name)}</span>
            <span class="mine-right"><span class="dots">${dots(x.dots)}</span><button type="button" class="mine-remove" data-remove="${x.uid}" aria-label="Прибрати ${esc(a.name)}">✕</button></span>
          </div>
          ${a.note ? `<input class="text-input mine-note" type="text" data-note="${x.uid}" maxlength="80" placeholder="${esc(a.note)}" value="${esc(x.note || '')}">` : ''}
        </li>`;
    }).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Переваги й вади</h1>
        <p>Розподіліть ${budget.merits} крапок ${termLink('advantages', 'переваг')} (${termLink('merit', 'чесноти')} й ${termLink('background', 'надбання')}) та ${budget.flaws} крапки ${termLink('flaw', 'вад')}. Бонуси від типу хижака й клану вже враховано окремо — вони не з’їдають бюджет.</p>
      </div>
      <div class="layout">
        <div>
          <div class="adv-toolbar">
            <div class="tabs" role="tablist">${tabs.map((t) => `<button type="button" role="tab" class="tab${t.id === tab.id ? ' is-active' : ''}" data-tab="${t.id}" aria-selected="${t.id === tab.id}">${esc(t.label)}</button>`).join('')}</div>
            <input class="text-input adv-search" type="search" placeholder="Пошук…" value="${esc(advQuery)}" autocomplete="off">
          </div>
          <div id="advList">${cards}</div>
          <p class="aside-empty" id="advEmpty" hidden>Нічого не знайдено</p>
        </div>
        <aside class="aside" id="detail">
          ${budgetBar('Переваги', spent.merits, budget.merits, 'advantages')}
          ${budgetBar('Вади', spent.flaws, budget.flaws, 'flaw')}
          ${thin ? `<div class="muted" style="margin-top:8px">Рідкокровців: чеснот ${spent.tbMerits}, вад ${spent.tbFlaws} (1–3, порівну)</div>` : ''}
          <div class="detail-section">${sectionTitle('Ваш вибір')}${mineRows ? `<ul class="mine-list">${mineRows}</ul>` : '<p class="muted">Поки нічого не обрано</p>'}</div>
          ${autoRows ? `<div class="detail-section">${sectionTitle('Отримано автоматично')}<ul class="gain-list">${autoRows}</ul></div>` : ''}
          <div class="page-ref">Базова книга (PDF), с. 136, 181–196</div>
        </aside>
      </div>`;

    $view.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => update({ advTab: el.dataset.tab })));

    const search = $view.querySelector('.adv-search');
    const applySearch = () => {
      const q = advQuery.trim().toLowerCase();
      let any = false;
      $view.querySelectorAll('[data-cat]').forEach((sec) => {
        let visible = 0;
        sec.querySelectorAll('.adv-card').forEach((card) => {
          const show = !q || card.dataset.search.includes(q);
          card.hidden = !show;
          if (show) visible++;
        });
        sec.hidden = !visible;
        if (visible) any = true;
      });
      document.getElementById('advEmpty').hidden = any;
    };
    search.addEventListener('input', () => { advQuery = search.value; applySearch(); });
    applySearch();

    $view.querySelectorAll('[data-adv]').forEach((el) => el.addEventListener('click', () => {
      const a = advById(el.dataset.adv);
      const n = Number(el.dataset.dots);
      let advs = state.advs.slice();
      const existing = advs.find((x) => x.id === a.id);
      if (a.kind === 'tbMerit' || a.kind === 'tbFlaw') {
        advs = existing ? advs.filter((x) => x !== existing) : advs.concat({ uid: newUid(), id: a.id, dots: 0, note: '' });
      } else if (a.multi || !existing) {
        advs.push({ uid: newUid(), id: a.id, dots: n, note: '' });
      } else if (existing.dots === n) {
        advs = advs.filter((x) => x !== existing);
      } else {
        advs = advs.map((x) => (x === existing ? Object.assign({}, x, { dots: n }) : x));
      }
      update({ advs });
    }));
    $view.querySelectorAll('[data-remove]').forEach((el) => el.addEventListener('click', () => {
      update({ advs: state.advs.filter((x) => x.uid !== el.dataset.remove) });
    }));
    $view.querySelectorAll('[data-note]').forEach((el) => el.addEventListener('input', () => {
      const advs = state.advs.map((x) => (x.uid === el.dataset.note ? Object.assign({}, x, { note: el.value }) : x));
      update({ advs }, { render: false });
    }));
  }

  // ---------- Крок 9: погляди ----------

  function renderViewsStep() {
    const { max } = VTM.convictionLimits;
    const humanity = baseHumanity() + ((ageById(state.age) || {}).humanity || 0) + ((predatorResult() || {}).humanity || 0);

    const rows = state.views.map((v, i) => `
      <section class="view-card">
        <header class="view-head">
          <h2>Переконання ${i + 1}</h2>
          ${state.views.length > 1 ? `<button type="button" class="mine-remove" data-vremove="${v.uid}" aria-label="Прибрати переконання ${i + 1}">✕</button>` : ''}
        </header>
        <div class="field">
          <label class="field-label" for="c-${v.uid}">Переконання <span class="req">*</span>${hint('convictions')}</label>
          <input class="text-input" id="c-${v.uid}" type="text" list="dl-convictions" maxlength="140" data-vfield="conviction" data-vuid="${v.uid}" placeholder="Цінність, якої ви тримаєтеся попри Звіра" value="${esc(v.conviction)}">
        </div>
        <div class="view-touch">
          <div class="field">
            <label class="field-label" for="t-${v.uid}">Опора <span class="req">*</span>${hint('touchstone')}</label>
            <input class="text-input" id="t-${v.uid}" type="text" maxlength="80" data-vfield="touchstone" data-vuid="${v.uid}" placeholder="Ім’я живої людини" value="${esc(v.touchstone)}">
          </div>
          <div class="field">
            <label class="field-label" for="w-${v.uid}">Хто вона для вас</label>
            <input class="text-input" id="w-${v.uid}" type="text" list="dl-touchstones" maxlength="140" data-vfield="touchstoneWho" data-vuid="${v.uid}" placeholder="Сестра, що досі мене шукає" value="${esc(v.touchstoneWho)}">
          </div>
        </div>
      </section>`).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Погляди</h1>
        <p>Оберіть від 1 до 3 ${termLink('convictions', 'переконань')} — людських цінностей, яких ваш вампір тримається навіть після смерті. До кожного — ${termLink('touchstone', 'опору')}: живу людину, що це переконання втілює.</p>
      </div>
      <div class="layout">
        <div>
          ${rows}
          ${state.views.length < max ? '<button type="button" class="btn btn-add" id="btnAddView">+ Додати переконання</button>' : ''}
        </div>
        <aside class="aside" id="detail">
          <div class="detail-section" style="margin-top:0">${sectionTitle('Людяність', 'humanity')}<p class="big-num">${humanity}</p></div>
          <div class="detail-section">${sectionTitle('Приклади переконань')}
            <div class="chips chips-btn">${VTM.convictionExamples.map((e) => `<button type="button" class="chip chip-btn" data-cexample="${esc(e)}">${esc(e)}</button>`).join('')}</div>
          </div>
          <div class="callout">${linkify('Якщо опора гине, ви втрачаєте відповідне переконання. Порушення переконання може дати Плями.')}</div>
          <div class="page-ref">Базова книга (PDF), с. 174–175</div>
        </aside>
      </div>
      <datalist id="dl-convictions">${VTM.convictionExamples.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
      <datalist id="dl-touchstones">${VTM.touchstoneExamples.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>`;

    const setView = (uid, patch, opts) => update({ views: state.views.map((v) => (v.uid === uid ? Object.assign({}, v, patch) : v)) }, opts);

    $view.querySelectorAll('[data-vfield]').forEach((el) => el.addEventListener('input', () => {
      setView(el.dataset.vuid, { [el.dataset.vfield]: el.value }, { render: false });
    }));
    // Приклад заповнює перше порожнє переконання або додає нове
    $view.querySelectorAll('[data-cexample]').forEach((el) => el.addEventListener('click', () => {
      const empty = state.views.find((v) => !v.conviction.trim());
      if (empty) setView(empty.uid, { conviction: el.dataset.cexample });
      else if (state.views.length < max) update({ views: state.views.concat({ uid: newUid(), conviction: el.dataset.cexample, touchstone: '', touchstoneWho: '' }) });
    }));
    $view.querySelectorAll('[data-vremove]').forEach((el) => el.addEventListener('click', () => {
      update({ views: state.views.filter((v) => v.uid !== el.dataset.vremove) });
    }));
    const add = document.getElementById('btnAddView');
    if (add) add.addEventListener('click', () => update({ views: state.views.concat({ uid: newUid(), conviction: '', touchstone: '', touchstoneWho: '' }) }));
  }

  // ---------- Крок 10: досвід ----------

  // Рядок «назва · крапки · − / +» для всього, що підвищується за рівнями
  function xpRow(kind, id, name, base, extra, max, nextCost, left) {
    const canAdd = base + extra < max && nextCost <= left;
    const title = base + extra >= max ? 'Максимум' : nextCost > left ? 'Не вистачає досвіду' : `Наступна крапка: ${nextCost} XP`;
    return `
      <div class="xp-row${extra ? ' is-bought' : ''}">
        <span class="xp-name">${name}</span>
        <span class="dots xp-dots">${dots(base)}<span class="xp-new">${dots(extra)}</span><span class="dots-empty">${'○'.repeat(Math.max(0, max - base - extra))}</span></span>
        <span class="xp-ctl">
          <button type="button" class="xp-btn" data-xp="${kind}" data-id="${id}" data-d="-1" ${extra ? '' : 'disabled'} aria-label="Скасувати крапку: ${esc(name.replace(/<[^>]+>/g, ''))}">−</button>
          <button type="button" class="xp-btn xp-plus" data-xp="${kind}" data-id="${id}" data-d="1" ${canAdd ? '' : 'disabled'} title="${title}">+${base + extra < max ? ` ${nextCost}` : ''}</button>
        </span>
      </div>`;
  }

  function renderXpStep() {
    const available = xpAvailable();
    const age = ageById(state.age);
    if (!available) {
      $view.innerHTML = `
        <div class="step-head">
          <h1>Досвід</h1>
          <p>${esc(age.name)} не отримує стартових ${termLink('xp', 'очок досвіду')} — переходьте до підсумку.</p>
        </div>`;
      return;
    }

    const x = state.xp;
    const spent = xpSpent();
    const left = available - spent;
    const clan = clanById(state.clan);

    const attrRows = Object.keys(VTM.attributeGroups).map((group) => `
      <div class="xp-col"><div class="xp-col-title">${esc(VTM.attributeGroups[group])}</div>
        ${VTM.attributes.filter((a) => a.group === group).map((a) => {
          const base = attrValue(a.id);
          const extra = x.attrs[a.id] || 0;
          return xpRow('attrs', a.id, termLink(a.id, esc(a.name)), base, extra, 5, (base + extra + 1) * 5, left);
        }).join('')}
      </div>`).join('');

    const skillRows = Object.keys(VTM.attributeGroups).map((group) => `
      <div class="xp-col"><div class="xp-col-title">${esc(VTM.attributeGroups[group])}</div>
        ${VTM.skills.filter((s) => s.group === group).map((s) => {
          const base = skillBase(s.id);
          const extra = x.skills[s.id] || 0;
          return xpRow('skills', s.id, termLink(s.id, esc(s.name)), base, extra, 5, (base + extra + 1) * 3, left);
        }).join('')}
      </div>`).join('');

    const discOptions = xpDisciplineOptions();
    const discRows = discOptions.map((d) => {
      const base = disciplineDots(d);
      const extra = x.discs[d] || 0;
      const rate = disciplineXpRate(d);
      const label = `${termLink('disc-' + d, esc(discName(d)))} <small class="muted">× ${rate}</small>`;
      let picker = '';
      if (extra) {
        const total = base + extra;
        const owned = allPowers(d);
        const full = owned.length >= total;
        const items = VTM.powers.filter((p) => p.discipline === d && p.level <= total && !(base && chosenPowers(d).includes(p.id))).map((p) => {
          const checked = xpPowers(d).includes(p.id);
          let reason = checked ? null : xpPowerBlocker(p, d);
          if (!checked && !reason && !full && !powerLevelsValid(owned.map((id) => powerById(id).level).concat(p.level))) reason = 'Спершу візьміть силу нижчого рівня';
          const disabled = !checked && (full || reason);
          return `
            <label class="power power-sm${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}">
              <input type="checkbox" data-xpower="${p.id}" data-pdisc="${d}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
              <span class="power-body"><span class="power-name">${p.level} · ${esc(p.name)}</span><span class="power-short">${esc(p.short)}</span>${reason ? `<span class="power-block">${esc(reason)}</span>` : ''}</span>
            </label>`;
        }).join('');
        picker = `<div class="xp-powers"><div class="power-count${owned.length === total ? ' is-done' : ''}">Нові сили: ${xpPowers(d).length} / ${extra}</div><div class="power-list">${items}</div></div>`;
      }
      return xpRow('discs', d, label, base, extra, 5, (base + extra + 1) * rate, left) + picker;
    }).join('');

    const limits = VTM.generationLimits[state.generation] || { max: 0 };
    const bpBase = finalBloodPotency();
    const bpRow = isThinBlood(clan) ? '' : xpRow('bp', 'bp', termLink('bloodPotency', 'Сила Крові'), bpBase, x.bp || 0, limits.max, (bpBase + (x.bp || 0) + 1) * 10, left);

    const specRows = x.specs.map((s) => `
      <div class="xp-spec">
        <select class="text-input" data-xspec-skill="${s.uid}">
          <option value="">— навичка —</option>
          ${VTM.skills.filter((k) => finalSkill(k.id)).map((k) => `<option value="${k.id}" ${k.id === s.skill ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}
        </select>
        <input class="text-input" type="text" ${s.skill ? `list="dl-${s.skill}"` : ''} data-xspec-text="${s.uid}" maxlength="60" placeholder="спеціалізація" value="${esc(s.text)}">
        <button type="button" class="mine-remove" data-xspec-remove="${s.uid}" aria-label="Прибрати спеціалізацію">✕</button>
      </div>`).join('');
    const datalists = VTM.skills.map((s) => `<datalist id="dl-${s.id}">${s.specialties.map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`).join('');

    // Переваги за досвід: лише чесноти й надбання, по 3 XP за крапку
    const advOptions = VTM.advantages.filter((a) => isMeritKind(a.kind) && !advBlocker(a, null, true));
    const advCats = [...new Set(advOptions.map((a) => a.cat))];
    const advSelect = `
      <select class="text-input" id="xpAdvSelect">
        <option value="">— перевага —</option>
        ${advCats.map((cat) => `<optgroup label="${esc(cat)}">${advOptions.filter((a) => a.cat === cat).map((a) => `<option value="${a.id}">${esc(a.name)} (${a.dots.map(dots).join(' / ')})</option>`).join('')}</optgroup>`).join('')}
      </select>`;
    const advRows = x.advs.map((e) => {
      const a = advById(e.id);
      const blocker = advBlocker(a, e.uid, true);
      return `
        <li class="mine-row">
          <div class="mine-head">
            <span><span class="tag tag-${a.kind}">${ADV_KIND[a.kind]}</span>${esc(a.name)}</span>
            <span class="mine-right"><span class="dots">${dots(e.dots)}</span><small class="muted">${e.dots * 3} XP</small><button type="button" class="mine-remove" data-xadv-remove="${e.uid}" aria-label="Прибрати ${esc(a.name)}">✕</button></span>
          </div>
          ${a.note ? `<input class="text-input mine-note" type="text" data-xadv-note="${e.uid}" maxlength="80" placeholder="${esc(a.note)}" value="${esc(e.note || '')}">` : ''}
          ${blocker ? `<span class="power-block">${esc(blocker)}</span>` : ''}
        </li>`;
    }).join('');

    const bsDots = totalDisciplineDots('bloodSorcery');
    const ritualSection = bsDots ? `
      <section class="xp-section">
        <h2>Ритуали${hint('ritual')} <small class="muted">рівень × 3</small></h2>
        <div class="power-list">${VTM.rituals.filter((r) => r.level <= bsDots && r.id !== state.ritual).map((r) => {
          const checked = x.rituals.includes(r.id);
          const disabled = !checked && r.level * 3 > left;
          return `
            <label class="power power-sm${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}">
              <input type="checkbox" data-xritual="${r.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
              <span class="power-body"><span class="power-name">${r.level} · ${esc(r.name)} <small class="muted">${r.level * 3} XP</small></span><span class="power-short">${esc(r.short)}</span></span>
            </label>`;
        }).join('')}</div>
      </section>` : '';

    const pct = Math.min(100, (spent / available) * 100);
    $view.innerHTML = `
      <div class="step-head">
        <h1>Досвід</h1>
        <p>${esc(age.name)} отримує ${available} ${termLink('xp', 'очок досвіду')}. Вартість — за таблицею книги: кнопка «+» показує ціну наступної крапки. Нові крапки виділено золотим.</p>
      </div>
      <div class="layout">
        <div>
          <section class="xp-section"><h2>Характеристики <small class="muted">новий рівень × 5</small></h2><div class="xp-cols">${attrRows}</div></section>
          <section class="xp-section"><h2>Навички <small class="muted">новий рівень × 3</small></h2><div class="xp-cols">${skillRows}</div></section>
          ${discOptions.length ? `<section class="xp-section"><h2>Дисципліни <small class="muted">кланова × 5 · каїтифська × 6 · позакланова × 7</small></h2>${discRows}</section>` : ''}
          ${ritualSection}
          <section class="xp-section">
            <h2>Спеціалізації <small class="muted">3 XP кожна</small></h2>
            ${specRows}
            <button type="button" class="btn btn-add" id="btnXpSpec" ${left >= 3 ? '' : 'disabled'}>+ Додати спеціалізацію (3 XP)</button>
          </section>
          <section class="xp-section">
            <h2>Переваги <small class="muted">3 XP за крапку</small></h2>
            <div class="xp-adv-add">${advSelect}<select class="text-input" id="xpAdvDots" disabled><option>—</option></select><button type="button" class="btn" id="btnXpAdv" disabled>Додати</button></div>
            ${advRows ? `<ul class="mine-list" style="margin-top:10px">${advRows}</ul>` : ''}
          </section>
          ${bpRow ? `<section class="xp-section"><h2>Сила Крові <small class="muted">новий рівень × 10</small></h2>${bpRow}</section>` : ''}
          ${datalists}
        </div>
        <aside class="aside" id="detail">
          <div class="xp-total"><span>Залишилось</span><b>${left}</b><span class="muted">із ${available} XP</span></div>
          <div class="budget ${spent === available ? 'is-done' : ''}"><div class="budget-bar"><span style="width:${pct}%"></span></div></div>
          ${left > 0 ? `<div class="callout">Невитрачений досвід можна залишити, але книга радить витратити його під час створення — узгодьте з Оповідачем.</div>` : ''}
          <div class="detail-section">${sectionTitle('Вартість')}
            <table class="bp-table">
              <tr><th>Характеристика</th><td>новий рівень × 5</td></tr>
              <tr><th>Навичка</th><td>новий рівень × 3</td></tr>
              <tr><th>Спеціалізація</th><td>3</td></tr>
              <tr><th>Кланова дисципліна</th><td>новий рівень × 5</td></tr>
              <tr><th>Каїтифська дисципліна</th><td>новий рівень × 6</td></tr>
              <tr><th>Позакланова дисципліна</th><td>новий рівень × 7</td></tr>
              <tr><th>Ритуал</th><td>рівень × 3</td></tr>
              <tr><th>Перевага</th><td>3 за крапку</td></tr>
              <tr><th>Сила Крові</th><td>новий рівень × 10</td></tr>
            </table>
          </div>
          <div class="page-ref">Базова книга (PDF), с. 153</div>
        </aside>
      </div>`;

    const setXp = (patch, opts) => update({ xp: Object.assign({}, state.xp, patch) }, opts);

    $view.querySelectorAll('[data-xp]').forEach((el) => el.addEventListener('click', () => {
      const kind = el.dataset.xp;
      const id = el.dataset.id;
      const delta = Number(el.dataset.d);
      if (kind === 'bp') { setXp({ bp: Math.max(0, (state.xp.bp || 0) + delta) }); return; }
      const map = Object.assign({}, state.xp[kind]);
      map[id] = (map[id] || 0) + delta;
      const patch = {};
      if (map[id] <= 0) delete map[id];
      patch[kind] = map;
      // Знижуючи дисципліну, прибираємо нові сили — їх доведеться обрати заново
      if (kind === 'discs' && delta < 0) patch.powers = Object.assign({}, state.xp.powers, { [id]: [] });
      setXp(patch);
    }));
    $view.querySelectorAll('[data-xpower]').forEach((el) => el.addEventListener('change', () => {
      const d = el.dataset.pdisc;
      let list = xpPowers(d).filter((id) => id !== el.dataset.xpower);
      if (el.checked) list.push(el.dataset.xpower);
      list = list.filter((id) => !powerById(id).requires || allPowers(d).concat(list).includes(powerById(id).requires));
      setXp({ powers: Object.assign({}, state.xp.powers, { [d]: list }) });
    }));
    $view.querySelectorAll('[data-xritual]').forEach((el) => el.addEventListener('change', () => {
      const rest = state.xp.rituals.filter((id) => id !== el.dataset.xritual);
      setXp({ rituals: el.checked ? rest.concat(el.dataset.xritual) : rest });
    }));

    document.getElementById('btnXpSpec').addEventListener('click', () => setXp({ specs: state.xp.specs.concat({ uid: newUid(), skill: '', text: '' }) }));
    $view.querySelectorAll('[data-xspec-skill]').forEach((el) => el.addEventListener('change', () => {
      setXp({ specs: state.xp.specs.map((s) => (s.uid === el.dataset.xspecSkill ? Object.assign({}, s, { skill: el.value }) : s)) });
    }));
    $view.querySelectorAll('[data-xspec-text]').forEach((el) => el.addEventListener('input', () => {
      setXp({ specs: state.xp.specs.map((s) => (s.uid === el.dataset.xspecText ? Object.assign({}, s, { text: el.value }) : s)) }, { render: false });
    }));
    $view.querySelectorAll('[data-xspec-remove]').forEach((el) => el.addEventListener('click', () => {
      setXp({ specs: state.xp.specs.filter((s) => s.uid !== el.dataset.xspecRemove) });
    }));

    const advSel = document.getElementById('xpAdvSelect');
    const advDots = document.getElementById('xpAdvDots');
    const advBtn = document.getElementById('btnXpAdv');
    advSel.addEventListener('change', () => {
      const a = advById(advSel.value);
      const affordable = a ? a.dots.filter((n) => n * 3 <= left) : [];
      advDots.innerHTML = affordable.length ? affordable.map((n) => `<option value="${n}">${dots(n)} — ${n * 3} XP</option>`).join('') : '<option>не вистачає досвіду</option>';
      advDots.disabled = !affordable.length;
      advBtn.disabled = !affordable.length;
    });
    advBtn.addEventListener('click', () => {
      if (!advSel.value) return;
      setXp({ advs: state.xp.advs.concat({ uid: newUid(), id: advSel.value, dots: Number(advDots.value), note: '' }) });
    });
    $view.querySelectorAll('[data-xadv-remove]').forEach((el) => el.addEventListener('click', () => {
      setXp({ advs: state.xp.advs.filter((e) => e.uid !== el.dataset.xadvRemove) });
    }));
    $view.querySelectorAll('[data-xadv-note]').forEach((el) => el.addEventListener('input', () => {
      setXp({ advs: state.xp.advs.map((e) => (e.uid === el.dataset.xadvNote ? Object.assign({}, e, { note: el.value }) : e)) }, { render: false });
    }));
  }

  // Блок листа: секта, Маска, сір, зв'язки, уточнення клану, зовнішність і схема мапи
  function storySheet() {
    const st = state.story;
    const row = (label, value, term) => (value ? `<div class="detail-section">${sectionTitle(label, term)}<p>${esc(value)}</p></div>` : '');
    const join = (...xs) => xs.map((x) => (x || '').trim()).filter(Boolean).join(' · ');
    const sire = st.sire.name.trim() ? join(st.sire.name, st.sire.clan, st.sire.year && `Залучений ${st.sire.year}`, st.sire.position) + (st.sire.embrace.trim() ? ` — ${st.sire.embrace.trim()}` : '') : '';
    const npcs = st.sectNpcs.filter((n) => n.name.trim()).map((n) => `${join(n.name, n.clan, n.year, n.position)}${n.relation.trim() ? ` — ${n.relation.trim()}` : ''}`);
    const coterie = st.coterie.filter((n) => n.name.trim()).map((n) => `${n.name.trim()}${n.relation.trim() ? ` — ${n.relation.trim()}` : ''}`);
    const people = peopleList().filter((p) => p.name).map((p) => `${p.name} — ${p.label}`);
    const malk = st.malkDisorder.trim() ? `${st.malkDisorder.trim()}${st.malkCategory ? ` (штраф: ${MALK_CATEGORIES.find((m) => m.id === st.malkCategory).name.toLowerCase()} кидки)` : ''}` : '';
    const list = (label, items, term) => (items.length ? `<div class="detail-section">${sectionTitle(label, term)}<ul class="plain-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
    const body = [
      row('Секта', sectName()),
      row('Ім’я Маски', join(st.maskName, st.kindredName && `кревне ім’я: ${st.kindredName}`), 'mask'),
      row('Хто ви вночі', st.nightJob.trim()),
      row('Сір', sire, 'sire'),
      list('Вампіри секти', npcs),
      list('Котерія', coterie, 'coterie'),
      list('Люди з переваг', people, 'background'),
      row('Уподобання Вентру', st.ventruePrey.trim(), 'bane'),
      row('Недуга Малкавіана', malk, 'bane'),
      row('Зовнішність', st.appearance.trim()),
      row('Дивацтва', st.quirks.trim()),
    ].join('');
    if (!body && !mapNodes().length) return '';
    return `
      <div class="detail-section">${sectionTitle('Зв’язки та історія', 'relationshipMap')}</div>
      <div class="sheet-grid">${body}</div>
      <div class="detail-section sheet-map">${relationshipMap(760, 380)}</div>`;
  }

  // ---------- Мапа зв'язків (схема) ----------

  const trunc = (str, n) => (str.length > n ? str.slice(0, n - 1) + '…' : str);

  // Кольори як у книзі: кревні — червоні, смертні — сині, персонажі гравців — нейтральні (с. 145)
  function mapNodes() {
    const st = state.story;
    const nodes = [];
    if (st.sire.name.trim()) nodes.push({ type: 'kin', name: st.sire.name.trim(), label: st.sire.embrace.trim() ? `сір · ${st.sire.embrace.trim()}` : 'сір' });
    st.sectNpcs.forEach((n) => { if (n.name.trim()) nodes.push({ type: 'kin', name: n.name.trim(), label: n.relation.trim() || 'секта' }); });
    st.coterie.forEach((n) => { if (n.name.trim()) nodes.push({ type: 'pc', name: n.name.trim(), label: n.relation.trim() || 'котерія' }); });
    state.views.forEach((v) => { if (v.touchstone.trim()) nodes.push({ type: 'mortal', name: v.touchstone.trim(), label: 'опора' }); });
    peopleList().forEach((p) => { if (p.name) nodes.push({ type: p.kin ? 'kin' : 'mortal', name: p.name, label: p.label }); });
    return nodes;
  }

  function relationshipMap(w, h) {
    const nodes = mapNodes();
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 - 120;
    const ry = h / 2 - 44;
    const me = trunc(state.concept.name.trim() || 'Ваш персонаж', 22);
    const parts = nodes.map((n, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      const cos = Math.cos(angle);
      const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
      const dx = anchor === 'start' ? 10 : anchor === 'end' ? -10 : 0;
      const dy = anchor === 'middle' ? (Math.sin(angle) < 0 ? -30 : 20) : -2;
      return {
        line: `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="map-line map-${n.type}"/>`,
        node: `<g class="map-node map-${n.type}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>
          <text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="map-name">${esc(trunc(n.name, 20))}</text>
          <text x="${(x + dx).toFixed(1)}" y="${(y + dy + 14).toFixed(1)}" text-anchor="${anchor}" class="map-label">${esc(trunc(n.label, 26))}</text></g>`,
      };
    });
    const meW = Math.max(110, me.length * 8.5 + 24);
    return `
      <svg class="rel-map" viewBox="0 0 ${w} ${h}" role="img" aria-label="Мапа зв’язків">
        ${parts.map((p) => p.line).join('')}
        ${parts.map((p) => p.node).join('')}
        <g class="map-me"><rect x="${cx - meW / 2}" y="${cy - 18}" width="${meW}" height="36" rx="8"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">${esc(me)}</text></g>
        ${nodes.length ? '' : `<text x="${cx}" y="${cy + 48}" text-anchor="middle" class="map-label">Заповнюйте поля — зв’язки з’являться тут</text>`}
      </svg>
      <div class="map-legend"><span class="lg lg-kin">кревні</span><span class="lg lg-mortal">смертні</span><span class="lg lg-pc">гравці</span></div>`;
  }

  // ---------- Крок 11: зв'язки та історія ----------

  const EMBRACE_EXAMPLES = ['випадкове Залучення', 'готував до цієї сили', 'моя помилка', 'болісне Залучення', 'ненавидить'];
  const KIN_POSITIVE = ['мій пан', 'поважаю її щирість', 'захоплюється мною', 'теж проти Принца'];
  const KIN_NEGATIVE = ['винен мені гроші', 'зрадник', 'боягуз', 'моторошно захоплюється мною'];
  const COTERIE_POSITIVE = ['старий друг', 'довіряю', 'у великому боргу'];
  const COTERIE_NEGATIVE = ['не довіряю', 'прагну перевершити', 'змагаємося за прихильність'];
  const NIGHT_JOBS = ['охоронець', 'бармен', 'таксист', 'медсестра нічної зміни', 'програміст, що працює ночами', 'працівник цілодобового магазину', 'тусовщик без роботи'];
  const MALK_CATEGORIES = [{ id: 'physical', name: 'Фізичні' }, { id: 'social', name: 'Соціальні' }, { id: 'mental', name: 'Ментальні' }];

  function storyField(path, label, opts) {
    const o = opts || {};
    const value = path.split('.').reduce((obj, k) => (obj == null ? '' : obj[k]), state.story) || '';
    const id = 'st-' + path.replace(/\./g, '-');
    const required = o.required ? ' <span class="req">*</span>' : '';
    const needs = o.required && !String(value).trim() ? ' needs-input' : '';
    const control = o.textarea
      ? `<textarea class="text-input" id="${id}" data-story="${path}" rows="3" maxlength="600" placeholder="${esc(o.placeholder || '')}">${esc(value)}</textarea>`
      : `<input class="text-input" id="${id}" type="text" data-story="${path}" maxlength="${o.max || 120}" placeholder="${esc(o.placeholder || '')}" value="${esc(value)}"${o.list ? ` list="${o.list}"` : ''}>`;
    const chips = o.chips ? `<div class="chips chips-btn">${o.chips.map((c) => `<button type="button" class="chip chip-btn" data-story-chip="${path}" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
    return `<div class="field${o.wide ? ' field-wide' : ''}${needs}"><label class="field-label" for="${id}">${esc(label)}${required}${o.term ? hint(o.term) : ''}</label>${control}${chips}</div>`;
  }

  function renderStoryStep() {
    const st = state.story;
    const clan = clanById(state.clan);
    const childe = state.age === 'childe';

    const sectRadios = SECTS.map((x) => `
      <label class="option${st.sect === x.id ? ' is-checked' : ''}">
        <input type="radio" name="sect" value="${x.id}" ${st.sect === x.id ? 'checked' : ''}>
        <span>${esc(x.name)}</span>
      </label>`).join('');

    const npcCards = st.sectNpcs.map((n, i) => `
      <div class="npc-card">
        <div class="npc-title">${i === 0 ? 'Позитивний зв’язок' : 'Негативний зв’язок'}</div>
        <div class="form-grid">
          ${storyField(`sectNpcs.${i}.name`, 'Ім’я', { required: !childe, placeholder: 'Ім’я кревного' })}
          ${storyField(`sectNpcs.${i}.clan`, 'Клан', { list: 'dl-clans', placeholder: 'Тореадор' })}
          ${storyField(`sectNpcs.${i}.year`, 'Рік Залучення', { max: 20, placeholder: '1987' })}
          ${storyField(`sectNpcs.${i}.position`, 'Позиція в секті', { placeholder: 'Шериф, гарпія…' })}
          ${storyField(`sectNpcs.${i}.relation`, 'Ставлення', { required: !childe, wide: true, chips: i === 0 ? KIN_POSITIVE : KIN_NEGATIVE })}
        </div>
      </div>`).join('');

    const coterieCards = st.coterie.map((n, i) => `
      <div class="npc-card">
        <div class="npc-title">${i === 0 ? 'Позитивний зв’язок' : 'Негативний зв’язок'}</div>
        <div class="form-grid">
          ${storyField(`coterie.${i}.name`, 'Персонаж гравця', { placeholder: 'Ім’я персонажа' })}
          ${storyField(`coterie.${i}.relation`, 'Ставлення', { chips: i === 0 ? COTERIE_POSITIVE : COTERIE_NEGATIVE })}
        </div>
      </div>`).join('');

    const people = peopleList();
    const peopleRows = people.map((p) => `
      <div class="field${p.name ? '' : ' needs-input'}">
        <label class="field-label" for="pp-${p.key}">${esc(p.title)} <span class="dots">${dots(p.dots)}</span> <span class="req">*</span>${p.auto ? ` <small class="muted">· ${esc(p.source)}</small>` : ''}</label>
        <input class="text-input" id="pp-${p.key}" type="text" maxlength="80" data-person="${p.key}" ${p.auto ? 'data-auto="1"' : ''} placeholder="Хто це: ім’я, хто він вам" value="${esc(p.name)}">
      </div>`).join('');

    const clanBlock = state.clan === 'ventrue' ? `
      <section class="view-card"><h2>Вентру: вибагливий смак</h2>
        <p class="muted">Прокляття клану: ви можете живитися лише певним типом смертних.</p>
        ${storyField('ventruePrey', 'Якою кров’ю ви живитеся?', { required: true, placeholder: 'натуральні брюнетки, солдати, люди з ПТСР…' })}
      </section>` : state.clan === 'malkavian' ? `
      <section class="view-card"><h2>Малкавіан: недуга</h2>
        <p class="muted">Природу розладу й категорію штрафу ви з Оповідачем вибираєте під час створення персонажа.</p>
        ${storyField('malkDisorder', 'Яким є ваш розлад?', { required: true, placeholder: 'чує фізичні відчуття як голоси…' })}
        <div class="field${st.malkCategory ? '' : ' needs-input'}"><span class="field-label">На які кидки діє штраф <span class="req">*</span></span>
          <div class="options options-row">${MALK_CATEGORIES.map((m) => `
            <label class="option${st.malkCategory === m.id ? ' is-checked' : ''}"><input type="radio" name="malkCategory" value="${m.id}" ${st.malkCategory === m.id ? 'checked' : ''}><span>${esc(m.name)}</span></label>`).join('')}
          </div>
        </div>
      </section>` : '';

    $view.innerHTML = `
      <div class="step-head">
        <h1>Зв’язки та історія</h1>
        <p>Те, що книга просить записати на ${termLink('relationshipMap', 'мапу зв’язків')} і розповісти Оповідачеві: секта, сір, знайомі кревні й усі люди, що стоять за вашими перевагами. Поля із * обов’язкові.</p>
      </div>
      <div class="layout">
        <div>
          <section class="view-card"><h2>Секта</h2>
            <div class="options options-row${st.sect ? '' : ' needs-input'}">${sectRadios}</div>
            ${st.sect === 'other' ? storyField('sectOther', 'Яка саме?', { required: true, placeholder: 'Ашірра, Шабаш…' }) : ''}
          </section>

          <section class="view-card"><h2>Сір</h2>
            <div class="form-grid">
              ${storyField('sire.name', 'Ім’я сіра', { required: true, term: 'sire', placeholder: 'Хто вас Залучив' })}
              ${storyField('sire.clan', 'Клан', { list: 'dl-clans', placeholder: clan ? clan.name : '' })}
              ${storyField('sire.year', 'Рік Залучення сіра', { max: 20, placeholder: '1920' })}
              ${storyField('sire.position', 'Позиція в секті', { placeholder: 'анцила, прімоген, Барон…' })}
              ${storyField('sire.embrace', 'Обставини вашого Залучення', { required: true, wide: true, chips: EMBRACE_EXAMPLES })}
            </div>
          </section>

          <section class="view-card"><h2>Вампіри вашої секти</h2>
            <p class="muted">${childe ? 'Наймолодші дитята можуть ще не мати зв’язків у секті — заповніть, якщо вони вже є.' : 'Двоє місцевих кревних: імена дає Оповідач, або пов’яжіть себе із сіром чи персонажем іншого гравця (с. 146). Це ще не надбання.'}</p>
            ${npcCards}
          </section>

          <section class="view-card"><h2>Котерія</h2>
            <p class="muted">Зв’язки з двома іншими персонажами гравців — зазвичай їх визначають разом на нульовій сесії.</p>
            ${coterieCards}
          </section>

          <section class="view-card"><h2>Люди з ваших переваг і вад</h2>
            ${people.length ? `<p class="muted">Книга просить внести на мапу кожного, хто стоїть за вашими контактами, союзниками, отарою чи ворогами.</p><div class="form-grid form-grid-1">${peopleRows}</div>` : '<p class="muted">Серед ваших переваг немає конкретних людей.</p>'}
          </section>

          ${clanBlock}

          <section class="view-card"><h2>Маска й ніч</h2>
            <div class="form-grid">
              ${storyField('maskName', 'Ім’я Маски', { term: 'mask', placeholder: 'Якщо ви офіційно мертві' })}
              ${storyField('kindredName', 'Кревне ім’я', { placeholder: 'Для Елізіуму, за бажанням' })}
              ${storyField('nightJob', 'Хто ви вночі', { wide: true, list: 'dl-night', placeholder: 'Чому вас ніколи не бачать удень' })}
            </div>
          </section>

          <section class="view-card"><h2>Погляньте в дзеркало</h2>
            <div class="form-grid form-grid-1">
              ${storyField('appearance', 'Зовнішність', { textarea: true, placeholder: 'Як ваші риси й переваги видно ззовні: погляд, одяг, статура' })}
              ${storyField('quirks', 'Дивацтва', { textarea: true, placeholder: 'Звички, дивний гумор, дрібниці, що вирізняють персонажа' })}
            </div>
          </section>
        </div>
        <aside class="aside" id="detail">
          ${sectionTitle('Мапа зв’язків', 'relationshipMap')}
          <div id="mapPreview">${relationshipMap(400, 380)}</div>
          <div class="callout">Мапа зв’язків — спільна схема хроніки. Оповідач доповнюватиме її під час гри.</div>
          <div class="page-ref">Базова книга (PDF), с. 136, 142–153, 156</div>
        </aside>
      </div>
      <datalist id="dl-clans">${VTM.clans.map((c) => `<option value="${esc(c.name)}">`).join('')}<option value="Невідомо"></datalist>
      <datalist id="dl-night">${NIGHT_JOBS.map((j) => `<option value="${esc(j)}">`).join('')}</datalist>`;

    const setStoryPath = (path, value) => {
      const story = JSON.parse(JSON.stringify(state.story));
      const keys = path.split('.');
      let obj = story;
      keys.slice(0, -1).forEach((k) => { obj = obj[k]; });
      obj[keys[keys.length - 1]] = value;
      return story;
    };
    const refreshMap = () => { document.getElementById('mapPreview').innerHTML = relationshipMap(400, 380); };

    $view.querySelectorAll('[data-story]').forEach((el) => el.addEventListener('input', () => {
      update({ story: setStoryPath(el.dataset.story, el.value) }, { render: false });
      const field = el.closest('.field');
      if (field && field.querySelector('.req')) field.classList.toggle('needs-input', !el.value.trim());
      refreshMap();
    }));
    $view.querySelectorAll('[data-story-chip]').forEach((el) => el.addEventListener('click', () => {
      update({ story: setStoryPath(el.dataset.storyChip, el.dataset.value) });
    }));
    $view.querySelectorAll('input[name="sect"]').forEach((el) => el.addEventListener('change', () => update({ story: setStoryPath('sect', el.value) })));
    $view.querySelectorAll('input[name="malkCategory"]').forEach((el) => el.addEventListener('change', () => update({ story: setStoryPath('malkCategory', el.value) })));
    // Люди з переваг: обрані записи зберігають ім'я в уточненні переваги, автоматичні — в story.people
    $view.querySelectorAll('[data-person]').forEach((el) => el.addEventListener('input', () => {
      const key = el.dataset.person;
      if (el.dataset.auto) {
        update({ story: Object.assign({}, state.story, { people: Object.assign({}, state.story.people, { [key]: el.value }) }) }, { render: false });
      } else {
        const setNote = (list) => list.map((x) => (x.uid === key ? Object.assign({}, x, { note: el.value }) : x));
        update({ advs: setNote(state.advs), xp: Object.assign({}, state.xp, { advs: setNote(state.xp.advs) }) }, { render: false });
      }
      el.closest('.field').classList.toggle('needs-input', !el.value.trim());
      refreshMap();
    }));
  }

  // ---------- Підсумок ----------

  function renderSummary() {
    const clan = clanById(state.clan);
    const age = ageById(state.age);
    const r = predatorResult();
    const bp = characterBloodPotency();
    const discs = clan.anyDisciplines ? 'будь-які' : clan.disciplines.map(discName).join(', ');
    // Переваги й вади: спершу обрані, потім автоматичні; чесноти й надбання — перед вадами
    const advRow = (kind, name, dotsN, extra) => `<li><span><span class="tag tag-${kind}">${ADV_KIND[kind]}</span>${nameWithHint(name)}${extra ? ` <small class="sheet-spec">${esc(extra)}</small>` : ''}</span><span class="dots">${dots(dotsN)}</span></li>`;
    const allAdvs = state.advs.concat(state.xp.advs).map((x) => {
      const a = advById(x.id);
      return { kind: a.kind.replace('tb', '').toLowerCase(), name: a.name, dots: x.dots, extra: x.note && x.note.trim() };
    }).concat(autoAdvantages().map((x) => ({ kind: x.kind, name: x.name, dots: x.dots, extra: x.source })));
    const items = allAdvs.filter((x) => x.kind !== 'flaw').concat(allAdvs.filter((x) => x.kind === 'flaw'))
      .map((x) => advRow(x.kind, x.name, x.dots, x.extra)).join('');
    const humanity = baseHumanity() + (age.humanity || 0) + r.humanity;
    // Каїтифи й рідкокровці не мають кланового прокляття
    const hasBane = !clan.anyDisciplines && !isThinBlood(clan);
    const ageExtras = [
      age.xp ? `досвід: витрачено ${xpSpent()} з ${age.xp}` : null,
      age.advantages ? `${age.advantages} крапки переваг` : null,
      age.flaws ? `${age.flaws} крапки вад` : null,
    ].filter(Boolean).join(', ');
    const c = state.concept;
    const conceptRows = [['Амбіція', c.ambition, 'ambition'], ['Бажання', c.desire, 'desire'], ['Сір', c.sire, 'sire'], ['Хроніка', c.chronicle, 'chronicle']]
      .filter(([, v]) => v.trim())
      .map(([label, v, term]) => `<div class="detail-section">${sectionTitle(label, term)}<p>${esc(v)}</p></div>`).join('');
    const attrCols = Object.keys(VTM.attributeGroups).map((group) => `
      <div>
        <div class="sheet-attr-group">${esc(VTM.attributeGroups[group])}</div>
        ${VTM.attributes.filter((a) => a.group === group).map((a) => `
          <div class="sheet-attr"><span>${termLink(a.id, esc(a.name))}</span><span class="dots">${dots(finalAttr(a.id))}<span class="dots-empty">${'○'.repeat(5 - finalAttr(a.id))}</span></span></div>`).join('')}
      </div>`).join('');
    const discRows = Object.keys(VTM.disciplines).filter((d) => totalDisciplineDots(d) > 0).map((d) => `
      <div class="sheet-disc">
        <div class="sheet-attr"><span><b>${termLink('disc-' + d, esc(discName(d)))}</b>${clan.disciplines.includes(d) || clan.anyDisciplines ? '' : ' <small class="sheet-spec">позакланова</small>'}</span><span class="dots">${dots(totalDisciplineDots(d))}<span class="dots-empty">${'○'.repeat(5 - totalDisciplineDots(d))}</span></span></div>
        <div class="sheet-powers">${allPowers(d).map((id) => powerById(id)).sort((a, b) => a.level - b.level).map((p) => `<span>${p.level} · ${esc(p.name)}</span>`).join('')}</div>
      </div>`).join('');
    const ritualNames = (disciplineDots('bloodSorcery') && state.ritual ? [state.ritual] : []).concat(state.xp.rituals).map((id) => ritualById(id).name);
    const ritualRow = ritualNames.length ? `<div class="sheet-disc"><div class="sheet-attr"><span>${termLink('ritual', ritualNames.length > 1 ? 'Ритуали' : 'Ритуал')}</span><span>${esc(ritualNames.join(', '))}</span></div></div>` : '';
    const discBlock = isThinBlood(clan)
      ? `<p>${esc(discs)} — узгодьте з Оповідачем.</p>`
      : `<div class="sheet-discs">${discRows}${ritualRow}</div>`;
    const skillSpecs = (id) => specialtyList(true).filter((s) => s.skill === id).map((s) => s.text);
    const skillCols = Object.keys(VTM.attributeGroups).map((group) => `
      <div>
        <div class="sheet-attr-group">${esc(VTM.attributeGroups[group])}</div>
        ${VTM.skills.filter((s) => s.group === group).map((s) => {
          const sp = skillSpecs(s.id);
          return `
          <div class="sheet-attr"><span>${termLink(s.id, esc(s.name))}${sp.length ? ` <small class="sheet-spec">${esc(sp.join(', '))}</small>` : ''}</span><span class="dots">${dots(finalSkill(s.id))}<span class="dots-empty">${'○'.repeat(5 - finalSkill(s.id))}</span></span></div>`;
        }).join('')}
      </div>`).join('');

    $view.innerHTML = `
      <div class="step-head">
        <h1>Підсумок</h1>
        <p>Персонаж готовий. Перевірте лист і збережіть його в PDF.</p>
      </div>
      <article class="sheet">
        <div class="sheet-head">
          ${clanArt(clan)}
          <div>
            <h2>${esc(c.name)}</h2>
            <div class="detail-sub">${esc(c.concept)} · ${esc(clan.name)}</div>
            <div class="chips">
              <span class="chip">${esc(age.name)} · ${state.generation}-те покоління</span>
              <span class="chip">Тип хижака: ${esc(r.pred.name)}</span>
            </div>
          </div>
        </div>
        ${conceptRows ? `<div class="sheet-grid">${conceptRows}</div>` : ''}
        <div class="detail-section">${sectionTitle('Характеристики')}<div class="sheet-attrs">${attrCols}</div></div>
        <div class="detail-section">${sectionTitle('Навички')}<div class="sheet-attrs">${skillCols}</div></div>
        <div class="detail-section">${sectionTitle('Дисципліни', 'discipline')}${discBlock}</div>
        <div class="detail-section">${sectionTitle('Шкали')}
          <div class="trackers">
            ${tracker('health', 'Здоров’я', finalAttr('stamina') + 3, 0, finalAttr('stamina') + 3)}
            ${tracker('willpower', 'Сила волі', finalAttr('composure') + finalAttr('resolve'), 0, finalAttr('composure') + finalAttr('resolve'))}
            ${tracker('humanity', 'Людяність', 10, humanity, humanity)}
            ${tracker('hunger', 'Голод', 5, 0)}
          </div>
        </div>
        <div class="sheet-grid">
          <div class="detail-section">${sectionTitle('Сила Крові', 'bloodPotency')}<p>${bp}${hasBane ? ` · згубність прокляття ${VTM.bloodPotency[bp].bane}` : ''}</p></div>
          <div class="detail-section">${sectionTitle('Людяність', 'humanity')}<p>${humanity}</p></div>
          <div class="detail-section">${sectionTitle('Спеціалізації', 'specialty')}<p>${esc(specialtyList(true).map((s) => `${skillById(s.skill).name} (${s.text})`).join(', '))}</p></div>
          ${ageExtras ? `<div class="detail-section">${sectionTitle('Від віку', 'xp')}<p>${esc(ageExtras)}</p></div>` : '<div></div>'}
          <div class="detail-section">${sectionTitle('Прокляття', 'bane')}<p>${linkify(clan.bane)}</p></div>
          ${clan.compulsion ? `<div class="detail-section">${sectionTitle(`Примус · ${clan.compulsion.name}`, 'compulsion')}<p>${linkify(clan.compulsion.text)}</p></div>` : '<div></div>'}
        </div>
        ${items ? `<div class="detail-section">${sectionTitle('Переваги й вади', 'advantages')}<ul class="gain-list">${items}</ul></div>` : ''}
        <div class="detail-section">${sectionTitle('Переконання та опори', 'convictions')}
          <ul class="gain-list">${state.views.map((v) => `<li><span>${esc(v.conviction)}</span><span class="view-touch-sum">${esc(v.touchstone)}${v.touchstoneWho.trim() ? ` <small class="sheet-spec">${esc(v.touchstoneWho)}</small>` : ''}</span></li>`).join('')}</ul>
        </div>
        ${storySheet()}
        ${c.notes.trim() ? `<div class="detail-section">${sectionTitle('Історія та нотатки')}<p class="notes">${esc(c.notes)}</p></div>` : ''}
        <div class="sheet-actions">
          ${IN_ARTIFACT ? '' : '<button type="button" class="btn btn-primary" id="btnPrint">Друк</button>'}
          <button type="button" class="btn${IN_ARTIFACT ? ' btn-primary' : ''}" id="btnPdf">Зберегти PDF</button>
          <button type="button" class="btn" id="btnExport">Зберегти у файл</button>
          <button type="button" class="btn" id="btnImport">Завантажити з файлу</button>
          <button type="button" class="btn" id="btnReset">Почати заново</button>
        </div>
        <p class="todo">${IN_ARTIFACT ? 'Щоб надрукувати лист, збережіть PDF і відкрийте його — друк звідси недоступний.' : 'PDF — готовий лист формату A4 для друку чи телефона.'} Файл персонажа (.vtm.json) можна завантажити пізніше або передати іншому гравцю.</p>
      </article>`;

    const printBtn = document.getElementById('btnPrint');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const pdfBtn = document.getElementById('btnPdf');
    pdfBtn.addEventListener('click', () => exportPdf(pdfBtn));
    document.getElementById('btnExport').addEventListener('click', exportCharacter);
    document.getElementById('btnImport').addEventListener('click', importCharacter);
    document.getElementById('btnReset').addEventListener('click', () => {
      askConfirm('Скинути персонажа й почати спочатку?', 'Скинути').then((ok) => {
        if (!ok) return;
        state = emptyState();
        save();
        render();
        window.scrollTo({ top: 0 });
      });
    });
  }

  // Шкала з клітинками для гри на папері: filled — скільки клітинок зафарбовано
  function tracker(termId, label, size, filled, value) {
    const boxes = Array.from({ length: size }, (_, i) => `<span class="box${i < filled ? ' is-filled' : ''}"></span>`).join('');
    return `<div class="tracker"><span class="tracker-label">${termLink(termId, esc(label))}${value != null ? ` <b>${value}</b>` : ''}</span><span class="boxes">${boxes}</span></div>`;
  }

  // ---------- Діалоги й сповіщення (вбудовані: confirm/alert недоступні в артефакті) ----------

  function askConfirm(message, okLabel) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal modal-sm" role="alertdialog" aria-modal="true">
          <p class="confirm-text">${esc(message)}</p>
          <div class="sheet-actions" style="margin-top:0;justify-content:flex-end">
            <button type="button" class="btn" data-answer="0">Скасувати</button>
            <button type="button" class="btn btn-primary" data-answer="1">${esc(okLabel || 'Так')}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const done = (ok) => { modal.remove(); document.removeEventListener('keydown', onKey); resolve(ok); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      modal.querySelectorAll('[data-answer]').forEach((b) => b.addEventListener('click', () => done(b.dataset.answer === '1')));
      modal.addEventListener('click', (e) => { if (e.target === modal) done(false); });
      document.addEventListener('keydown', onKey);
      modal.querySelector('[data-answer="1"]').focus();
    });
  }

  function notify(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ---------- Збереження у файл і завантаження ----------

  const SAVE_FORMAT = 'vtm5-creator';
  // У вбудованій сторінці claude.ai є window.claude: там друк і пряме завантаження заблоковані
  const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === 'function');
  const fileBaseName = () => (state.concept.name.trim() || 'персонаж').replace(/[\\/:*?"<>|]+/g, '_');

  async function saveFile(filename, text, mime) {
    if (IN_ARTIFACT) {
      const downloads = await window.claude.use('downloads');
      if (!downloads) { notify('Збереження файлів недоступне в цьому перегляді.'); return; }
      try {
        await downloads.save({ filename, data: text });
        notify('Файл збережено');
      } catch (e) {
        if (e && e.code !== 'declined') notify('Не вдалося зберегти файл. Спробуйте ще раз.');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCharacter() {
    const data = { format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), character: state };
    saveFile(`${fileBaseName()}.vtm.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  // ---------- PDF листа ----------
  // Бібліотеки вантажимо з cdnjs лише при першому збереженні PDF
  const PDF_LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  ];
  let pdfLibsPromise = null;

  function loadPdfLibs() {
    if (!pdfLibsPromise) {
      pdfLibsPromise = PDF_LIBS.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Не завантажився ${src}`));
        document.head.appendChild(script);
      })), Promise.resolve()).catch((e) => { pdfLibsPromise = null; throw e; });
    }
    return pdfLibsPromise;
  }

  // Шукаємо над межею сторінки широку білу смугу (проміжок між блоками, а не між рядками тексту)
  const PDF_GAP_PX = 28;
  function findPageBreak(ctx, width, top, limit) {
    const from = Math.floor(top + (limit - top) * 0.6);
    const data = ctx.getImageData(0, from, width, limit - from).data;
    let run = 0;
    for (let y = limit - from - 1; y >= 0; y--) {
      let blank = true;
      for (let x = 0, i = y * width * 4; x < width; x++, i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) { blank = false; break; }
      }
      run = blank ? run + 1 : 0;
      if (run >= PDF_GAP_PX) return from + y + Math.floor(PDF_GAP_PX / 2);
    }
    return limit;
  }

  async function exportPdf(btn) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Готую PDF…';
    try {
      await loadPdfLibs();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      // Світла копія листа поза екраном
      const wrap = document.createElement('div');
      wrap.className = 'pdf-render';
      const sheet = document.querySelector('.sheet').cloneNode(true);
      sheet.querySelectorAll('.sheet-actions, .todo, .hint').forEach((el) => el.remove());
      // Відкрито з диска (file://): такі картинки «забруднюють» canvas, тож у PDF ставимо заглушку
      sheet.querySelectorAll('.sheet-head img').forEach((img) => {
        if (location.protocol === 'file:' && !img.src.startsWith('data:')) img.outerHTML = clanArt(clanById(state.clan), false, true);
      });
      wrap.appendChild(sheet);
      document.body.appendChild(wrap);
      const scale = 2;
      // Де можна розривати сторінку: перед секцією, рядком списку, дисципліною чи шкалою
      const wrapTop = wrap.getBoundingClientRect().top;
      const breaks = [...new Set(Array.from(wrap.querySelectorAll('.detail-section, .sheet-grid, .gain-list li, .sheet-disc, .tracker'))
        .map((el) => Math.round((el.getBoundingClientRect().top - wrapTop) * scale)))].sort((a, b) => a - b);
      let canvas;
      try {
        canvas = await window.html2canvas(wrap, { scale, backgroundColor: '#ffffff', logging: false });
      } finally {
        wrap.remove();
      }

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const margin = 10;
      const pageW = 210 - margin * 2;
      const pxPerMm = canvas.width / pageW;
      const pagePx = Math.floor((297 - margin * 2) * pxPerMm);
      const ctx = canvas.getContext('2d');
      for (let top = 0, first = true; top < canvas.height - 2; first = false) {
        const limit = top + pagePx;
        const fit = breaks.filter((y) => y > top + pagePx * 0.5 && y <= limit).pop();
        const end = limit >= canvas.height ? canvas.height : fit || findPageBreak(ctx, canvas.width, top, limit);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - top;
        slice.getContext('2d').drawImage(canvas, 0, top, canvas.width, end - top, 0, 0, canvas.width, end - top);
        if (!first) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, (end - top) / pxPerMm);
        top = end;
      }
      pdf.setProperties({ title: state.concept.name || 'Персонаж' });
      await saveFile(`${fileBaseName()}.pdf`, pdf.output('blob'), 'application/pdf');
    } catch (e) {
      notify('Не вдалося створити PDF. Перевірте з’єднання з інтернетом і спробуйте ще раз.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // Дані з файлу — недовірені: лишаємо тільки відомі id і значення в допустимих межах
  function sanitizeCharacter(c) {
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max || 500) : '');
    const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
    const oneOf = (v, ids) => (ids.includes(v) ? v : null);
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    const ids = (list) => list.map((x) => x.id);
    const discIds = Object.keys(VTM.disciplines);
    const powerIds = ids(VTM.powers);
    const ritualIds = ids(VTM.rituals);
    const advIds = ids(VTM.advantages);
    const intMap = (m, keys, min, max) => {
      const out = {};
      Object.keys(obj(m)).forEach((k) => { const v = int(m[k], min, max); if (keys.includes(k) && v !== null) out[k] = v; });
      return out;
    };
    const powerMap = (m) => {
      const out = {};
      Object.keys(obj(m)).forEach((k) => { if (discIds.includes(k)) out[k] = arr(m[k]).filter((p) => powerIds.includes(p)); });
      return out;
    };
    const advList = (list) => arr(list).filter((x) => advIds.includes(obj(x).id))
      .map((x) => ({ uid: newUid(), id: x.id, dots: int(x.dots, 0, 6) || 0, note: str(x.note, 80) }));
    const pred = obj(c.pred);
    const concept = obj(c.concept);
    const specs = obj(c.specs);
    const xp = obj(c.xp);
    const skillIds = ids(VTM.skills);
    return Object.assign(emptyState(), {
      step: int(c.step, 0, STEPS.length - 1) || 0,
      clan: oneOf(c.clan, ids(VTM.clans)),
      age: oneOf(c.age, ids(VTM.ages)),
      generation: int(c.generation, 10, 16),
      predator: oneOf(c.predator, ids(VTM.predators)),
      pred: {
        specialty: int(pred.specialty, 0, 5),
        specialtyDetail: str(pred.specialtyDetail, 60),
        discipline: oneOf(pred.discipline, discIds),
        picks: intMap(pred.picks, ['flaw'], 0, 5),
        splits: Object.fromEntries(Object.keys(obj(pred.splits)).filter((k) => ['backgrounds', 'flaws'].includes(k))
          .map((k) => [k, arr(pred.splits[k]).slice(0, 2).map((v) => int(v, 0, 3) || 0)])),
      },
      concept: Object.fromEntries(Object.keys(emptyConcept()).map((k) => [k, str(concept[k], k === 'notes' ? 4000 : 120)])),
      attrs: intMap(c.attrs, ids(VTM.attributes), 1, 4),
      skillDist: oneOf(c.skillDist, ids(VTM.skillDistributions)),
      skills: intMap(c.skills, skillIds, 1, 4),
      specs: {
        auto: Object.fromEntries(Object.keys(obj(specs.auto)).filter((k) => VTM.freeSpecialtySkills.includes(k)).map((k) => [k, str(specs.auto[k], 60)])),
        freeSkill: oneOf(specs.freeSkill, skillIds),
        freeText: str(specs.freeText, 60),
      },
      discDots: intMap(c.discDots, discIds, 1, 2),
      powers: powerMap(c.powers),
      ritual: oneOf(c.ritual, ritualIds),
      advs: advList(c.advs),
      advTab: oneOf(c.advTab, ADV_TABS.map((t) => t.id)) || 'background',
      views: arr(c.views).slice(0, 3).map((v) => ({ uid: newUid(), conviction: str(obj(v).conviction, 140), touchstone: str(obj(v).touchstone, 80), touchstoneWho: str(obj(v).touchstoneWho, 140) })),
      xp: {
        attrs: intMap(xp.attrs, ids(VTM.attributes), 1, 4),
        skills: intMap(xp.skills, skillIds, 1, 5),
        discs: intMap(xp.discs, discIds, 1, 5),
        powers: powerMap(xp.powers),
        specs: arr(xp.specs).map((s) => ({ uid: newUid(), skill: oneOf(obj(s).skill, skillIds) || '', text: str(obj(s).text, 60) })),
        advs: advList(xp.advs),
        bp: int(xp.bp, 0, 4) || 0,
        rituals: arr(xp.rituals).filter((r) => ritualIds.includes(r)),
      },
      humanity8: c.humanity8 === true,
      story: (() => {
        const st = obj(c.story);
        const tpl = emptyStory();
        const pick = (o, shape) => Object.fromEntries(Object.keys(shape).map((k) => [k, str(obj(o)[k], 600)]));
        return Object.assign(tpl, {
          sect: oneOf(st.sect, SECTS.map((x) => x.id)) || '',
          sectOther: str(st.sectOther, 120),
          maskName: str(st.maskName, 120),
          kindredName: str(st.kindredName, 120),
          nightJob: str(st.nightJob, 120),
          sire: pick(st.sire, tpl.sire),
          sectNpcs: tpl.sectNpcs.map((shape, i) => pick(arr(st.sectNpcs)[i], shape)),
          coterie: tpl.coterie.map((shape, i) => pick(arr(st.coterie)[i], shape)),
          people: Object.fromEntries(Object.keys(obj(st.people)).filter((k) => /^auto-\d+-[A-Za-z]+$/.test(k)).map((k) => [k, str(st.people[k], 80)])),
          ventruePrey: str(st.ventruePrey, 120),
          malkDisorder: str(st.malkDisorder, 120),
          malkCategory: oneOf(st.malkCategory, MALK_CATEGORIES.map((m) => m.id)) || '',
          appearance: str(st.appearance, 600),
          quirks: str(st.quirks, 600),
        });
      })(),
    });
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { data = null; }
      if (!data || data.format !== SAVE_FORMAT || !data.character || typeof data.character !== 'object') {
        notify('Це не файл персонажа з цього застосунку.');
        return;
      }
      const apply = () => {
        state = sanitizeCharacter(data.character);
        if (!state.views.length) state.views = emptyState().views;
        save();
        render();
        window.scrollTo({ top: 0 });
        notify('Персонажа завантажено');
      };
      if (!state.clan) apply();
      else askConfirm('Замінити поточного персонажа завантаженим?', 'Замінити').then((ok) => { if (ok) apply(); });
    };
    reader.readAsText(file);
  });
  const importCharacter = () => fileInput.click();

  // ---------- Каркас: кроки, нижня панель ----------

  function renderStepper() {
    const el = document.getElementById('stepper');
    const real = STEPS.map((s, i) => {
      const done = i < state.step && !s.missing();
      const cls = i === state.step ? ' is-current' : done ? ' is-done' : '';
      return `<button type="button" class="step${cls}" data-step="${i}" ${canOpenStep(i) ? '' : 'disabled'}>
        <span class="step-num">${done ? '✓' : i + 1}</span><span class="step-label">${esc(s.title)}</span></button>`;
    });
    // Майбутні кроки показуємо як дорожню карту перед підсумком
    const upcoming = UPCOMING.map((t) => `<button type="button" class="step" disabled title="Незабаром"><span class="step-num">·</span><span class="step-label">${esc(t)}</span></button>`);
    el.innerHTML = real.slice(0, -1).concat(upcoming, real.slice(-1)).join('');
    el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => goTo(Number(b.dataset.step))));
    // На вузьких екранах тримаємо поточний крок у полі зору
    const cur = el.querySelector('.is-current');
    if (cur && el.scrollWidth > el.clientWidth) el.scrollLeft = cur.offsetLeft - (el.clientWidth - cur.offsetWidth) / 2;
  }

  function renderActionbar() {
    const step = STEPS[state.step];
    const missing = step.missing();
    const back = document.getElementById('btnBack');
    const next = document.getElementById('btnNext');
    back.disabled = state.step === 0;
    next.style.visibility = state.step === STEPS.length - 1 ? 'hidden' : 'visible';
    next.disabled = !!missing;

    const clan = clanById(state.clan);
    const age = ageById(state.age);
    const pred = predById(state.predator);
    const picked = [
      state.concept.name.trim(),
      clan && clan.name,
      age && state.generation && `${state.generation}-те пок.`,
      pred && pred.name,
    ].filter(Boolean).join(' · ');
    document.getElementById('status').innerHTML =
      (picked ? `<b>${esc(picked)}</b>` : '') + (missing ? `<span>${esc(missing)}</span>` : '');
  }

  function renderChrome() {
    renderStepper();
    renderActionbar();
  }

  function render() {
    hidePopover();
    while (state.step > 0 && !canOpenStep(state.step)) state.step--;
    STEPS[state.step].render();
    renderChrome();
  }

  function goTo(i) {
    if (i < 0 || i >= STEPS.length || !canOpenStep(i)) return;
    state.step = i;
    save();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollDetailOnMobile() {
    if (window.matchMedia('(max-width: 1000px)').matches) {
      const d = document.getElementById('detail');
      if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.getElementById('btnBack').addEventListener('click', () => goTo(state.step - 1));
  document.getElementById('btnNext').addEventListener('click', () => goTo(state.step + 1));

  render();
})();
