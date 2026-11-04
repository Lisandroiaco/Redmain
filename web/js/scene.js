/* Red Main — escena del menú: tormenta nocturna con bosque, rayos y lluvia
   que choca contra el letrero (máscara de colisión por píxel). */
(function (RM) {
  'use strict';
  var rand = RM.rand, clamp = RM.clamp, lerp = RM.lerp, mk = RM.canvas;

  function Scene() {
    this.t = 0;
    this.flash = 0;        // iluminación global del relámpago (0..1)
    this.bolt = null;      // rayo visible
    this.events = [];      // eventos agendados (parpadeos, truenos)
    this.nextStrike = 3.2;
    this.nextSheet = 1.5;
    this.shake = 0;
    this.wind = -0.2;
    this.tilt = { x: 0, y: 0 };
    this.tiltTarget = { x: 0, y: 0 };
    this.splashes = [];
    this.runners = [];
    this.falls = [];
    this.ripples = [];
    this.embers = [];
    this.blood = [];
    this.mask = null;
    this.maskOn = true;
    this.hotRect = null;   // botón resaltado (emite brasas)
  }

  /* ---------- Construcción (se rehace al cambiar tamaño) ---------- */

  Scene.prototype.resize = function (W, H, dpr, profile) {
    this.W = W; this.H = H; this.dpr = dpr; this.profile = profile;
    this.u = Math.min(W / 1280, H / 720);
    this.horizon = H * 0.8;
    var c = document.createElement('canvas').getContext('2d');
    var sky = c.createLinearGradient(0, 0, 0, this.horizon);
    sky.addColorStop(0, '#050309');
    sky.addColorStop(0.45, '#120a22');
    sky.addColorStop(1, '#2a1a44');
    this.skyGrad = sky;
    this.clouds = [this.buildClouds(70, [62, 44, 104], 0.5), this.buildClouds(45, [30, 20, 58], 0.75)];
    this.city = this.buildCity();
    this.forests = [
      this.buildForest('#1d1334', 0.05, 0.12, 1),
      this.buildForest('#120a22', 0.08, 0.19, 2)
    ];
    this.buildTrees();
    this.fog = this.buildFog();
    this.vignette = this.buildVignette();
    this.grain = this.buildGrain();
    this.scan = this.buildScanlines();
    this.initRain();
  };

  Scene.prototype.buildClouds = function (n, rgb, alpha) {
    var W = this.W, H = this.H, k = 0.5;
    var cw = W, ch = H * 0.6;
    var c = mk(cw * k, ch * k), g = c.getContext('2d');
    g.scale(k, k);
    for (var i = 0; i < n; i++) {
      var x = Math.random() * cw, y = Math.pow(Math.random(), 1.4) * ch * 0.85;
      var r = rand(0.06, 0.2) * W;
      var a = rand(0.08, 0.22) * alpha;
      for (var dx = -1; dx <= 1; dx++) {
        var gr = g.createRadialGradient(x + dx * cw, y, 0, x + dx * cw, y, r);
        gr.addColorStop(0, 'rgba(' + rgb.join(',') + ',' + a + ')');
        gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
        g.fillStyle = gr;
        g.fillRect(x + dx * cw - r, y - r, r * 2, r * 2);
      }
    }
    return { c: c, w: cw, h: ch };
  };

  Scene.prototype.buildCity = function () {
    var W = this.W, H = this.H, dpr = this.dpr;
    var ch = H * 0.42;
    var c = mk(W * dpr, ch * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    var lights = [];
    var x = W * 0.06;
    while (x < W * 0.94) {
      var bw = rand(0.025, 0.07) * W;
      var center = 1 - Math.abs((x + bw / 2) / W - 0.5) * 1.6;
      var bh = (rand(0.05, 0.16) + center * rand(0.04, 0.16)) * H;
      g.fillStyle = '#1a1230';
      g.fillRect(x, ch - bh, bw, bh);
      if (Math.random() < 0.3) g.fillRect(x + bw * 0.3, ch - bh - H * 0.02, bw * 0.4, H * 0.02);
      var ws = Math.max(2, 3 * this.u);
      for (var wy = ch - bh + ws * 2; wy < ch - ws * 2; wy += ws * 2.6) {
        for (var wx = x + ws; wx < x + bw - ws; wx += ws * 2.2) {
          if (Math.random() < 0.07) {
            g.fillStyle = Math.random() < 0.2 ? 'rgba(255,60,50,0.35)' : 'rgba(255,190,120,0.28)';
            g.fillRect(wx, wy, ws, ws * 1.2);
          }
        }
      }
      x += bw + rand(0, 0.012) * W;
    }
    // Torre central con antena (detrás del letrero).
    var tw = W * 0.035, th = H * 0.36, tx = W * 0.5 - tw / 2;
    g.fillStyle = '#1a1230';
    g.fillRect(tx, ch - th, tw, th);
    g.fillRect(tx + tw * 0.45, ch - th - H * 0.06, tw * 0.1, H * 0.06);
    lights.push({ x: W * 0.5, y: this.horizon - th - H * 0.06 });
    return { c: c, h: ch, lights: lights };
  };

  Scene.prototype.buildForest = function (color, minH, maxH, seed) {
    var W = this.W, H = this.H, dpr = this.dpr;
    var fw = W * 1.1, fh = maxH * H * 1.15;
    var c = mk(fw * dpr, fh * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = color;
    var x = -10;
    while (x < fw + 10) {
      var hill = 0.5 + 0.5 * Math.sin(x / W * 5.3 + seed * 2) * Math.cos(x / W * 2.1 + seed);
      var h = lerp(minH, maxH, clamp(hill * 0.7 + Math.random() * 0.45, 0, 1)) * H;
      var w = h * rand(0.28, 0.38);
      // Pino: tres pisos triangulares + tronco.
      g.fillRect(x - w * 0.04, fh - h * 0.25, w * 0.08, h * 0.25);
      for (var k = 0; k < 4; k++) {
        var ty = fh - h * (0.18 + k * 0.22), tw2 = w * (1 - k * 0.2);
        g.beginPath();
        g.moveTo(x - tw2 / 2, ty);
        g.lineTo(x, ty - h * 0.38);
        g.lineTo(x + tw2 / 2, ty);
        g.closePath(); g.fill();
      }
      x += w * rand(0.35, 0.7);
    }
    g.fillRect(0, fh - 2, fw, 2);
    return { c: c, w: fw, h: fh };
  };

  // Árbol muerto retorcido, dibujado recursivamente.
  function deadTree(h, color, lean, depth, dpr) {
    var w = h * 1.5, ch = h * 1.08;
    var c = mk(w * dpr, ch * dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.strokeStyle = color; g.fillStyle = color;
    g.lineCap = 'round'; g.lineJoin = 'round';
    var bx = w / 2, by = ch;
    for (var i = 0; i < 5; i++) {
      g.lineWidth = h * 0.022 * rand(0.5, 1);
      g.beginPath();
      g.moveTo(bx, by - h * 0.05);
      g.quadraticCurveTo(bx + (i - 2) * h * 0.03, by - h * 0.01, bx + (i - 2) * h * 0.08 + rand(-4, 4), by + 2);
      g.stroke();
    }
    function br(x, y, len, ang, wd, d) {
      var bend = rand(-0.4, 0.4);
      var mx = x + Math.cos(ang + bend) * len * 0.5, my = y + Math.sin(ang + bend) * len * 0.5;
      var x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      g.lineWidth = wd;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
      if (d <= 0) return;
      var n = d >= depth - 1 ? 2 : (Math.random() < 0.3 ? 3 : 2);
      for (var k = 0; k < n; k++) {
        var side = (k % 2 ? 1 : -1) * rand(0.25, 0.75);
        br(x2, y2, len * rand(0.62, 0.82), ang + side + lean * 0.1, wd * rand(0.55, 0.7), d - 1);
      }
      if (d < depth - 2 && Math.random() < 0.35) {
        br(x2, y2, len * 0.35, ang + rand(-1.3, 1.3), wd * 0.4, 0);
      }
    }
    br(bx, by - h * 0.03, h * 0.3, -Math.PI / 2 + lean * 0.2, h * 0.06, depth);
    return { c: c, w: w, h: ch };
  }

  Scene.prototype.buildTrees = function () {
    var W = this.W, H = this.H, dpr = this.dpr;
    this.trees = [];
    var mid = [0.05, 0.16, 0.27, 0.73, 0.84, 0.95];
    for (var i = 0; i < mid.length; i++) {
      var h = H * rand(0.3, 0.5);
      var t = deadTree(h, '#0c0717', rand(-0.6, 0.6), 6, dpr);
      t.x = W * mid[i] + rand(-0.02, 0.02) * W; t.y = this.horizon + H * 0.03;
      t.amp = rand(0.008, 0.016); t.ph = rand(0, 6); t.freq = rand(0.5, 0.9); t.par = 16;
      this.trees.push(t);
    }
    var near = [{ x: -0.07, lean: 1.2 }, { x: 1.07, lean: -1.2 }];
    this.near = near.map(function (n) {
      var t = deadTree(H * 0.88, '#040207', n.lean, 7, dpr);
      t.x = W * n.x; t.y = H + H * 0.06;
      t.amp = 0.006; t.ph = rand(0, 6); t.freq = 0.45; t.par = -26;
      return t;
    });
  };

  Scene.prototype.buildFog = function () {
    var W = this.W, H = this.H, k = 0.35;
    var fw = W, fh = H * 0.3;
    var c = mk(fw * k, fh * k), g = c.getContext('2d');
    g.scale(k, k);
    for (var i = 0; i < 40; i++) {
      var x = Math.random() * fw, y = fh * rand(0.35, 0.8), r = rand(0.05, 0.14) * W;
      for (var dx = -1; dx <= 1; dx++) {
        var gr = g.createRadialGradient(x + dx * fw, y, 0, x + dx * fw, y, r);
        gr.addColorStop(0, 'rgba(110,90,150,' + rand(0.05, 0.12) + ')');
        gr.addColorStop(1, 'rgba(110,90,150,0)');
        g.fillStyle = gr; g.fillRect(x + dx * fw - r, y - r, r * 2, r * 2);
      }
    }
    return { c: c, w: fw, h: fh };
  };

  Scene.prototype.drawFog = function (ctx, speed, y, alpha) {
    var fo = this.fog, off = ((this.t * speed) % fo.w + fo.w) % fo.w;
    ctx.globalAlpha = alpha * (1 + this.flash);
    for (var rep = 0; rep < 2; rep++) ctx.drawImage(fo.c, -off + rep * fo.w + this.tilt.x * 10, y, fo.w, fo.h);
    ctx.globalAlpha = 1;
  };

  Scene.prototype.buildVignette = function () {
    var k = 0.25, W = this.W, H = this.H;
    var c = mk(W * k, H * k), g = c.getContext('2d');
    var gr = g.createRadialGradient(c.width / 2, c.height * 0.45, c.height * 0.25, c.width / 2, c.height / 2, c.width * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    return c;
  };

  Scene.prototype.buildGrain = function () {
    var c = mk(160, 160), g = c.getContext('2d');
    var img = g.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  Scene.prototype.buildScanlines = function () {
    var c = mk(4, 4), g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 0, 4, 1);
    g.fillRect(0, 0, 1, 4);
    return c;
  };

  /* ---------- Lluvia ---------- */

  Scene.prototype.initRain = function () {
    var W = this.W, H = this.H;
    var n = Math.round(clamp(W * H / 620, 480, 1700) * this.profile.rain * (0.25 + 0.75 * RM.settings.rain));
    this.rain = [[], [], []];
    for (var i = 0; i < n; i++) {
      var d = this.newDrop(true);
      this.rain[d.layer].push(d);
    }
  };

  Scene.prototype.newDrop = function (anywhere, d) {
    var W = this.W, H = this.H, u = Math.max(0.5, H / 720);
    d = d || { z: Math.pow(Math.random(), 1.3) };
    var z = d.z;
    d.layer = z < 0.4 ? 0 : z < 0.72 ? 1 : 2;
    d.speed = lerp(520, 1500, z) * u * rand(0.9, 1.1);
    d.len = lerp(7, 34, z) * u;
    d.x = rand(-0.1, 1.25) * W;
    d.y = anywhere ? rand(-H, H) : rand(-H * 0.3, -10);
    d.gy = this.horizon + z * (H - this.horizon) + rand(-4, 4);
    return d;
  };

  Scene.prototype.setMask = function (data, w, h, rect) {
    this.mask = data; this.mw = w; this.mh = h; this.mrect = rect;
  };

  Scene.prototype.hit = function (x, y) {
    if (!this.mask || !this.maskOn) return false;
    var r = this.mrect;
    if (x < r.x0 || x >= r.x1 || y < r.y0 || y >= r.y1) return false;
    return this.mask[(y | 0) * this.mw + (x | 0)] > 110;
  };

  Scene.prototype.splash = function (x, y, n, red) {
    var u = Math.max(0.5, this.H / 720);
    for (var i = 0; i < n && this.splashes.length < 500; i++) {
      var a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      var sp = rand(60, 220) * u;
      this.splashes.push({ x: x, y: y - 1, vx: Math.cos(a) * sp + this.wind * 60, vy: Math.sin(a) * sp, life: rand(0.18, 0.4), red: red });
    }
  };

  Scene.prototype.updateRain = function (dt) {
    var H = this.H, W = this.W, wind = this.wind;
    for (var L = 0; L < 3; L++) {
      var arr = this.rain[L];
      for (var i = 0; i < arr.length; i++) {
        var d = arr[i];
        var py = d.y;
        d.y += d.speed * dt;
        d.x += wind * d.speed * dt;
        if (L === 2 && this.mask && this.maskOn) {
          // Chequea varios puntos del segmento recorrido: las gotas son rápidas.
          var hitY = -1;
          for (var s = 1; s <= 3; s++) {
            var yy = py + (d.y - py) * (s / 3), xx = d.x - wind * (d.y - yy);
            if (this.hit(xx, yy)) { hitY = yy; d.hx = xx; break; }
          }
          if (hitY >= 0) {
            this.splash(d.hx, hitY, 3 + (Math.random() * 3 | 0));
            if (Math.random() < 0.14 && this.runners.length < 80) {
              this.runners.push({ x: d.hx, y: hitY, v: rand(25, 70) * H / 720, life: rand(2, 6), pause: rand(0, 0.3), trail: [d.hx, hitY], age: 0 });
            }
            this.newDrop(false, d);
            continue;
          }
        }
        if (d.y > d.gy) {
          if (d.z > 0.35 && this.ripples.length < 90 && Math.random() < 0.25) {
            this.ripples.push({ x: d.x, y: d.gy, r: 0, max: lerp(4, 16, d.z) * H / 720, life: 1 });
          }
          if (L === 2 && Math.random() < 0.3) this.splash(d.x, d.gy, 2);
          this.newDrop(false, d);
        } else if (d.x < -W * 0.2) {
          d.x += W * 1.4;
        }
      }
    }
  };

  Scene.prototype.drawRain = function (ctx, L) {
    var arr = this.rain[L];
    if (!arr.length) return;
    var u = Math.max(0.6, this.H / 720);
    var widths = [0.8, 1.2, 1.9], alphas = [0.16, 0.26, 0.38];
    var a = Math.min(0.9, alphas[L] * (1 + this.flash * 1.8));
    ctx.strokeStyle = 'rgba(200,198,235,' + a + ')';
    ctx.lineWidth = widths[L] * u;
    ctx.beginPath();
    var w = this.wind;
    for (var i = 0; i < arr.length; i++) {
      var d = arr[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - w * d.len, d.y - d.len);
    }
    ctx.stroke();
  };

  /* ---------- Gotas que escurren por las letras ---------- */

  Scene.prototype.updateRunners = function (dt) {
    var H = this.H;
    for (var i = this.runners.length - 1; i >= 0; i--) {
      var r = this.runners[i];
      r.life -= dt; r.age += dt;
      if (r.life <= 0 || !this.maskOn) { this.runners.splice(i, 1); continue; }
      if (r.pause > 0) { r.pause -= dt; continue; }
      var ny = r.y + r.v * dt;
      if (this.hit(r.x, ny + 2)) r.y = ny;
      else if (this.hit(r.x - 1.5, ny + 2)) { r.x -= 1.5; r.y = ny; }
      else if (this.hit(r.x + 1.5, ny + 2)) { r.x += 1.5; r.y = ny; }
      else {
        // Se desprende del borde y cae.
        this.falls.push({ x: r.x, y: r.y + 2, vy: 30, red: false });
        this.runners.splice(i, 1);
        continue;
      }
      r.v = clamp(r.v + rand(-40, 40) * dt, 15 * H / 720, 90 * H / 720);
      if (Math.random() < dt * 0.6) r.pause = rand(0.15, 0.8);
      var tl = r.trail;
      var lx = tl[tl.length - 2], ly = tl[tl.length - 1];
      if (Math.abs(r.y - ly) + Math.abs(r.x - lx) > 3) {
        tl.push(r.x, r.y);
        if (tl.length > 24) tl.splice(0, 2);
      }
    }
    for (var j = this.falls.length - 1; j >= 0; j--) {
      var f = this.falls[j];
      var py = f.y;
      f.vy += 1400 * dt * H / 720;
      f.y += f.vy * dt;
      if (f.y - py > 0 && this.hit(f.x, f.y) && !this.hit(f.x, py)) {
        this.splash(f.x, f.y, 3, f.red);
        this.falls.splice(j, 1);
        continue;
      }
      if (f.y > this.horizon + (this.H - this.horizon) * 0.9) {
        this.ripples.push({ x: f.x, y: f.y, r: 0, max: 10, life: 1, red: f.red });
        this.falls.splice(j, 1);
      }
    }
  };

  Scene.prototype.drawRunners = function (ctx) {
    var u = Math.max(0.6, this.H / 720);
    var lit = this.flash;
    ctx.lineCap = 'round';
    for (var i = 0; i < this.runners.length; i++) {
      var r = this.runners[i], tl = r.trail;
      var fade = Math.min(1, r.life * 2) * Math.min(1, r.age * 6);
      if (tl.length >= 4) {
        ctx.strokeStyle = 'rgba(255,215,215,' + (0.16 * fade) + ')';
        ctx.lineWidth = 1.7 * u;
        ctx.beginPath(); ctx.moveTo(tl[0], tl[1]);
        for (var k = 2; k < tl.length; k += 2) ctx.lineTo(tl[k], tl[k + 1]);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,0,0,' + (0.45 * fade) + ')';
      ctx.beginPath(); ctx.arc(r.x, r.y + 0.8 * u, 2.1 * u, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,235,' + ((0.7 + lit * 0.3) * fade) + ')';
      ctx.beginPath(); ctx.arc(r.x - 0.5 * u, r.y - 0.4 * u, 1.1 * u, 0, 6.283); ctx.fill();
    }
    for (var j = 0; j < this.falls.length; j++) {
      var f = this.falls[j];
      ctx.fillStyle = f.red ? 'rgba(150,0,0,0.95)' : 'rgba(220,225,255,0.75)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 1.4 * u, 2.6 * u, 0, 0, 6.283); ctx.fill();
    }
  };

  Scene.prototype.drawSplashes = function (ctx, dt) {
    var u = Math.max(0.6, this.H / 720);
    var g = 900 * this.H / 720;
    for (var i = this.splashes.length - 1; i >= 0; i--) {
      var s = this.splashes[i];
      s.life -= dt;
      if (s.life <= 0) { this.splashes.splice(i, 1); continue; }
      s.vy += g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      var a = Math.min(1, s.life * 4);
      ctx.fillStyle = s.red ? 'rgba(170,10,10,' + a + ')' : 'rgba(215,215,255,' + (a * 0.8) + ')';
      ctx.fillRect(s.x, s.y, 1.5 * u, 1.5 * u);
    }
  };

  /* ---------- Sangre que gotea del título ---------- */

  Scene.prototype.setBloodTips = function (tips) {
    this.bloodTips = tips.map(function (p) { return { x: p.x, y: p.y, r: 0, timer: rand(1, 9), max: p.r }; });
  };

  Scene.prototype.updateBlood = function (dt) {
    if (!this.bloodTips || !this.maskOn) return;
    for (var i = 0; i < this.bloodTips.length; i++) {
      var b = this.bloodTips[i];
      if (b.timer > 0) { b.timer -= dt; continue; }
      b.r += dt * b.max * 0.6;
      if (b.r >= b.max) {
        this.falls.push({ x: b.x, y: b.y + b.r, vy: 20, red: true });
        b.r = 0; b.timer = rand(3, 12);
      }
    }
  };

  Scene.prototype.drawBlood = function (ctx) {
    if (!this.bloodTips) return;
    for (var i = 0; i < this.bloodTips.length; i++) {
      var b = this.bloodTips[i];
      if (b.r <= 0.2) continue;
      ctx.fillStyle = '#7d0000';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.6, b.r * 0.8, b.r * 1.1, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,120,0.5)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y + b.r * 0.3, b.r * 0.25, 0, 6.283); ctx.fill();
    }
  };

  /* ---------- Brasas ---------- */

  Scene.prototype.updateEmbers = function (dt) {
    var W = this.W, H = this.H;
    var rate = 7 * this.profile.embers;
    if (Math.random() < rate * dt) {
      this.embers.push({ x: rand(0.1, 0.9) * W, y: rand(0.55, 1.02) * H, vx: rand(-10, 10), vy: rand(-55, -20), life: rand(3, 6), max: 6, s: rand(0.8, 2.2), ph: rand(0, 6) });
    }
    var hr = this.hotRect;
    if (hr && Math.random() < 30 * dt * this.profile.embers) {
      this.embers.push({ x: rand(hr.x0, hr.x1), y: rand(hr.y0 + (hr.y1 - hr.y0) * 0.3, hr.y1), vx: rand(-15, 15), vy: rand(-90, -35), life: rand(0.8, 1.8), max: 1.8, s: rand(0.8, 2), ph: rand(0, 6) });
    }
    for (var i = this.embers.length - 1; i >= 0; i--) {
      var e = this.embers[i];
      e.life -= dt;
      if (e.life <= 0) { this.embers.splice(i, 1); continue; }
      e.x += (e.vx + Math.sin(this.t * 2 + e.ph) * 14 + this.wind * 40) * dt;
      e.y += e.vy * dt;
    }
  };

  Scene.prototype.drawEmbers = function (ctx) {
    var u = Math.max(0.6, this.H / 720);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.embers.length; i++) {
      var e = this.embers[i];
      var a = Math.min(1, e.life) * (0.6 + 0.4 * Math.sin(this.t * 9 + e.ph));
      ctx.fillStyle = 'rgba(255,' + (70 + (e.ph * 20 | 0)) + ',20,' + a + ')';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.s * u, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  /* ---------- Rayos ---------- */

  function boltPath(x0, y0, x1, y1, disp, out) {
    if (disp < 3) { out.push(x1, y1); return; }
    var mx = (x0 + x1) / 2 + rand(-disp, disp), my = (y0 + y1) / 2 + rand(-disp, disp) * 0.3;
    boltPath(x0, y0, mx, my, disp / 2, out);
    boltPath(mx, my, x1, y1, disp / 2, out);
  }

  Scene.prototype.strike = function (forceNear) {
    var W = this.W, H = this.H;
    var dist = forceNear ? rand(0, 0.12) : Math.pow(Math.random(), 0.8);
    var near = 1 - dist;
    if (dist < 0.75) {
      var x0 = rand(0.08, 0.92) * W, x1 = x0 + rand(-0.15, 0.15) * W;
      var y1 = this.horizon - rand(0, 0.1) * H;
      var main = [x0, -10];
      boltPath(x0, -10, x1, y1, W * 0.12, main);
      var branches = [];
      for (var b = 0; b < 4; b++) {
        var idx = (rand(0.15, 0.7) * main.length / 2 | 0) * 2;
        var bx = main[idx], by = main[idx + 1];
        var pts = [bx, by];
        boltPath(bx, by, bx + rand(-0.14, 0.14) * W, by + rand(0.08, 0.25) * H, W * 0.05, pts);
        branches.push(pts);
      }
      this.bolt = { main: main, branches: branches, life: 0.32, x: x0, power: 0.5 + near * 0.5 };
    }
    var p = 0.45 + near * 0.55;
    var self = this;
    [[0, 1], [0.07, 0.35], [0.12, 0.85], [0.22, 0.25], [0.3, 0.6]].forEach(function (f) {
      self.events.push({ at: self.t + f[0], fn: function () { self.flash = Math.max(self.flash, f[1] * p); } });
    });
    var delay = 0.06 + dist * 2.2;
    this.events.push({ at: this.t + delay, fn: function () {
      RM.audio.thunder(dist);
      if (near > 0.55) {
        self.shake = Math.max(self.shake, near * 9 * self.u);
        RM.vibrate(near > 0.85 ? [60, 40, 140] : [40]);
      }
    } });
  };

  Scene.prototype.sheet = function () {
    var self = this, p = rand(0.1, 0.3);
    [[0, 1], [0.1, 0.5]].forEach(function (f) {
      self.events.push({ at: self.t + f[0], fn: function () { self.flash = Math.max(self.flash, f[1] * p); } });
    });
  };

  Scene.prototype.drawBolt = function (ctx) {
    var b = this.bolt;
    if (!b) return;
    var a = clamp(b.life / 0.32, 0, 1) * (0.6 + 0.4 * Math.random()) * b.power;
    var u = Math.max(0.6, this.H / 720);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var passes = [[20, 'rgba(120,80,255,' + (0.12 * a) + ')'], [7, 'rgba(190,170,255,' + (0.45 * a) + ')'], [2.4, 'rgba(255,255,255,' + a + ')']];
    var draw = function (pts, wmul) {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      for (var p = 0; p < passes.length; p++) {
        ctx.lineWidth = passes[p][0] * u * wmul; ctx.strokeStyle = passes[p][1]; ctx.stroke();
      }
    };
    draw(b.main, 1);
    for (var i = 0; i < b.branches.length; i++) draw(b.branches[i], 0.5);
    ctx.globalCompositeOperation = 'source-over';
  };

  /* ---------- Bucle ---------- */

  Scene.prototype.update = function (dt) {
    this.t += dt;
    var t = this.t;
    // Viento con ráfagas.
    var target = -0.2 + Math.sin(t * 0.13) * 0.08 + Math.sin(t * 0.71) * 0.04 + (Math.sin(t * 0.05) > 0.7 ? -0.12 : 0);
    this.wind = lerp(this.wind, target, Math.min(1, dt * 0.8));
    this.tilt.x = lerp(this.tilt.x, this.tiltTarget.x, Math.min(1, dt * 4));
    this.tilt.y = lerp(this.tilt.y, this.tiltTarget.y, Math.min(1, dt * 4));

    if (RM.settings.thunder) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) { this.strike(false); this.nextStrike = rand(5, 13); }
      this.nextSheet -= dt;
      if (this.nextSheet <= 0) { this.sheet(); this.nextSheet = rand(2, 6); }
    }
    for (var i = this.events.length - 1; i >= 0; i--) {
      if (t >= this.events[i].at) { var e = this.events[i]; this.events.splice(i, 1); e.fn(); }
    }
    this.flash *= Math.exp(-dt * 7);
    if (this.bolt) { this.bolt.life -= dt; if (this.bolt.life <= 0) this.bolt = null; }
    this.shake *= Math.exp(-dt * 6);

    this.updateRain(dt);
    this.updateRunners(dt);
    this.updateBlood(dt);
    this.updateEmbers(dt);
    for (var r = this.ripples.length - 1; r >= 0; r--) {
      var rp = this.ripples[r];
      rp.life -= dt * 1.8; rp.r = rp.max * (1 - rp.life);
      if (rp.life <= 0) this.ripples.splice(r, 1);
    }
  };

  Scene.prototype.img = function (ctx, c, x, y) {
    ctx.drawImage(c, x, y, c.width / this.dpr, c.height / this.dpr);
  };

  Scene.prototype.drawTree = function (ctx, tr) {
    var sway = Math.sin(this.t * tr.freq + tr.ph) * tr.amp + this.wind * tr.amp * 2.5;
    ctx.save();
    ctx.translate(tr.x + this.tilt.x * tr.par, tr.y + this.tilt.y * tr.par * 0.3);
    ctx.rotate(sway);
    ctx.drawImage(tr.c, -tr.w / 2, -tr.h, tr.w, tr.h);
    ctx.restore();
  };

  // Todo lo que va detrás del letrero.
  Scene.prototype.drawBack = function (ctx) {
    var W = this.W, H = this.H, hz = this.horizon, f = this.flash, tx = this.tilt.x, ty = this.tilt.y;
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(-20, -20, W + 40, hz + 40);
    // Luna velada.
    var mx = W * 0.74 + tx * 4, my = H * 0.17;
    var mg = ctx.createRadialGradient(mx, my, 0, mx, my, H * 0.35);
    mg.addColorStop(0, 'rgba(170,150,220,0.22)');
    mg.addColorStop(1, 'rgba(170,150,220,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - H * 0.35, my - H * 0.35, H * 0.7, H * 0.7);
    // Cielo iluminado por el relámpago.
    if (f > 0.01) {
      ctx.fillStyle = 'rgba(175,150,255,' + (f * 0.55) + ')';
      ctx.fillRect(-20, -20, W + 40, hz + 40);
    }
    for (var i = 0; i < this.clouds.length; i++) {
      var cl = this.clouds[i];
      var off = ((this.t * (8 + i * 10)) % cl.w + cl.w) % cl.w;
      var cy = -H * 0.05 + ty * 3;
      for (var rep = 0; rep < 2; rep++) {
        var x = -off + rep * cl.w + tx * (3 + i * 3);
        ctx.drawImage(cl.c, x, cy, cl.w, cl.h);
        if (f > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, f * 1.6);
          ctx.drawImage(cl.c, x, cy, cl.w, cl.h);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    this.drawBolt(ctx);
    // Ciudad y su luz de antena.
    var cx = tx * 6;
    this.img(ctx, this.city.c, cx, hz - this.city.h);
    var blink = (Math.sin(this.t * 2.4) > 0.6) ? 1 : 0.15;
    for (var l = 0; l < this.city.lights.length; l++) {
      var lt = this.city.lights[l];
      ctx.fillStyle = 'rgba(255,30,30,' + blink + ')';
      ctx.beginPath(); ctx.arc(lt.x + cx, lt.y, 2 * this.u + 1, 0, 6.283); ctx.fill();
    }
    // Niebla sobre la ciudad.
    var fog = ctx.createLinearGradient(0, hz - H * 0.3, 0, hz);
    fog.addColorStop(0, 'rgba(40,26,66,0)');
    fog.addColorStop(1, 'rgba(46,30,74,0.55)');
    ctx.fillStyle = fog; ctx.fillRect(-20, hz - H * 0.3, W + 40, H * 0.3);
    // Bosques lejanos.
    for (var k = 0; k < this.forests.length; k++) {
      var fo = this.forests[k];
      this.img(ctx, fo.c, -W * 0.05 + tx * (8 + k * 5), hz - fo.h + H * 0.01 * (k + 1));
    }
    // Agua / suelo con reflejo.
    var gy = hz + H * 0.02;
    var water = ctx.createLinearGradient(0, gy, 0, H);
    water.addColorStop(0, '#120c22');
    water.addColorStop(0.4, '#0d0f26');
    water.addColorStop(1, '#05040c');
    ctx.fillStyle = water; ctx.fillRect(-20, gy, W + 40, H - gy + 20);
    ctx.save();
    ctx.globalAlpha = 0.16 + f * 0.25;
    ctx.translate(0, gy * 2);
    ctx.scale(1, -1);
    this.img(ctx, this.city.c, cx, gy - this.city.h * 0.6);
    ctx.restore();
    if (f > 0.01) {
      ctx.fillStyle = 'rgba(150,130,255,' + (f * 0.18) + ')';
      ctx.fillRect(-20, gy, W + 40, H - gy + 20);
    }
    // Ondas en charcos.
    ctx.lineWidth = 1;
    for (var r = 0; r < this.ripples.length; r++) {
      var rp = this.ripples[r];
      ctx.strokeStyle = rp.red ? 'rgba(160,20,20,' + (rp.life * 0.6) + ')' : 'rgba(170,170,225,' + (rp.life * 0.35) + ')';
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.28, 0, 0, 6.283); ctx.stroke();
    }
    this.drawFog(ctx, 12, hz - H * 0.2, 0.8);
    // Árboles medios.
    for (var m = 0; m < this.trees.length; m++) this.drawTree(ctx, this.trees[m]);
    this.drawFog(ctx, -20, hz - H * 0.12, 0.6);
    this.drawRain(ctx, 0);
    this.drawRain(ctx, 1);
    for (var n = 0; n < this.near.length; n++) this.drawTree(ctx, this.near[n]);
  };

  // Lluvia cercana, salpicaduras y brasas: por delante del letrero.
  Scene.prototype.drawFront = function (ctx, dt) {
    this.drawBlood(ctx);
    this.drawRunners(ctx);
    this.drawRain(ctx, 2);
    this.drawSplashes(ctx, dt);
    this.drawEmbers(ctx);
  };

  Scene.prototype.drawPost = function (ctx) {
    var W = this.W, H = this.H;
    if (this.flash > 0.01) {
      ctx.fillStyle = 'rgba(225,215,255,' + (this.flash * 0.1) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.drawImage(this.vignette, -2, -2, W + 4, H + 4);
    if (this.profile.grain) {
      ctx.globalAlpha = 0.045;
      var p = ctx.createPattern(this.grain, 'repeat');
      ctx.save();
      ctx.translate(rand(0, 160), rand(0, 160));
      ctx.fillStyle = p; ctx.fillRect(-160, -160, W + 320, H + 320);
      ctx.restore();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = ctx.createPattern(this.scan, 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  };

  RM.Scene = Scene;
})(window.RM);
