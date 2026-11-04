/* Red Main — selección de modo: HISTORIA, 1 JUGADOR y ONLINE sobre la tormenta. */
(function (RM) {
  'use strict';
  var mk = RM.canvas, lerp = RM.lerp, clamp = RM.clamp;
  var BTN_FONT = '"Metal Mania", "Cinzel", serif';

  function Modes() {
    this.cards = [
      { id: 'story', label: 'HISTORIA', art: 'story', banner: ['#c4180f', '#6e0404'], text: '#e9e6e6', h: 0, tag: '3 ranuras' },
      { id: 'solo', label: '1 JUGADOR', art: 'solo', banner: ['#c4180f', '#6e0404'], text: '#e9e6e6', h: 0, tag: '4 niveles' },
      { id: 'online', label: 'ONLINE', art: 'online', banner: ['#f2c200', '#9a7600'], text: '#1a1200', h: 0, tag: 'BETA' }
    ];
    this.back = { id: 'back', h: 0 };
    this.hover = null;
    this.pressed = null;
    this.t = 0;
    this.appear = 0;
    this.built = false;
    this.fire = [];
    this.onlineCount = null;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  Modes.roundRect = roundRect;

  // Devuelve la lista de tareas que el cargador ejecuta de a una por frame.
  Modes.prototype.tasks = function (W, H, dpr) {
    var self = this;
    var list = [function () { self.layout(W, H, dpr); }];
    list.push(function () { RM.Menu.prototype.buildTitle.call(self, W, H, dpr, H > W, 0.6, 0.035); });
    this.cards.forEach(function (c) { list.push(function () { self.buildCard(c); }); });
    list.push(function () { self.buildBack(); });
    list.push(function () { self.mask = self.buildMask(); self.built = true; });
    return list;
  };

  Modes.prototype.buildNow = function (W, H, dpr) {
    this.tasks(W, H, dpr).forEach(function (f) { f(); });
  };

  Modes.prototype.layout = function (W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    var portrait = H > W;
    var ch = portrait ? Math.min(H * 0.24, W * 0.5) : Math.min(H * 0.52, W * 0.3);
    var cw = ch * 0.84;
    var gap = Math.min(W * 0.045, cw * 0.25);
    this.cw = cw; this.ch = ch;
    var self = this;
    this.cards.forEach(function (c, i) {
      if (portrait) {
        c.x = W / 2 + (i === 1 ? 0 : (i === 0 ? -1 : 1) * (cw / 2 + gap / 2)) ;
        c.y = i === 1 ? H * 0.72 : H * 0.44;
      } else {
        c.x = W / 2 + (i - 1) * (cw + gap);
        c.y = H * 0.6 + (i === 1 ? H * 0.035 : 0);
      }
      c.rect = { x0: c.x - cw / 2, y0: c.y - ch / 2, x1: c.x + cw / 2, y1: c.y + ch / 2 };
    });
    var bs = Math.max(15, H * 0.055);
    this.back.fs = bs;
    this.back.x = Math.max(22, H * 0.05);
    this.back.y = H - Math.max(20, H * 0.05) - bs * 0.6;
    this.back.rect = { x0: this.back.x - 10, y0: this.back.y - bs, x1: this.back.x + bs * 5.2, y1: this.back.y + bs };
    this.subtitleSize = Math.max(11, H * 0.032);
    self.built = false;
  };

  Modes.prototype.buildCard = function (c) {
    var dpr = this.dpr, cw = this.cw, ch = this.ch;
    var pad = cw * 0.05, artH = ch * 0.72, r = cw * 0.05;
    var cv = mk(cw * dpr, ch * dpr), g = cv.getContext('2d');
    g.scale(dpr, dpr);
    // Marco.
    roundRect(g, 0, 0, cw, ch, r);
    g.fillStyle = '#0b0608'; g.fill();
    // Ilustración.
    g.save();
    roundRect(g, pad, pad, cw - pad * 2, artH - pad, r * 0.6);
    g.clip();
    g.translate(pad, pad);
    RM.Art[c.art](g, cw - pad * 2, artH - pad);
    g.restore();
    // Franja con el nombre.
    var by = artH + pad * 0.3, bh = ch - by - pad;
    var gr = g.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, c.banner[0]); gr.addColorStop(1, c.banner[1]);
    g.fillStyle = gr;
    roundRect(g, pad, by, cw - pad * 2, bh, r * 0.5); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (var i = 0; i < 160; i++) g.fillRect(pad + Math.random() * (cw - pad * 2), by + Math.random() * bh, 1.2, 1.2);
    var fs = Math.min(bh * 0.62, (cw - pad * 4) / (c.label.length * 0.62));
    g.font = fs + 'px ' + BTN_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = fs * 0.1; g.strokeStyle = c.id === 'online' ? 'rgba(255,240,190,0.6)' : 'rgba(0,0,0,0.75)'; g.lineJoin = 'round';
    g.strokeText(c.label, cw / 2, by + bh * 0.54);
    g.fillStyle = c.text;
    g.fillText(c.label, cw / 2, by + bh * 0.54);
    // Etiqueta chica arriba a la derecha.
    g.font = '700 ' + Math.max(8, ch * 0.05) + 'px "Cinzel", serif';
    var tw = g.measureText(c.tag).width + 10;
    g.fillStyle = c.id === 'online' ? '#ffd400' : 'rgba(0,0,0,0.65)';
    roundRect(g, cw - pad - tw - 4, pad + 4, tw, ch * 0.075, 3); g.fill();
    g.fillStyle = c.id === 'online' ? '#1a1200' : '#e8d0c8';
    g.fillText(c.tag, cw - pad - 4 - tw / 2, pad + 4 + ch * 0.04);
    // Borde.
    g.lineWidth = Math.max(1.5, cw * 0.012);
    g.strokeStyle = c.id === 'online' ? '#6a5200' : '#3a0606';
    roundRect(g, 0.75, 0.75, cw - 1.5, ch - 1.5, r); g.stroke();
    c.canvas = cv;
    c.artBox = { x: pad, y: pad, w: cw - pad * 2, h: artH - pad };
    // Halo de fuego para el resaltado.
    var gp = cw * 0.18;
    var glow = mk((cw + gp * 2) * dpr, (ch + gp * 2) * dpr), gg = glow.getContext('2d');
    gg.scale(dpr, dpr);
    gg.filter = 'blur(' + (gp * 0.4 * dpr) + 'px)';
    gg.fillStyle = c.id === 'online' ? '#ffb400' : '#ff3000';
    roundRect(gg, gp, gp, cw, ch, r); gg.fill();
    glow.pad = gp;
    c.glow = glow;
  };

  Modes.prototype.buildBack = function () {
    var b = this.back, dpr = this.dpr, fs = b.fs;
    var make = function (fill) {
      var c = mk(fs * 6 * dpr, fs * 1.8 * dpr), g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.font = fs + 'px ' + BTN_FONT; g.textBaseline = 'middle';
      g.fillStyle = fill;
      g.beginPath(); g.moveTo(fs * 0.1, fs * 0.9); g.lineTo(fs * 0.7, fs * 0.5); g.lineTo(fs * 0.7, fs * 1.3); g.fill();
      g.lineWidth = fs * 0.06; g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.strokeText('VOLVER', fs * 0.95, fs * 0.95);
      g.fillText('VOLVER', fs * 0.95, fs * 0.95);
      return c;
    };
    b.normal = make('#9a0d0d');
    b.lit = make('#ff6a2a');
  };

  Modes.prototype.buildMask = function () {
    var W = Math.ceil(this.W), H = Math.ceil(this.H);
    var c = mk(W, H), g = c.getContext('2d');
    var T = this.title;
    g.drawImage(T.full, T.x, T.y, T.w, T.h);
    g.fillStyle = '#fff';
    var self = this;
    this.cards.forEach(function (cd) { roundRect(g, cd.rect.x0, cd.rect.y0, self.cw, self.ch, self.cw * 0.05); g.fill(); });
    var d = g.getImageData(0, 0, W, H).data;
    var a = new Uint8Array(W * H);
    for (var k = 0; k < a.length; k++) a[k] = d[k * 4 + 3];
    var y1 = 0;
    this.cards.forEach(function (cd) { y1 = Math.max(y1, cd.rect.y1); });
    return { data: a, w: W, h: H, rect: { x0: 0, y0: Math.max(0, T.y), x1: W, y1: Math.min(H, y1 + 2) } };
  };

  Modes.prototype.hitTest = function (x, y) {
    for (var i = 0; i < this.cards.length; i++) {
      var r = this.cards[i].rect;
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return this.cards[i];
    }
    var b = this.back.rect;
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return this.back;
    return null;
  };

  Modes.prototype.update = function (dt, visible) {
    this.t += dt;
    this.appear = clamp(this.appear + (visible ? dt * 1.6 : -dt * 3), 0, 1);
    var all = this.cards.concat([this.back]);
    for (var i = 0; i < all.length; i++) {
      var it = all[i], target = (this.hover === it || this.pressed === it) ? 1 : 0;
      it.h = lerp(it.h, target, Math.min(1, dt * (target ? 12 : 6)));
    }
    // Chispas de la fogata de la tarjeta 1 JUGADOR.
    if (Math.random() < dt * 30 && this.fire.length < 40) {
      this.fire.push({ x: (Math.random() - 0.5) * 0.08, y: 0, vy: 0.12 + Math.random() * 0.15, life: 0.6 + Math.random() * 0.6, s: 0.6 + Math.random() });
    }
    for (var f = this.fire.length - 1; f >= 0; f--) {
      var p = this.fire[f];
      p.life -= dt; p.y -= p.vy * dt; p.x += Math.sin(this.t * 6 + f) * 0.02 * dt;
      if (p.life <= 0) this.fire.splice(f, 1);
    }
  };

  Modes.prototype.hotRect = function () {
    var it = this.hover || this.pressed;
    return it && it !== this.back ? it.rect : null;
  };

  Modes.prototype.draw = function (ctx, flash, alpha) {
    if (!this.built) return;
    var d = this.dpr, cw = this.cw, ch = this.ch, self = this;
    var A = alpha * this.appear;
    if (A <= 0.01) return;
    RM.Menu.prototype.drawTitle.call(this, ctx, flash, A);
    ctx.save();
    ctx.globalAlpha = A * 0.8;
    ctx.font = '400 ' + this.subtitleSize + 'px "Cinzel", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cdbfd0';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText('— Elegí cómo enfrentar la noche —', this.W / 2, this.title.y + this.title.h * 0.86);
    ctx.restore();

    this.cards.forEach(function (c, i) {
      var ap = RM.easeOutCubic(clamp(self.appear * 1.6 - i * 0.25, 0, 1));
      if (ap <= 0) return;
      var h = c.h;
      var bob = Math.sin(self.t * 1.3 + i * 1.7) * 2;
      var y = c.y + (1 - ap) * self.H * 0.25 + bob - h * 6;
      var s = 1 + 0.05 * h;
      ctx.save();
      ctx.globalAlpha = alpha * ap;
      ctx.translate(c.x, y);
      ctx.rotate((i - 1) * 0.02 * (1 - h));
      ctx.scale(s, s);
      if (h > 0.01) {
        var flick = 0.85 + 0.15 * Math.sin(self.t * 21 + i);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * ap * h * flick;
        ctx.drawImage(c.glow, -cw / 2 - c.glow.pad, -ch / 2 - c.glow.pad, c.glow.width / d, c.glow.height / d);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha * ap;
      }
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.drawImage(c.canvas, -cw / 2, -ch / 2, cw, ch);
      ctx.shadowColor = 'transparent';
      var box = c.artBox;
      if (c.id === 'solo') self.drawFire(ctx, -cw / 2 + box.x, -ch / 2 + box.y, box.w, box.h);
      if (c.id === 'online' && self.onlineCount != null) {
        ctx.font = '700 ' + Math.max(9, ch * 0.055) + 'px "Cinzel", serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = Math.sin(self.t * 4) > 0 ? '#3cff6a' : '#1e9a3a';
        ctx.beginPath(); ctx.arc(-cw / 2 + box.x + 10, -ch / 2 + box.y + 12, 3.5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#1a1200';
        ctx.fillText(self.onlineCount, -cw / 2 + box.x + 18, -ch / 2 + box.y + 12);
      }
      if (flash > 0.05) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash * 0.25 * alpha * ap;
        ctx.drawImage(c.canvas, -cw / 2, -ch / 2, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    });

    var b = this.back;
    ctx.save();
    ctx.globalAlpha = A * (1 - b.h);
    ctx.drawImage(b.normal, b.x, b.y - b.fs * 0.95, b.normal.width / d, b.normal.height / d);
    ctx.globalAlpha = A * b.h;
    ctx.drawImage(b.lit, b.x, b.y - b.fs * 0.95, b.lit.width / d, b.lit.height / d);
    ctx.restore();
  };

  // Llamas animadas dibujadas encima de la ilustración de la fogata.
  Modes.prototype.drawFire = function (ctx, x, y, w, h) {
    var fx = x + w * RM.Art.soloFire.x, fy = y + h * RM.Art.soloFire.y;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    var t = this.t;
    for (var k = 0; k < 5; k++) {
      var fh = h * (0.16 + 0.05 * Math.sin(t * 9 + k * 2)), fw = w * (0.05 + k * 0.006);
      var ox = Math.sin(t * 5 + k) * w * 0.012;
      var gr = ctx.createLinearGradient(0, fy, 0, fy - fh);
      gr.addColorStop(0, 'rgba(255,200,60,0.75)'); gr.addColorStop(0.5, 'rgba(255,90,10,0.55)'); gr.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(fx - fw + ox, fy);
      ctx.quadraticCurveTo(fx - fw * 0.5 + ox, fy - fh * 0.6, fx + ox * 2, fy - fh);
      ctx.quadraticCurveTo(fx + fw * 0.5 + ox, fy - fh * 0.6, fx + fw + ox, fy);
      ctx.fill();
    }
    for (var i = 0; i < this.fire.length; i++) {
      var p = this.fire[i];
      ctx.fillStyle = 'rgba(255,' + (120 + (i * 13) % 100) + ',30,' + Math.min(1, p.life) + ')';
      ctx.fillRect(fx + p.x * w, fy + p.y * h * 2.5, p.s, p.s);
    }
    ctx.restore();
  };

  RM.Modes = Modes;
})(window.RM);
