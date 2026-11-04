/* Red Main — pantallas de Modo Historia (3 ranuras de guardado) y 1 Jugador (4 niveles). */
(function (RM) {
  'use strict';
  var KEY_SAVES = 'redmain.saves.v1';
  var KEY_RECORDS = 'redmain.records.v1';
  var $ = function (id) { return document.getElementById(id); };

  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; }
  }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function fmtTime(sec) {
    sec = Math.floor(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + 'h ' : '') + m + 'm ' + (h ? '' : s + 's');
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var SKULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.7 1.3 4.6 3 5.8V19c0 .6.4 1 1 1h1.5v-2h1.5v2h3v-2h1.5v2H16c.6 0 1-.4 1-1v-3c1.7-1.2 3-3.1 3-5.8C20.5 5.6 17 2 12 2zM8.5 13.5a2 2 0 110-4 2 2 0 010 4zm7 0a2 2 0 110-4 2 2 0 010 4z"/></svg>';

  var CHAPTERS = ['El Bosque', 'La Cabaña', 'El Río Rojo', 'La Ciudad Ahogada', 'El Ojo'];

  var Screens = { thumbs: {} };

  Screens.saves = function () { var s = load(KEY_SAVES, [null, null, null]); while (s.length < 3) s.push(null); return s; };
  Screens.writeSaves = function (s) { store(KEY_SAVES, s); };
  Screens.records = function () { return load(KEY_RECORDS, {}); };

  // Tareas de carga: genera las miniaturas (lo pesado) antes de mostrar la pantalla.
  Screens.storyTasks = function () {
    return [function () { Screens.thumbs.story = RM.Art.toDataURL(RM.Art.story, 240, 150, 1.5); }];
  };
  Screens.soloTasks = function () {
    return RM.Art.LEVELS.map(function (lv) {
      return function () { Screens.thumbs['lv' + lv.n] = RM.Art.toDataURL(function (g, w, h) { RM.Art.level(lv.n, g, w, h); }, 240, 140, 1.5); };
    });
  };

  /* ---------- Modo Historia ---------- */

  var formSlot = null, confirmSlot = null;

  Screens.renderStory = function () {
    var saves = Screens.saves();
    var html = saves.map(function (s, i) {
      var head = '<div class="slot-num">RANURA ' + (i + 1) + '</div>';
      if (formSlot === i) {
        return '<div class="slot editing">' + head +
          '<label class="field">Nombre<input id="newName" maxlength="14" value="Errante" autocomplete="off"></label>' +
          '<div class="field">Dificultad<div class="seg" id="newDiff"><button data-v="normal" class="on">Normal</button><button data-v="pesadilla">Pesadilla</button></div></div>' +
          '<div class="slot-actions"><button class="btn sm" data-act="create" data-i="' + i + '">Comenzar</button><button class="btn sm ghost" data-act="cancel">Cancelar</button></div></div>';
      }
      if (!s) {
        return '<button class="slot empty" data-act="new" data-i="' + i + '">' + head + '<span class="plus">+</span><span>Nueva partida</span></button>';
      }
      var thumb = Screens.thumbs.story ? '<img class="slot-img" alt="" src="' + Screens.thumbs.story + '">' : '';
      var del = confirmSlot === i
        ? '<div class="slot-confirm">¿Borrar partida? <button data-act="del-yes" data-i="' + i + '">Sí</button><button data-act="del-no">No</button></div>'
        : '<button class="icon-btn" data-act="del" data-i="' + i + '" aria-label="Borrar partida">✕</button>';
      return '<div class="slot filled">' + head + del + thumb +
        '<div class="slot-name">' + esc(s.name) + (s.difficulty === 'pesadilla' ? ' <span class="badge red">Pesadilla</span>' : '') + '</div>' +
        '<div class="slot-ch">Capítulo ' + s.chapter + ' — ' + CHAPTERS[(s.chapter - 1) % CHAPTERS.length] + '</div>' +
        '<div class="bar"><i style="width:' + Math.round(s.progress) + '%"></i></div>' +
        '<div class="slot-meta"><span>' + Math.round(s.progress) + '%</span><span>⏱ ' + fmtTime(s.playtime) + '</span><span>' + fmtDate(s.updated) + '</span></div>' +
        '<button class="btn sm" data-act="play" data-i="' + i + '">Continuar</button></div>';
    }).join('');
    $('slots').innerHTML = html;
    if (formSlot !== null) { var inp = $('newName'); if (inp) { inp.focus(); inp.select(); } }
  };

  Screens.bindStory = function (onPlay) {
    $('slots').addEventListener('click', function (e) {
      var seg = e.target.closest('#newDiff button');
      if (seg) {
        seg.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === seg); });
        RM.audio.hover();
        return;
      }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act'), i = +b.getAttribute('data-i');
      var saves = Screens.saves();
      RM.audio.hover();
      if (act === 'new') { formSlot = i; confirmSlot = null; }
      else if (act === 'cancel') { formSlot = null; }
      else if (act === 'create') {
        var name = ($('newName').value || '').trim() || 'Errante';
        var diff = $('newDiff').querySelector('.on').getAttribute('data-v');
        saves[i] = { name: name, difficulty: diff, chapter: 1, progress: 0, playtime: 0, created: Date.now(), updated: Date.now() };
        Screens.writeSaves(saves);
        formSlot = null;
        RM.audio.select();
        onPlay(i);
        return;
      }
      else if (act === 'del') { confirmSlot = i; }
      else if (act === 'del-no') { confirmSlot = null; }
      else if (act === 'del-yes') { saves[i] = null; Screens.writeSaves(saves); confirmSlot = null; RM.audio.back(); }
      else if (act === 'play') { RM.audio.select(); onPlay(i); return; }
      Screens.renderStory();
    });
    $('slots').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'newName') { var c = document.querySelector('[data-act="create"]'); if (c) c.click(); }
    });
  };

  // Avanza el progreso de la partida mientras se "juega" el capítulo (demo).
  Screens.tickSave = function (slot, dt) {
    var saves = Screens.saves(), s = saves[slot];
    if (!s) return;
    s.playtime += dt;
    s.progress = Math.min(100, s.progress + dt * 0.8);
    if (s.progress >= 100 && s.chapter < CHAPTERS.length) { s.chapter++; s.progress = 0; }
    s.updated = Date.now();
    Screens.writeSaves(saves);
  };
  Screens.chapterName = function (n) { return CHAPTERS[(n - 1) % CHAPTERS.length]; };

  /* ---------- 1 Jugador ---------- */

  var selected = 1;
  Screens.renderSolo = function () {
    var rec = Screens.records();
    $('levels').innerHTML = RM.Art.LEVELS.map(function (lv) {
      var skulls = '';
      for (var k = 0; k < 4; k++) skulls += '<span class="skull' + (k < lv.diff ? ' on' : '') + '">' + SKULL + '</span>';
      var r = rec[lv.n];
      return '<button class="level' + (selected === lv.n ? ' sel' : '') + (lv.n === 4 ? ' nightmare' : '') + '" data-n="' + lv.n + '">' +
        '<span class="lv-img" style="background-image:url(' + (Screens.thumbs['lv' + lv.n] || '') + ')"><span class="lv-num">' + lv.n + '</span></span>' +
        '<span class="lv-name">' + lv.name + '</span>' +
        '<span class="lv-diff">' + skulls + '<em>' + lv.label + '</em></span>' +
        '<span class="lv-desc">' + lv.desc + '</span>' +
        '<span class="lv-rec">Récord: ' + (r ? fmtTime(r) : '—') + '</span></button>';
    }).join('');
    var lv = RM.Art.LEVELS[selected - 1];
    $('soloPlay').textContent = 'Jugar nivel ' + lv.n;
  };

  Screens.bindSolo = function (onPlay) {
    $('levels').addEventListener('click', function (e) {
      var b = e.target.closest('.level');
      if (!b) return;
      var n = +b.getAttribute('data-n');
      if (n === selected) { RM.audio.select(); onPlay(n); return; }
      selected = n;
      RM.audio.hover();
      if (n === 4) RM.vibrate([30, 40, 30]);
      Screens.renderSolo();
    });
    $('soloPlay').addEventListener('click', function () { RM.audio.select(); onPlay(selected); });
  };

  Screens.saveRecord = function (n, sec) {
    var rec = Screens.records();
    if (!rec[n] || sec > rec[n]) { rec[n] = sec; store(KEY_RECORDS, rec); }
  };

  Screens.esc = esc;
  RM.Screens = Screens;
})(window.RM);
