// server.js - Real-time Synchronized Wheel Server
// Language: JavaScript / Node.js (ES Module)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Default wheel items
const DEFAULT_ITEMS = [
  'รางวัลที่ 1: ทองคำ 1 สลึง',
  'รางวัลที่ 2: บัตรกำนัล 1,000 บ.',
  'กินหมูกระทะฟรี',
  'เลี้ยงกาแฟทั้งโต๊ะ',
  'โชคดีครั้งหน้า',
  'สิทธิ์หมุนใหม่อีกรอบ',
  'ร้องเพลง 1 เพลง',
  'เป็นหัวหน้าทริป'
];

const DEFAULT_COLORS = [
  '#FF4D4D', '#FF9F1C', '#FFD166', '#06D6A0',
  '#118AB2', '#073B4C', '#8338EC', '#3A86FF'
];

function createDefaultItems() {
  return DEFAULT_ITEMS.map((label, idx) => ({
    id: 'item_' + Date.now() + '_' + idx,
    label,
    color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }));
}

// In-memory rooms storage
class Room {
  constructor(id) {
    this.id = id;
    this.clients = new Set();
    this.items = createDefaultItems();
    this.state = 'idle'; // 'idle' | 'spinning' | 'result'
    this.currentAngle = 0; // In radians
    this.spinData = null; // { startTime, duration, startAngle, targetAngle, winnerIndex, winnerItem }
    this.history = [];
    this.hostPassword = 'admin'; // simple room protection if needed
  }

  getViewerCount() {
    return this.clients.size;
  }

