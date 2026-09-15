const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Tối ưu cho Render free: tăng khoảng cách ping để giảm tải
    pingInterval: 25000,
    pingTimeout: 20000
});

// Phục vụ file tĩnh
app.use(express.static(__dirname));
if (path.join(__dirname, 'public') !== __dirname) {
    app.use(express.static(path.join(__dirname, 'public')));
}

// Lưu tất cả người chơi: socket.id => { id, name, score }
const players = new Map();

function getScoreboard() {
    return Array.from(players.values())
        .sort((a, b) => b.score - a.score)
        .map(p => ({ id: p.id, name: p.name, score: p.score }));
}

// Throttled broadcast: gom các cập nhật trong 300ms để giảm tải server
let broadcastTimer = null;
function scheduleBroadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(() => {
        broadcastTimer = null;
        io.emit('scoreboardUpdate', {
            players: getScoreboard(),
            onlineCount: players.size
        });
    }, 300);
}

// Broadcast ngay lập tức (dùng cho join/leave)
function broadcastNow() {
    clearTimeout(broadcastTimer);
    broadcastTimer = null;
    io.emit('scoreboardUpdate', {
        players: getScoreboard(),
        onlineCount: players.size
    });
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id} | Total sockets: ${io.engine.clientsCount}`);

    // Gửi bảng xếp hạng hiện tại cho người mới vào
    socket.emit('scoreboardUpdate', {
        players: getScoreboard(),
        onlineCount: players.size
    });

    // Khi người chơi gửi tên
    socket.on('join', (data) => {
        const rawName = (typeof data === 'object' && data ? data.name : data) || '';
        const playerName = String(rawName).trim().slice(0, 20) || 'Anonymous';

        players.set(socket.id, {
            id: socket.id,
            name: playerName,
            score: 0
        });

        console.log(`"${playerName}" joined (${socket.id}). Players: ${players.size}`);
        socket.emit('joined', { id: socket.id, name: playerName });
        broadcastNow();
    });

    // Cập nhật điểm (rate-limited: tối đa 10 lần/giây/người chơi)
    let lastScoreUpdate = 0;
    socket.on('updateScore', (rawScore) => {
        const player = players.get(socket.id);
        if (!player) return;

        const now = Date.now();
        if (now - lastScoreUpdate < 100) return; // Rate limit
        lastScoreUpdate = now;

        const numericScore = typeof rawScore === 'number' ? rawScore : (parseInt(rawScore, 10) || 0);
        player.score = numericScore;
        scheduleBroadcast(); // Throttled — gom nhiều cập nhật trong 300ms
    });

    // Khi ngắt kết nối
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`"${player.name}" left (${socket.id}). Players: ${players.size - 1}`);
            players.delete(socket.id);
            broadcastNow();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});