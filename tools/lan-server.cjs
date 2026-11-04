#!/usr/bin/env node
// Red Main — servidor de red local para PC (mismo protocolo que el de la app Android).
// Reenvía cada mensaje WebSocket a los demás clientes y responde búsquedas UDP.
// Uso: node tools/lan-server.cjs ["Nombre de la sala"]
'use strict';
const http = require('http');
const crypto = require('crypto');
const dgram = require('dgram');
const os = require('os');

const WS_PORT = 47800, UDP_PORT = 47801;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const roomName = process.argv[2] || 'Sala de PC';
const clients = new Set();
let nextId = 1;

function frame(text) {
  const data = Buffer.from(text, 'utf8'), n = data.length;
  let head;
  if (n < 126) head = Buffer.from([0x81, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, data]);
}

function broadcast(from, text) {
  const f = frame(text);
  for (const c of clients) if (c !== from) c.sock.write(f);
}

const server = http.createServer((req, res) => { res.writeHead(200); res.end('Red Main LAN server\n'); });
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { sock, id: nextId++, buf: Buffer.alloc(0), partial: '' };
  clients.add(c);
  sock.write(frame(JSON.stringify({ t: '_hello', cid: c.id })));
  console.log('+ jugador', c.id, '(' + clients.size + ' conectados)');
  sock.on('data', (chunk) => {
    c.buf = Buffer.concat([c.buf, chunk]);
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len;
      if (c.buf.length < need) return;
      const mask = masked ? c.buf.slice(off, off + 4) : null;
      const data = c.buf.slice(off + (masked ? 4 : 0), need);
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      c.buf = c.buf.slice(need);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op === 1 || op === 0) {
        c.partial += data.toString('utf8');
        if (b0 & 0x80) { broadcast(c, c.partial); c.partial = ''; }
      }
    }
  });
  const bye = () => {
    if (!clients.delete(c)) return;
    broadcast(c, JSON.stringify({ t: '_left', cid: c.id }));
    console.log('- jugador', c.id, '(' + clients.size + ' conectados)');
  };
  sock.on('close', bye);
  sock.on('error', bye);
});
server.listen(WS_PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  console.log('Red Main — servidor local "' + roomName + '" en el puerto ' + WS_PORT);
  console.log('Conectate desde el juego con: ' + (ips.length ? ips.join(', ') : '127.0.0.1'));
});

const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
udp.on('message', (msg, rinfo) => {
  if (!msg.toString().startsWith('REDMAIN?')) return;
  const out = Buffer.from('REDMAIN!' + JSON.stringify({ name: roomName, port: WS_PORT, players: clients.size }));
  udp.send(out, rinfo.port, rinfo.address);
});
udp.on('error', (e) => console.log('UDP no disponible (la búsqueda automática no va a funcionar):', e.message));
udp.bind(UDP_PORT, '0.0.0.0');
