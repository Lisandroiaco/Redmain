/* Red Main — motor del nivel jugable (vista 2D desde arriba).
   Movimiento con colisiones, caminar / correr / agacharse, linterna y antorchas,
   objetos, forja de la herradura, portón de salida y controles táctiles. */
(function (RM) {
  'use strict';
  var clamp = RM.clamp, rand = RM.rand;
  var T = 16;
  var SPEED = { walk: 52, run: 92, crouch: 26 };
  var RECIPE = ['ingot', 'ingot2', 'coal', 'nails', 'hammer'];

  function Level(onExit) {
    this.onExit = onExit;
    this.ready = false;
  }

  /* ---------- Carga (tareas para el cargador) ---------- */

  Level.prototype.tasks = function () {
    var self = this;
    return [
      function () { self.map = RM.Castle.build(); },
      function () { self.staticLayer = RM.Castle.renderStatic(self.map); },
      function () {
        self.propSprites = {};
        Object.keys(RM.Castle.PROP).forEach(function (k) { self.propSprites[k] = RM.Castle.buildPropSprite(RM.Castle.PROP[k]); });
      },
      function () { self.hero = RM.Sprites.buildHero(); self.icons = RM.Sprites.buildIcons(); },
      function () { self.lightTex = makeLightTex(); self.ghost = makeGhost(); },
      function () { self.reset(); self.ready = true; }
    ];
  };

  function makeLightTex() {
    var c = RM.canvas(128, 128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }

  // La Dama Blanca: figura pálida de pelo negro y vestido de novia.
  function makeGhost() {
    var c = RM.canvas(20, 38), g = c.getContext('2d');
    var r = function (x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); };
    r(4, 12, 12, 24, '#e8e8f0'); r(2, 26, 16, 12, '#dcdce6'); r(5, 12, 2, 24, '#c8c8d4');
    r(6, 2, 8, 9, '#f2f0f2'); r(5, 1, 10, 4, '#0c0c10'); r(4, 3, 2, 16, '#0c0c10'); r(14, 3, 2, 16, '#0c0c10');
    r(7, 6, 2, 2, '#000'); r(11, 6, 2, 2, '#000'); r(9, 9, 2, 1, '#400');
    r(2, 14, 2, 10, '#e8e8f0'); r(16, 14, 2, 10, '#e8e8f0');
    return c;
  }

  Level.prototype.reset = function () {
    var m = this.map;
    m.items.forEach(function (it) { it.taken = false; });
    m.notes.forEach(function (n) { n.read = false; });
    m.gate.open = 0; m.gate.opening = false;
    m.solid[37 * m.W + 24] = m.solid[37 * m.W + 25] = 2;
    this.p = { x: m.start.x, y: m.start.y, dir: 3, frame: 0, animT: 0, moving: false, stamina: 1, run: false, crouch: false, stepAcc: 0, tired: false };
    this.inv = {};
    this.crafted = false;
    this.used = false;
    this.time = 0;
    this.t = 0;
    this.msg = null;
    this.note = null;
    this.paused = false;
    this.won = false;
    this.winT = 0;
    this.room = null;
    this.roomToast = null;
    this.flash = 0;
    this.nextFlash = rand(6, 12);
    this.scare = null;
    this.scares = {};
    this.flicker = 0;
    this.near = null;
    this.input = { x: 0, y: 0, keys: {}, joy: null, buttons: {} };
    this.rain = [];
    for (var i = 0; i < 160; i++) this.rain.push(this.newDrop(true));
    this.say('Encontrá los materiales para forjar una herradura y abrí el portón.', 5);
  };

  Level.prototype.newDrop = function (anywhere) {
    var rects = this.map.outdoorRects, r = rects[(Math.random() * rects.length) | 0];
    return { x: r.x + Math.random() * r.w, y: anywhere ? r.y + Math.random() * r.h : r.y - 10, r: r, vy: rand(220, 300) };
  };

  Level.prototype.say = function (text, dur) { this.msg = { text: text, t: dur || 3 }; };

  /* ---------- Colisiones ---------- */

  Level.prototype.solidAt = function (px, py) {
    var m = this.map, x = (px / T) | 0, y = (py / T) | 0;
    if (x < 0 || y < 0 || x >= m.W || y >= m.H) return true;
    var s = m.solid[y * m.W + x];
    return s === 1 || (s === 2 && m.gate.open < 1);
  };

  Level.prototype.blocked = function (x, y) {
    var hw = 5, top = y - 5;
    return this.solidAt(x - hw, top) || this.solidAt(x + hw, top) || this.solidAt(x - hw, y) || this.solidAt(x + hw, y);
  };

  Level.prototype.move = function (dx, dy) {
    var p = this.p;
    if (dx && !this.blocked(p.x + dx, p.y)) p.x += dx;
    if (dy && !this.blocked(p.x, p.y + dy)) p.y += dy;
  };

  /* ---------- Bucle ---------- */

  Level.prototype.update = function (dt) {
    if (!this.ready) return;
    this.t += dt;
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.roomToast) { this.roomToast.t -= dt; if (this.roomToast.t <= 0) this.roomToast = null; }
    this.updateRain(dt);
    this.flash *= Math.exp(-dt * 6);
    if (this.paused || this.note) return;
    if (this.won) { this.winT += dt; return; }
    this.time += dt;
    var p = this.p, inp = this.input;

    // Dirección desde teclado o joystick.
    var ix = 0, iy = 0, k = inp.keys;
    if (k.ArrowLeft || k.a) ix -= 1;
    if (k.ArrowRight || k.d) ix += 1;
    if (k.ArrowUp || k.w) iy -= 1;
    if (k.ArrowDown || k.s) iy += 1;
    if (inp.joy && inp.joy.mag > 0.15) { ix = inp.joy.dx; iy = inp.joy.dy; }
    var mag = Math.min(1, Math.hypot(ix, iy));
    p.moving = mag > 0.1;
    var wantsRun = (p.run || k.Shift) && !p.crouch && !p.tired;
    var mode = p.crouch ? 'crouch' : (wantsRun && p.moving ? 'run' : 'walk');
    if (mode === 'run') { p.stamina -= dt * 0.22; if (p.stamina <= 0) { p.tired = true; p.stamina = 0; this.say('Estás agotado…', 1.6); } }
    else p.stamina = Math.min(1, p.stamina + dt * (p.moving ? 0.12 : 0.22));
    if (p.tired && p.stamina > 0.35) p.tired = false;
    p.mode = mode;

    if (p.moving) {
      var n = Math.hypot(ix, iy) || 1;
      var sp = SPEED[mode] * (inp.joy ? Math.max(0.55, mag) : 1);
      var dx = ix / n * sp * dt, dy = iy / n * sp * dt;
      this.move(dx, dy);
      if (Math.abs(ix) > Math.abs(iy)) p.dir = ix < 0 ? 1 : 2; else p.dir = iy < 0 ? 3 : 0;
      var rate = mode === 'run' ? 11 : mode === 'crouch' ? 5 : 7;
      p.animT += dt * rate;
      p.frame = (p.animT | 0) % 4;
      p.stepAcc += sp * dt;
      var stepLen = mode === 'run' ? 22 : 16;
      if (p.stepAcc > stepLen) { p.stepAcc = 0; RM.audio.step(this.floorAt(p.x, p.y), mode); }
    } else {
      p.frame = 0; p.animT = 0;
    }

    this.updateRoom();
    this.findNear();
    this.updateGate(dt);
    this.updateScares(dt);

    // Relámpagos sobre el patio (se ven por ventanas y afuera).
    this.nextFlash -= dt;
    if (this.nextFlash <= 0 && RM.settings.thunder) {
      this.nextFlash = rand(8, 16);
      var self = this;
      this.flash = 1;
      setTimeout(function () { self.flash = Math.max(self.flash, 0.7); }, 120);
      var outside = this.room && this.room.outdoor;
      setTimeout(function () { RM.audio.thunder(outside ? 0.25 : 0.65); }, outside ? 200 : 900);
    }
  };

  Level.prototype.floorAt = function (x, y) {
    var t = this.map.tiles[((y / T) | 0) * this.map.W + ((x / T) | 0)];
    return t === 2 ? 'wood' : (t === 4 || t === 6) ? 'grass' : 'stone';
  };

  Level.prototype.updateRoom = function () {
    var rm = RM.Castle.roomAt(this.map, this.p.x, this.p.y - 4);
    if (rm && rm !== this.room) {
      this.room = rm;
      this.roomToast = { text: rm.name, t: 2.4 };
      RM.audio.setMuffle(rm.outdoor ? 0 : 1);
      if (rm.id === 'crypt' && !this.scares.crypt) { this.scares.crypt = true; RM.audio.creak(); }
    }
  };

  Level.prototype.findNear = function () {
    var p = this.p, best = null, bd = 1e9, m = this.map;
    var consider = function (o, kind, r) {
      var d = Math.hypot(o.x - p.x, o.y - (p.y - 4));
      if (d < r && d < bd) { bd = d; best = { kind: kind, o: o }; }
    };
    m.items.forEach(function (it) { if (!it.taken) consider(it, 'item', 22); });
    m.notes.forEach(function (n) { consider(n, 'note', 20); });
    m.interact.forEach(function (o) { if (!(o.kind === 'gate' && m.gate.open >= 1)) consider(o, o.kind, o.r); });
    this.near = best;
  };

  Level.prototype.actionLabel = function () {
    var n = this.near;
    if (!n) return null;
    return { item: 'AGARRAR', note: 'LEER', anvil: 'FORJAR', gate: 'ABRIR', mirror: 'MIRAR', well: 'MIRAR' }[n.kind];
  };

  Level.prototype.count = function () {
    var self = this;
    return RECIPE.filter(function (id) { return self.inv[id]; }).length;
  };

  Level.prototype.act = function () {
    if (this.won || this.paused) return;
    if (this.note) { this.note = null; RM.audio.page(); return; }
    var n = this.near;
    if (!n) return;
    var self = this;
    if (n.kind === 'item') {
      n.o.taken = true;
      this.inv[n.o.id] = true;
      RM.audio.pickup();
      RM.vibrate([20]);
      this.say('Conseguiste: ' + n.o.name + ' (' + this.count() + '/5)', 2.6);
      if (this.count() === 2 && !this.scares.first) this.triggerScare();
      if (this.count() === 5) setTimeout(function () { self.say('Tenés todo. Andá a la Herrería y forjá la herradura.', 4); }, 1800);
    } else if (n.kind === 'note') {
      this.note = n.o;
      n.o.read = true;
      RM.audio.page();
    } else if (n.kind === 'anvil') {
      if (this.crafted) { this.say('El yunque todavía está tibio.', 2); return; }
      var missing = RECIPE.filter(function (id) { return !self.inv[id]; }).map(function (id) {
        return self.map.items.filter(function (it) { return it.id === id; })[0].name;
      });
      if (missing.length) { this.say('Para forjar te falta: ' + missing.join(', ') + '.', 3.5); RM.audio.back(); return; }
      this.crafted = true;
      RM.audio.clang();
      RM.vibrate([40, 120, 40, 120, 80]);
      this.say('¡Forjaste la HERRADURA! Llevala al portón del vestíbulo.', 4);
    } else if (n.kind === 'gate') {
      if (!this.crafted) { this.say('Una cerradura con forma de herradura… No abre sin ella.', 3); RM.audio.back(); return; }
      if (this.map.gate.opening) return;
      this.map.gate.opening = true;
      this.used = true;
      RM.audio.gate();
      RM.vibrate([200]);
      this.say('El portón cruje y se abre…', 3);
    } else if (n.kind === 'mirror') {
      if (!this.scares.mirror) {
        this.scares.mirror = true;
        this.scare = { kind: 'mirror', t: 0, dur: 1.1 };
        RM.audio.scream();
        RM.vibrate([80, 40, 160]);
      } else this.say('Tu reflejo… y nada más. Por ahora.', 2.5);
    } else if (n.kind === 'well') {
      RM.audio.whisper();
      this.say('Desde el fondo del pozo alguien susurra tu nombre.', 3);
    }
  };

  Level.prototype.triggerScare = function () {
    this.scares.first = true;
    // Aparece a unos tiles del jugador, del lado al que mira, y se desvanece.
    var p = this.p, dirs = [[0, 1], [-1, 0], [1, 0], [0, -1]], d = dirs[p.dir];
    var gx = p.x + d[0] * 70, gy = p.y + d[1] * 70;
    for (var i = 0; i < 6 && this.blocked(gx, gy); i++) { gx -= d[0] * 10; gy -= d[1] * 10; }
    this.scare = { kind: 'ghost', x: gx, y: gy, t: 0, dur: 1.6 };
    this.flicker = 1.6;
    RM.audio.whisper();
    var self = this;
    setTimeout(function () { self.say('¿Qué fue eso…?', 2.5); }, 1600);
  };

  Level.prototype.updateScares = function (dt) {
    if (this.flicker > 0) this.flicker -= dt;
    if (this.scare) { this.scare.t += dt; if (this.scare.t > this.scare.dur) this.scare = null; }
  };

  Level.prototype.updateGate = function (dt) {
    var g = this.map.gate;
    if (g.opening && g.open < 1) g.open = Math.min(1, g.open + dt * 0.5);
    if (g.open >= 1 && this.p.y > this.map.exitY && !this.won) {
      this.won = true;
      this.winT = 0;
      RM.audio.select();
      RM.vibrate([60, 60, 60]);
      RM.Screens.saveRecord(1, this.time);
    }
  };

  Level.prototype.updateRain = function (dt) {
    for (var i = 0; i < this.rain.length; i++) {
      var d = this.rain[i];
      d.y += d.vy * dt; d.x -= d.vy * 0.15 * dt;
      if (d.y > d.r.y + d.r.h || d.x < d.r.x) this.rain[i] = this.newDrop(false);
    }
  };

  /* ---------- Dibujo ---------- */

  Level.prototype.layout = function (W, H) {
    this.W = W; this.H = H;
    this.S = Math.max(1, Math.round(H / 190));
    var u = Math.min(W, H);
    this.ui = {
      joy: { x: u * 0.2, y: H - u * 0.24, r: u * 0.13 },
      act: { x: W - u * 0.16, y: H - u * 0.2, r: u * 0.1 },
      run: { x: W - u * 0.38, y: H - u * 0.12, r: u * 0.075 },
      crouch: { x: W - u * 0.36, y: H - u * 0.34, r: u * 0.07 },
      pause: { x: W - u * 0.07, y: u * 0.07, r: u * 0.05 }
    };
  };

  Level.prototype.draw = function (ctx, W, H, dpr) {
    if (!this.ready) return;
    if (this.W !== W || this.H !== H) this.layout(W, H);
    var S = this.S, m = this.map, p = this.p;
    var vw = W / S, vh = H / S;
    var cx = clamp(p.x - vw / 2, 0, Math.max(0, m.W * T - vw));
    var cy = clamp(p.y - 12 - vh / 2, 0, Math.max(0, m.H * T - vh));
    cx = Math.round(cx * S) / S; cy = Math.round(cy * S) / S;
    this.cam = { x: cx, y: cy };

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(S, S);
    ctx.translate(-cx, -cy);
    ctx.drawImage(this.staticLayer, cx, cy, vw + 1, vh + 1, cx, cy, vw + 1, vh + 1);
    this.drawGate(ctx);
    this.drawPickups(ctx);
    this.drawSorted(ctx, cx, cy, vw, vh);
    this.drawFlames(ctx, cx, cy, vw, vh);
    this.drawRain(ctx);
    if (this.near) this.drawPrompt(ctx);
    ctx.restore();

    this.drawLighting(ctx, W, H, cx, cy, S);
    if (this.scare && this.scare.kind === 'mirror') this.drawMirrorScare(ctx, W, H);
    this.drawHUD(ctx, W, H);
    if (this.note) this.drawNote(ctx, W, H);
    if (this.paused) this.drawPause(ctx, W, H);
    if (this.won) this.drawWin(ctx, W, H);
  };

  Level.prototype.drawGate = function (ctx) {
    var g = this.map.gate, x = g.x * T, y = g.y * T;
    ctx.fillStyle = '#0a0a0e'; ctx.fillRect(x, y, 32, 16);
    var lift = g.open * 15;
    ctx.fillStyle = '#4a4e58';
    for (var i = 0; i < 6; i++) ctx.fillRect(x + 2 + i * 5, y - lift, 2, 16 - Math.min(14, lift));
    ctx.fillRect(x, y + 6 - lift, 32, 2);
    if (g.open < 1) { ctx.fillStyle = '#b8bec7'; ctx.fillRect(x + 14, y + 8, 4, 5); ctx.fillStyle = '#000'; ctx.fillRect(x + 15, y + 9, 2, 3); }
  };

  Level.prototype.drawPickups = function (ctx) {
    var t = this.t, icons = this.icons;
    this.map.items.forEach(function (it) {
      if (it.taken) return;
      var bob = Math.sin(t * 3 + it.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 6, 5, 2, 0, 0, 6.283); ctx.fill();
      ctx.drawImage(icons[it.icon], it.x - 8, it.y - 10 + bob);
      if (Math.sin(t * 4 + it.y) > 0.7) { ctx.fillStyle = '#fff'; ctx.fillRect(it.x + 3, it.y - 9 + bob, 1, 3); ctx.fillRect(it.x + 2, it.y - 8 + bob, 3, 1); }
    });
    this.map.notes.forEach(function (n) {
      ctx.drawImage(icons.note, n.x - 8, n.y - 9);
      if (!n.read && Math.sin(t * 3 + n.x) > 0.6) { ctx.fillStyle = '#ffd36a'; ctx.fillRect(n.x + 4, n.y - 10, 1, 2); }
    });
  };

  // Muebles y personaje ordenados por profundidad (Y de la base).
  Level.prototype.drawSorted = function (ctx, cx, cy, vw, vh) {
    var list = [], self = this, p = this.p;
    this.map.props.forEach(function (pr) {
      var spr = self.propSprites[pr.type];
      if (pr.x + spr.width < cx || pr.x > cx + vw || pr.baseY < cy || pr.baseY - spr.height > cy + vh) return;
      list.push({ y: pr.baseY, draw: function () { ctx.drawImage(spr, Math.round(pr.x), pr.baseY - spr.height); } });
    });
    list.push({ y: p.y, draw: function () { self.drawHero(ctx); } });
    if (this.scare && this.scare.kind === 'ghost') {
      var s = this.scare;
      list.push({ y: s.y, draw: function () {
        var a = Math.sin(Math.min(1, s.t / s.dur) * Math.PI);
        ctx.globalAlpha = a * (0.7 + 0.3 * Math.random());
        ctx.drawImage(self.ghost, Math.round(s.x - 10), Math.round(s.y - 38));
        ctx.globalAlpha = 1;
      } });
    }
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (o) { o.draw(); });
  };

  Level.prototype.drawHero = function (ctx) {
    var p = this.p, h = this.hero;
    var mode = p.mode === 'run' ? 1 : p.mode === 'crouch' ? 2 : 0;
    var row = mode * 4 + p.dir;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 8, 3, 0, 0, 6.283); ctx.fill();
    ctx.drawImage(h.canvas, p.frame * h.fw, row * h.fh, h.fw, h.fh, Math.round(p.x - h.fw / 2), Math.round(p.y - h.fh + 1), h.fw, h.fh);
  };

  Level.prototype.drawFlames = function (ctx, cx, cy, vw, vh) {
    var t = this.t;
    this.map.flames.forEach(function (f, i) {
      if (f.x < cx - 20 || f.x > cx + vw + 20 || f.y < cy - 20 || f.y > cy + vh + 20) return;
      var k = Math.sin(t * 13 + i * 2.1) * 0.5 + Math.sin(t * 7.7 + i) * 0.5;
      var draw = function (x, y, s) {
        var hgt = s * (4 + k);
        ctx.fillStyle = '#ff5a10'; ctx.fillRect(x - s, y - hgt, s * 2, hgt);
        ctx.fillStyle = '#ffc040'; ctx.fillRect(x - s / 2, y - hgt * 0.7, s, hgt * 0.7);
      };
      if (f.big) { for (var j = -2; j <= 2; j++) draw(f.x + j * 4, f.y + 2, 2); }
      else if (f.triple) { draw(f.x - 4, f.y, 0.8); draw(f.x, f.y, 0.8); draw(f.x + 4, f.y, 0.8); }
      else draw(f.x, f.y, 1.5);
    });
  };

  Level.prototype.drawRain = function (ctx) {
    ctx.strokeStyle = 'rgba(190,200,240,0.45)'; ctx.lineWidth = 0.7;
    ctx.beginPath();
    this.rain.forEach(function (d) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 1.5, d.y - 7); });
    ctx.stroke();
  };

  Level.prototype.drawPrompt = function (ctx) {
    var o = this.near.o, y = o.y - 22 + Math.sin(this.t * 5) * 1.5;
    ctx.fillStyle = '#ff3a1a'; ctx.fillRect(o.x - 1, y, 3, 6); ctx.fillRect(o.x - 1, y + 8, 3, 2);
  };

  Level.prototype.drawLighting = function (ctx, W, H, cx, cy, S) {
    var k = 4, lw = Math.ceil(W / k), lh = Math.ceil(H / k);
    if (!this.lc || this.lc.width !== lw || this.lc.height !== lh) this.lc = RM.canvas(lw, lh);
    var g = this.lc.getContext('2d'), t = this.t, tex = this.lightTex, self = this;
    var inCrypt = this.room && this.room.id === 'crypt';
    var dark = (inCrypt ? 0.975 : 0.93) - this.flash * 0.45;
    if (this.flicker > 0 && Math.random() < 0.5) dark = 0.99;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lw, lh);
    g.fillStyle = 'rgba(3,2,8,' + dark + ')';
    g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    var sc = S / k;
    var light = function (x, y, r, a) {
      var sx = (x - cx) * sc, sy = (y - cy) * sc, sr = r * sc;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > lw || sy - sr > lh) return;
      g.globalAlpha = a;
      g.drawImage(tex, sx - sr, sy - sr, sr * 2, sr * 2);
    };
    // Luna en los espacios abiertos.
    this.map.outdoorRects.forEach(function (r) {
      g.globalAlpha = 0.45 + self.flash * 0.5;
      g.fillStyle = '#fff';
      g.fillRect((r.x - cx) * sc, (r.y - cy) * sc, r.w * sc, r.h * sc);
    });
    var lanternOff = this.flicker > 0 && Math.random() < 0.6;
    if (!lanternOff) {
      var fl = 1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
      light(this.p.x, this.p.y - 14, 86 * fl * (this.p.crouch ? 0.85 : 1), 1);
      light(this.p.x, this.p.y - 14, 34, 1);
    }
    this.map.lights.forEach(function (L) {
      var f = L.flick ? 1 + Math.sin(t * 8 + L.flick) * 0.06 + Math.sin(t * 19 + L.flick * 2) * 0.04 : 1;
      light(L.x, L.y, L.r * f, L.color === 'moon' ? 0.6 : 0.9);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lc, 0, 0, lw * k, lh * k);
    // Brillo cálido de las llamas.
    ctx.globalCompositeOperation = 'lighter';
    this.map.lights.forEach(function (L) {
      if (L.color === 'moon') return;
      var sx = (L.x - cx) * S, sy = (L.y - cy) * S, sr = L.r * S * 0.6;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > W || sy - sr > H) return;
      ctx.globalAlpha = 0.13 + Math.sin(t * 10 + L.flick) * 0.03;
      ctx.drawImage(self.warmTex || (self.warmTex = tint(tex, '#ff7a20')), sx - sr, sy - sr, sr * 2, sr * 2);
    });
    if (this.flash > 0.02) { ctx.globalAlpha = this.flash * 0.15; ctx.fillStyle = '#c8c0ff'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  };

  function tint(src, color) {
    var c = RM.canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  Level.prototype.drawMirrorScare = function (ctx, W, H) {
    var s = this.scare, a = s.t < 0.15 ? 1 : 1 - (s.t - 0.15) / (s.dur - 0.15);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    var sz = H * 0.9 / 38;
    var jx = (Math.random() - 0.5) * 12;
    ctx.drawImage(this.ghost, W / 2 - 10 * sz + jx, H * 0.05, 20 * sz, 38 * sz);
    ctx.restore();
  };

  /* ---------- HUD y controles ---------- */

  function roundRect(g, x, y, w, h, r) { RM.Modes.roundRect(g, x, y, w, h, r); }

  Level.prototype.drawHUD = function (ctx, W, H) {
    var u = Math.min(W, H), self = this, t = this.t;
    var fs = Math.max(11, u * 0.036);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Objetivo + inventario.
    var x0 = u * 0.03, y0 = u * 0.03, slot = Math.max(26, u * 0.085);
    ctx.fillStyle = 'rgba(8,2,6,0.6)';
    roundRect(ctx, x0, y0, slot * 6 + 26, slot + fs * 1.9, 6); ctx.fill();
    ctx.font = '700 ' + fs * 0.8 + 'px "Cinzel", serif';
    ctx.fillStyle = '#ff5a2a'; ctx.textBaseline = 'top';
    var obj = this.used ? 'Escapá por el portón' : this.crafted ? 'Abrí el portón del vestíbulo' : this.count() === 5 ? 'Forjá la herradura en la Herrería' : 'Materiales para la herradura ' + this.count() + '/5';
    ctx.fillText(obj, x0 + 8, y0 + 6);
    RECIPE.forEach(function (id, i) {
      var sx = x0 + 8 + i * (slot + 2), sy = y0 + fs * 1.4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx, sy, slot, slot);
      ctx.strokeStyle = self.inv[id] ? '#c4180f' : '#3a2a2a'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, slot - 1, slot - 1);
      ctx.globalAlpha = self.inv[id] ? 1 : 0.18;
      ctx.drawImage(self.icons[id === 'ingot2' ? 'ingot' : id], sx + 3, sy + 3, slot - 6, slot - 6);
      ctx.globalAlpha = 1;
    });
    var hx = x0 + 8 + 5 * (slot + 2) + 10, hy = y0 + fs * 1.4;
    ctx.fillStyle = '#c4180f'; ctx.fillRect(hx - 9, hy + slot / 2 - 1, 6, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hx, hy, slot, slot);
    ctx.strokeStyle = this.crafted ? '#ffcc00' : '#3a2a2a'; ctx.strokeRect(hx + 0.5, hy + 0.5, slot - 1, slot - 1);
    ctx.globalAlpha = this.crafted ? 1 : 0.18;
    ctx.drawImage(this.icons.horseshoe, hx + 3, hy + 3, slot - 6, slot - 6);
    ctx.globalAlpha = 1;
    // Estamina.
    var by = y0 + slot + fs * 1.9 + 6, bw = slot * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, by, bw, 5);
    ctx.fillStyle = this.p.tired ? '#ff3a1a' : '#e8d070'; ctx.fillRect(x0, by, bw * this.p.stamina, 5);
    // Tiempo.
    ctx.font = '700 ' + fs + 'px "Cinzel", serif';
    ctx.textAlign = 'right'; ctx.fillStyle = '#d8ccd8';
    var s = this.time | 0;
    ctx.fillText((s / 60 | 0) + ':' + ('0' + s % 60).slice(-2), this.ui.pause.x - this.ui.pause.r - 10, u * 0.045);
    // Nombre de sala.
    if (this.roomToast) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, this.roomToast.t);
      ctx.font = (fs * 1.7) + 'px "Metal Mania", serif';
      ctx.fillStyle = '#c4180f'; ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
      ctx.fillText(this.roomToast.text, W / 2, H * 0.14);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    // Mensaje.
    if (this.msg) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + fs + 'px "Cinzel", serif';
      var tw = Math.min(W * 0.6, ctx.measureText(this.msg.text).width + 30);
      ctx.globalAlpha = Math.min(1, this.msg.t * 2);
      ctx.fillStyle = 'rgba(10,2,6,0.8)';
      roundRect(ctx, W / 2 - tw / 2, H * 0.7 - fs * 1.1, tw, fs * 2.2, 6); ctx.fill();
      ctx.fillStyle = '#eee';
      wrapText(ctx, this.msg.text, W / 2, H * 0.7, tw - 20, fs * 1.1);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.drawControls(ctx, W, H, t);
  };

  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    lines.push(line);
    var y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, x, y0 + i * lh); });
    return lines.length;
  }

  Level.prototype.drawControls = function (ctx, W, H) {
    var ui = this.ui, inp = this.input, p = this.p;
    ctx.save();
    // Joystick.
    var j = inp.joy, jb = j ? { x: j.ox, y: j.oy } : ui.joy;
    ctx.globalAlpha = j ? 0.55 : 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.strokeStyle = '#c4180f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jb.x, jb.y, ui.joy.r, 0, 6.283); ctx.fill(); ctx.stroke();
    var kx = jb.x + (j ? j.dx * j.mag * ui.joy.r : 0), ky = jb.y + (j ? j.dy * j.mag * ui.joy.r : 0);
    ctx.globalAlpha = j ? 0.9 : 0.4;
    ctx.fillStyle = '#8a0d0d';
    ctx.beginPath(); ctx.arc(kx, ky, ui.joy.r * 0.42, 0, 6.283); ctx.fill();
    // Botones.
    var btn = function (b, label, on, glow) {
      ctx.globalAlpha = on ? 0.95 : 0.6;
      var gr = ctx.createRadialGradient(b.x, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      gr.addColorStop(0, on ? '#ff7a2a' : '#5a0a0a'); gr.addColorStop(1, on ? '#a01000' : '#200204');
      ctx.fillStyle = gr;
      if (glow) { ctx.shadowColor = '#ff3a00'; ctx.shadowBlur = 16; }
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = on ? '#ffb070' : '#7a1a1a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffe8d8';
      ctx.font = '700 ' + Math.max(9, b.r * 0.32) + 'px "Cinzel", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, b.x, b.y);
    };
    var lab = this.actionLabel();
    btn(ui.act, lab || 'ACCIÓN', !!lab || inp.buttons.act, !!lab && Math.sin(this.t * 6) > 0);
    btn(ui.run, p.tired ? 'CANSADO' : 'CORRER', p.run && !p.crouch);
    btn(ui.crouch, 'AGACHAR', p.crouch);
    // Pausa.
    var pz = ui.pause;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(pz.x, pz.y, pz.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#d8ccd8'; ctx.fillRect(pz.x - pz.r * 0.35, pz.y - pz.r * 0.4, pz.r * 0.25, pz.r * 0.8); ctx.fillRect(pz.x + pz.r * 0.1, pz.y - pz.r * 0.4, pz.r * 0.25, pz.r * 0.8);
    ctx.restore();
  };

  Level.prototype.panel = function (ctx, W, H, w, h) {
    var x = W / 2 - w / 2, y = H / 2 - h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    return { x: x, y: y, w: w, h: h };
  };

  Level.prototype.drawNote = function (ctx, W, H) {
    var n = this.note, u = Math.min(W, H);
    var b = this.panel(ctx, W, H, Math.min(W * 0.7, u * 1.3), u * 0.7);
    ctx.save();
    var gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    gr.addColorStop(0, '#d8ccaa'); gr.addColorStop(1, '#b8a880');
    ctx.fillStyle = gr; roundRect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(90,6,6,0.5)'; ctx.beginPath(); ctx.arc(b.x + b.w * 0.88, b.y + b.h * 0.8, u * 0.04, 0, 6.283); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a0606';
    ctx.font = (u * 0.06) + 'px "Metal Mania", serif';
    ctx.fillText(n.title, W / 2, b.y + u * 0.08);
    ctx.fillStyle = '#2a1e10';
    ctx.font = '700 ' + (u * 0.038) + 'px "Cinzel", serif';
    wrapText(ctx, n.text, W / 2, b.y + b.h * 0.52, b.w - u * 0.12, u * 0.052);
    ctx.font = '400 ' + (u * 0.03) + 'px "Cinzel", serif';
    ctx.fillStyle = '#5a4a30';
    ctx.fillText('Tocá para cerrar', W / 2, b.y + b.h - u * 0.04);
    ctx.restore();
  };

  Level.prototype.menuButtons = function (W, H, labels) {
    var u = Math.min(W, H), bw = u * 0.6, bh = u * 0.11;
    return labels.map(function (l, i) { return { id: l[0], label: l[1], x: W / 2 - bw / 2, y: H * 0.42 + i * (bh + u * 0.03), w: bw, h: bh }; });
  };

  Level.prototype.drawButtons = function (ctx, list) {
    list.forEach(function (b) {
      var gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, '#c2240f'); gr.addColorStop(1, '#640400');
      ctx.fillStyle = gr; roundRect(ctx, b.x, b.y, b.w, b.h, 5); ctx.fill();
      ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe8d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = (b.h * 0.5) + 'px "Metal Mania", serif';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    });
  };

  Level.prototype.drawPause = function (ctx, W, H) {
    var u = Math.min(W, H);
    this.panel(ctx, W, H, 0, 0);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c4180f'; ctx.font = (u * 0.12) + 'px "Metal Mania", serif';
    ctx.shadowColor = '#f00'; ctx.shadowBlur = 16;
    ctx.fillText('PAUSA', W / 2, H * 0.25);
    ctx.shadowBlur = 0;
    this.pauseBtns = this.menuButtons(W, H, [['resume', 'Reanudar'], ['restart', 'Reiniciar nivel'], ['quit', 'Salir del nivel']]);
    this.drawButtons(ctx, this.pauseBtns);
    ctx.restore();
  };

  Level.prototype.drawWin = function (ctx, W, H) {
    var u = Math.min(W, H), a = Math.min(1, this.winT / 1.2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffcc00'; ctx.font = (u * 0.13) + 'px "Metal Mania", serif';
    ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 20;
    ctx.fillText('¡ESCAPASTE!', W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d8ccd8'; ctx.font = '700 ' + (u * 0.042) + 'px "Cinzel", serif';
    var s = this.time | 0, read = this.map.notes.filter(function (n) { return n.read; }).length;
    ctx.fillText('El Castillo del Terror · tiempo ' + (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2), W / 2, H * 0.32);
    ctx.font = '400 ' + (u * 0.034) + 'px "Cinzel", serif';
    ctx.fillText('Notas leídas: ' + read + '/' + this.map.notes.length + ' · La Dama Blanca te vio irte…', W / 2, H * 0.39);
    if (this.winT > 1) {
      this.winBtns = this.menuButtons(W, H, [['quit', 'Continuar'], ['restart', 'Jugar de nuevo']]);
      this.winBtns.forEach(function (b) { b.y += H * 0.08; });
      this.drawButtons(ctx, this.winBtns);
    } else this.winBtns = null;
    ctx.restore();
  };

  /* ---------- Entrada ---------- */

  function inCircle(b, x, y, extra) { return Math.hypot(x - b.x, y - b.y) <= b.r * (extra || 1.25); }
  function inRect(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

  Level.prototype.pointer = function (type, e) {
    if (!this.ready) return;
    var x = e.clientX, y = e.clientY, ui = this.ui, inp = this.input, id = e.pointerId;
    if (type === 'down') {
      if (this.won) {
        var wb = (this.winBtns || []).filter(function (b) { return inRect(b, x, y); })[0];
        if (wb) this.choose(wb.id);
        return;
      }
      if (this.paused) {
        var pb = (this.pauseBtns || []).filter(function (b) { return inRect(b, x, y); })[0];
        if (pb) this.choose(pb.id);
        return;
      }
      if (this.note) { this.note = null; RM.audio.page(); return; }
      if (inCircle(ui.pause, x, y, 1.4)) { this.setPaused(true); return; }
      if (inCircle(ui.act, x, y)) { inp.buttons.act = id; this.act(); return; }
      if (inCircle(ui.run, x, y)) { this.p.run = !this.p.run; if (this.p.run) this.p.crouch = false; RM.audio.hover(); RM.vibrate([10]); return; }
      if (inCircle(ui.crouch, x, y)) { this.p.crouch = !this.p.crouch; if (this.p.crouch) this.p.run = false; RM.audio.hover(); RM.vibrate([10]); return; }
      if (x < this.W * 0.55 && !inp.joy) { inp.joy = { id: id, ox: x, oy: y, dx: 0, dy: 0, mag: 0 }; }
    } else if (type === 'move') {
      var j = inp.joy;
      if (j && j.id === id) {
        var dx = x - j.ox, dy = y - j.oy, d = Math.hypot(dx, dy), R = ui.joy.r;
        if (d > R * 1.4) { j.ox = x - dx / d * R * 1.4; j.oy = y - dy / d * R * 1.4; dx = x - j.ox; dy = y - j.oy; d = Math.hypot(dx, dy); }
        j.mag = Math.min(1, d / R);
        j.dx = d ? dx / d : 0; j.dy = d ? dy / d : 0;
      }
    } else {
      if (inp.joy && inp.joy.id === id) inp.joy = null;
      if (inp.buttons.act === id) inp.buttons.act = null;
    }
  };

  Level.prototype.key = function (down, e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.input.keys[k] = down;
    if (!down) return;
    if (k === 'Escape' || k === 'p') { this.setPaused(!this.paused); return; }
    if (this.won && (k === 'Enter' || k === ' ')) { this.choose('quit'); return; }
    if (k === 'e' || k === ' ' || k === 'Enter') this.act();
    if (k === 'c' || k === 'Control') { this.p.crouch = !this.p.crouch; if (this.p.crouch) this.p.run = false; }
    if (k === 'r') { this.p.run = !this.p.run; if (this.p.run) this.p.crouch = false; }
  };

  Level.prototype.setPaused = function (v) {
    if (this.won) return;
    this.paused = v;
    this.input.joy = null;
    RM.audio[v ? 'back' : 'hover']();
  };

  Level.prototype.choose = function (id) {
    RM.audio.select();
    if (id === 'resume') this.setPaused(false);
    else if (id === 'restart') { this.reset(); RM.audio.setMuffle(1); }
    else if (id === 'quit') { RM.audio.setMuffle(0); this.onExit(this.won); }
  };

  // Botón "atrás" de Android.
  Level.prototype.back = function () {
    if (this.note) { this.note = null; return; }
    if (this.won) { this.choose('quit'); return; }
    this.setPaused(!this.paused);
  };

  RM.Level = Level;
})(window.RM);
