/* Red Main — audio 100% sintetizado con WebAudio (sin archivos externos).
   Lluvia, viento, truenos, música ambiente generativa y efectos de interfaz. */
(function (RM) {
  'use strict';
  var A = { ready: false };
  var ctx, master, musicBus, sfxBus, ambBus, revIn;
  var rainGain = null, musicOn = false, nextNote = 0, noteIdx = 5;
  var white, brown;

  // Escala de Re menor armónica, registro medio: suena a caja de música rota.
  var SCALE = [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 277.18, 293.66, 329.63, 349.23, 440.0];

  function noiseBuffer(sec, kind) {
    var len = Math.floor(ctx.sampleRate * sec);
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
    }
    return b;
  }

  function impulse(sec, decay) {
    var len = Math.floor(ctx.sampleRate * sec);
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function bus(send) {
    var g = ctx.createGain();
    g.connect(master);
    var s = ctx.createGain();
    s.gain.value = send;
    g.connect(s);
    s.connect(revIn);
    return g;
  }

  function filter(type, freq, q) {
    var f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    return f;
  }

  function gainNode(v) { var g = ctx.createGain(); g.gain.value = v; return g; }

  function chain() {
    for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]);
    return arguments[arguments.length - 1];
  }

  A.init = function () {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    comp.connect(ctx.destination);
    master = gainNode(0.9); master.connect(comp);
    var conv = ctx.createConvolver();
    conv.buffer = impulse(4.5, 2.6);
    revIn = gainNode(1);
    var revOut = gainNode(0.55);
    chain(revIn, conv, revOut, master);
    musicBus = bus(0.7); sfxBus = bus(0.35); ambBus = bus(0.08);
    white = noiseBuffer(3, 'white');
    brown = noiseBuffer(5, 'brown');
    A.ready = true;
    A.applySettings();
    return true;
  };

  A.state = function () { return ctx ? ctx.state : 'none'; };
  A.resume = function () { return ctx && ctx.state !== 'running' ? ctx.resume() : Promise.resolve(); };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };

  A.applySettings = function () {
    if (!ctx) return;
    var s = RM.settings, t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(s.music * 0.85, t, 0.15);
    sfxBus.gain.setTargetAtTime(s.sfx, t, 0.15);
    ambBus.gain.setTargetAtTime(s.sfx * 0.85, t, 0.15);
    if (rainGain) rainGain.gain.setTargetAtTime(0.32 * (0.25 + 0.75 * s.rain), t, 0.4);
  };

  function loop(buf, offset) {
    var s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(0, offset || 0);
    return s;
  }

  // Lluvia + viento: capas de ruido filtrado en bucle.
  A.startAmbience = function () {
    if (!ctx || rainGain) return;
    rainGain = gainNode(0);
    rainGain.connect(ambBus);
    chain(loop(white), filter('highpass', 450), filter('lowpass', 6500), gainNode(0.55), rainGain);
    chain(loop(white, 1.3), filter('bandpass', 2600, 0.6), gainNode(0.35), rainGain);
    chain(loop(brown), filter('lowpass', 750), gainNode(0.6), rainGain);
    // Viento con ráfagas lentas.
    var wind = gainNode(0.12);
    chain(loop(brown, 2), filter('bandpass', 320, 0.8), wind, ambBus);
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    var depth = gainNode(0.09);
    chain(lfo, depth, wind.gain); lfo.start();
    A.applySettings();
  };

  // Drone oscuro + notas generativas.
  A.startMusic = function () {
    if (!ctx || musicOn) return;
    musicOn = true;
    var lp = filter('lowpass', 360, 5);
    var g = gainNode(0);
    g.gain.setTargetAtTime(0.13, ctx.currentTime, 4);
    [[36.71, 'sawtooth', 0.5], [36.98, 'sawtooth', 0.5], [55.0, 'triangle', 0.35], [73.42, 'triangle', 0.25]].forEach(function (o) {
      var osc = ctx.createOscillator();
      osc.type = o[1]; osc.frequency.value = o[0];
      chain(osc, gainNode(o[2]), lp); osc.start();
    });
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    chain(lfo, gainNode(170), lp.frequency); lfo.start();
    chain(lp, g, musicBus);
    nextNote = ctx.currentTime + 2.5;
  };

  function bell(t, f, amp) {
    [[1, 1], [2.01, 0.25], [3.0, 0.08]].forEach(function (p) {
      var o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f * p[0];
      var g = gainNode(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * p[1], t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 / p[0]);
      chain(o, g, musicBus);
      o.start(t); o.stop(t + 3.5);
    });
  }

  // Llamado cada frame: agenda la siguiente nota de la melodía.
  A.tick = function () {
    if (!ctx || !musicOn || ctx.state !== 'running') return;
    var t = ctx.currentTime;
    if (nextNote < t) nextNote = t + 0.1;
    if (t > nextNote - 0.15) {
      noteIdx = RM.clamp(noteIdx + Math.round(RM.rand(-2.4, 2.4)), 0, SCALE.length - 1);
      bell(nextNote, SCALE[noteIdx], 0.14);
      if (Math.random() < 0.25) bell(nextNote + 0.02, SCALE[Math.max(0, noteIdx - 4)] / 2, 0.08);
      nextNote += Math.random() < 0.3 ? RM.rand(0.35, 0.6) : RM.rand(1.8, 4.2);
    }
  };

  // Trueno: dist 0 = encima tuyo, 1 = lejano.
  A.thunder = function (dist) {
    if (!ctx) return;
    var t = ctx.currentTime, near = 1 - dist;
    if (near > 0.5) {
      var crack = ctx.createBufferSource(); crack.buffer = white;
      var cg = gainNode(0);
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(0.9 * near, t + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      chain(crack, filter('highpass', 1100), cg, sfxBus);
      crack.start(t, Math.random() * 2, 0.6);
    }
    var dur = RM.rand(3.5, 7);
    var r = ctx.createBufferSource(); r.buffer = brown; r.loop = true;
    var g = gainNode(0.0001);
    var peak = 1.7 * (0.3 + near * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06 + dist * 0.5);
    for (var tt = t + 0.35; tt < t + dur * 0.7; tt += RM.rand(0.15, 0.55)) {
      g.gain.linearRampToValueAtTime(peak * RM.rand(0.25, 0.95), tt);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(r, filter('lowpass', 110 + near * 420, 0.9), g, sfxBus);
    r.start(t, Math.random() * 3);
    r.stop(t + dur + 0.1);
  };

  function thump(t, f0, amp, dur) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + dur);
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, g, sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseHit(t, type, freq, amp, dur, q) {
    var s = ctx.createBufferSource(); s.buffer = white;
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, filter(type, freq, q), g, sfxBus);
    s.start(t, Math.random() * 2, dur + 0.1);
  }

  A.heartbeat = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    thump(t, 70, 0.9, 0.22); thump(t + 0.22, 62, 0.6, 0.25);
  };

  A.eyeOpen = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = white;
    var bp = filter('bandpass', 300, 4);
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(4200, t + 0.9);
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    chain(s, bp, g, sfxBus); s.start(t, 0, 1.1);
  };

  A.logoHit = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    thump(t, 90, 1.0, 1.2);
    noiseHit(t, 'lowpass', 500, 0.6, 1.0);
    [1, 2.41, 3.93, 5.37].forEach(function (m, i) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 196 * m;
      var g = gainNode(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12 / (i + 1), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 / (i * 0.5 + 1));
      chain(o, g, sfxBus); o.start(t); o.stop(t + 4);
    });
  };

  A.hover = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    noiseHit(t, 'bandpass', 900, 0.22, 0.25, 1.5);
    thump(t, 140, 0.15, 0.18);
  };

  A.select = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    thump(t, 110, 1.0, 0.9);
    noiseHit(t, 'lowpass', 1800, 0.5, 0.6);
    noiseHit(t, 'highpass', 3000, 0.15, 0.3);
  };

  A.back = function () {
    if (!ctx) return;
    var t = ctx.currentTime;
    noiseHit(t, 'bandpass', 500, 0.3, 0.35, 2);
    thump(t, 90, 0.35, 0.3);
  };

  RM.audio = A;
})(window.RM);
