document.addEventListener('DOMContentLoaded', () => {
    // 1. Cấu hình kết nối Socket.io (hỗ trợ cả chạy qua Express port 3000 và Live Server 5500)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const socketUrl = isLocal
        ? (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000')
        : 'https://trivankute.github.io/2048-Online/';

    const socket = io(socketUrl);

    // 2. DOM Elements liên quan đến Modal, Tên & Bảng xếp hạng
    const nameModal = document.querySelector('#name-modal');
    const nameForm = document.querySelector('#name-form');
    const nameInput = document.querySelector('#name-input');
    const playerNameTitle = document.querySelector('#player-name-title');

    const scoreboardList = document.querySelector('#scoreboard-list');
    const onlineCountDisplay = document.querySelector('#online-count');
    const bestScoreDisplay = document.querySelector('#best-score');

    const restartBtn = document.querySelector('#restart-btn');
    const retryBtn = document.querySelector('#retry-btn');
    const gameMessage = document.querySelector('#game-message');
    const gameMessageText = document.querySelector('#game-message-text');

    // 3. Trạng thái người chơi
    let hasJoined = false;
    let myPlayerName = localStorage.getItem('2048_player_name') || '';

    if (myPlayerName) {
        nameInput.value = myPlayerName;
    }

    // Xử lý gửi tên khi bấm Play
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredName = nameInput.value.trim();
        if (!enteredName) return;

        myPlayerName = enteredName;
        localStorage.setItem('2048_player_name', myPlayerName);
        playerNameTitle.textContent = myPlayerName;
        playerNameTitle.title = myPlayerName;

        nameModal.classList.add('hidden');
        hasJoined = true;

        socket.emit('join', { name: myPlayerName });
        sendScore();
    });

    // Re-join khi socket kết nối lại
    socket.on('connect', () => {
        if (hasJoined && myPlayerName) {
            socket.emit('join', { name: myPlayerName });
            sendScore();
        }
    });

    // Cập nhật bảng xếp hạng thời gian thực từ server
    socket.on('scoreboardUpdate', (data) => {
        const players = data.players || [];
        const onlineCount = data.onlineCount || players.length;

        if (onlineCountDisplay) {
            onlineCountDisplay.textContent = `🟢 ${onlineCount} online`;
        }

        if (players.length > 0 && bestScoreDisplay) {
            const topScore = Math.max(...players.map(p => p.score));
            bestScoreDisplay.textContent = topScore;
        }

        renderScoreboard(players);
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderScoreboard(players) {
        if (!scoreboardList) return;
        if (!players || players.length === 0) {
            scoreboardList.innerHTML = '<div class="empty-scoreboard">Waiting for players...</div>';
            return;
        }

        scoreboardList.innerHTML = '';
        players.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'scoreboard-row';
            const isMe = player.id === socket.id;
            if (isMe) {
                row.classList.add('is-current-user');
            }

            let rankHtml = `#${index + 1}`;
            if (index === 0) rankHtml = '<span class="rank-gold">🥇 1</span>';
            else if (index === 1) rankHtml = '<span class="rank-silver">🥈 2</span>';
            else if (index === 2) rankHtml = '<span class="rank-bronze">🥉 3</span>';

            row.innerHTML = `
                <span class="col-rank">${rankHtml}</span>
                <span class="col-name">
                    ${escapeHtml(player.name)}
                    ${isMe ? '<span class="you-badge">YOU</span>' : ''}
                </span>
                <span class="col-score">${player.score}</span>
            `;

            scoreboardList.appendChild(row);
        });
    }

    const gridDisplay = document.querySelector('.grid');
    const scoreDisplay = document.querySelector('#score');
    const width = 4;
    let squares = [];
    let score = 0;
    let isGameOver = false;
    let hasWon = false;

    function sendScore() {
        if (socket && socket.connected && hasJoined) {
            socket.emit('updateScore', score);
        }
    }

    // Hiệu ứng khi ô mới xuất hiện (phóng to nhẹ từ tâm)
    function animateNew(element) {
        element.animate([
            { transform: 'scale(0.2)', opacity: 0 },
            { transform: 'scale(1)', opacity: 1 }
        ], {
            duration: 180,
            easing: 'ease-out'
        });
    }

    // Hiệu ứng khi 2 ô gộp lại
    function animateMerge(element) {
        element.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.22)' },
            { transform: 'scale(1)' }
        ], {
            duration: 180,
            easing: 'ease-out'
        });
    }

    // Cập nhật class màu sắc cho các ô 2048
    function updateSquareStyles() {
        squares.forEach(square => {
            const val = parseInt(square.innerHTML, 10) || 0;
            square.className = '';
            if (val > 0) {
                square.classList.add(val <= 2048 ? `tile-${val}` : 'tile-super');
            }
        });
    }

    function createBoard() {
        gridDisplay.innerHTML = '';
        squares = [];
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div');
            square.innerHTML = "";
            gridDisplay.appendChild(square);
            squares.push(square);
        }
        generate();
        generate();
        updateSquareStyles();
    }
    createBoard();

    // Sinh số ngẫu nhiên vào ô trống (90% số 2, 10% số 4)
    function generate() {
        let emptySquares = squares.filter(square => !square.innerHTML || square.innerHTML === "0" || square.innerHTML === "");
        if (emptySquares.length > 0) {
            const randomNumber = Math.floor(Math.random() * emptySquares.length);
            const chosenVal = Math.random() > 0.1 ? 2 : 4;
            emptySquares[randomNumber].innerHTML = chosenVal;
            animateNew(emptySquares[randomNumber]);
        }
    }

    function combineRowLeft() {
        for (let i = 0; i < width * width; i++) {
            if (i % width === width - 1) continue;

            const currentValue = parseInt(squares[i].innerHTML, 10);
            const nextValue = parseInt(squares[i + 1].innerHTML, 10);

            if (currentValue && currentValue === nextValue) {
                let combinedTotal = currentValue + nextValue;
                squares[i].innerHTML = combinedTotal;
                squares[i + 1].innerHTML = "";
                animateMerge(squares[i]);
                score += combinedTotal;
                sendScore();
                scoreDisplay.innerHTML = score;
            }
        }
    }

    function combineRowRight() {
        for (let i = width * width - 2; i >= 0; i--) {
            if (i % width === width - 1) continue;

            const currentValue = parseInt(squares[i].innerHTML, 10);
            const nextValue = parseInt(squares[i + 1].innerHTML, 10);

            if (currentValue && currentValue === nextValue) {
                let combinedTotal = currentValue + nextValue;
                squares[i].innerHTML = combinedTotal;
                squares[i + 1].innerHTML = "";
                animateMerge(squares[i]);
                score += combinedTotal;
                sendScore();
                scoreDisplay.innerHTML = score;
            }
        }
    }

    function combineColumnUp() {
        for (let i = 0; i < width * (width - 1); i++) {
            const currentValue = parseInt(squares[i].innerHTML, 10);
            const nextValue = parseInt(squares[i + width].innerHTML, 10);
            if (currentValue && currentValue === nextValue) {
                let combinedTotal = currentValue + nextValue;
                squares[i].innerHTML = combinedTotal;
                squares[i + width].innerHTML = "";
                animateMerge(squares[i]);
                score += combinedTotal;
                sendScore();
                scoreDisplay.innerHTML = score;
            }
        }
    }

    function combineColumnDown() {
        for (let i = width * (width - 1) - 1; i >= 0; i--) {
            const currentValue = parseInt(squares[i].innerHTML, 10);
            const nextValue = parseInt(squares[i + width].innerHTML, 10);
            if (currentValue && currentValue === nextValue) {
                let combinedTotal = currentValue + nextValue;
                squares[i].innerHTML = combinedTotal;
                squares[i + width].innerHTML = "";
                animateMerge(squares[i]);
                score += combinedTotal;
                sendScore(); // Đã bổ sung cập nhật và gửi điểm cho cột xuống
                scoreDisplay.innerHTML = score;
            }
        }
    }

    function moveRight() {
        for (let i = 0; i < 16; i += 4) {
            let row = [
                parseInt(squares[i].innerHTML, 10) || 0,
                parseInt(squares[i + 1].innerHTML, 10) || 0,
                parseInt(squares[i + 2].innerHTML, 10) || 0,
                parseInt(squares[i + 3].innerHTML, 10) || 0
            ];
            let filteredRow = row.filter(num => num);
            let missing = 4 - filteredRow.length;
            let zeros = Array(missing).fill("");
            let newRow = zeros.concat(filteredRow);
            squares[i].innerHTML = newRow[0] || "";
            squares[i + 1].innerHTML = newRow[1] || "";
            squares[i + 2].innerHTML = newRow[2] || "";
            squares[i + 3].innerHTML = newRow[3] || "";
        }
    }

    function moveLeft() {
        for (let i = 0; i < 16; i += 4) {
            let row = [
                parseInt(squares[i].innerHTML, 10) || 0,
                parseInt(squares[i + 1].innerHTML, 10) || 0,
                parseInt(squares[i + 2].innerHTML, 10) || 0,
                parseInt(squares[i + 3].innerHTML, 10) || 0
            ];
            let filteredRow = row.filter(num => num);
            let missing = 4 - filteredRow.length;
            let zeros = Array(missing).fill("");
            let newRow = filteredRow.concat(zeros);
            squares[i].innerHTML = newRow[0] || "";
            squares[i + 1].innerHTML = newRow[1] || "";
            squares[i + 2].innerHTML = newRow[2] || "";
            squares[i + 3].innerHTML = newRow[3] || "";
        }
    }

    function moveUp() {
        for (let i = 0; i < 4; i++) {
            let column = [
                parseInt(squares[i].innerHTML, 10) || 0,
                parseInt(squares[i + width].innerHTML, 10) || 0,
                parseInt(squares[i + (width * 2)].innerHTML, 10) || 0,
                parseInt(squares[i + (width * 3)].innerHTML, 10) || 0
            ];
            let filteredColumn = column.filter(num => num);
            let missing = 4 - filteredColumn.length;
            let zeros = Array(missing).fill("");
            let newColumn = filteredColumn.concat(zeros);
            squares[i].innerHTML = newColumn[0] || "";
            squares[i + width].innerHTML = newColumn[1] || "";
            squares[i + (width * 2)].innerHTML = newColumn[2] || "";
            squares[i + (width * 3)].innerHTML = newColumn[3] || "";
        }
    }

    function moveDown() {
        for (let i = 0; i < 4; i++) {
            let column = [
                parseInt(squares[i].innerHTML, 10) || 0,
                parseInt(squares[i + width].innerHTML, 10) || 0,
                parseInt(squares[i + (width * 2)].innerHTML, 10) || 0,
                parseInt(squares[i + (width * 3)].innerHTML, 10) || 0
            ];
            let filteredColumn = column.filter(num => num);
            let missing = 4 - filteredColumn.length;
            let zeros = Array(missing).fill("");
            let newColumn = zeros.concat(filteredColumn);
            squares[i].innerHTML = newColumn[0] || "";
            squares[i + width].innerHTML = newColumn[1] || "";
            squares[i + (width * 2)].innerHTML = newColumn[2] || "";
            squares[i + (width * 3)].innerHTML = newColumn[3] || "";
        }
    }

    function control(e) {
        if (!hasJoined || isGameOver) return;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        if (e.key === 'ArrowRight') {
            moveRight();
            combineRowRight();
            moveRight();
            generate();
        } else if (e.key === 'ArrowLeft') {
            moveLeft();
            combineRowLeft();
            moveLeft();
            generate();
        } else if (e.key === 'ArrowUp') {
            moveUp();
            combineColumnUp();
            moveUp();
            generate();
        } else if (e.key === 'ArrowDown') {
            moveDown();
            combineColumnDown();
            moveDown();
            generate();
        }

        updateSquareStyles();
        checkForWin();
        checkGameOver();
    }
    document.addEventListener('keydown', control);

    function checkForWin() {
        if (hasWon) return;
        for (let i = 0; i < squares.length; i++) {
            if (squares[i].innerHTML == 2048) {
                hasWon = true;
                if (gameMessage && gameMessageText) {
                    gameMessageText.textContent = 'You Win!';
                    gameMessage.classList.add('game-won');
                    gameMessage.style.display = 'flex';
                }
                break;
            }
        }
    }

    function checkGameOver() {
        const hasEmpty = squares.some(sq => !sq.innerHTML || sq.innerHTML === "0" || sq.innerHTML === "");
        if (hasEmpty) return;

        // Kiểm tra gộp hàng ngang
        for (let i = 0; i < width * width; i++) {
            if (i % width !== width - 1) {
                if (squares[i].innerHTML === squares[i + 1].innerHTML) return;
            }
        }
        // Kiểm tra gộp hàng dọc
        for (let i = 0; i < width * (width - 1); i++) {
            if (squares[i].innerHTML === squares[i + width].innerHTML) return;
        }

        // Nếu không còn ô trống và không gộp được ô nào -> Game Over
        isGameOver = true;
        if (gameMessage && gameMessageText) {
            gameMessageText.textContent = 'Game Over!';
            gameMessage.classList.remove('game-won');
            gameMessage.style.display = 'flex';
        }
    }

    function resetGame() {
        score = 0;
        scoreDisplay.innerHTML = '0';
        isGameOver = false;
        hasWon = false;
        if (gameMessage) {
            gameMessage.style.display = 'none';
            gameMessage.classList.remove('game-won');
        }
        createBoard();
        sendScore();
    }

    if (restartBtn) restartBtn.addEventListener('click', resetGame);
    if (retryBtn) retryBtn.addEventListener('click', resetGame);
});