  broadcast(message, excludeWs = null) {
    const raw = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  getSyncState() {
    return {
      type: 'sync',
      roomId: this.id,
      items: this.items,
      state: this.state,
      currentAngle: this.currentAngle,
      spinData: this.spinData,
      viewerCount: this.getViewerCount(),
      history: this.history,
      serverTime: Date.now()
    };
  }
}

const rooms = new Map();

function getOrCreateRoom(roomId = 'main') {
  const cleanId = (roomId || 'main').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'main';
  if (!rooms.has(cleanId)) {
    rooms.set(cleanId, new Room(cleanId));
  }
  return rooms.get(cleanId);
}

// HTTP Static Server
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA/rooms
      const indexFallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFallback, (fallbackErr, content) => {
        if (fallbackErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const roomId = urlObj.searchParams.get('room') || 'main';
  const room = getOrCreateRoom(roomId);

  ws.roomId = room.id;
  room.clients.add(ws);

  // Send initial full sync
  ws.send(JSON.stringify(room.getSyncState()));

  // Broadcast updated viewer count
  room.broadcast({
    type: 'viewer_count',
    count: room.getViewerCount()
  });

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw);
      handleMessage(ws, room, msg);
    } catch (e) {
      console.error('Invalid message received:', e.message);
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    room.broadcast({
      type: 'viewer_count',
      count: room.getViewerCount()
    });
    // Clean up empty non-main rooms after 1 hour if desired
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error in room ${room.id}:`, err.message);
  });
});

function handleMessage(ws, room, msg) {
  const now = Date.now();

  switch (msg.type) {
    case 'ping': {
      // Time synchronization: reply immediately with server timestamp
      ws.send(JSON.stringify({
        type: 'pong',
        clientTime: msg.clientTime,
        serverTime: now
      }));
      break;
    }

    case 'spin_request': {
      // Can only spin if idle or previous result settled
      if (room.state === 'spinning') {
        ws.send(JSON.stringify({ type: 'error', message: 'Wheel is already spinning!' }));
        return;
      }

      if (!room.items || room.items.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'No items in wheel!' }));
        return;
      }

      const itemCount = room.items.length;
      const sliceAngle = (2 * Math.PI) / itemCount;

      // Pick random winner
      const winnerIndex = Math.floor(Math.random() * itemCount);
      const winnerItem = room.items[winnerIndex];

      // Spin physics: duration 6-8 seconds
      const duration = typeof msg.duration === 'number' && msg.duration >= 3000 && msg.duration <= 12000
        ? msg.duration
        : 6500;

      // Minimum full rotations (between 5 and 8 turns)
      const fullRotations = 5 + Math.floor(Math.random() * 4);

      // Pointer is at TOP (12 o'clock = 3*PI/2)
      // Angle on wheel at top is: (3*PI/2 - rotation) mod 2PI = sliceStart + offset
      // Random offset within the slice (keep padding 15% from edges for clear needle position)
      const slicePadding = sliceAngle * 0.15;
      const subOffset = slicePadding + Math.random() * (sliceAngle - 2 * slicePadding);
      const targetSubAngle = (winnerIndex * sliceAngle) + subOffset;

      const pointerAngle = (3 * Math.PI) / 2; // Top
      const desiredModAngle = (pointerAngle - targetSubAngle + 2 * Math.PI) % (2 * Math.PI);

      const currentMod = room.currentAngle % (2 * Math.PI);
      let angleDelta = desiredModAngle - currentMod;
      if (angleDelta < 0) {
        angleDelta += 2 * Math.PI;
      }

      const totalTargetAngle = room.currentAngle + (fullRotations * 2 * Math.PI) + angleDelta;

      room.state = 'spinning';
      room.spinData = {
        startTime: now,
        duration,
        startAngle: room.currentAngle,
        targetAngle: totalTargetAngle,
        winnerIndex,
        winnerItem: winnerItem.label
      };

      // Broadcast spin start to ALL viewers simultaneously
      room.broadcast({
        type: 'spin_start',
        spinData: room.spinData,
        serverTime: now
      });

      // Schedule spin completion on server
      setTimeout(() => {
        if (room.state === 'spinning' && room.spinData?.startTime === now) {
          room.state = 'result';
          room.currentAngle = totalTargetAngle;
          const winRecord = {
            id: 'win_' + now,
            winner: winnerItem.label,
            color: winnerItem.color,
            timestamp: now
          };
          room.history.unshift(winRecord);
          if (room.history.length > 30) room.history.pop();

          room.broadcast({
            type: 'spin_complete',
            winnerIndex,
            winnerItem: winnerItem.label,
            winnerRecord: winRecord,
            finalAngle: totalTargetAngle,
            serverTime: Date.now()
          });
        }
      }, duration);

      break;
    }

    case 'update_items': {
      // Disallow updating items while wheel is spinning
      if (room.state === 'spinning') {
        ws.send(JSON.stringify({ type: 'error', message: 'Cannot modify items while spinning!' }));
        return;
      }

      if (!Array.isArray(msg.items) || msg.items.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'Wheel must have at least 1 item' }));
        return;
      }

      room.items = msg.items.map((item, idx) => ({
        id: item.id || ('item_' + Date.now() + '_' + idx),
        label: String(item.label || 'Item ' + (idx + 1)).trim().slice(0, 80),
        color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
      }));

      // Broadcast new items list to all connected viewers
      room.broadcast({
        type: 'items_updated',
        items: room.items,
        updatedBy: msg.senderName || 'Anonymous'
      });
      break;
    }

    case 'remove_winner': {
      if (room.state === 'spinning') return;
      if (!msg.label && typeof msg.index !== 'number') return;

      if (typeof msg.index === 'number' && room.items[msg.index]) {
        room.items.splice(msg.index, 1);
      } else if (msg.label) {
        const idx = room.items.findIndex(it => it.label === msg.label);
        if (idx !== -1) room.items.splice(idx, 1);
      }

      room.broadcast({
        type: 'items_updated',
        items: room.items,
        notice: `Removed item: ${msg.label || ''}`
      });
      break;
    }

    case 'reset_wheel': {
      if (room.state === 'spinning') return;
      room.state = 'idle';
      room.items = createDefaultItems();
      room.currentAngle = 0;
      room.spinData = null;
      room.broadcast(room.getSyncState());
      break;
    }

    case 'clear_history': {
      room.history = [];
      room.broadcast({ type: 'history_cleared' });
      break;
    }

    default:
      break;
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`> Real-time Wheel Server running at http://localhost:${PORT}`);
  console.log(`> Share with viewers on the local network using your machine IP:${PORT}`);
});
