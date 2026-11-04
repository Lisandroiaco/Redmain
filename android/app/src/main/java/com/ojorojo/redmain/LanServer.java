package com.ojorojo.redmain;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Partida en red local (Wi-Fi / hotspot) sin servidor externo.
 *
 * - Servidor WebSocket mínimo (puerto 47800) que reenvía cada mensaje de texto
 *   a todos los demás clientes. La lógica del juego vive en JavaScript: el
 *   anfitrión también se conecta como cliente (ws://127.0.0.1:47800).
 * - Respondedor UDP (puerto 47801) para que otros celulares encuentren la sala
 *   con un broadcast "REDMAIN?".
 */
public class LanServer {
    public static final int WS_PORT = 47800;
    public static final int UDP_PORT = 47801;
    private static final String GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    private final List<Client> clients = new CopyOnWriteArrayList<>();
    private volatile boolean running;
    private ServerSocket server;
    private DatagramSocket udp;
    private volatile String roomName = "Sala";
    private int nextId = 1;

    public synchronized boolean isRunning() { return running; }

    public synchronized void start(String name) throws IOException {
        roomName = name == null ? "Sala" : name;
        if (running) return;
        server = new ServerSocket();
        server.setReuseAddress(true);
        server.bind(new InetSocketAddress(WS_PORT));
        udp = new DatagramSocket(null);
        udp.setReuseAddress(true);
        udp.setBroadcast(true);
        udp.bind(new InetSocketAddress(UDP_PORT));
        running = true;
        Thread accept = new Thread(this::acceptLoop, "lan-accept");
        accept.setDaemon(true);
        accept.start();
        Thread disc = new Thread(this::discoveryLoop, "lan-udp");
        disc.setDaemon(true);
        disc.start();
    }

    public synchronized void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (IOException ignored) { }
        if (udp != null) udp.close();
        for (Client c : clients) c.close();
        clients.clear();
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket s = server.accept();
                s.setTcpNoDelay(true);
                Client c;
                synchronized (this) { c = new Client(s, nextId++); }
                c.start();
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    private void discoveryLoop() {
        byte[] buf = new byte[256];
        while (running) {
            try {
                DatagramPacket p = new DatagramPacket(buf, buf.length);
                udp.receive(p);
                String msg = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                if (msg.startsWith("REDMAIN?")) {
                    JSONObject o = new JSONObject();
                    o.put("name", roomName);
                    o.put("port", WS_PORT);
                    o.put("players", clients.size());
                    byte[] out = ("REDMAIN!" + o.toString()).getBytes(StandardCharsets.UTF_8);
                    udp.send(new DatagramPacket(out, out.length, p.getAddress(), p.getPort()));
                }
            } catch (Exception e) {
                if (!running) return;
            }
        }
    }

    private void broadcast(Client from, String text) {
        for (Client c : clients) if (c != from) c.send(text);
    }

    private class Client extends Thread {
        final Socket socket;
        final int id;
        OutputStream out;

        Client(Socket s, int id) {
            super("lan-client-" + id);
            setDaemon(true);
            this.socket = s;
            this.id = id;
        }

        @Override
        public void run() {
            try {
                DataInputStream in = new DataInputStream(new BufferedInputStream(socket.getInputStream()));
                out = socket.getOutputStream();
                if (!handshake(in)) { close(); return; }
                clients.add(this);
                send("{\"t\":\"_hello\",\"cid\":" + id + "}");
                StringBuilder partial = new StringBuilder();
                while (running) {
                    int b0 = in.read();
                    if (b0 < 0) break;
                    int b1 = in.readUnsignedByte();
                    int op = b0 & 0x0F;
                    boolean fin = (b0 & 0x80) != 0;
                    long len = b1 & 0x7F;
                    if (len == 126) len = in.readUnsignedShort();
                    else if (len == 127) len = in.readLong();
                    if (len > 1 << 20) break;
                    byte[] mask = new byte[4];
                    boolean masked = (b1 & 0x80) != 0;
                    if (masked) in.readFully(mask);
                    byte[] data = new byte[(int) len];
                    in.readFully(data);
                    if (masked) for (int i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
                    if (op == 8) break;
                    if (op == 9) { sendFrame(0x8A, data); continue; }
                    if (op == 1 || op == 0) {
                        partial.append(new String(data, StandardCharsets.UTF_8));
                        if (fin) { broadcast(this, partial.toString()); partial.setLength(0); }
                    }
                }
            } catch (IOException ignored) {
            } finally {
                boolean was = clients.remove(this);
                close();
                if (was) broadcast(this, "{\"t\":\"_left\",\"cid\":" + id + "}");
            }
        }

        private boolean handshake(DataInputStream in) throws IOException {
            String key = null;
            StringBuilder line = new StringBuilder();
            int prev = -1, c, lines = 0;
            while ((c = in.read()) >= 0) {
                if (c == '\n' && prev == '\r') {
                    String l = line.toString().trim();
                    line.setLength(0);
                    if (l.isEmpty()) break;
                    if (++lines > 100) return false;
                    int i = l.indexOf(':');
                    if (i > 0 && l.substring(0, i).trim().equalsIgnoreCase("Sec-WebSocket-Key")) key = l.substring(i + 1).trim();
                } else if (c != '\r') {
                    line.append((char) c);
                    if (line.length() > 8192) return false;
                }
                prev = c;
            }
            if (key == null) return false;
            String accept;
            try {
                MessageDigest sha = MessageDigest.getInstance("SHA-1");
                accept = Base64.encodeToString(sha.digest((key + GUID).getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            } catch (Exception e) {
                return false;
            }
            String resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n";
            out.write(resp.getBytes(StandardCharsets.UTF_8));
            out.flush();
            return true;
        }

        void send(String text) {
            try { sendFrame(0x81, text.getBytes(StandardCharsets.UTF_8)); } catch (IOException e) { close(); }
        }

        synchronized void sendFrame(int head, byte[] data) throws IOException {
            if (out == null) return;
            out.write(head);
            int n = data.length;
            if (n < 126) out.write(n);
            else if (n < 65536) { out.write(126); out.write((n >> 8) & 0xFF); out.write(n & 0xFF); }
            else { out.write(127); for (int i = 7; i >= 0; i--) out.write((int) (((long) n >> (8 * i)) & 0xFF)); }
            out.write(data);
            out.flush();
        }

        void close() {
            try { socket.close(); } catch (IOException ignored) { }
        }
    }

    /* ---------- Utilidades de red ---------- */

    /** Direcciones IPv4 locales (Wi-Fi o hotspot) para mostrarle al anfitrión. */
    public static List<String> localIps() {
        List<String> ips = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) ips.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) { }
        return ips;
    }

    /** Busca salas en la red con broadcast UDP. Bloquea ~1,5 s; devuelve un JSON con la lista. */
    public static String discover() {
        Map<String, JSONObject> found = new LinkedHashMap<>();
        DatagramSocket s = null;
        try {
            s = new DatagramSocket();
            s.setBroadcast(true);
            s.setSoTimeout(250);
            byte[] q = "REDMAIN?".getBytes(StandardCharsets.UTF_8);
            List<InetAddress> targets = new ArrayList<>();
            targets.add(InetAddress.getByName("255.255.255.255"));
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    if (ia.getBroadcast() != null) targets.add(ia.getBroadcast());
                }
            }
            long end = System.currentTimeMillis() + 1500;
            int round = 0;
            byte[] buf = new byte[512];
            while (System.currentTimeMillis() < end) {
                if (round++ % 3 == 0) {
                    for (InetAddress t : targets) {
                        try { s.send(new DatagramPacket(q, q.length, t, UDP_PORT)); } catch (IOException ignored) { }
                    }
                }
                try {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    s.receive(p);
                    String msg = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                    if (msg.startsWith("REDMAIN!")) {
                        JSONObject o = new JSONObject(msg.substring(8));
                        String ip = p.getAddress().getHostAddress();
                        o.put("ip", ip);
                        found.put(ip, o);
                    }
                } catch (IOException ignored) { }
            }
        } catch (Exception ignored) {
        } finally {
            if (s != null) s.close();
        }
        JSONArray arr = new JSONArray();
        for (JSONObject o : found.values()) arr.put(o);
        return arr.toString();
    }
}
