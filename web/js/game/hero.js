/* Red Main — protagonista dibujado con curvas (sin píxeles ni figuras sueltas).
   Esqueleto con rodillas y codos que se anima en tiempo real: caminar, correr,
   agacharse, agarrar objetos, vendarse, forcejear, desangrarse y caer, en 4
   direcciones. Unidades del mundo: los pies están en (0,0), alto ≈ 74.
   También dibuja el primer plano de la cara para las escenas del garfio. */
(function (RM) {
  'use strict';
  var OUT = 'rgba(26,14,10,0.95)';
  var TAU = Math.PI * 2;

  var BASE = {
    skin: '#eab894', skinD: '#c48a66', skinL: '#f6d2b4', hair: '#3e2716', hairL: '#6a4428',
    beard: '#4a2e1a', beardL: '#7a5232', shirt: '#4f7a3a', shirtD: '#33521f', shirtL: '#6e9a52',
    pants: '#34507a', pantsD: '#22385a', pantsL: '#4a6a96', shoe: '#2a1d16', shoeL: '#4a3426', sole: '#d8d0c0', glass: '#121212'
  };
  // Remeras de cada jugador en cooperativo (claro, base, sombra).
  var SHIRTS = [['#4f7a3a', '#33521f', '#6e9a52'], ['#a8322a', '#741a14', '#c85a4a'], ['#2f5e9e', '#1d3e6e', '#5a86c4'], ['#c8a032', '#8a6a16', '#e4c05a']];

  function palette(i) {
    var p = Object.assign({}, BASE), s = SHIRTS[(i || 0) % SHIRTS.length];
    p.shirt = s[0]; p.shirtD = s[1]; p.shirtL = s[2];
    return p;
  }

  /* ---------- Trazos ---------- */

  function fillStroke(g, fill, lw) {
    g.fillStyle = fill; g.fill();
    if (lw !== 0) { g.lineWidth = lw || 1.4; g.strokeStyle = OUT; g.stroke(); }
  }
  // Miembro con forma de cápsula que se afina (hombro→codo, rodilla→tobillo…).
  function seg(g, x1, y1, x2, y2, w1, w2, fill, lw) {
    var a = Math.atan2(y2 - y1, x2 - x1), nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(x1 + nx * w1, y1 + ny * w1);
    g.lineTo(x2 + nx * w2, y2 + ny * w2);
    g.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true);
    g.lineTo(x1 - nx * w1, y1 - ny * w1);
    g.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true);
    g.closePath();
    fillStroke(g, fill, lw);
  }
  function oval(g, x, y, rx, ry, fill, lw, rot) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); fillStroke(g, fill, lw);
  }
  // Rodilla / codo por IK de dos huesos. bend = +1 / -1 elige hacia qué lado se dobla.
  function joint(x1, y1, x2, y2, l1, l2, bend) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 0.001;
    d = Math.min(d, l1 + l2 - 0.01);
    var a = Math.acos(RM.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    var base = Math.atan2(dy, dx) + a * bend;
    return [x1 + Math.cos(base) * l1, y1 + Math.sin(base) * l1];
  }
  function lgrad(g, x1, x2, c1, c2, c3) {
    var gr = g.createLinearGradient(x1, 0, x2, 0);
    gr.addColorStop(0, c1); gr.addColorStop(0.5, c2); gr.addColorStop(1, c3 || c1);
    return gr;
  }
  function vgrad(g, y1, y2, c1, c2) { var gr = g.createLinearGradient(0, y1, 0, y2); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr; }

  /* ---------- Piezas ---------- */

  // Mano cerrada con pulgar. a = ángulo del antebrazo.
  function hand(g, x, y, a, pal, k) {
    g.save(); g.translate(x, y); g.rotate(a - Math.PI / 2);
    g.beginPath();
    g.moveTo(-3.4, -1); g.bezierCurveTo(-4.2, 3.5, -2, 5.6, 0.5, 5.4); g.bezierCurveTo(3.4, 5.2, 4.3, 2.6, 3.6, -1.2);
    g.quadraticCurveTo(0, -2.6, -3.4, -1); g.closePath();
    fillStroke(g, pal.skin, 1.2);
    g.beginPath(); g.moveTo(3.2 * (k || 1), 0); g.quadraticCurveTo(5.4 * (k || 1), 1.6, 4.4 * (k || 1), 3.6); g.lineWidth = 1; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(120,60,40,0.45)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-1.8, 3.8); g.lineTo(-1.6, 5); g.moveTo(0.4, 4.2); g.lineTo(0.5, 5.3); g.stroke();
    g.restore();
  }
  function shoe(g, x, y, dir, pal, w) {
    w = w || 1;
    if (dir === 'side') {
      g.beginPath();
      g.moveTo(3.5, -4.6); g.quadraticCurveTo(4.6, -1, 3.6, 0.6); g.lineTo(-7.5, 0.6);
      g.quadraticCurveTo(-10.2, 0.4, -9.4, -2.2); g.quadraticCurveTo(-8, -4.6, -3, -5.2); g.closePath();
      g.save(); g.translate(x, y); fillStroke(g, vgrad(g, -5, 1, pal.shoeL, pal.shoe), 1.2);
      g.fillStyle = 'rgba(200,190,170,0.55)'; g.fillRect(-8.6, -0.4, 11.6, 0.9);
      g.restore();
    } else {
      g.save(); g.translate(x, y);
      g.beginPath(); g.moveTo(-5 * w, -1); g.bezierCurveTo(-5.6 * w, -6, 5.6 * w, -6, 5 * w, -1); g.quadraticCurveTo(0, 1.8, -5 * w, -1); g.closePath();
      fillStroke(g, vgrad(g, -5, 1, pal.shoeL, pal.shoe), 1.2);
      g.fillStyle = pal.sole; g.beginPath(); g.ellipse(0, 0.2, 5 * w, 1.2, 0, 0, Math.PI); g.fill();
      g.restore();
    }
  }

  // Cabeza de frente / espalda / perfil (perfil mirando a la izquierda).
  function head(g, view, hy, pal, s) {
    var look = s.look || 0, fear = s.fear || 0;
    if (view === 'front') {
      oval(g, -11.6, hy + 1, 2.6, 4, pal.skinD, 1.1); oval(g, 11.6, hy + 1, 2.6, 4, pal.skinD, 1.1);
      // Cara con mandíbula ancha.
      g.beginPath();
      g.moveTo(-11, hy - 3); g.bezierCurveTo(-11.6, hy - 14, 11.6, hy - 14, 11, hy - 3);
      g.bezierCurveTo(11.4, hy + 7, 7, hy + 12.5, 0, hy + 12.8); g.bezierCurveTo(-7, hy + 12.5, -11.4, hy + 7, -11, hy - 3); g.closePath();
      var fg = g.createRadialGradient(-3, hy - 4, 2, 0, hy, 14); fg.addColorStop(0, pal.skinL); fg.addColorStop(0.6, pal.skin); fg.addColorStop(1, pal.skinD);
      fillStroke(g, fg, 1.4);
      // Pelo corto con mechones.
      g.beginPath();
      g.moveTo(-11.4, hy - 2); g.bezierCurveTo(-13, hy - 9, -10, hy - 15.5, -4, hy - 15.2);
      g.quadraticCurveTo(-2, hy - 17.4, 1, hy - 15.6); g.quadraticCurveTo(4, hy - 17, 6, hy - 14.8);
      g.bezierCurveTo(11, hy - 14.4, 13.2, hy - 9, 11.4, hy - 2);
      g.quadraticCurveTo(10.6, hy - 6.5, 9.4, hy - 8); g.quadraticCurveTo(4, hy - 7.6, 1.5, hy - 10.4);
      g.quadraticCurveTo(-3, hy - 7.2, -9.2, hy - 8); g.quadraticCurveTo(-10.6, hy - 6.5, -11.4, hy - 2); g.closePath();
      fillStroke(g, vgrad(g, hy - 16, hy - 4, pal.hairL, pal.hair), 1.3);
      g.strokeStyle = 'rgba(255,230,200,0.18)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(-6, hy - 13.5); g.quadraticCurveTo(-3, hy - 11, -4, hy - 9); g.moveTo(3, hy - 14); g.quadraticCurveTo(5.5, hy - 12, 6, hy - 9.5); g.stroke();
      // Barba tupida (cubre mandíbula y mentón).
      g.beginPath();
      g.moveTo(-11.2, hy - 1.5); g.bezierCurveTo(-12.6, hy + 9, -8, hy + 17.5, 0, hy + 18);
      g.bezierCurveTo(8, hy + 17.5, 12.6, hy + 9, 11.2, hy - 1.5);
      g.quadraticCurveTo(10, hy + 3.5, 7.6, hy + 4.4); g.quadraticCurveTo(4.8, hy + 2.8, 0, hy + 3.2);
      g.quadraticCurveTo(-4.8, hy + 2.8, -7.6, hy + 4.4); g.quadraticCurveTo(-10, hy + 3.5, -11.2, hy - 1.5); g.closePath();
      fillStroke(g, vgrad(g, hy, hy + 18, pal.beardL, pal.beard), 1.3);
      g.strokeStyle = 'rgba(20,10,4,0.45)'; g.lineWidth = 0.6;
      for (var i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 2.2, hy + 8 + Math.abs(i) * 0.3); g.quadraticCurveTo(i * 2.5, hy + 12, i * 2.1, hy + 15.5 - Math.abs(i) * 0.6); g.stroke(); }
      // Boca y bigote.
      g.fillStyle = fear > 0.3 ? '#2a0808' : '#6a2a20';
      g.beginPath(); g.ellipse(0, hy + 7.4, 2.8, fear > 0.3 ? 2.2 : 1.1, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-6.6, hy + 6.2); g.bezierCurveTo(-3.6, hy + 3, 3.6, hy + 3, 6.6, hy + 6.2); g.quadraticCurveTo(3, hy + 5, 0, hy + 5.6); g.quadraticCurveTo(-3, hy + 5, -6.6, hy + 6.2); g.closePath();
      fillStroke(g, pal.beard, 1);
      // Nariz.
      g.fillStyle = 'rgba(160,90,60,0.35)'; g.beginPath(); g.ellipse(0.4, hy + 2.6, 2.8, 1.6, 0, 0, TAU); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-1.6, hy + 2.8); g.quadraticCurveTo(0.2, hy + 4.2, 2.2, hy + 2.8); g.stroke();
      // Ojos y cejas.
      [-1, 1].forEach(function (k) {
        var ex = k * 4.8, ey = hy - 1;
        var lost = s.eyeLost && k === -1;
        if (lost) {
          g.fillStyle = '#2a0204'; g.beginPath(); g.ellipse(ex, ey, 2.6, 2, 0, 0, TAU); g.fill();
        } else {
          g.fillStyle = '#f4f0ea'; g.beginPath(); g.ellipse(ex, ey, 2.4, 1.7 + fear * 0.7, 0, 0, TAU); g.fill();
          g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(ex + look * 1, ey + 0.2, 1.2 - fear * 0.3, 0, TAU); g.fill();
        }
        g.strokeStyle = pal.hair; g.lineWidth = 1.7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(ex - k * 3.2, ey - 4.2 - fear * 1.4); g.quadraticCurveTo(ex, ey - 5.4 - fear * 1.8, ex + k * 3.2, ey - 4.6 + fear * 0.4); g.stroke();
      });
      // Lentes: marco grueso rectangular redondeado.
      g.lineWidth = 1.5; g.strokeStyle = pal.glass;
      [-1, 1].forEach(function (k) {
        var x = k * 4.8;
        RM.Art2.rrPath(g, x - 4, hy - 4.2, 8, 6.4, 2.2);
        g.fillStyle = 'rgba(170,205,235,0.22)'; g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(x - 2.4, hy - 3); g.lineTo(x - 0.6, hy - 1.2); g.stroke();
        g.lineWidth = 1.5; g.strokeStyle = pal.glass;
      });
      g.beginPath(); g.moveTo(-0.8, hy - 2); g.quadraticCurveTo(0, hy - 3, 0.8, hy - 2); g.moveTo(-8.8, hy - 2.4); g.lineTo(-11, hy - 1.6); g.moveTo(8.8, hy - 2.4); g.lineTo(11, hy - 1.6); g.stroke();
      if (s.eyeLost) crack(g, -4.8, hy - 1);
    } else if (view === 'back') {
      oval(g, -11.6, hy + 1, 2.6, 4, pal.skinD, 1.1); oval(g, 11.6, hy + 1, 2.6, 4, pal.skinD, 1.1);
      g.strokeStyle = pal.glass; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-12.5, hy - 1.8); g.lineTo(-10, hy - 2.4); g.moveTo(12.5, hy - 1.8); g.lineTo(10, hy - 2.4); g.stroke();
      // Nuca.
      oval(g, 0, hy + 8, 7, 5, pal.skinD, 1.1);
      // Barba asomando a los costados.
      g.beginPath(); g.moveTo(-11, hy + 1); g.quadraticCurveTo(-12, hy + 10, -7, hy + 14); g.lineTo(-8, hy + 5); g.closePath(); fillStroke(g, pal.beard, 1.1);
      g.beginPath(); g.moveTo(11, hy + 1); g.quadraticCurveTo(12, hy + 10, 7, hy + 14); g.lineTo(8, hy + 5); g.closePath(); fillStroke(g, pal.beard, 1.1);
      g.beginPath();
      g.moveTo(-11.4, hy + 2); g.bezierCurveTo(-13.4, hy - 10, -8, hy - 15.6, 0, hy - 15.4);
      g.bezierCurveTo(8, hy - 15.6, 13.4, hy - 10, 11.4, hy + 2);
      g.quadraticCurveTo(8, hy + 7.4, 0, hy + 7.6); g.quadraticCurveTo(-8, hy + 7.4, -11.4, hy + 2); g.closePath();
      fillStroke(g, vgrad(g, hy - 16, hy + 8, pal.hairL, pal.hair), 1.3);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.7;
      for (var h = -3; h <= 3; h++) { g.beginPath(); g.moveTo(h * 2.6, hy - 12); g.quadraticCurveTo(h * 3, hy - 3, h * 2.4, hy + 5); g.stroke(); }
      g.fillStyle = 'rgba(255,230,200,0.12)'; g.beginPath(); g.ellipse(-3, hy - 9, 5, 3, -0.3, 0, TAU); g.fill();
    } else {
      // Perfil (mira a la izquierda).
      g.beginPath();
      g.moveTo(8, hy - 9); g.bezierCurveTo(4, hy - 15, -8, hy - 15, -10, hy - 6);
      g.quadraticCurveTo(-10.4, hy - 3, -11.2, hy - 1); g.quadraticCurveTo(-13.8, hy + 2, -11, hy + 3.4);
      g.quadraticCurveTo(-10.4, hy + 8, -7, hy + 11); g.lineTo(6, hy + 12); g.bezierCurveTo(11, hy + 8, 12, hy - 3, 8, hy - 9); g.closePath();
      var pg = g.createRadialGradient(-5, hy - 3, 2, 0, hy, 14); pg.addColorStop(0, pal.skinL); pg.addColorStop(0.7, pal.skin); pg.addColorStop(1, pal.skinD);
      fillStroke(g, pg, 1.4);
      // Barba de perfil.
      g.beginPath();
      g.moveTo(3.4, hy - 1); g.bezierCurveTo(5, hy + 9, 1, hy + 17, -6, hy + 16.5);
      g.bezierCurveTo(-11.6, hy + 15.5, -12.6, hy + 9, -10.6, hy + 4.4);
      g.quadraticCurveTo(-7, hy + 3.8, -4.6, hy + 5); g.quadraticCurveTo(0, hy + 3.4, 3.4, hy - 1); g.closePath();
      fillStroke(g, vgrad(g, hy, hy + 17, pal.beardL, pal.beard), 1.3);
      g.strokeStyle = 'rgba(20,10,4,0.45)'; g.lineWidth = 0.6;
      for (var b = 0; b < 5; b++) { g.beginPath(); g.moveTo(-8 + b * 2.4, hy + 7); g.quadraticCurveTo(-8.6 + b * 2.4, hy + 11, -8 + b * 2.2, hy + 14.5); g.stroke(); }
      g.fillStyle = '#2a0808'; g.beginPath(); g.ellipse(-10, hy + 6.8, 1.4, fear > 0.3 ? 1.4 : 0.6, 0, 0, TAU); g.fill();
      // Oreja.
      oval(g, 3, hy + 1, 2.6, 3.8, pal.skinD, 1.1);
      g.strokeStyle = 'rgba(90,40,20,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.arc(3, hy + 1, 1.4, -1.5, 1.6); g.stroke();
      // Pelo.
      g.beginPath();
      g.moveTo(-10.2, hy - 5.4); g.bezierCurveTo(-11.4, hy - 13, -4, hy - 17.2, 2, hy - 15.4);
      g.quadraticCurveTo(6, hy - 16, 8, hy - 13); g.bezierCurveTo(12.6, hy - 9, 12.4, hy + 0, 9.4, hy + 6);
      g.quadraticCurveTo(7, hy + 3, 6.4, hy - 2); g.quadraticCurveTo(4, hy - 6, 1, hy - 7.4);
      g.quadraticCurveTo(-4, hy - 7.6, -10.2, hy - 5.4); g.closePath();
      fillStroke(g, vgrad(g, hy - 17, hy + 4, pal.hairL, pal.hair), 1.3);
      // Ojo, ceja y lentes.
      if (!s.eyeLost) {
        g.fillStyle = '#f4f0ea'; g.beginPath(); g.ellipse(-7.4, hy - 1, 1.5, 1.5 + fear * 0.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(-8.2, hy - 0.8, 0.9, 0, TAU); g.fill();
      }
      g.strokeStyle = pal.hair; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, hy - 4.6 - fear); g.quadraticCurveTo(-7, hy - 5.8 - fear * 1.5, -4.4, hy - 4.8); g.stroke();
      g.lineWidth = 1.5; g.strokeStyle = pal.glass;
      RM.Art2.rrPath(g, -10.6, hy - 4, 5, 6.2, 1.8); g.fillStyle = 'rgba(170,205,235,0.22)'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-5.6, hy - 1.8); g.lineTo(2.4, hy - 1.4); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-9.6, hy - 3); g.lineTo(-8.2, hy - 1.4); g.stroke();
    }
    // Venda puesta en la cabeza.
    if (s.wrap) {
      g.save();
      g.beginPath();
      if (view === 'front') { g.moveTo(-12.4, hy - 6); g.quadraticCurveTo(0, hy - 9.5, 12.4, hy + 1); g.lineTo(12, hy + 5); g.quadraticCurveTo(0, hy - 3.4, -12.6, hy - 1.6); }
      else if (view === 'back') { g.moveTo(-12.4, hy + 1); g.quadraticCurveTo(0, hy - 9, 12.4, hy - 6); g.lineTo(12.6, hy - 1.6); g.quadraticCurveTo(0, hy - 3, -12, hy + 5); }
      else { g.moveTo(-11.4, hy - 4.6); g.quadraticCurveTo(0, hy - 8.4, 11, hy - 4); g.lineTo(11.4, hy + 0.6); g.quadraticCurveTo(0, hy - 3.6, -11.6, hy + 0.4); }
      g.closePath();
      fillStroke(g, vgrad(g, hy - 8, hy + 4, '#f6f2ea', '#cdc4b4'), 1.2);
      g.strokeStyle = 'rgba(130,110,90,0.55)'; g.lineWidth = 0.6;
      for (var w = -9; w <= 9; w += 3.5) { g.beginPath(); g.moveTo(w, hy - 7 + w * 0.3); g.lineTo(w + 1.2, hy - 2.4 + w * 0.3); g.stroke(); }
      if (view !== 'back') { g.fillStyle = 'rgba(160,10,14,0.75)'; g.beginPath(); g.ellipse(view === 'front' ? -4.8 : -7, hy - 3.2, 2.6, 1.8, 0.3, 0, TAU); g.fill(); }
      g.restore();
    }
    // Sangre que corre del ojo.
    if (s.bleed && view !== 'back') {
      var ex2 = view === 'front' ? -4.8 : -7.6, drip = (s.t * 6) % 10;
      g.fillStyle = '#9a0408';
      g.beginPath(); g.moveTo(ex2 - 1.4, hy); g.quadraticCurveTo(ex2 - 2, hy + 6, ex2 - 0.6, hy + 9 + drip * 0.4); g.quadraticCurveTo(ex2 + 1, hy + 6, ex2 + 1.4, hy); g.closePath(); g.fill();
      g.beginPath(); g.arc(ex2 - 0.3, hy + 10 + drip, 1, 0, TAU); g.fill();
    }
  }

  function crack(g, x, y) {
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(x - 3.6, y - 2.6); g.lineTo(x, y); g.lineTo(x + 3, y - 3); g.moveTo(x, y); g.lineTo(x + 1, y + 3); g.moveTo(x, y); g.lineTo(x - 3.4, y + 2); g.stroke();
  }

  /* ---------- Figura completa ---------- */

  // s = { dir:0 abajo,1 izq,2 der,3 arriba, phase, amp, run, crouch, pick, heal, struggle, down, bleed, eyeLost, wrap, t }
  function draw(g, s, pal) {
    pal = pal || BASE;
    s = Object.assign({ phase: 0, amp: 0, run: 0, crouch: 0, pick: 0, heal: 0, struggle: 0, down: 0, t: 0 }, s);
    g.save();
    if (s.down > 0) {
      // Tirado en el piso (de costado, con un charco de sangre si sangra).
      var dk = Math.min(1, s.down);
      if (s.bleed || s.dead) {
        g.fillStyle = 'rgba(110,2,6,' + 0.7 * dk + ')';
        g.beginPath(); g.ellipse(-14, -2, 20 * dk + 4, 7 * dk + 2, 0, 0, TAU); g.fill();
      }
      g.rotate(-Math.PI / 2 * dk);
      g.translate(0, 4 * dk);
      s = Object.assign({}, s, { dir: 0, amp: 0, crouch: 0, run: 0, pick: 0, heal: 0, struggle: 0, fear: s.dead ? 0 : 1 });
    }
    var flip = s.dir === 2;
    if (flip) g.scale(-1, 1);
    var side = s.dir === 1 || s.dir === 2;
    if (side) drawSide(g, s, pal); else drawFront(g, s, pal, s.dir === 3);
    g.restore();
  }

  function drawFront(g, s, pal, back) {
    var c = Math.max(s.crouch || 0, (s.pick || 0) * 0.8);
    var ph = s.phase, amp = s.amp, run = s.run || 0;
    var stride = 1 + run * 0.9;
    var bob = Math.abs(Math.sin(ph)) * amp * (1 + run * 1.6) * (1 - c * 0.6);
    var hipY = -23 + c * 9 - bob * 0.4;
    var shY = hipY - 26 + c * 2 - bob * 0.6 + (s.pick || 0) * 4;
    var hy = shY - 13 + (s.pick || 0) * 3;
    var bodyX = Math.sin(ph) * amp * 0.8;
    var str = s.struggle ? Math.sin(s.t * 40) * 1.2 : 0;

    // Piernas (con rodilla).
    [-1, 1].forEach(function (k) {
      var sw = Math.sin(ph) * k * amp * stride * (back ? -1 : 1);
      var fx = k * (6.2 + c * 4), fy = sw * 2.6 - Math.max(0, -sw) * 1.6 * (1 + run);
      var hx = k * 6 + bodyX;
      var kn = [(hx + fx) / 2 + k * (0.6 + c * 3), (hipY + 1 + fy - 3) / 2 + Math.max(0, -sw) * 0.8 - c * 2];
      var col = back ? pal.pantsD : pal.pants;
      seg(g, hx, hipY + 1, kn[0], kn[1], 5.2, 4.4, lgrad(g, hx - 5, hx + 5, col, pal.pantsL, pal.pantsD));
      seg(g, kn[0], kn[1], fx, fy - 3.5, 4.4, 3.6, lgrad(g, fx - 5, fx + 5, col, pal.pantsL, pal.pantsD));
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(kn[0] - 2, kn[1]); g.quadraticCurveTo(kn[0], kn[1] + 1.2, kn[0] + 2, kn[1]); g.stroke();
      shoe(g, fx + k * 0.6, fy, 'front', pal, 1.05);
    });

    // Brazos de atrás (en la vista de espalda se dibujan antes).
    var arms = function () {
      [-1, 1].forEach(function (k) {
        var sw = -Math.sin(ph) * k * amp * (back ? -1 : 1);
        var sx = k * 16 + bodyX, sy = shY + 4;
        var hx, hy2;
        if (s.struggle) { hx = k * 8 + str; hy2 = hy + 4; }
        else if (s.heal) { hx = k * 7 + Math.sin(s.t * 12 + k) * 2; hy2 = hy - 4; }
        else if (s.pick) { hx = k * 9; hy2 = -2 - (1 - s.pick) * 20; }
        else {
          hx = k * (19.5 + c * 2) + sw * (2 + run * 2);
          hy2 = shY + 22 - c * 3 + sw * (2.6 + run * 4) - run * 5;
        }
        var el = joint(sx, sy, hx, hy2, 10.5, 10.5, k > 0 ? 1 : -1);
        // Manga de la remera.
        var mx = sx + (el[0] - sx) * 0.62, my = sy + (el[1] - sy) * 0.62;
        seg(g, el[0], el[1], hx, hy2, 3.6, 3.1, lgrad(g, hx - 4, hx + 4, pal.skinD, pal.skin, pal.skinD));
        seg(g, mx, my, el[0], el[1], 3.8, 3.6, pal.skin);
        seg(g, sx, sy, mx, my, 6, 5.2, lgrad(g, sx - 6, sx + 6, pal.shirt, pal.shirtL, pal.shirtD));
        hand(g, hx, hy2, Math.atan2(hy2 - el[1], hx - el[0]), pal, k);
      });
    };

    // Torso: hombros anchos y panza.
    var tx = bodyX;
    g.save(); g.translate(tx + str * 0.5, 0);
    g.beginPath();
    g.moveTo(-14.5, shY + 0.5);
    g.bezierCurveTo(-19.5, shY + 4, -21.5, shY + 15, -19.6, hipY - 4);
    g.quadraticCurveTo(-18, hipY + 1.6, -13.6, hipY + 2);
    g.quadraticCurveTo(0, hipY + 4.8, 13.6, hipY + 2);
    g.quadraticCurveTo(18, hipY + 1.6, 19.6, hipY - 4);
    g.bezierCurveTo(21.5, shY + 15, 19.5, shY + 4, 14.5, shY + 0.5);
    if (back) g.quadraticCurveTo(0, shY - 3.4, -14.5, shY + 0.5);
    else { g.quadraticCurveTo(8, shY - 2.6, 5.6, shY - 1.2); g.quadraticCurveTo(0, shY + 3.6, -5.6, shY - 1.2); g.quadraticCurveTo(-8, shY - 2.6, -14.5, shY + 0.5); }
    g.closePath();
    fillStroke(g, lgrad(g, -21, 21, pal.shirtL, pal.shirt, pal.shirtD), 1.5);
    g.save(); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(16, hipY - 10, 9, 22, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(-6, shY + 10, 7, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-15, hipY - 6); g.quadraticCurveTo(0, hipY - 1, 15, hipY - 6); g.stroke();
    g.beginPath(); g.moveTo(-13, shY + 10); g.quadraticCurveTo(-11, shY + 14, -13, shY + 18); g.moveTo(13, shY + 10); g.quadraticCurveTo(11, shY + 14, 13, shY + 18); g.stroke();
    g.restore();
    if (!back) {
      // Cuello redondo y estampa de un ojo rojo.
      g.strokeStyle = pal.shirtD; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5.6, shY - 1); g.quadraticCurveTo(0, shY + 3.8, 5.6, shY - 1); g.stroke();
      g.fillStyle = 'rgba(240,230,220,0.85)'; g.beginPath(); g.ellipse(-7, shY + 9, 3.2, 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8100c'; g.beginPath(); g.arc(-7, shY + 9, 1.2, 0, TAU); g.fill();
    } else {
      g.strokeStyle = pal.shirtD; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, shY - 0.6); g.quadraticCurveTo(0, shY + 0.8, 6, shY - 0.6); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, shY + 3); g.lineTo(0, hipY - 2); g.stroke();
    }
    // Cinturón.
    g.fillStyle = '#1e140e'; g.beginPath(); g.moveTo(-13.6, hipY + 0.6); g.quadraticCurveTo(0, hipY + 3.6, 13.6, hipY + 0.6); g.lineTo(13.4, hipY + 3); g.quadraticCurveTo(0, hipY + 6, -13.4, hipY + 3); g.closePath(); g.fill();
    if (!back) { g.fillStyle = '#c8a040'; RM.Art2.rrPath(g, -2.4, hipY + 1.6, 4.8, 3.2, 0.8); g.fill(); }
    // Manchas de sangre en la remera.
    if (s.bleed) { g.fillStyle = 'rgba(130,4,8,0.8)'; g.beginPath(); g.ellipse(-4, shY + 4, 3.5, 5, 0.3, 0, TAU); g.ellipse(-2, shY + 11, 2, 2.6, 0, 0, TAU); g.fill(); }
    g.restore();

    arms();
    g.save(); g.translate(tx * 0.6 + str, 0);
    head(g, back ? 'back' : 'front', hy, pal, s);
    g.restore();
  }

  function drawSide(g, s, pal) {
    var c = Math.max(s.crouch || 0, (s.pick || 0) * 0.7);
    var ph = s.phase, amp = s.amp, run = s.run || 0;
    var A1 = (0.42 + run * 0.35) * amp, KB = (0.55 + run * 0.6) * amp;
    var L1 = 11.5, L2 = 11.5;
    var hipY0 = -23 + c * 9;
    // Piernas en coordenadas relativas a la cadera.
    var legs = [0, Math.PI].map(function (off) {
      var p = ph + off, ta = Math.sin(p) * A1 + c * 0.9;
      var bend = Math.max(0, Math.cos(p)) * KB + c * 1.9;
      var kx = -Math.sin(ta) * L1, ky = Math.cos(ta) * L1;
      var sa = ta - bend;
      var fx = kx - Math.sin(sa) * L2, fy = ky + Math.cos(sa) * L2;
      return { kx: kx, ky: ky, fx: fx, fy: fy };
    });
    var lowest = Math.max(legs[0].fy, legs[1].fy);
    var hipY = c > 0.3 ? hipY0 : -lowest - 0.5;
    if (c > 0.3) legs.forEach(function (l) { var d = -hipY - l.fy; l.fy += d; });
    var lean = -(0.12 * run * amp) - c * 0.18 - (s.pick || 0) * 0.55;
    var hipX = 1.5;

    var leg = function (l, far) {
      var col = far ? pal.pantsD : pal.pants;
      seg(g, hipX, hipY, hipX + l.kx, hipY + l.ky, 5.4, 4.5, col);
      seg(g, hipX + l.kx, hipY + l.ky, hipX + l.fx, hipY + l.fy - 3, 4.5, 3.7, far ? pal.pantsD : lgrad(g, hipX + l.fx - 4, hipX + l.fx + 4, pal.pantsL, pal.pants, pal.pantsD));
      shoe(g, hipX + l.fx, hipY + l.fy + 0.6, 'side', far ? Object.assign({}, pal, { shoeL: pal.shoe }) : pal);
    };
    var arm = function (far) {
      var sw = Math.sin(ph + (far ? 0 : Math.PI)) * (0.5 + run * 0.6) * amp;
      var sx = 0.5, sy = -27.5 + 3.5;
      var ang = sw, elb = 0.25 + run * 1.1 + c * 0.4;
      if (s.pick) { ang = -1.1 * s.pick; elb = 0.1; }
      if (s.struggle) { ang = -1.9 + Math.sin(s.t * 40) * 0.1; elb = 0.6; }
      if (s.heal) { ang = -2.4; elb = 1.9 + Math.sin(s.t * 12) * 0.2; }
      var ex = sx - Math.sin(ang) * 10.5, ey = sy + Math.cos(ang) * 10.5;
      var fa = ang - elb;
      var hx = ex - Math.sin(fa) * 10, hy2 = ey + Math.cos(fa) * 10;
      var skin = far ? pal.skinD : pal.skin;
      seg(g, ex, ey, hx, hy2, 3.6, 3.1, skin);
      seg(g, sx, sy, sx + (ex - sx) * 0.66, sy + (ey - sy) * 0.66, 6, 5.3, far ? pal.shirtD : lgrad(g, sx - 6, sx + 6, pal.shirtL, pal.shirt, pal.shirtD));
      seg(g, sx + (ex - sx) * 0.66, sy + (ey - sy) * 0.66, ex, ey, 3.8, 3.6, skin);
      hand(g, hx, hy2, Math.atan2(hy2 - ey, hx - ex), far ? Object.assign({}, pal, { skin: pal.skinD }) : pal, -1);
    };

    leg(legs[1], true);
    g.save(); g.translate(hipX, hipY); g.rotate(lean); g.translate(-hipX, -hipY);
    var shY = hipY - 26 + c * 2;
    g.save(); g.translate(0, shY + 27.5);
    arm(true);
    g.restore();
    g.restore();
    leg(legs[0], false);
    g.save(); g.translate(hipX, hipY); g.rotate(lean); g.translate(-hipX, -hipY);
    // Torso de perfil con panza hacia adelante.
    g.beginPath();
    g.moveTo(-2, shY - 0.6);
    g.bezierCurveTo(-9, shY + 1, -12, shY + 8, -15.6, shY + 16);
    g.bezierCurveTo(-18, shY + 22, -14, hipY + 2.6, -8, hipY + 2.6);
    g.lineTo(8.6, hipY + 2.2); g.bezierCurveTo(10.4, hipY - 8, 10.4, shY + 6, 7, shY + 0.6);
    g.quadraticCurveTo(2.5, shY - 2, -2, shY - 0.6); g.closePath();
    fillStroke(g, lgrad(g, -17, 10, pal.shirtL, pal.shirt, pal.shirtD), 1.5);
    g.save(); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(9, shY + 14, 6, 18, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-15, shY + 18); g.quadraticCurveTo(-8, shY + 21, -2, shY + 19); g.stroke();
    g.restore();
    if (s.bleed) { g.fillStyle = 'rgba(130,4,8,0.8)'; g.beginPath(); g.ellipse(-8, shY + 6, 3, 5, 0.3, 0, TAU); g.fill(); }
    g.fillStyle = '#1e140e'; g.beginPath(); g.moveTo(-12.4, hipY - 0.4); g.lineTo(8.8, hipY - 0.6); g.lineTo(8.6, hipY + 2.4); g.lineTo(-11.6, hipY + 2.6); g.closePath(); g.fill();
    var hy = shY - 12.5;
    head(g, 'side', hy, pal, s);
    g.save(); g.translate(0, shY + 27.5); arm(false); g.restore();
    g.restore();
  }

  /* ---------- Primer plano de la cara (escenas) ---------- */
  // Unidades: la cabeza mide ~200 de alto centrada en (0,0).
  // o = { fear, hit (0..1 garfio clavado), lost (ojo arrancado), blood (0..1), shake, look, pal }
  function face(g, o) {
    var pal = o.pal || BASE, fear = o.fear == null ? 1 : o.fear;
    g.save();
    g.lineJoin = 'round';
    // Cuello y hombros.
    g.beginPath(); g.moveTo(-120, 260); g.quadraticCurveTo(-110, 150, -40, 120); g.lineTo(40, 120); g.quadraticCurveTo(110, 150, 120, 260); g.closePath();
    fillStroke(g, lgrad(g, -120, 120, pal.shirtL, pal.shirt, pal.shirtD), 4);
    // Orejas.
    oval(g, -108, 10, 18, 30, pal.skinD, 4); oval(g, 108, 10, 18, 30, pal.skinD, 4);
    // Cara.
    g.beginPath();
    g.moveTo(-100, -30); g.bezierCurveTo(-104, -130, 104, -130, 100, -30);
    g.bezierCurveTo(104, 60, 62, 112, 0, 115); g.bezierCurveTo(-62, 112, -104, 60, -100, -30); g.closePath();
    var fg = g.createRadialGradient(-30, -40, 10, 0, 0, 130); fg.addColorStop(0, pal.skinL); fg.addColorStop(0.6, pal.skin); fg.addColorStop(1, pal.skinD);
    fillStroke(g, fg, 4.5);
    // Sudor.
    g.fillStyle = 'rgba(220,240,255,0.7)';
    [[-70, -70], [64, -84], [80, -40]].forEach(function (p) { g.beginPath(); g.moveTo(p[0], p[1] - 7); g.quadraticCurveTo(p[0] + 5, p[1] + 3, p[0], p[1] + 5); g.quadraticCurveTo(p[0] - 5, p[1] + 3, p[0], p[1] - 7); g.fill(); });
    // Pelo.
    g.beginPath();
    g.moveTo(-104, -20); g.bezierCurveTo(-118, -90, -90, -142, -36, -140);
    g.quadraticCurveTo(-16, -160, 10, -142); g.quadraticCurveTo(36, -156, 56, -134);
    g.bezierCurveTo(100, -130, 120, -80, 104, -20);
    g.quadraticCurveTo(96, -60, 84, -72); g.quadraticCurveTo(36, -66, 14, -94);
    g.quadraticCurveTo(-26, -64, -84, -72); g.quadraticCurveTo(-96, -60, -104, -20); g.closePath();
    fillStroke(g, vgrad(g, -150, -40, pal.hairL, pal.hair), 4);
    g.strokeStyle = 'rgba(255,230,200,0.16)'; g.lineWidth = 2.5;
    for (var h = 0; h < 7; h++) { g.beginPath(); g.moveTo(-70 + h * 22, -130 + Math.abs(h - 3) * 4); g.quadraticCurveTo(-60 + h * 22, -105, -66 + h * 22, -82); g.stroke(); }
    // Barba.
    g.beginPath();
    g.moveTo(-102, -10); g.bezierCurveTo(-114, 80, -70, 165, 0, 170); g.bezierCurveTo(70, 165, 114, 80, 102, -10);
    g.quadraticCurveTo(92, 30, 70, 40); g.quadraticCurveTo(40, 26, 0, 30); g.quadraticCurveTo(-40, 26, -70, 40); g.quadraticCurveTo(-92, 30, -102, -10); g.closePath();
    fillStroke(g, vgrad(g, 0, 170, pal.beardL, pal.beard), 4);
    g.strokeStyle = 'rgba(15,6,2,0.4)'; g.lineWidth = 1.6;
    for (var b = 0; b < 40; b++) {
      var bx = -86 + (b % 10) * 19 + (b * 7 % 5), by = 60 + ((b / 10) | 0) * 22;
      if (Math.hypot(bx, by - 40) > 125) continue;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 3, by + 9, bx - 1, by + 17); g.stroke();
    }
    // Boca abierta del susto + bigote.
    g.fillStyle = '#1e0606'; g.beginPath(); g.ellipse(0, 72, 22, 10 + fear * 14, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8e0d4'; g.fillRect(-14, 60 - fear * 2, 28, 5);
    g.beginPath(); g.moveTo(-58, 58); g.bezierCurveTo(-30, 26, 30, 26, 58, 58); g.quadraticCurveTo(28, 46, 0, 52); g.quadraticCurveTo(-28, 46, -58, 58); g.closePath();
    fillStroke(g, pal.beard, 3);
    // Nariz.
    g.fillStyle = 'rgba(150,80,50,0.35)'; g.beginPath(); g.ellipse(2, 22, 22, 13, 0, 0, TAU); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, 24); g.quadraticCurveTo(0, 36, 16, 24); g.moveTo(-4, -16); g.quadraticCurveTo(-10, 6, -12, 18); g.stroke();
    // Ojos.
    [-1, 1].forEach(function (k) {
      var ex = k * 42, ey = -18, hitEye = k === -1;
      if (hitEye && o.lost) {
        g.fillStyle = '#1a0002'; g.beginPath(); g.ellipse(ex, ey, 22, 16, 0, 0, TAU); g.fill();
        g.fillStyle = '#6a0006'; g.beginPath(); g.ellipse(ex, ey + 4, 16, 9, 0, 0, TAU); g.fill();
      } else {
        g.fillStyle = '#f6f2ec'; g.beginPath(); g.ellipse(ex, ey, 21, 13 + fear * 6, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(180,40,40,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ex - 18, ey + 2); g.lineTo(ex - 10, ey); g.moveTo(ex + 18, ey - 2); g.lineTo(ex + 11, ey + 1); g.stroke();
        var ix = ex + (o.look || 0) * 6;
        g.fillStyle = '#4a2e18'; g.beginPath(); g.arc(ix, ey, 9 - fear * 2, 0, TAU); g.fill();
        g.fillStyle = '#0a0604'; g.beginPath(); g.arc(ix, ey, 4.5 - fear * 1.5, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ix - 3, ey - 3, 2, 0, TAU); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.ellipse(ex, ey, 21, 13 + fear * 6, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
      g.strokeStyle = pal.hair; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex - k * 26, ey - 30 - fear * 10); g.quadraticCurveTo(ex, ey - 44 - fear * 12, ex + k * 26, ey - 34 + fear * 4); g.stroke();
    });
    // Lentes.
    g.lineWidth = 7; g.strokeStyle = pal.glass;
    [-1, 1].forEach(function (k) {
      var x = k * 42;
      RM.Art2.rrPath(g, x - 34, -46, 68, 54, 16);
      g.fillStyle = 'rgba(170,205,235,0.16)'; g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x - 24, -36); g.lineTo(x - 8, -20); g.moveTo(x - 14, -40); g.lineTo(x - 4, -30); g.stroke();
      g.lineWidth = 7; g.strokeStyle = pal.glass;
    });
    g.beginPath(); g.moveTo(-8, -26); g.quadraticCurveTo(0, -34, 8, -26); g.moveTo(-76, -30); g.lineTo(-104, -20); g.moveTo(76, -30); g.lineTo(104, -20); g.stroke();
    // Lente izquierda rota cuando entra el garfio.
    if (o.hit > 0 || o.lost) {
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath();
      [[-30, -14], [-12, -44], [-70, -40], [-62, 4], [-20, 6]].forEach(function (p) { g.moveTo(-42, -18); g.lineTo(p[0], p[1]); });
      g.stroke();
    }
    // Sangre.
    var bl = o.blood || 0;
    if (bl > 0) {
      g.fillStyle = 'rgba(150,0,6,0.92)';
      g.beginPath(); g.ellipse(-42, -18, 26 * Math.min(1, bl * 2), 20 * Math.min(1, bl * 2), 0, 0, TAU); g.fill();
      for (var d = 0; d < 5; d++) {
        var dx = -60 + d * 9, len = 40 + bl * (90 + d * 30);
        g.beginPath(); g.moveTo(dx - 5, -10); g.quadraticCurveTo(dx - 7, -10 + len * 0.6, dx, -10 + len); g.quadraticCurveTo(dx + 7, -10 + len * 0.6, dx + 5, -10); g.fill();
        g.beginPath(); g.arc(dx, -6 + len, 6, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  RM.Hero = { draw: draw, face: face, palette: palette, SHIRTS: SHIRTS };
})(window.RM);
