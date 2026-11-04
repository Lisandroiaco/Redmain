/* Red Main — protagonista dibujado con vectores (sin píxeles).
   Esqueleto simple que se anima en tiempo real: caminar, correr y agacharse
   en 4 direcciones. Unidades del mundo: los pies están en (0,0), alto ≈ 72. */
(function (RM) {
  'use strict';
  var OUT = 'rgba(28,16,12,0.92)';

  var BASE = {
    skin: '#e8b892', skinD: '#c48c66', hair: '#4a2f1c', beard: '#5a3a22', beardL: '#7a5232',
    shirt: '#4f7a3a', shirtD: '#365a26', pants: '#34507a', pantsD: '#263a5a', shoe: '#2a1d16', glass: '#151515'
  };
  // Colores de remera para cada jugador en cooperativo.
  var SHIRTS = [['#4f7a3a', '#365a26'], ['#a8322a', '#7a1f1a'], ['#2f5e9e', '#1f416e'], ['#c8a032', '#8e6e1a']];

  function palette(i) {
    var p = Object.assign({}, BASE), s = SHIRTS[(i || 0) % SHIRTS.length];
    p.shirt = s[0]; p.shirtD = s[1];
    return p;
  }

  function shape(g, fill, path, lw) {
    g.beginPath(); path(); g.fillStyle = fill; g.fill();
    g.lineWidth = lw || 1.6; g.strokeStyle = OUT; g.stroke();
  }
  function ell(g, x, y, rx, ry, fill, lw) { shape(g, fill, function () { g.ellipse(x, y, rx, ry, 0, 0, 6.283); }, lw); }
  function rr(g, x, y, w, h, r, fill, lw) {
    shape(g, fill, function () {
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }, lw);
  }
  function limb(g, x1, y1, x2, y2, w, color) {
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = w + 3.2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  // s = { dir:0 abajo,1 izq,2 der,3 arriba, phase, amp (0..1), run (0..1), crouch (0..1) }
  function draw(g, s, pal) {
    pal = pal || BASE;
    g.save();
    if (s.dir === 2) g.scale(-1, 1);
    var side = s.dir === 1 || s.dir === 2;
    var c = s.crouch, sw = Math.sin(s.phase) * s.amp;
    var stride = 1 + s.run * 0.8;
    var bob = Math.abs(Math.cos(s.phase)) * s.amp * (1.2 + s.run * 2) * (1 - c);
    var legLen = 20 - 10 * c;
    var hipY = -legLen - 2 + bob * 0;
    var torsoH = 27 - 6 * c;
    var shoulderY = hipY - torsoH - bob;
    var headY = shoulderY - 10;
    var lean = side ? -s.run * 3 * s.amp : 0;

    if (!side) {
      var back = s.dir === 3;
      // Piernas.
      var spread = 6 + c * 4;
      [-1, 1].forEach(function (k) {
        var lift = k * sw * 3 * stride * (back ? -1 : 1);
        var footY = -1 - Math.max(0, lift);
        if (c > 0.4) {
          limb(g, k * spread, hipY + 2, k * (spread + 5), footY - 5, 9, pal.pants);
          limb(g, k * (spread + 5), footY - 5, k * (spread + 2), footY, 8, pal.pantsD);
        } else limb(g, k * spread, hipY + 2, k * spread, footY - 2, 9, back ? pal.pantsD : pal.pants);
        ell(g, k * (spread + 1), footY, 6, 3.5, pal.shoe);
      });
      // Torso con panza.
      var tg = g.createLinearGradient(-18, 0, 18, 0);
      tg.addColorStop(0, pal.shirtD); tg.addColorStop(0.45, pal.shirt); tg.addColorStop(1, pal.shirtD);
      shape(g, tg, function () {
        g.moveTo(-14, shoulderY + 2);
        g.quadraticCurveTo(-21, shoulderY + torsoH * 0.6, -15, hipY + 3);
        g.lineTo(15, hipY + 3);
        g.quadraticCurveTo(21, shoulderY + torsoH * 0.6, 14, shoulderY + 2);
        g.quadraticCurveTo(0, shoulderY - 3, -14, shoulderY + 2);
      });
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-15, hipY, 30, 3);
      // Brazos.
      [-1, 1].forEach(function (k) {
        var a = -k * sw * (3 + s.run * 5) * (back ? -1 : 1);
        var hx = k * (19 + c * 2), hy = shoulderY + 20 - c * 3 + a;
        limb(g, k * 14, shoulderY + 4, k * 18, shoulderY + 10 + a * 0.4, 9, pal.shirt);
        limb(g, k * 18, shoulderY + 10 + a * 0.4, hx, hy, 7, pal.skin);
        ell(g, hx, hy + 1, 3.6, 3.6, pal.skin, 1.2);
      });
      // Cabeza.
      if (back) {
        ell(g, 0, headY, 12, 12.5, pal.hair);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(-3, headY - 5, 6, 4, 0, 0, 6.283); g.fill();
        ell(g, -12, headY + 1, 2.5, 4, pal.skin, 1.2); ell(g, 12, headY + 1, 2.5, 4, pal.skin, 1.2);
        shape(g, pal.beard, function () { g.moveTo(-12, headY + 4); g.quadraticCurveTo(-13, headY + 12, -8, headY + 13); g.lineTo(-9, headY + 6); g.closePath(); });
        shape(g, pal.beard, function () { g.moveTo(12, headY + 4); g.quadraticCurveTo(13, headY + 12, 8, headY + 13); g.lineTo(9, headY + 6); g.closePath(); });
      } else {
        ell(g, -12, headY + 1, 2.5, 4, pal.skinD, 1.2); ell(g, 12, headY + 1, 2.5, 4, pal.skinD, 1.2);
        ell(g, 0, headY, 11.5, 12.5, pal.skin);
        // Pelo corto.
        shape(g, pal.hair, function () {
          g.moveTo(-12, headY - 1); g.quadraticCurveTo(-13, headY - 13, 0, headY - 13.5);
          g.quadraticCurveTo(13, headY - 13, 12, headY - 1); g.quadraticCurveTo(8, headY - 8, 0, headY - 8);
          g.quadraticCurveTo(-8, headY - 8, -12, headY - 1);
        });
        // Barba tupida.
        shape(g, pal.beard, function () {
          g.moveTo(-11.5, headY - 1);
          g.quadraticCurveTo(-13, headY + 16, 0, headY + 18);
          g.quadraticCurveTo(13, headY + 16, 11.5, headY - 1);
          g.quadraticCurveTo(9, headY + 5, 0, headY + 5);
          g.quadraticCurveTo(-9, headY + 5, -11.5, headY - 1);
        });
        g.strokeStyle = pal.beardL; g.lineWidth = 0.8;
        for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3, headY + 8); g.lineTo(i * 3.4, headY + 14); g.stroke(); }
        g.fillStyle = '#7a3a2e'; g.beginPath(); g.ellipse(0, headY + 8, 3, 1.3, 0, 0, 6.283); g.fill();
        // Bigote.
        shape(g, pal.beard, function () { g.moveTo(-6, headY + 6); g.quadraticCurveTo(0, headY + 3, 6, headY + 6); g.quadraticCurveTo(0, headY + 5, -6, headY + 6); }, 1);
        // Lentes.
        g.lineWidth = 1.6; g.strokeStyle = pal.glass;
        [-1, 1].forEach(function (k) {
          g.fillStyle = 'rgba(170,205,230,0.55)';
          g.beginPath(); g.ellipse(k * 5, headY - 1, 4, 3.4, 0, 0, 6.283); g.fill(); g.stroke();
          g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(k * 5, headY - 0.6, 1.2, 0, 6.283); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(k * 5 - 1.5, headY - 2.2, 0.8, 0, 6.283); g.fill();
        });
        g.beginPath(); g.moveTo(-1, headY - 1.5); g.lineTo(1, headY - 1.5); g.stroke();
        g.strokeStyle = pal.hair; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(-8, headY - 6); g.lineTo(-3, headY - 5.5); g.moveTo(3, headY - 5.5); g.lineTo(8, headY - 6); g.stroke();
      }
    } else {
      // Perfil mirando a la izquierda.
      var hipX = 2;
      [1, -1].forEach(function (k, idx) {
        var ang = k * sw * (0.45 + s.run * 0.35);
        var col = idx === 0 ? pal.pantsD : pal.pants;
        g.save(); g.translate(hipX, hipY + 2);
        if (c > 0.4) {
          limb(g, 0, 0, -9 - k * 2, -1, 9, col);
          limb(g, -9 - k * 2, -1, -6 - k * 2, legLen + 2, 8, col);
          ell(g, -9 - k * 2, legLen + 3, 6.5, 3.5, pal.shoe);
        } else {
          g.rotate(ang);
          limb(g, 0, 0, 0, legLen - 1, 9, col);
          ell(g, -2.5, legLen + 0.5, 6.5, 3.5, pal.shoe);
        }
        g.restore();
      });
      g.save(); g.translate(lean, 0);
      var tg2 = g.createLinearGradient(-16, 0, 12, 0);
      tg2.addColorStop(0, pal.shirt); tg2.addColorStop(1, pal.shirtD);
      shape(g, tg2, function () {
        g.moveTo(-6, shoulderY + 1);
        g.quadraticCurveTo(-23, shoulderY + torsoH * 0.65, -9, hipY + 3);
        g.lineTo(10, hipY + 3);
        g.quadraticCurveTo(12, shoulderY + torsoH * 0.5, 8, shoulderY + 1);
        g.quadraticCurveTo(1, shoulderY - 2, -6, shoulderY + 1);
      });
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-10, hipY, 20, 3);
      // Brazo cercano.
      g.save(); g.translate(1, shoulderY + 5);
      g.rotate(-sw * (0.5 + s.run * 0.6) - c * 0.6);
      limb(g, 0, 0, 0, 9, 9, pal.shirt);
      limb(g, 0, 9, 0, 19 - c * 3, 7, pal.skin);
      ell(g, 0, 20 - c * 3, 3.6, 3.6, pal.skin, 1.2);
      g.restore();
      // Cabeza de perfil.
      var hx = -1;
      ell(g, hx, headY, 11, 12.5, pal.skin);
      shape(g, pal.skin, function () { g.moveTo(hx - 10, headY - 2); g.quadraticCurveTo(hx - 15, headY + 1, hx - 10.5, headY + 3); }, 1.2);
      shape(g, pal.hair, function () {
        g.moveTo(hx - 10, headY - 4); g.quadraticCurveTo(hx - 9, headY - 14, hx + 2, headY - 13.5);
        g.quadraticCurveTo(hx + 13, headY - 12, hx + 11, headY + 2); g.quadraticCurveTo(hx + 6, headY - 5, hx - 10, headY - 4);
      });
      ell(g, hx + 3, headY + 1, 2.5, 3.8, pal.skinD, 1.1);
      shape(g, pal.beard, function () {
        g.moveTo(hx + 5, headY - 1);
        g.quadraticCurveTo(hx + 6, headY + 15, hx - 4, headY + 17);
        g.quadraticCurveTo(hx - 14, headY + 15, hx - 11, headY + 5);
        g.quadraticCurveTo(hx - 4, headY + 6, hx + 5, headY - 1);
      });
      g.lineWidth = 1.6; g.strokeStyle = pal.glass; g.fillStyle = 'rgba(170,205,230,0.55)';
      g.beginPath(); g.ellipse(hx - 7, headY - 1, 3.2, 3.2, 0, 0, 6.283); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(hx - 4, headY - 1.5); g.lineTo(hx + 4, headY - 0.5); g.stroke();
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(hx - 8, headY - 0.7, 1.1, 0, 6.283); g.fill();
      g.restore();
    }
    g.restore();
  }

  RM.Hero = { draw: draw, palette: palette, SHIRTS: SHIRTS };
})(window.RM);
