/* Red Main — letrero del título, botones JUGAR / SALIR y engranaje de ajustes. */
(function (RM) {
  'use strict';
  var rand = RM.rand, mk = RM.canvas, lerp = RM.lerp;
  var TITLE_FONT = '"Cinzel Decorative", "Cinzel", serif';
  var BTN_FONT = '"Metal Mania", "Cinzel", serif';

  function Menu() {
    this.items = [
      { id: 'play', label: 'JUGAR', h: 0 },
      { id: 'exit', label: 'SALIR', h: 0 }
    ];
    this.gear = { id: 'settings', h: 0 };
    this.hover = null;
    this.pressed = null;
    this.t = 0;
    this.appear = 0;
  }

  // Busca bordes inferiores de los glifos para colgar gotas de sangre.
  function findDripPoints(canvas, count) {
    var g = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var data = g.getImageData(0, 0, w, h).data;
    var pts = [];
    var step = Math.max(1, (w / 260) | 0);
    for (var x = 0; x < w; x += step) {
      for (var y = 1; y < h - 2; y++) {
        var a = data[(y * w + x) * 4 + 3], b = data[((y + 1) * w + x) * 4 + 3];
        if (a > 160 && b < 30) pts.push({ x: x, y: y });
      }
    }
    var out = [];
    for (var i = 0; i < count && pts.length; i++) {
      var k = (Math.random() * pts.length) | 0;
      var p = pts[k];
      var tooClose = out.some(function (o) { return Math.abs(o.x - p.x) < w * 0.025; });
      if (!tooClose) out.push(p);
      pts.splice(k, 1);
    }
    return out;
  }

  function drawDrip(g, x, y, len, w) {
    g.beginPath();
    g.moveTo(x - w * 1.3, y - w * 0.6);
    g.quadraticCurveTo(x - w * 0.5, y + w * 0.2, x - w * 0.45, y + w);
    g.lineTo(x - w * 0.32, y + len);
    g.arc(x, y + len, w * 0.55, Math.PI, 0, true);
    g.lineTo(x + w * 0.45, y + w);
    g.quadraticCurveTo(x + w * 0.5, y + w * 0.2, x + w * 1.3, y - w * 0.6);
    g.closePath();
    g.fill();
  }

  function speckle(g, w, h, n, color, maxR) {
    g.fillStyle = color;
    for (var i = 0; i < n; i++) {
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, Math.random() * maxR, 0, 6.283);
      g.fill();
    }
  }

  Menu.prototype.build = function (W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    var portrait = H > W;
    this.buildTitle(W, H, dpr, portrait);
    this.buildButtons(W, H, dpr, portrait);
    var gs = Math.max(16, H * 0.032);
    this.gear.r = gs;
    this.gear.x = Math.max(24, H * 0.06) + gs;
    this.gear.y = H - Math.max(22, H * 0.05) - gs;
    this.gear.labelSize = gs * 1.45;
    this.gear.rect = { x0: this.gear.x - gs * 1.8, y0: this.gear.y - gs * 1.8, x1: this.gear.x + gs * 6.4, y1: this.gear.y + gs * 1.8 };
  };

  // scale/yFrac permiten reusar el letrero más chico (pantalla de modos).
  Menu.prototype.buildTitle = function (W, H, dpr, portrait, scale, yFrac) {
    scale = scale || 1;
    var fs = Math.min(H * (portrait ? 0.1 : 0.155), W * (portrait ? 0.2 : 0.12)) * scale;
    var cw = fs * 4.2, ch = fs * 2.7;
    var shape = mk(cw * dpr, ch * dpr), g = shape.getContext('2d');
    g.scale(dpr, dpr);
    g.textBaseline = 'alphabetic';
    g.font = '700 ' + fs + 'px ' + TITLE_FONT;
    var redW = g.measureText('Red').width, mainW = g.measureText('Main').width, rW = g.measureText('R').width;
    var y1 = fs * 1.0, y2 = fs * 1.95;
    var redX = cw / 2 - redW / 2 + fs * 0.18;
    g.fillStyle = '#fff';
    g.fillText('Red', redX, y1);
    g.fillText('Main', cw / 2 - mainW / 2, y2);
    // R espejada, pegada a la R original (el sello del logo).
    var mirror = mk(cw * dpr, ch * dpr), mg = mirror.getContext('2d');
    mg.scale(dpr, dpr);
    mg.font = g.font; mg.fillStyle = '#fff';
    mg.save();
    mg.translate(redX + rW * 0.52, 0);
    mg.scale(-1, 1);
    mg.fillText('R', 0, y1);
    mg.restore();
    // Gotas: chorreados que cuelgan de los bordes inferiores.
    var tips = [];
    var dps = findDripPoints(shape, 48);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#fff';
    for (var i = 0; i < dps.length; i++) {
      var p = dps[i];
      var long = Math.random() < 0.4;
      var len = (long ? rand(0.2, 0.5) : rand(0.05, 0.16)) * fs * dpr;
      var w = rand(0.02, 0.038) * fs * dpr;
      drawDrip(g, p.x, p.y, len, w);
      if (long) tips.push({ x: p.x / dpr, y: (p.y + len) / dpr, r: w * 0.6 / dpr });
    }
    // Colorear: base roja, borde superior brillante, textura gastada.
    var color = function (src, top, mid, bot) {
      var c = mk(src.width, src.height), cg = c.getContext('2d');
      cg.drawImage(src, 0, 0);
      cg.globalCompositeOperation = 'source-in';
      cg.fillStyle = top; cg.fillRect(0, 0, c.width, c.height);
      // Copia desplazada hacia abajo: deja un filo de luz en el borde superior.
      var tmp = mk(src.width, src.height), tg = tmp.getContext('2d');
      var grd = tg.createLinearGradient(0, 0, 0, tmp.height);
      grd.addColorStop(0, mid); grd.addColorStop(0.75, bot); grd.addColorStop(1, '#3a0000');
      tg.drawImage(src, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = grd; tg.fillRect(0, 0, tmp.width, tmp.height);
      cg.globalCompositeOperation = 'source-atop';
      cg.drawImage(tmp, 0, fs * 0.03 * dpr);
      speckle(cg, c.width, c.height, 900, 'rgba(25,0,0,0.35)', 1.6 * dpr);
      speckle(cg, c.width, c.height, 300, 'rgba(255,90,70,0.18)', 1.2 * dpr);
      return c;
    };
    var art = mk(cw * dpr, ch * dpr), ag = art.getContext('2d');
    ag.globalAlpha = 0.9;
    ag.drawImage(color(mirror, '#7a0606', '#5c0202', '#3d0000'), 0, 0);
    ag.globalAlpha = 1;
    ag.drawImage(color(shape, '#e5261c', '#b3100b', '#7a0303'), 0, 0);
    // Silueta completa (para glow, sombra y máscara).
    var full = mk(cw * dpr, ch * dpr), fg = full.getContext('2d');
    fg.drawImage(mirror, 0, 0); fg.drawImage(shape, 0, 0);
    var blur = function (src, px, col) {
      var pad = px * 3;
      var c = mk(src.width + pad * 2, src.height + pad * 2), bg = c.getContext('2d');
      bg.filter = 'blur(' + px + 'px)';
      var tint = mk(src.width, src.height), tg = tint.getContext('2d');
      tg.drawImage(src, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, tint.width, tint.height);
      bg.drawImage(tint, pad, pad);
      c.pad = pad;
      return c;
    };
    this.title = {
      art: art, full: full,
      glow: blur(full, fs * 0.14 * dpr, '#ff1800'),
      shadow: blur(full, fs * 0.08 * dpr, '#000'),
      x: W / 2 - cw / 2, y: H * (yFrac != null ? yFrac : (portrait ? 0.14 : 0.1)) - fs * 0.1, w: cw, h: ch
    };
    var tx = this.title.x, ty = this.title.y;
    this.bloodTips = tips.map(function (p) { return { x: p.x + tx, y: p.y + ty, r: Math.max(1.5, p.r * 1.6) }; });
  };

  Menu.prototype.buildButtons = function (W, H, dpr, portrait) {
    var fs = Math.min(H * (portrait ? 0.06 : 0.09), W * 0.1);
    var ys = portrait ? [0.56, 0.66] : [0.61, 0.75];
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      var probe = mk(10, 10).getContext('2d');
      probe.font = fs + 'px ' + BTN_FONT;
      var tw = probe.measureText(it.label).width;
      var pad = fs * 0.5;
      var cw = tw + pad * 2, ch = fs * 1.7;
      var make = function (fill, stroke) {
        var c = mk(cw * dpr, ch * dpr), g = c.getContext('2d');
        g.scale(dpr, dpr);
        g.font = fs + 'px ' + BTN_FONT;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (stroke) { g.lineWidth = fs * 0.06; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(it.label, cw / 2, ch / 2); }
        g.fillStyle = fill(g);
        g.fillText(it.label, cw / 2, ch / 2);
        return c;
      };
      it.normal = make(function (g) {
        var gr = g.createLinearGradient(0, ch * 0.3, 0, ch * 0.7);
        gr.addColorStop(0, '#a8120e'); gr.addColorStop(1, '#650303');
        return gr;
      }, 'rgba(0,0,0,0.55)');
      var ng = it.normal.getContext('2d');
      ng.globalCompositeOperation = 'source-atop';
      speckle(ng, it.normal.width, it.normal.height, 260, 'rgba(20,0,0,0.4)', 1.4 * dpr);
      it.lit = make(function (g) {
        var gr = g.createLinearGradient(0, ch * 0.28, 0, ch * 0.72);
        gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.4, '#ff6a1f'); gr.addColorStop(1, '#b81000');
        return gr;
      }, 'rgba(90,0,0,0.6)');
      var shapeC = make(function () { return '#fff'; });
      var gp = fs * 0.35 * dpr * 3;
      var glow = mk(shapeC.width + gp * 2, shapeC.height + gp * 2), gg = glow.getContext('2d');
      gg.filter = 'blur(' + (fs * 0.35 * dpr) + 'px)';
      var tint = mk(shapeC.width, shapeC.height), tg = tint.getContext('2d');
      tg.drawImage(shapeC, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#ff3000'; tg.fillRect(0, 0, tint.width, tint.height);
      gg.drawImage(tint, gp, gp);
      glow.pad = gp;
      it.glow = glow;
      it.shape = shapeC;
      it.cw = cw; it.ch = ch; it.fs = fs;
      it.x = W / 2; it.y = H * ys[i];
      it.rect = { x0: it.x - cw / 2 - fs * 0.3, y0: it.y - ch * 0.42, x1: it.x + cw / 2 + fs * 0.3, y1: it.y + ch * 0.42 };
    }
  };

  // Silueta del letrero y botones en blanco para la colisión de la lluvia.
  Menu.prototype.buildMask = function () {
    var W = Math.ceil(this.W), H = Math.ceil(this.H);
    var c = mk(W, H), g = c.getContext('2d');
    var T = this.title;
    g.drawImage(T.full, T.x, T.y, T.w, T.h);
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      g.drawImage(it.shape, it.x - it.cw / 2, it.y - it.ch / 2, it.cw, it.ch);
    }
    var d = g.getImageData(0, 0, W, H).data;
    var a = new Uint8Array(W * H);
    for (var k = 0; k < a.length; k++) a[k] = d[k * 4 + 3];
    var last = this.items[this.items.length - 1];
    return { data: a, w: W, h: H, rect: { x0: 0, y0: Math.max(0, T.y), x1: W, y1: Math.min(H, last.rect.y1 + 4) } };
  };

  Menu.prototype.hitTest = function (x, y) {
    for (var i = 0; i < this.items.length; i++) {
      var r = this.items[i].rect;
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return this.items[i];
    }
    var gr = this.gear.rect;
    if (x >= gr.x0 && x <= gr.x1 && y >= gr.y0 && y <= gr.y1) return this.gear;
    return null;
  };

  Menu.prototype.update = function (dt) {
    this.t += dt;
    var all = this.items.concat([this.gear]);
    for (var i = 0; i < all.length; i++) {
      var it = all[i];
      var target = (this.hover === it || this.pressed === it) ? 1 : 0;
      it.h = lerp(it.h, target, Math.min(1, dt * (target ? 12 : 6)));
    }
  };

  Menu.prototype.hotRect = function () {
    var it = this.hover || this.pressed;
    return it && it.rect && it !== this.gear ? it.rect : null;
  };

  Menu.prototype.drawTitle = function (ctx, flash, alpha) {
    var T = this.title, d = this.dpr;
    var pulse = 0.55 + 0.15 * Math.sin(this.t * 1.7) + 0.08 * Math.sin(this.t * 7.3);
    ctx.globalAlpha = 0.75 * alpha;
    ctx.drawImage(T.shadow, T.x - T.shadow.pad / d, T.y - T.shadow.pad / d + T.h * 0.02, T.shadow.width / d, T.shadow.height / d);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (pulse * 0.8 + flash * 0.6) * alpha);
    ctx.drawImage(T.glow, T.x - T.glow.pad / d, T.y - T.glow.pad / d, T.glow.width / d, T.glow.height / d);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(T.art, T.x, T.y, T.w, T.h);
    if (flash > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash * 0.45 * alpha;
      ctx.drawImage(T.art, T.x, T.y, T.w, T.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  };

  Menu.prototype.drawButtons = function (ctx, flash, alpha) {
    var d = this.dpr;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], h = it.h;
      var flick = 0.85 + 0.15 * Math.sin(this.t * 23 + i * 3) * Math.sin(this.t * 7 + i);
      var s = 1 + 0.06 * h;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(s, s);
      if (h > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        var gx = -it.cw / 2 - it.glow.pad / d, gy = -it.ch / 2 - it.glow.pad / d, gw = it.glow.width / d, gh = it.glow.height / d;
        ctx.globalAlpha = h * flick * alpha;
        ctx.drawImage(it.glow, gx, gy, gw, gh);
        ctx.globalAlpha = h * flick * alpha * 0.7;
        ctx.drawImage(it.glow, gx + gw * 0.1, gy + gh * 0.15, gw * 0.8, gh * 0.7);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = (1 - h) * alpha;
      ctx.drawImage(it.normal, -it.cw / 2, -it.ch / 2, it.cw, it.ch);
      ctx.globalAlpha = h * alpha;
      ctx.drawImage(it.lit, -it.cw / 2, -it.ch / 2, it.cw, it.ch);
      if (h > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = h * alpha * (0.25 + 0.2 * flick);
        ctx.drawImage(it.lit, -it.cw / 2, -it.ch / 2, it.cw, it.ch);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (flash > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash * 0.3 * alpha;
        ctx.drawImage(it.normal, -it.cw / 2, -it.ch / 2, it.cw, it.ch);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.drawGear(ctx, alpha);
  };

  Menu.prototype.drawGear = function (ctx, alpha) {
    var G = this.gear, r = G.r, h = G.h;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(G.x, G.y);
    ctx.save();
    ctx.rotate(this.t * 0.25 + h * 0.8);
    ctx.beginPath();
    var teeth = 8;
    for (var i = 0; i < teeth * 2; i++) {
      var a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
      var rr = i % 2 ? r * 0.78 : r;
      ctx.arc(0, 0, rr, a0 + 0.06, a1 - 0.06);
    }
    ctx.closePath();
    ctx.moveTo(r * 0.34, 0);
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2, true);
    var c = h > 0.5 ? '#ff5a1f' : '#8e0c0c';
    ctx.shadowColor = 'rgba(255,40,0,' + (0.2 + h * 0.6) + ')';
    ctx.shadowBlur = r * (0.4 + h);
    ctx.fillStyle = c;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.font = '700 ' + G.labelSize + 'px ' + TITLE_FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = h > 0.5 ? '#ff6a2a' : '#9a0d0d';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
    ctx.fillText('Demo', r * 1.5, r * 0.05);
    ctx.restore();
  };

  RM.Menu = Menu;
})(window.RM);
