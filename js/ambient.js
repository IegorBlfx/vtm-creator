// Генеративний темний ембієнт на Web Audio API — без аудіофайлів і ліцензій.
// Шари: низький гул із «диханням» фільтра, повільні мінорні акорди, дощ, рідкі дзвони й далеке серцебиття.
// Браузери дозволяють звук лише після дії користувача, тому start() викликається з кліку.
window.VTM = window.VTM || {};

VTM.ambient = (function () {
  'use strict';

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Ре мінор: Dm – B♭ – Gm – A
  const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 50, 55], [45, 49, 52]];
  const BELL_NOTES = [74, 77, 79, 81, 84, 86];
  const MASTER_LEVEL = 0.25; // тихий фон: ~ −26 dBFS RMS

  let ctx = null;
  let master = null;
  let reverb = null;
  let timers = [];
  let chordIndex = 0;
  let playing = false;

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
  function noise(c, seconds) {
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

  // Будує постійні шари в контексті c (живому або офлайн для перевірки)
  function build(c) {
    const out = c.createDynamicsCompressor();
    out.threshold.value = -18;
    out.ratio.value = 3;
    out.connect(c.destination);
    const m = c.createGain();
    m.gain.value = 0;
    m.connect(out);
    const rv = c.createConvolver();
    rv.buffer = impulse(c, 5, 3);
    const wet = c.createGain();
    wet.gain.value = 0.55;
    rv.connect(wet);
    wet.connect(m);

    // Гул: дві розстроєні пилки на ре та синусоїдальний суббас, повільно «дихає» фільтр
    const droneFilter = c.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 1.5;
    const droneGain = c.createGain();
    droneGain.gain.value = 0.16;
    droneFilter.connect(droneGain);
    droneGain.connect(m);
    droneGain.connect(rv);
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

    // Дощ: відфільтрований рожевий шум, гучність повільно хвилюється
    const rain = c.createBufferSource();
    rain.buffer = noise(c, 6);
    rain.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5500;
    const rainGain = c.createGain();
    rainGain.gain.value = 0.09;
    const rainLfo = c.createOscillator();
    rainLfo.frequency.value = 0.07;
    const rainDepth = c.createGain();
    rainDepth.gain.value = 0.03;
    rainLfo.connect(rainDepth);
    rainDepth.connect(rainGain.gain);
    rain.connect(hp);
    hp.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(m);
    rain.start();
    rainLfo.start();

    return { master: m, reverb: rv };
  }

  // Акорд із повільним наростанням і згасанням
  function pad(c, m, rv, chord, when, dur) {
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
        g.gain.linearRampToValueAtTime(0.03, when + dur * 0.4);
        g.gain.linearRampToValueAtTime(0, when + dur);
        o.connect(f);
        f.connect(g);
        g.connect(m);
        g.connect(rv);
        o.start(when);
        o.stop(when + dur + 0.1);
      });
    });
  }

  // Далекий дзвін: основний тон і негармонійний обертон, переважно в реверберацію
  function bell(c, m, rv, when) {
    const freq = midi(BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)]);
    [[1, 0.05], [2.76, 0.015]].forEach(([ratio, level]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = c.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(level, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 4.5);
      o.connect(g);
      g.connect(rv);
      g.connect(m);
      o.start(when);
      o.stop(when + 4.6);
    });
  }

  // Серцебиття: два глухі удари з падінням висоти
  function heartbeat(c, m, when) {
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
      g.connect(m);
      o.start(t);
      o.stop(t + 0.35);
    });
  }

  // Живе планування подій через таймери
  function loop(fn, minS, maxS) {
    const tick = () => {
      if (!playing) return;
      fn();
      timers.push(setTimeout(tick, rand(minS, maxS) * 1000));
    };
    timers.push(setTimeout(tick, rand(minS, maxS) * 500));
  }

  function startLoops() {
    pad(ctx, master, reverb, CHORDS[chordIndex], ctx.currentTime + 0.1, 15);
    timers.push(setInterval(() => {
      if (!playing) return;
      chordIndex = (chordIndex + 1) % CHORDS.length;
      pad(ctx, master, reverb, CHORDS[chordIndex], ctx.currentTime + 0.1, 15);
    }, 12000));
    loop(() => bell(ctx, master, reverb, ctx.currentTime + 0.05), 6, 13);
    loop(() => heartbeat(ctx, master, ctx.currentTime + 0.05), 18, 32);
  }

  function clearLoops() {
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers = [];
  }

  async function start() {
    if (playing) return;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      const graph = build(ctx);
      master = graph.master;
      reverb = graph.reverb;
    }
    await ctx.resume();
    playing = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(MASTER_LEVEL, now + 3);
    startLoops();
  }

  function stop() {
    if (!ctx || !playing) return;
    playing = false;
    clearLoops();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.5);
    setTimeout(() => { if (!playing) ctx.suspend(); }, 1600);
  }

  // Офлайн-рендер кількох секунд для перевірки рівнів (без відтворення)
  async function renderPreview(seconds) {
    const c = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
    const graph = build(c);
    graph.master.gain.setValueAtTime(MASTER_LEVEL, 0);
    pad(c, graph.master, graph.reverb, CHORDS[0], 0.1, 15);
    bell(c, graph.master, graph.reverb, 2);
    heartbeat(c, graph.master, 4);
    bell(c, graph.master, graph.reverb, 6);
    return c.startRendering();
  }

  return { start, stop, isPlaying: () => playing, supported: !!(window.AudioContext || window.webkitAudioContext), renderPreview };
})();
