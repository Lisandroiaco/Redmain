/* Red Main — intro del estudio "Ojo Rojo Games":
   latidos en la oscuridad, un ojo de pupila rasgada que se abre, golpe y glitch. */
(function (RM) {
  'use strict';
  var clamp = RM.clamp, ease = RM.easeOutCubic, smooth = RM.smooth;

  function Intro() {
    this.t = 0;
    this.dur = 6.4;
    this.done = false;
    this.fired = {};
    this.cues = [
      [0.45, function () { RM.audio.heartbeat(); RM.vibrate([30, 180, 25]); }],
      [1.25, function () { RM.audio.heartbeat(); RM.vibrate([30, 180, 25]); }],
      [1.85, function () { RM.audio.eyeOpen(); }],
      [2.75, function () { RM.audio.logoHit(); RM.vibrate([70]); }]
    ];
  }

  Intro.prototype.skip = function () { if (this.t > 0.4) this.t = Math.max(this.t, this.dur - 0.5); };

  Intro.prototype.update = function (dt) {
    this.t += dt;
    for (var i = 0; i < this.cues.length; i++) {
      if (!this.fired[i] && this.t >= this.cues[i][0]) {
        this.fired[i] = true;
        if (this.t - this.cues[i][0] < 0.3) this.cues[i][1]();
      }
    }
    if (this.t >= this.dur) this.done = true;
  };

  function pulse(x) { return x > 0 ? Math.exp(-x * 5) : 0; }

  Intro.prototype.draw = function (ctx, W, H, dpr) {
    var t = this.t;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    var m = Math.min(W, H);
    var cx = W / 2, cy = H * 0.42;
    var ew = Math.min(m * 0.34, W * 0.2);

    // Latidos: el rojo respira desde los bordes.
    var hb = pulse(t - 0.45) + pulse(t - 1.25) * 0.8;
    if (hb > 0.01) {
      var vg = ctx.createRadialGradient(cx, cy, m * 0.1, cx, cy, m * 0.9);
      vg.addColorStop(0, 'rgba(120,0,0,0)');
      vg.addColorStop(1, 'rgba(120,0,0,' + (hb * 0.45) + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    var line = smooth(1.45, 1.85, t);
    var open = ease(clamp((t - 1.85) / 0.75, 0, 1));
    var blink = t > 4.3 && t < 4.62 ? Math.sin((t - 4.3) / 0.32 * Math.PI) : 0;
    open *= 1 - blink * 0.95;
    var fade = 1 - smooth(5.5, 6.3, t);

    ctx.save();
    ctx.globalAlpha = fade;
    // Línea del ojo cerrado.
    if (line > 0 && open < 0.05) {
      ctx.strokeStyle = '#ff2a1a';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - ew * line, cy); ctx.lineTo(cx + ew * line, cy); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (open > 0.02) {
      var eh = ew * 0.5 * open;
      var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, ew * 2);
      halo.addColorStop(0, 'rgba(255,30,0,' + (0.3 * open) + ')');
      halo.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = halo; ctx.fillRect(cx - ew * 2, cy - ew * 2, ew * 4, ew * 4);

      var eyePath = function () {
        ctx.beginPath();
        ctx.moveTo(cx - ew, cy);
        ctx.quadraticCurveTo(cx, cy - eh * 2, cx + ew, cy);
        ctx.quadraticCurveTo(cx, cy + eh * 2, cx - ew, cy);
        ctx.closePath();
      };
      ctx.save();
      eyePath(); ctx.clip();
      ctx.fillStyle = '#120000'; ctx.fillRect(cx - ew, cy - ew, ew * 2, ew * 2);
      var look = Math.sin(t * 1.3) * ew * 0.12 * smooth(3, 3.6, t);
      var ix = cx + look, ir = ew * 0.46;
      var iris = ctx.createRadialGradient(ix, cy, 0, ix, cy, ir);
      iris.addColorStop(0, '#ffe27a');
      iris.addColorStop(0.28, '#ff4a12');
      iris.addColorStop(0.75, '#8c0000');
      iris.addColorStop(1, '#250000');
      ctx.fillStyle = iris;
      ctx.beginPath(); ctx.arc(ix, cy, ir, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(60,0,0,0.55)'; ctx.lineWidth = 1;
      for (var i = 0; i < 40; i++) {
        var a = i / 40 * 6.283;
        ctx.beginPath();
        ctx.moveTo(ix + Math.cos(a) * ir * 0.25, cy + Math.sin(a) * ir * 0.25);
        ctx.lineTo(ix + Math.cos(a + 0.1) * ir * 0.95, cy + Math.sin(a + 0.1) * ir * 0.95);
        ctx.stroke();
      }
      var dil = 1 - 0.4 * smooth(2.75, 3.1, t);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(ix, cy, ir * 0.12 * dil, ir * 0.85, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(ix - ir * 0.35, cy - ir * 0.35, ir * 0.08, 0, 6.283); ctx.fill();
      var lid = ctx.createLinearGradient(0, cy - eh, 0, cy + eh);
      lid.addColorStop(0, 'rgba(0,0,0,0.7)'); lid.addColorStop(0.3, 'rgba(0,0,0,0)');
      lid.addColorStop(0.75, 'rgba(0,0,0,0)'); lid.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = lid; ctx.fillRect(cx - ew, cy - eh, ew * 2, eh * 2);
      ctx.restore();
      ctx.strokeStyle = '#ff2a1a';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 22;
      ctx.lineWidth = Math.max(2, m * 0.005);
      eyePath(); ctx.stroke();
      ctx.shadowBlur = 0;
      // Lágrima de sangre.
      var tear = smooth(3.2, 5.2, t);
      if (tear > 0) {
        var tx = cx + ew * 0.18, ty = cy + eh * 0.95 + tear * ew * 0.55;
        ctx.fillStyle = '#b00000';
        ctx.beginPath();
        ctx.moveTo(tx - 2, cy + eh * 0.9);
        ctx.lineTo(tx - 1.5, ty);
        ctx.arc(tx, ty, m * 0.008, Math.PI, 0, true);
        ctx.lineTo(tx + 2, cy + eh * 0.9);
        ctx.fill();
      }
    }

    // Texto del estudio.
    var tx1 = ease(clamp((t - 2.75) / 0.9, 0, 1));
    if (tx1 > 0) {
      var fs = Math.min(ew * 0.36, W * 0.07);
      var spacing = fs * (0.12 + (1 - tx1) * 0.9);
      var word = 'OJO ROJO';
      ctx.font = '700 ' + fs + 'px "Cinzel", serif';
      ctx.textBaseline = 'middle';
      var widths = [], total = 0;
      for (var k = 0; k < word.length; k++) { widths.push(ctx.measureText(word[k]).width); total += widths[k] + (k ? spacing : 0); }
      var x = cx - total / 2, y = cy + ew * 0.95;
      ctx.globalAlpha = fade * tx1;
      ctx.shadowColor = 'rgba(255,0,0,0.8)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#efe6e6';
      for (var j = 0; j < word.length; j++) {
        ctx.fillText(word[j], x, y);
        x += widths[j] + spacing;
      }
      ctx.shadowBlur = 0;
      var tx2 = ease(clamp((t - 3.25) / 0.8, 0, 1));
      ctx.globalAlpha = fade * tx2;
      ctx.fillStyle = '#ff2a1a';
      var lw = total * 0.55 * tx2;
      ctx.fillRect(cx - lw, y + fs * 0.72, lw * 2, Math.max(1, fs * 0.04));
      ctx.font = '400 ' + (fs * 0.38) + 'px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText('G   A   M   E   S', cx, y + fs * 1.15);
      ctx.textAlign = 'left';
    }
    ctx.restore();

    // Glitch: franjas desplazadas + aberración cromática.
    var g = (t > 2.75 && t < 2.9) || (t > 3.9 && t < 3.98) || (t > 5.05 && t < 5.15);
    if (g) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var cw = ctx.canvas.width, chh = ctx.canvas.height;
      for (var s = 0; s < 7; s++) {
        var sy = Math.random() * chh, sh = Math.random() * chh * 0.06 + 2;
        var off = (Math.random() - 0.5) * cw * 0.06;
        ctx.drawImage(ctx.canvas, 0, sy, cw, sh, off, sy, cw, sh);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(ctx.canvas, 6 * dpr, 0);
      ctx.restore();
    }
  };

  RM.Intro = Intro;
})(window.RM);
