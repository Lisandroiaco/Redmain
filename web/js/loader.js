/* Red Main — cargador en esquina: un ojo rodeado por un anillo de gotas de sangre.
   Ejecuta tareas reales (pre-renderizado, conexión online) repartidas entre frames
   para que la escena nunca se trabe mientras carga. */
(function (RM) {
  'use strict';
  var BUDGET_MS = 7;

  function Loader() {
    this.active = false;
    this.alpha = 0;
    this.t = 0;
    this.shown = 0;
  }

  // tasks: funciones; si una devuelve una Promise, se espera sin bloquear.
  Loader.prototype.start = function (tasks, onDone, opts) {
    opts = opts || {};
    this.tasks = tasks.slice();
    this.total = Math.max(1, tasks.length);
    this.done = 0;
    this.waiting = false;
    this.failed = null;
    this.t = 0;
    this.shown = 0;
    this.minTime = opts.minTime != null ? opts.minTime : 1.4;
    this.label = opts.label || 'CARGANDO';
    this.onDone = onDone;
    this.active = true;
  };

  Loader.prototype.update = function (dt) {
    this.alpha += ((this.active ? 1 : 0) - this.alpha) * Math.min(1, dt * 6);
    if (!this.active) return;
    this.t += dt;
    var start = performance.now();
    while (!this.waiting && this.tasks.length && performance.now() - start < BUDGET_MS) {
      var task = this.tasks.shift(), self = this, res;
      try { res = task(); } catch (e) { this.failed = e; res = null; }
      if (res && typeof res.then === 'function') {
        this.waiting = true;
        res.then(function () { self.waiting = false; self.done++; }, function (e) { self.failed = e; self.waiting = false; self.done++; });
      } else {
        this.done++;
      }
    }
    var real = this.done / this.total;
    var target = Math.min(real, this.t / this.minTime);
    this.shown += (target - this.shown) * Math.min(1, dt * 8);
    if (this.done >= this.total && this.t >= this.minTime && this.shown > 0.985) {
      this.active = false;
      this.shown = 1;
      var cb = this.onDone; this.onDone = null;
      if (cb) cb(this.failed);
    }
  };

  Loader.prototype.draw = function (ctx, W, H) {
    if (this.alpha < 0.01) return;
    var a = this.alpha, t = this.t;
    var R = Math.max(16, Math.min(W, H) * 0.05);
    var cx = W - R * 2.1, cy = H - R * 2.1;
    ctx.save();
    ctx.globalAlpha = a;
    var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
    halo.addColorStop(0, 'rgba(255,20,0,0.25)'); halo.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(cx - R * 2.4, cy - R * 2.4, R * 4.8, R * 4.8);

    // Anillo de 12 gotas: una "cabeza" gira y deja estela, como un cuerno girando.
    var n = 12, head = (t * 9) % n;
    for (var i = 0; i < n; i++) {
      var ang = i / n * Math.PI * 2 - Math.PI / 2;
      var dist = (head - i + n) % n;
      var lit = Math.max(0.18, 1 - dist / 6);
      var x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang + Math.PI / 2);
      var s = R * (0.13 + 0.07 * lit);
      ctx.fillStyle = 'rgba(' + (120 + 135 * lit | 0) + ',' + (20 * lit | 0) + ',10,' + lit + ')';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.8);
      ctx.quadraticCurveTo(s, -s * 0.2, s * 0.8, s * 0.4);
      ctx.arc(0, s * 0.4, s * 0.8, 0, Math.PI);
      ctx.quadraticCurveTo(-s, -s * 0.2, 0, -s * 1.8);
      ctx.fill();
      ctx.restore();
    }
    // Arco de progreso.
    ctx.strokeStyle = 'rgba(255,60,30,0.9)';
    ctx.lineWidth = Math.max(1.5, R * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.shown);
    ctx.stroke();

    // Ojo central que parpadea y mira alrededor.
    var blink = Math.abs(Math.sin(t * 0.9)) > 0.97 ? 0.1 : 1;
    var ew = R * 0.55, eh = R * 0.3 * blink;
    ctx.beginPath();
    ctx.moveTo(cx - ew, cy);
    ctx.quadraticCurveTo(cx, cy - eh * 2, cx + ew, cy);
    ctx.quadraticCurveTo(cx, cy + eh * 2, cx - ew, cy);
    ctx.closePath();
    ctx.fillStyle = '#140000'; ctx.fill();
    ctx.save(); ctx.clip();
    var lx = cx + Math.cos(t * 1.7) * ew * 0.25, ly = cy + Math.sin(t * 2.3) * eh * 0.3;
    var ir = ctx.createRadialGradient(lx, ly, 0, lx, ly, ew * 0.5);
    ir.addColorStop(0, '#ffd36a'); ir.addColorStop(0.4, '#ff3a10'); ir.addColorStop(1, '#4a0000');
    ctx.fillStyle = ir; ctx.beginPath(); ctx.arc(lx, ly, ew * 0.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(lx, ly, ew * 0.07, ew * 0.4, 0, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ff2a1a'; ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.shadowColor = '#f00'; ctx.shadowBlur = R * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - ew, cy);
    ctx.quadraticCurveTo(cx, cy - eh * 2, cx + ew, cy);
    ctx.quadraticCurveTo(cx, cy + eh * 2, cx - ew, cy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Texto.
    var fs = Math.max(11, R * 0.42);
    ctx.font = '700 ' + fs + 'px "Cinzel", serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var dots = '...'.slice(0, (t * 3 | 0) % 4);
    ctx.fillStyle = 'rgba(235,40,25,' + (0.7 + 0.3 * Math.sin(t * 4)) + ')';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
    ctx.fillText(this.label + dots.padEnd(3, ' '), cx - R * 1.8, cy - fs * 0.35);
    ctx.font = '400 ' + (fs * 0.85) + 'px "Cinzel", serif';
    ctx.fillStyle = 'rgba(210,200,215,0.75)';
    ctx.fillText(Math.round(this.shown * 100) + '%', cx - R * 1.8, cy + fs * 0.75);
    ctx.restore();
  };

  RM.Loader = Loader;
})(window.RM);
