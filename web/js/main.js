/* Red Main — motor principal: estados, bucle, entrada y paneles. */
(function (RM) {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, profile;
  var scene = new RM.Scene();
  var menu = new RM.Menu();
  var intro = null;
  var state = 'boot';     // boot → tap? → intro → menu ⇄ play
  var fade = 1;           // cortina negra (1 = negro total)
  var fadeTarget = 1;
  var fadeSpeed = 1;
  var stateT = 0;
  var last = 0;
  var running = true;
  var built = false;

  var $ = function (id) { return document.getElementById(id); };
  var panels = { settings: $('settings'), confirm: $('confirm') };

  function setState(s) { state = s; stateT = 0; }

  /* ---------- Tamaño ---------- */

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
    var m = menu.buildMask();
    scene.setMask(m.data, m.w, m.h, m.rect);
    scene.setBloodTips(menu.bloodTips);
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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state === 'tap') { drawTap(); return; }
    if (state === 'intro') {
      intro.update(dt);
      intro.draw(ctx, W, H, dpr);
      if (intro.done) enterMenu();
      return;
    }

    var showMenu = state === 'menu' || state === 'toPlay';
    scene.maskOn = showMenu;
    scene.hotRect = state === 'menu' ? menu.hotRect() : null;
    scene.update(dt);
    menu.update(dt);

    ctx.save();
    if (scene.shake > 0.1) ctx.translate(RM.rand(-1, 1) * scene.shake, RM.rand(-1, 1) * scene.shake);
    scene.drawBack(ctx);
    var menuAlpha = state === 'toPlay' ? Math.max(0, 1 - stateT * 1.2) : showMenu ? 1 : 0;
    if (menuAlpha > 0) {
      menu.drawTitle(ctx, scene.flash, menuAlpha);
      menu.drawButtons(ctx, scene.flash, menuAlpha);
    }
    scene.drawFront(ctx, dt);
    ctx.restore();
    scene.drawPost(ctx);

    if (state === 'toPlay' && stateT > 1.1) { setState('play'); fadeTarget = 0.35; fadeSpeed = 0.6; }
    if (state === 'play') drawChapter();

    if (fade > 0.003) {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')';
      ctx.fillRect(0, 0, W, H);
    }
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

  function drawChapter() {
    var a = RM.smooth(0, 1.4, stateT);
    var fs = Math.min(H * 0.11, W * 0.09);
    ctx.save();
    ctx.globalAlpha = 0.7 * a;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,20,0,0.8)'; ctx.shadowBlur = fs * 0.4;
    ctx.fillStyle = '#d01a12';
    ctx.font = fs + 'px "Metal Mania", serif';
    ctx.fillText('CAPÍTULO I', W / 2, H * 0.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ccd8';
    ctx.font = '400 ' + (fs * 0.32) + 'px "Cinzel", serif';
    ctx.fillText('La lluvia no se detiene', W / 2, H * 0.4 + fs * 0.85);
    ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(stateT * 3));
    ctx.fillStyle = '#ff5a2a';
    ctx.font = '700 ' + (fs * 0.28) + 'px "Cinzel", serif';
    ctx.fillText('PRÓXIMAMENTE', W / 2, H * 0.68);
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = '#bbb';
    ctx.font = '400 ' + (fs * 0.2) + 'px "Cinzel", serif';
    ctx.fillText('Tocá para volver al menú', W / 2, H * 0.78);
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
    fade = 1; fadeTarget = 0; fadeSpeed = 0.5;
    RM.audio.startAmbience();
    RM.audio.startMusic();
    scene.events.push({ at: scene.t + 0.5, fn: function () { if (RM.settings.thunder) scene.strike(true); } });
  }

  function activate(item) {
    if (!item) return;
    if (item.id === 'play') {
      RM.audio.select();
      RM.vibrate([25]);
      scene.strike(true);
      setState('toPlay');
    } else if (item.id === 'exit') {
      RM.audio.select();
      RM.vibrate([15]);
      openPanel('confirm');
    } else if (item.id === 'settings') {
      RM.audio.hover();
      RM.vibrate([10]);
      openPanel('settings');
    }
  }

  function backToMenu() {
    RM.audio.back();
    setState('menu');
    fadeTarget = 0; fadeSpeed = 1;
  }

  /* ---------- Paneles DOM ---------- */

  var openName = null;
  function openPanel(name) {
    closePanels(true);
    openName = name;
    panels[name].classList.add('open');
    menu.hover = null; menu.pressed = null;
    if (name === 'settings') syncSettingsUI();
  }
  function closePanels(silent) {
    if (!openName) return;
    panels[openName].classList.remove('open');
    openName = null;
    if (!silent) RM.audio.back();
  }

  function syncSettingsUI() {
    var s = RM.settings;
    $('optMusic').value = Math.round(s.music * 100);
    $('optSfx').value = Math.round(s.sfx * 100);
    $('optRain').value = Math.round(s.rain * 100);
    document.querySelectorAll('[data-opt]').forEach(function (grp) {
      var key = grp.getAttribute('data-opt');
      grp.querySelectorAll('button').forEach(function (b) {
        var v = b.getAttribute('data-v');
        var cur = String(s[key]);
        b.classList.toggle('on', v === cur);
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

  function pos(e) { return { x: e.clientX, y: e.clientY }; }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'tap') { startIntro(); return; }
    if (state === 'intro') { intro.skip(); return; }
    if (state === 'play' && stateT > 0.8) { backToMenu(); return; }
    if (state !== 'menu' || openName) return;
    var p = pos(e), it = menu.hitTest(p.x, p.y);
    menu.pressed = it;
    if (it && it !== menu.hover) { RM.audio.hover(); RM.vibrate([8]); }
    menu.hover = it;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (state !== 'menu' || openName) return;
    var p = pos(e), it = menu.hitTest(p.x, p.y);
    if (e.pointerType === 'mouse' || menu.pressed) {
      if (it && it !== menu.hover) RM.audio.hover();
      menu.hover = it;
    }
    if (e.pointerType === 'mouse') {
      scene.tiltTarget.x = (p.x / W - 0.5) * 2;
      scene.tiltTarget.y = (p.y / H - 0.5) * 2;
    }
  });
  canvas.addEventListener('pointerup', function (e) {
    if (state !== 'menu' || openName) return;
    var p = pos(e), it = menu.hitTest(p.x, p.y);
    var pressed = menu.pressed;
    menu.pressed = null;
    if (e.pointerType !== 'mouse') menu.hover = null;
    if (it && it === pressed) activate(it);
  });
  canvas.addEventListener('pointercancel', function () { menu.pressed = null; menu.hover = null; });

  window.addEventListener('keydown', function (e) {
    if (state === 'tap' && (e.key === 'Enter' || e.key === ' ')) { startIntro(); return; }
    if (state === 'intro') { intro.skip(); return; }
    if (e.key === 'Escape' || e.key === 'Backspace') { RM.onBack(); return; }
    if (state === 'play') { backToMenu(); return; }
    if (state !== 'menu' || openName) return;
    var list = menu.items.concat([menu.gear]);
    var i = list.indexOf(menu.hover);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      i = e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      menu.hover = list[i];
      RM.audio.hover();
    } else if (e.key === 'Enter' || e.key === ' ') {
      activate(menu.hover || menu.items[0]);
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
    if (state === 'play' || state === 'toPlay') { backToMenu(); return true; }
    if (state === 'intro') { intro.skip(); return true; }
    if (state === 'menu') { openPanel('confirm'); RM.audio.back(); return true; }
    return false;
  };
  RM.onPause = function () { RM.audio.suspend(); };
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
  RM.debug = { scene: scene, menu: menu };
  boot();
})(window.RM);
