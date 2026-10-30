// Генеративна темна музика на Web Audio API — без аудіофайлів і ліцензій.
// Шари: низький гул із «диханням» фільтра, мінорні акорди, тихий дощ, дзвони, далеке серцебиття
// і темний електронний біт (бочка, клеп, хети, пульсуючий бас), синхронізований з акордами.
// Браузери дозволяють звук лише після дії користувача, тому start() викликається з кліку.
window.VTM = window.VTM || {};

VTM.ambient = (function () {
  'use strict';

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Ре мінор: Dm – B♭ – Gm – A, кожен акорд тримається 4 такти
  const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 50, 55], [45, 49, 52]];
  const BELL_NOTES = [74, 77, 79, 81, 84, 86];
  const MASTER_LEVEL = 0.25; // тихий фон: ~ −26 dBFS RMS
  const BPM = 96;
  const STEP = 60 / BPM / 4; // шістнадцята
  const BARS_PER_CHORD = 4;
  const BEAT_LEVEL = 0.8;

  // Візерунок такту з 16 кроків
  const KICK = [0, 6, 8];
  const CLAP = [4, 12];
  const HAT = [2, 6, 10, 14];
  const HAT_SOFT = [1, 3, 5, 7, 9, 11, 13, 15];
  const BASS = [0, 3, 6, 8, 11, 14];

  let ctx = null;
  let nodes = null;
  let timers = [];
  let playing = false;
  let nextStepTime = 0;
  let stepIndex = 0;
  let scheduler = null;

  const rand = (min, max) => min + Math.random() * (max - min);

  // Штучна реверберація: шум із експоненційним загасанням
  function impulse(c, seconds, decay) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // «Рожевий» шум для дощу (м'якший за білий)
  function pinkNoise(c, seconds) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0; let b1 = 0; let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    return buf;
  }

  // Короткий білий шум для хетів і клепа
  function whiteNoise(c, seconds) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Будує постійні шари в контексті c (живому або офлайн для перевірки)
  function build(c) {
    const out = c.createDynamicsCompressor();
    out.threshold.value = -18;
    out.ratio.value = 3;
    out.connect(c.destination);
    const master = c.createGain();
    master.gain.value = 0;
    master.connect(out);
    const reverb = c.createConvolver();
    reverb.buffer = impulse(c, 5, 3);
    const wet = c.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet);
    wet.connect(master);

    // Гул: дві розстроєні пилки на ре та синусоїдальний суббас, повільно «дихає» фільтр
    const droneFilter = c.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 1.5;
    const droneGain = c.createGain();
    droneGain.gain.value = 0.13;
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    droneGain.connect(reverb);
    [[midi(38), 'sawtooth', -7], [midi(38), 'sawtooth', 6], [midi(26), 'sine', 0]].forEach(([freq, type, detune]) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
    });
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoDepth = c.createGain();
    lfoDepth.gain.value = 120;
    lfo.connect(lfoDepth);
    lfoDepth.connect(droneFilter.frequency);
    lfo.start();

    // Дощ: тихий відфільтрований рожевий шум
    const rain = c.createBufferSource();
    rain.buffer = pinkNoise(c, 6);
    rain.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5000;
    const rainGain = c.createGain();
    rainGain.gain.value = 0.03;
    const rainLfo = c.createOscillator();
    rainLfo.frequency.value = 0.07;
    const rainDepth = c.createGain();
    rainDepth.gain.value = 0.01;
    rainLfo.connect(rainDepth);
    rainDepth.connect(rainGain.gain);
    rain.connect(hp);
    hp.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(master);
    rain.start();
    rainLfo.start();

    // Шина біту: окрема гучність, щоб біт входив плавно
    const beat = c.createGain();
    beat.gain.value = 0;
    beat.connect(master);
    const beatVerb = c.createGain();
    beatVerb.gain.value = 0.25;
    beat.connect(beatVerb);
    beatVerb.connect(reverb);

    return { master, reverb, beat, noise: whiteNoise(c, 1) };
  }

  // Акорд із повільним наростанням і згасанням
  function pad(c, n, chord, when, dur) {
    chord.forEach((note) => {
      [-6, 6].forEach((detune) => {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = midi(note);
        o.detune.value = detune;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 850;
        const g = c.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.03, when + dur * 0.35);
        g.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(f);
        f.connect(g);
        g.connect(n.master);
        g.connect(n.reverb);
        o.start(when);
        o.stop(when + dur + 0.1);
      });
    });
  }

  // Дзвін: основний тон і негармонійний обертон, переважно в реверберацію
  function bell(c, n, when) {
    const freq = midi(BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)]);
    [[1, 0.07], [2.76, 0.02]].forEach(([ratio, level]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = c.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 4.5);
      o.connect(g);
      g.connect(n.reverb);
      g.connect(n.master);
      o.start(when);
      o.stop(when + 4.6);
    });
  }

  // Серцебиття: два глухі удари з падінням висоти
  function heartbeat(c, n, when) {
    [0, 0.32].forEach((offset, i) => {
      const t = when + offset;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i ? 0.16 : 0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(n.master);
      o.start(t);
      o.stop(t + 0.35);
    });
  }

  // ---------- Біт ----------

  function kick(c, n, t) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g);
    g.connect(n.beat);
    o.start(t);
    o.stop(t + 0.45);
  }

  function noiseHit(c, n, t, opts) {
    const src = c.createBufferSource();
    src.buffer = n.noise;
    const f = c.createBiquadFilter();
    f.type = opts.type;
    f.frequency.value = opts.freq;
    f.Q.value = opts.q || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.level, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    src.connect(f);
    f.connect(g);
    g.connect(n.beat);
    src.start(t, Math.random() * 0.5);
    src.stop(t + opts.decay + 0.05);
  }

  // Бас: коротка пилка на тоніці акорду октавою нижче, з «клацанням» фільтра
  function bass(c, n, t, note) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(note);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(160, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(f);
    f.connect(g);
    g.connect(n.beat);
    o.start(t);
    o.stop(t + 0.28);
  }

  // Один крок секвенсора (шістнадцята); на початку кожних 4 тактів — новий акорд
  function playStep(c, n, step, t) {
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chord = CHORDS[Math.floor(bar / BARS_PER_CHORD) % CHORDS.length];
    if (inBar === 0 && bar % BARS_PER_CHORD === 0) pad(c, n, chord, t, BARS_PER_CHORD * 16 * STEP + 2);
    if (KICK.includes(inBar)) kick(c, n, t);
    if (CLAP.includes(inBar)) noiseHit(c, n, t, { type: 'bandpass', freq: 1500, q: 1.2, level: 0.22, decay: 0.18 });
    if (HAT.includes(inBar)) noiseHit(c, n, t, { type: 'highpass', freq: 7500, level: 0.09, decay: 0.07 });
    else if (HAT_SOFT.includes(inBar)) noiseHit(c, n, t, { type: 'highpass', freq: 9000, level: 0.03, decay: 0.04 });
    if (BASS.includes(inBar)) bass(c, n, t, chord[0] - 12);
  }

  // Планувальник з упередженням: таймер не точний, тож ноти ставимо наперед за годинником аудіо
  function schedule() {
    while (nextStepTime < ctx.currentTime + 0.12) {
      playStep(ctx, nodes, stepIndex, nextStepTime);
      nextStepTime += STEP;
      stepIndex++;
    }
  }

  function loop(fn, minS, maxS) {
    const tick = () => {
      if (!playing) return;
      fn();
      timers.push(setTimeout(tick, rand(minS, maxS) * 1000));
    };
    timers.push(setTimeout(tick, rand(minS, maxS) * 500));
  }

  function startLoops() {
    nextStepTime = ctx.currentTime + 0.1;
    stepIndex = 0;
    scheduler = setInterval(schedule, 25);
    loop(() => bell(ctx, nodes, ctx.currentTime + 0.05), 2.5, 6);
    loop(() => heartbeat(ctx, nodes, ctx.currentTime + 0.05), 18, 32);
  }

  function clearLoops() {
    clearInterval(scheduler);
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function fade(param, to, seconds) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + seconds);
  }

  async function start() {
    if (playing) return;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      nodes = build(ctx);
    }
    await ctx.resume();
    playing = true;
    fade(nodes.master.gain, MASTER_LEVEL, 3);
    // Біт входить поступово, за кілька тактів
    nodes.beat.gain.setValueAtTime(0, ctx.currentTime);
    nodes.beat.gain.linearRampToValueAtTime(BEAT_LEVEL, ctx.currentTime + 10);
    startLoops();
  }

  function stop() {
    if (!ctx || !playing) return;
    playing = false;
    clearLoops();
    fade(nodes.master.gain, 0, 1.5);
    setTimeout(() => { if (!playing) ctx.suspend(); }, 1600);
  }

  // Офлайн-рендер кількох секунд для перевірки рівнів (без відтворення)
  async function renderPreview(seconds) {
    const c = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    const n = build(c);
    n.master.gain.setValueAtTime(MASTER_LEVEL, 0);
    n.beat.gain.setValueAtTime(BEAT_LEVEL, 0);
    for (let step = 0, t = 0.05; t < seconds; step++, t += STEP) playStep(c, n, step, t);
    for (let t = 1; t < seconds; t += 4) bell(c, n, t);
    heartbeat(c, n, 5);
    return c.startRendering();
  }

  return { start, stop, isPlaying: () => playing, supported: !!(window.AudioContext || window.webkitAudioContext), renderPreview };
})();
