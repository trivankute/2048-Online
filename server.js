const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); // Cho phép tất cả các nguồn truy cập (CORS)
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Cho phép mọi cổng (bao gồm 5500 của Live Server) kết nối vào
        methods: ["GET", "POST"]
    }
});
// Phục vụ các file tĩnh (index.html, style.css, app.js...)
app.use(express.static(__dirname));
if (path.join(__dirname, 'public') !== __dirname) {
    app.use(express.static(path.join(__dirname, 'public')));
}

// Lưu trữ tất cả người chơi đang kết nối: socket.id => { id, name, score }
const players = new Map();

function getScoreboard() {
    return Array.from(players.values())
        .sort((a, b) => b.score - a.score)
        .map(p => ({
            id: p.id,
            name: p.name,
            score: p.score
        }));
}

function broadcastScoreboard() {
    io.emit('scoreboardUpdate', {
        players: getScoreboard(),
        onlineCount: players.size
    });
}

io.on('connection', (socket) => {
    console.log(`Người chơi kết nối: ${socket.id}`);

    // Gửi bảng xếp hạng hiện tại cho người mới vào ngay lập tức
    socket.emit('scoreboardUpdate', {
        players: getScoreboard(),
        onlineCount: players.size
    });

    // Khi người chơi gửi tên để tham gia game
    socket.on('join', (data) => {
        const rawName = (typeof data === 'object' && data ? data.name : data) || '';
        const playerName = String(rawName).trim().slice(0, 20) || 'Anonymous';

        players.set(socket.id, {
            id: socket.id,
            name: playerName,
            score: 0
        });

        console.log(`Người chơi "${playerName}" (${socket.id}) đã tham gia phòng.`);

        socket.emit('joined', {
            id: socket.id,
            name: playerName
        });

        broadcastScoreboard();
    });

    // Khi người chơi cập nhật điểm
    socket.on('updateScore', (score) => {
        const player = players.get(socket.id);
        if (player) {
            const numericScore = typeof score === 'number' ? score : (parseInt(score, 10) || 0);
            player.score = numericScore;
            broadcastScoreboard();
        }
    });

    // Khi người chơi ngắt kết nối
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`Người chơi "${player.name}" (${socket.id}) đã rời phòng.`);
            players.delete(socket.id);
            broadcastScoreboard();
        } else {
            console.log(`Socket ngắt kết nối: ${socket.id}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});