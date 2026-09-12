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
// Phục vụ các file tĩnh (index.html, style.css, script.js...)
app.use(express.static(path.join(__dirname, 'public'))); 
// Nếu file index.html nằm ngay ngoài thư mục gốc, đổi thành: app.use(express.static(__dirname));

let waitingPlayer = null; // Biến tạm lưu người chơi đang chờ ghép cặp

io.on('connection', (socket) => {
    console.log(`Người chơi kết nối: ${socket.id}`);

    // Logic ghép phòng tự động 2 người
    if (waitingPlayer) {
        const roomId = `room_${waitingPlayer.id}_${socket.id}`;
        
        // Cả 2 người cùng vào phòng
        socket.join(roomId);
        waitingPlayer.join(roomId);

        // Lưu roomId vào instance của socket để dùng sau
        socket.roomId = roomId;
        waitingPlayer.roomId = roomId;

        // Thông báo trận đấu bắt đầu
        io.to(roomId).emit('gameStart', { roomId });
        console.log(`Phòng ${roomId} đã bắt đầu với 2 người chơi.`);

        waitingPlayer = null; // Reset hàng chờ
    } else {
        waitingPlayer = socket;
        socket.emit('waiting', 'Đang chờ đối thủ tham gia...');
    }

    // Nhận điểm số từ 1 client và gửi sang cho đối thủ
    socket.on('updateScore', (score) => {
        if (socket.roomId) {
            // socket.to(roomId) chỉ gửi cho đối thủ trong cùng room, không gửi lại chính mình
            socket.to(socket.roomId).emit('opponentScoreUpdate', score);
        }
    });

    // Xử lý khi có người ngắt kết nối
    socket.on('disconnect', () => {
        console.log(`Người chơi ngắt kết nối: ${socket.id}`);
        
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }

        if (socket.roomId) {
            socket.to(socket.roomId).emit('opponentLeft', 'Đối thủ đã thoát phòng!');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});