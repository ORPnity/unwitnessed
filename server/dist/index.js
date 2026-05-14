"use strict";
/**
 * UNWITNESSED — WebSocket Signaling Server
 *
 * This server is a BLIND RELAY. It:
 * - Manages room creation/joining/leaving
 * - Relays encrypted messages between peers
 * - NEVER stores or decrypts messages
 * - Destroys rooms when all users leave
 * - Keeps NO logs, NO history, NO analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = require("http");
const crypto_1 = require("crypto");
// ═══════════════════════════════════════════
// STATE (in-memory only, no persistence)
// ═══════════════════════════════════════════
const rooms = new Map();
const userRooms = new Map();
// ═══════════════════════════════════════════
// SERVER SETUP
// ═══════════════════════════════════════════
const PORT = parseInt(process.env.PORT || process.env.WS_PORT || '3001');
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');
const httpServer = (0, http_1.createServer)((req, res) => {
    // CORS headers for all HTTP requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    // Health check endpoint
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'alive',
            service: 'unwitnessed-signal',
            rooms: rooms.size,
            timestamp: Date.now()
        }));
        return;
    }
    res.writeHead(404);
    res.end();
});
const wss = new ws_1.WebSocketServer({
    server: httpServer,
    maxPayload: 64 * 1024,
});
console.log(`
╔══════════════════════════════════════════╗
║         UNWITNESSED SIGNAL SERVER        ║
║                                          ║
║  Port: ${String(PORT).padEnd(37)}║
║  Mode: ZERO-KNOWLEDGE RELAY             ║
║  Storage: NONE                           ║
║  Logging: MINIMAL                        ║
║                                          ║
║  "Nothing witnessed."                    ║
╚══════════════════════════════════════════╝
`);
// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════
function generateRoomId() {
    const bytes = (0, crypto_1.randomBytes)(8);
    const hex = bytes.toString('hex').toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}
function generateUserId() {
    return (0, crypto_1.randomBytes)(16).toString('hex');
}
function send(ws, data) {
    if (ws.readyState === ws_1.WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}
function broadcast(room, data, excludeWs) {
    room.users.forEach((user) => {
        if (user.ws !== excludeWs) {
            send(user.ws, data);
        }
    });
}
function destroyRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        broadcast(room, {
            type: 'room_destroyed',
            reason: 'All users have left. Room destroyed.',
        });
        rooms.delete(roomId);
        console.log(`[ROOM DESTROYED] ${roomId}`);
    }
}
// ═══════════════════════════════════════════
// MESSAGE HANDLERS
// ═══════════════════════════════════════════
function handleCreateRoom(ws, data) {
    const roomId = generateRoomId();
    const userId = generateUserId();
    const room = {
        id: roomId,
        type: data.roomType || '1v1',
        maxUsers: data.roomType === '1v1' ? 2 : (data.maxUsers || 10),
        passwordHash: data.passwordHash,
        users: new Map(),
        createdAt: Date.now(),
    };
    room.users.set(userId, {
        ws,
        alias: data.alias || 'ANON',
        publicKey: data.publicKey || '',
        joinedAt: Date.now(),
    });
    rooms.set(roomId, room);
    userRooms.set(ws, roomId);
    send(ws, {
        type: 'room_created',
        roomId,
        userId,
        roomType: room.type,
        maxUsers: room.maxUsers,
    });
    console.log(`[ROOM CREATED] ${roomId} (${room.type}, max: ${room.maxUsers})`);
}
function handleJoinRoom(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room) {
        send(ws, { type: 'error', message: 'Room not found. It may have been destroyed.' });
        return;
    }
    if (room.passwordHash !== data.passwordHash) {
        send(ws, { type: 'error', message: 'Invalid password.' });
        return;
    }
    if (room.users.size >= room.maxUsers) {
        send(ws, { type: 'error', message: `Room is full. Maximum ${room.maxUsers} users.` });
        return;
    }
    const userId = generateUserId();
    room.users.set(userId, {
        ws,
        alias: data.alias || 'ANON',
        publicKey: data.publicKey || '',
        joinedAt: Date.now(),
    });
    userRooms.set(ws, data.roomId);
    const peers = Array.from(room.users.entries())
        .filter(([id]) => id !== userId)
        .map(([, user]) => ({
        alias: user.alias,
        publicKey: user.publicKey,
    }));
    send(ws, {
        type: 'room_joined',
        roomId: data.roomId,
        userId,
        roomType: room.type,
        maxUsers: room.maxUsers,
        currentUsers: room.users.size,
        peers,
    });
    broadcast(room, {
        type: 'user_joined',
        alias: data.alias,
        publicKey: data.publicKey,
        currentUsers: room.users.size,
        maxUsers: room.maxUsers,
    }, ws);
    console.log(`[USER JOINED] Room ${data.roomId} (${room.users.size}/${room.maxUsers})`);
}
function handleMessage(ws, data) {
    const roomId = userRooms.get(ws);
    if (!roomId)
        return;
    const room = rooms.get(roomId);
    if (!room)
        return;
    // BLIND RELAY: forward encrypted message without ever decrypting
    broadcast(room, {
        type: 'message',
        ciphertext: data.ciphertext,
        nonce: data.nonce,
        senderPublicKey: data.senderPublicKey,
        senderAlias: data.senderAlias,
        timestamp: data.timestamp || Date.now(),
        messageId: data.messageId || (0, crypto_1.randomBytes)(8).toString('hex'),
    }, ws);
}
function handleLeaveRoom(ws) {
    const roomId = userRooms.get(ws);
    if (!roomId)
        return;
    const room = rooms.get(roomId);
    if (!room) {
        userRooms.delete(ws);
        return;
    }
    let leavingAlias = 'UNKNOWN';
    for (const [userId, user] of room.users.entries()) {
        if (user.ws === ws) {
            leavingAlias = user.alias;
            room.users.delete(userId);
            break;
        }
    }
    userRooms.delete(ws);
    broadcast(room, {
        type: 'user_left',
        alias: leavingAlias,
        currentUsers: room.users.size,
        maxUsers: room.maxUsers,
    });
    console.log(`[USER LEFT] Room ${roomId} (${room.users.size}/${room.maxUsers})`);
    if (room.users.size === 0) {
        destroyRoom(roomId);
    }
}
// ═══════════════════════════════════════════
// WEBSOCKET CONNECTION HANDLING
// ═══════════════════════════════════════════
wss.on('connection', (ws) => {
    console.log(`[CONNECTION] New peer connected`);
    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw.toString());
            switch (data.type) {
                case 'create_room':
                    handleCreateRoom(ws, data);
                    break;
                case 'join_room':
                    handleJoinRoom(ws, data);
                    break;
                case 'message':
                    handleMessage(ws, data);
                    break;
                case 'leave_room':
                    handleLeaveRoom(ws);
                    break;
                case 'ping':
                    send(ws, { type: 'pong' });
                    break;
                default:
                    send(ws, { type: 'error', message: 'Unknown message type' });
            }
        }
        catch {
            send(ws, { type: 'error', message: 'Invalid message format' });
        }
    });
    ws.on('close', () => {
        handleLeaveRoom(ws);
        console.log(`[DISCONNECTED] Peer disconnected`);
    });
    ws.on('error', () => {
        handleLeaveRoom(ws);
    });
});
// ═══════════════════════════════════════════
// ROOM CLEANUP (destroy stale rooms)
// ═══════════════════════════════════════════
const ROOM_TIMEOUT = 24 * 60 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.createdAt > ROOM_TIMEOUT) {
            console.log(`[TIMEOUT] Room ${roomId} expired`);
            destroyRoom(roomId);
        }
    }
}, 60 * 1000);
httpServer.listen(PORT, () => {
    console.log(`Signal server listening on port ${PORT}`);
});
