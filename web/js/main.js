/* Red Main — motor principal: estados, bucle, entrada y paneles. */
(function (RM) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, profile;
  var scene = new RM.Scene();
  var menu = new RM.Menu();
  var modes = new RM.Modes();
  var loader = new RM.Loader();
  var intro = null;
  // Estados: boot → tap? → intro → menu → loading → modes ⇄ (paneles) → loading → play
  var state = 'boot';
  var view = 'menu';          // qué letrero/botones se ven: 'menu' o 'modes'
  var menuFade = 1, buttonsFade = 1;
  var fade = 1, fadeTarget = 1, fadeSpeed = 1;
  var stateT = 0, last = 0, running = true, built = false;
  var play = null;            // contexto de la partida en curso
  var level = null;           // nivel jugable activo
  var saveAcc = 0;

  var $ = function (id) { return document.getElementById(id); };
  var panels = { settings: $('settings'), confirm: $('confirm'), story: $('story'), solo: $('solo'), online: $('online') };

  function setState(s) { state = s; stateT = 0; }

  /* ---------- Tamaño ---------- */

  function applyMask(src) {
    var m = src.mask || src.buildMask();
    scene.setMask(m.data, m.w, m.h, m.rect);
    scene.setBloodTips(src.bloodTips || []);
    scene.runners.length = 0;
  }

  function resize() {
    profile = RM.qualityProfile();
    dpr = profile.dpr;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    scene.resize(W, H, dpr, profile);
    menu.build(W, H, dpr);
    menu.mask = menu.buildMask();
    if (modes.built) modes.buildNow(W, H, dpr);
    applyMask(view === 'modes' ? modes : menu);
    built = true;
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  /* ---------- Bucle ---------- */

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!built) return;
    stateT += dt;
    fade += (fadeTarget - fade) * Math.min(1, dt * fadeSpeed * 3);
    RM.audio.tick();
    loader.update(dt);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state === 'tap') { drawTap(); return; }
    if (state === 'intro') {
      intro.update(dt);
      intro.draw(ctx, W, H, dpr);
      if (intro.done) enterMenu();
      return;
    }
    if (state === 'level') {
      level.update(dt);
      level.draw(ctx, W, H, dpr);
      if (fade > 0.003) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')'; ctx.fillRect(0, 0, W, H); }
      return;
    }

    var playing = state === 'play';
    menuFade += (((view === 'menu' && !playing) ? 1 : 0) - menuFade) * Math.min(1, dt * 5);
    buttonsFade += ((state === 'menu' ? 1 : 0) - buttonsFade) * Math.min(1, dt * 5);
    scene.maskOn = !playing;
    scene.hotRect = state === 'menu' ? menu.hotRect() : (state === 'modes' && !openName ? modes.hotRect() : null);
    scene.update(dt);
    menu.update(dt);
    modes.update(dt, view === 'modes' && !playing);

    ctx.save();
    if (scene.shake > 0.1) ctx.translate(RM.rand(-1, 1) * scene.shake, RM.rand(-1, 1) * scene.shake);
    scene.drawBack(ctx);
    if (menuFade > 0.01) {
      menu.drawTitle(ctx, scene.flash, menuFade);
      menu.drawButtons(ctx, scene.flash, menuFade * buttonsFade);
    }
    modes.draw(ctx, scene.flash, 1);
    scene.drawFront(ctx, dt);
    ctx.restore();
    scene.drawPost(ctx);

    if (playing) { drawPlay(dt); }

    if (fade > 0.003) {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    loader.draw(ctx, W, H);
  }

  function drawTap() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    var a = 0.55 + 0.45 * Math.sin(stateT * 2.5);
    var fs = Math.max(16, Math.min(W, H) * 0.045);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + fs + 'px "Cinzel", serif';
    ctx.fillStyle = 'rgba(230,30,20,' + a + ')';
    ctx.fillText('TOCÁ PARA COMENZAR', W / 2, H / 2);
    ctx.font = '400 ' + (fs * 0.5) + 'px "Cinzel", serif';
    ctx.fillStyle = 'rgba(200,190,210,0.55)';
    ctx.fillText('Usá auriculares para vivir la tormenta', W / 2, H / 2 + fs * 1.4);
    ctx.textAlign = 'left';
  }

  function fmtClock(s) {
    s = Math.floor(s);
    return (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2);
  }

  // Pantalla de partida (demo): cambia según el modo elegido.
  function drawPlay(dt) {
    var a = RM.smooth(0, 1.2, stateT);
    var fs = Math.min(H * 0.11, W * 0.09);
    var big, sub, lines = [], accent = '#d01a12';
    if (play.mode === 'story') {
      saveAcc += dt;
      if (saveAcc > 1) { RM.Screens.tickSave(play.slot, saveAcc); saveAcc = 0; }
      var s = RM.Screens.saves()[play.slot] || { chapter: 1, progress: 0, name: '' };
      big = 'CAPÍTULO ' + ['I', 'II', 'III', 'IV', 'V'][(s.chapter - 1) % 5];
      sub = RM.Screens.chapterName(s.chapter);
      lines.push(s.name + ' camina bajo la lluvia… (' + Math.floor(s.progress) + '%)');
      lines.push('Ranura ' + (play.slot + 1) + ' · guardado automático');
    } else if (play.mode === 'solo') {
      var lv = RM.Art.LEVELS[play.level - 1];
      big = 'NIVEL ' + lv.n;
      sub = lv.name;
      lines.push(lv.desc);
      lines.push('Sobreviviste ' + fmtClock(stateT));
      if (lv.n === 4) accent = '#ff2a1a';
    } else {
      big = 'PARTIDA ONLINE';
      sub = play.room;
      lines.push(play.players.join('  ·  '));
      lines.push('Conectados por P2P');
    }
    ctx.save();
    ctx.globalAlpha = 0.7 * a;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,20,0,0.8)'; ctx.shadowBlur = fs * 0.4;
    ctx.fillStyle = accent;
    ctx.font = fs + 'px "Metal Mania", serif';
    ctx.fillText(big, W / 2, H * 0.33);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ccd8';
    ctx.font = '700 ' + (fs * 0.36) + 'px "Cinzel", serif';
    ctx.fillText(sub, W / 2, H * 0.33 + fs * 0.85);
    ctx.font = '400 ' + (fs * 0.22) + 'px "Cinzel", serif';
    ctx.fillStyle = '#b9a9b9';
    lines.forEach(function (l, i) { ctx.fillText(l, W / 2, H * 0.55 + i * fs * 0.38); });
    ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(stateT * 3));
    ctx.fillStyle = '#ff5a2a';
    ctx.font = '700 ' + (fs * 0.26) + 'px "Cinzel", serif';
    ctx.fillText('DEMO · LA JUGABILIDAD LLEGA PRONTO', W / 2, H * 0.75);
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#bbb';
    ctx.font = '400 ' + (fs * 0.2) + 'px "Cinzel", serif';
    ctx.fillText('Tocá para volver', W / 2, H * 0.84);
    ctx.restore();
  }

  /* ---------- Transiciones ---------- */

  function startIntro() {
    RM.audio.init();
    RM.audio.resume();
    intro = new RM.Intro();
    setState('intro');
    fade = 0; fadeTarget = 0;
  }

  function enterMenu() {
    setState('menu');
    view = 'menu';
    fade = 1; fadeTarget = 0; fadeSpeed = 0.5;
    RM.audio.startAmbience();
    RM.audio.startMusic();
    scene.events.push({ at: scene.t + 0.5, fn: function () { if (RM.settings.thunder) scene.strike(true); } });
  }

  // Carga en el lugar (sin cambiar de escena) las tarjetas y miniaturas de los modos.
  function goModes() {
    setState('loading');
    var tasks = [];
    if (!modes.built) tasks = tasks.concat(modes.tasks(W, H, dpr));
    if (!RM.Screens.thumbs.story) tasks = tasks.concat(RM.Screens.storyTasks(), RM.Screens.soloTasks());
    loader.start(tasks, function () {
      view = 'modes';
      modes.appear = 0;
      applyMask(modes);
      setState('modes');
    }, { minTime: tasks.length ? 1.8 : 0.6 });
  }

  function goMenu() {
    RM.audio.back();
    view = 'menu';
    applyMask(menu);
    setState('menu');
  }

  function activate(item) {
    if (!item) return;
    if (item.id === 'play') {
      RM.audio.select();
      RM.vibrate([25]);
      scene.strike(true);
      goModes();
    } else if (item.id === 'exit') {
      RM.audio.select();
      RM.vibrate([15]);
      openPanel('confirm');
    } else if (item.id === 'settings') {
      RM.audio.hover();
      RM.vibrate([10]);
      openPanel('settings');
    } else if (item.id === 'back') {
      goMenu();
    } else if (item.id === 'story') {
      RM.audio.select(); RM.vibrate([20]);
      RM.Screens.renderStory();
      openPanel('story');
    } else if (item.id === 'solo') {
      RM.audio.select(); RM.vibrate([20]);
      RM.Screens.renderSolo();
      openPanel('solo');
    } else if (item.id === 'online') {
      RM.audio.select(); RM.vibrate([20]);
      openPanel('online');
      RM.Online.UI.open();
    }
  }

  // Nivel jugable: carga el mapa completo (tiles, muebles, sprites, luces) antes de entrar.
  function startLevel(net) {
    closePanels(true);
    setState('loading');
    scene.strike(true);
    level = new RM.Level({ onExit: exitLevel, net: net || null });
    play = net ? { mode: 'online' } : { mode: 'solo', level: 1 };
    fadeTarget = 0.7; fadeSpeed = 0.6;
    loader.start(level.tasks(), function () {
      setState('level');
      fade = 1; fadeTarget = 0; fadeSpeed = 0.7;
      RM.audio.setMuffle(1);
    }, { minTime: 2.6, label: 'CARGANDO MAPA' });
  }

  function exitLevel() {
    var wasOnline = play && play.mode === 'online';
    level = null; play = null;
    RM.audio.setMuffle(0);
    setState('modes');
    fade = 1; fadeTarget = 0; fadeSpeed = 0.8;
    if (wasOnline) { RM.Online.endMatch(); openPanel('online'); RM.Online.UI.open(); }
    else { RM.Screens.renderSolo(); openPanel('solo'); }
  }

  // Arranca una partida con pantalla de carga.
  function startPlay(ctxPlay) {
    if (ctxPlay.mode === 'solo' && ctxPlay.level === 1) { startLevel(); return; }
    closePanels(true);
    setState('loading');
    scene.strike(true);
    loader.start([function () { saveAcc = 0; }], function () {
      play = ctxPlay;
      setState('play');
    }, { minTime: 2.2, label: ctxPlay.mode === 'online' ? 'SINCRONIZANDO' : 'CARGANDO' });
  }

  function endPlay() {
    if (play && play.mode === 'story' && saveAcc > 0) RM.Screens.tickSave(play.slot, saveAcc);
    var back = play ? play.mode : null;
    play = null;
    RM.audio.back();
    setState('modes');
    if (back === 'story') { RM.Screens.renderStory(); openPanel('story'); }
    else if (back === 'solo') { RM.Screens.renderSolo(); openPanel('solo'); }
    else if (back === 'online') { RM.Online.endMatch(); openPanel('online'); RM.Online.UI.open(); }
  }

  RM.Screens.bindStory(function (slot) { startPlay({ mode: 'story', slot: slot }); });
  RM.Screens.bindSolo(function (n) { startPlay({ mode: 'solo', level: n }); });
  // Cooperativo: todos cargan el castillo y juegan juntos.
  RM.Online.UI.bind(function () { startLevel(RM.Online.gameNet()); });
  RM.Online.on('closed', function (why) { if (state === 'level' && level && level.net) level.say(why + ' Seguís jugando solo.', 5); });

  /* ---------- Paneles DOM ---------- */

  var openName = null;
  function openPanel(name) {
    closePanels(true);
    openName = name;
    panels[name].classList.add('open');
    menu.hover = menu.pressed = null;
    modes.hover = modes.pressed = null;
    if (name === 'settings') syncSettingsUI();
  }
  function closePanels(silent) {
    if (!openName) return;
    if (openName === 'online') RM.Online.UI.close();
    panels[openName].classList.remove('open');
    openName = null;
    if (!silent) RM.audio.back();
  }

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closePanels(); });
  });

  function syncSettingsUI() {
    var s = RM.settings;
    $('optMusic').value = Math.round(s.music * 100);
    $('optSfx').value = Math.round(s.sfx * 100);
    $('optRain').value = Math.round(s.rain * 100);
    document.querySelectorAll('[data-opt]').forEach(function (grp) {
      var key = grp.getAttribute('data-opt');
      grp.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-v') === String(s[key]));
      });
    });
  }

  var rebuildTimer = null;
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(resize, 250);
  }

  [['optMusic', 'music'], ['optSfx', 'sfx'], ['optRain', 'rain']].forEach(function (p) {
    $(p[0]).addEventListener('input', function (e) {
      RM.settings[p[1]] = e.target.value / 100;
      RM.saveSettings();
      RM.audio.applySettings();
      if (p[1] === 'rain') scheduleRebuild();
    });
  });
  document.querySelectorAll('[data-opt]').forEach(function (grp) {
    var key = grp.getAttribute('data-opt');
    grp.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var v = b.getAttribute('data-v');
      RM.settings[key] = v === 'true' ? true : v === 'false' ? false : v;
      RM.saveSettings();
      RM.audio.hover();
      if (key === 'vibration' && RM.settings.vibration) RM.vibrate([30]);
      if (key === 'quality') scheduleRebuild();
      syncSettingsUI();
    });
  });
  $('settingsBack').addEventListener('click', function () { closePanels(); });
  $('exitNo').addEventListener('click', function () { closePanels(); });
  $('exitYes').addEventListener('click', function () {
    RM.audio.select();
    closePanels(true);
    RM.Online.leave();
    fadeTarget = 1; fadeSpeed = 1.2;
    setTimeout(function () {
      if (RM.native && RM.native.exit) { RM.native.exit(); return; }
      $('bye').classList.add('open');
      running = false;
      RM.audio.suspend();
    }, 900);
  });
  Object.keys(panels).forEach(function (k) {
    panels[k].addEventListener('pointerdown', function (e) { if (e.target === panels[k]) closePanels(); });
  });

  /* ---------- Entrada ---------- */

  function target() {
    if (openName) return null;
    return state === 'menu' ? menu : state === 'modes' ? modes : null;
  }

  ['down', 'move', 'up', 'cancel'].forEach(function (k) {
    canvas.addEventListener('pointer' + k, function (e) {
      if (state === 'level') { e.stopImmediatePropagation(); e.preventDefault(); level.pointer(k, e); }
    });
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'tap') { startIntro(); return; }
    if (state === 'intro') { intro.skip(); return; }
    if (state === 'play' && stateT > 0.8) { endPlay(); return; }
    var T = target();
    if (!T) return;
    var it = T.hitTest(e.clientX, e.clientY);
    T.pressed = it;
    if (it && it !== T.hover) { RM.audio.hover(); RM.vibrate([8]); }
    T.hover = it;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') {
      scene.tiltTarget.x = (e.clientX / W - 0.5) * 2;
      scene.tiltTarget.y = (e.clientY / H - 0.5) * 2;
    }
    var T = target();
    if (!T) return;
    var it = T.hitTest(e.clientX, e.clientY);
    if (e.pointerType === 'mouse' || T.pressed) {
      if (it && it !== T.hover) RM.audio.hover();
      T.hover = it;
    }
  });
  canvas.addEventListener('pointerup', function (e) {
    var T = target();
    if (!T) return;
    var it = T.hitTest(e.clientX, e.clientY);
    var pressed = T.pressed;
    T.pressed = null;
    if (e.pointerType !== 'mouse') T.hover = null;
    if (it && it === pressed) activate(it);
  });
  canvas.addEventListener('pointercancel', function () {
    menu.pressed = menu.hover = modes.pressed = modes.hover = null;
  });

  window.addEventListener('keyup', function (e) { if (state === 'level') level.key(false, e); });
  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    if (state === 'level') { if (!e.repeat) level.key(true, e); e.preventDefault(); return; }
    if (state === 'tap' && (e.key === 'Enter' || e.key === ' ')) { startIntro(); return; }
    if (state === 'intro') { intro.skip(); return; }
    if (e.key === 'Escape' || e.key === 'Backspace') { RM.onBack(); return; }
    if (state === 'play') { endPlay(); return; }
    var T = target();
    if (!T) return;
    var list = T === menu ? menu.items.concat([menu.gear]) : modes.cards.concat([modes.back]);
    var i = list.indexOf(T.hover);
    var next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (next) {
      i = (i + next + list.length) % list.length;
      T.hover = list[i];
      RM.audio.hover();
    } else if (e.key === 'Enter' || e.key === ' ') {
      activate(T.hover || list[0]);
    }
  });

  // Paralaje con el giroscopio del celu.
  var base = null;
  window.addEventListener('deviceorientation', function (e) {
    if (e.beta == null || e.gamma == null) return;
    var ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    var x, y;
    if (ang === 90) { x = e.beta; y = -e.gamma; }
    else if (ang === 270 || ang === -90) { x = -e.beta; y = e.gamma; }
    else { x = e.gamma; y = e.beta; }
    if (!base) base = { x: x, y: y };
    base.x += (x - base.x) * 0.01;
    base.y += (y - base.y) * 0.01;
    scene.tiltTarget.x = RM.clamp((x - base.x) / 20, -1, 1);
    scene.tiltTarget.y = RM.clamp((y - base.y) / 20, -1, 1);
  });

  /* ---------- Integración con Android ---------- */

  // Devuelve true si el juego manejó el botón "atrás".
  RM.onBack = function () {
    if (openName) { closePanels(); return true; }
    if (state === 'loading') return true;
    if (state === 'level') { level.back(); return true; }
    if (state === 'play') { endPlay(); return true; }
    if (state === 'modes') { goMenu(); return true; }
    if (state === 'intro') { intro.skip(); return true; }
    if (state === 'menu') { openPanel('confirm'); RM.audio.back(); return true; }
    return false;
  };
  RM.onPause = function () {
    if (state === 'level' && level && !level.won) level.paused = true;
    RM.audio.suspend();
  };
  RM.onResume = function () { if (state !== 'tap' && state !== 'boot') RM.audio.resume(); last = 0; };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) RM.onPause(); else RM.onResume();
  });

  /* ---------- Arranque ---------- */

  function boot() {
    var fonts = ['700 40px "Cinzel Decorative"', '40px "Metal Mania"', '700 40px "Cinzel"', '400 40px "Cinzel"'];
    var load = document.fonts && document.fonts.load
      ? Promise.all(fonts.map(function (f) { return document.fonts.load(f); }))
      : Promise.resolve();
    var timeout = new Promise(function (r) { setTimeout(r, 2500); });
    Promise.race([load, timeout]).then(function () {
      resize();
      RM.audio.init();
      // En la app Android el audio arranca solo; en el navegador hace falta un toque.
      if (RM.audio.state() === 'running') startIntro();
      else setState('tap');
      requestAnimationFrame(frame);
    });
  }

  RM.debug = { level: function () { return level; }, scene: scene, menu: menu, modes: modes, loader: loader, activate: activate, state: function () { return state; } };
  boot();
})(window.RM);
