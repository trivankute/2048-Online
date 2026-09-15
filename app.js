document.addEventListener('DOMContentLoaded', () => {
    // ===== 1. Socket Configuration =====
    const SERVER_URL = process.env.SERVER_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const socketUrl = isLocal
        ? (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000')
        : SERVER_URL;
    const socket = io("https://two048-online-quo3.onrender.com");

    // ===== 2. DOM Elements =====
    const nameModal = document.querySelector('#name-modal');
    const nameForm = document.querySelector('#name-form');
    const nameInput = document.querySelector('#name-input');
    const playerNameTitle = document.querySelector('#player-name-title');
    const gridDisplay = document.querySelector('.grid');
    const gridWrapper = document.querySelector('.grid-wrapper');
    const scoreDisplay = document.querySelector('#score');
    const bestScoreDisplay = document.querySelector('#best-score');
    const restartBtn = document.querySelector('#restart-btn');
    const retryBtn = document.querySelector('#retry-btn');
    const gameMessage = document.querySelector('#game-message');
    const gameMessageText = document.querySelector('#game-message-text');
    const scoreboardList = document.querySelector('#scoreboard-list');
    const onlineCountDisplay = document.querySelector('#online-count');

    // ===== 3. Player State =====
    let hasJoined = false;
    let myPlayerName = localStorage.getItem('2048_player_name') || '';
    if (myPlayerName) nameInput.value = myPlayerName;

    // ===== 4. Name Form Handler =====
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        myPlayerName = name;
        localStorage.setItem('2048_player_name', myPlayerName);
        playerNameTitle.textContent = myPlayerName;
        playerNameTitle.title = myPlayerName;
        nameModal.classList.add('hidden');
        hasJoined = true;
        socket.emit('join', { name: myPlayerName });
        sendScoreNow();
    });

    // ===== 5. Socket Reconnection =====
    socket.on('connect', () => {
        if (hasJoined && myPlayerName) {
            socket.emit('join', { name: myPlayerName });
            sendScoreNow();
        }
    });

    // ===== 6. Scoreboard Updates =====
    socket.on('scoreboardUpdate', (data) => {
        const players = data.players || [];
        const onlineCount = data.onlineCount || players.length;
        if (onlineCountDisplay) onlineCountDisplay.textContent = `🟢 ${onlineCount} online`;
        if (players.length > 0 && bestScoreDisplay) {
            bestScoreDisplay.textContent = Math.max(...players.map(p => p.score));
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
            if (isMe) row.classList.add('is-current-user');

            let rankHtml = `#${index + 1}`;
            if (index === 0) rankHtml = '<span class="rank-gold">🥇 1</span>';
            else if (index === 1) rankHtml = '<span class="rank-silver">🥈 2</span>';
            else if (index === 2) rankHtml = '<span class="rank-bronze">🥉 3</span>';

            row.innerHTML = `
                <span class="col-rank">${rankHtml}</span>
                <span class="col-name">${escapeHtml(player.name)}${isMe ? '<span class="you-badge">YOU</span>' : ''}</span>
                <span class="col-score">${player.score}</span>
            `;
            scoreboardList.appendChild(row);
        });
    }

    // ===== 7. Game State =====
    const WIDTH = 4;
    let squares = [];
    let score = 0;
    let isGameOver = false;

    // ===== 8. Score Sync (Throttled for server performance) =====
    let lastSentScore = -1;
    let sendScoreTimer = null;

    function sendScore() {
        if (!socket || !socket.connected || !hasJoined) return;
        if (score === lastSentScore) return;
        clearTimeout(sendScoreTimer);
        sendScoreTimer = setTimeout(() => {
            lastSentScore = score;
            socket.emit('updateScore', score);
        }, 150);
    }

    function sendScoreNow() {
        if (!socket || !socket.connected || !hasJoined) return;
        clearTimeout(sendScoreTimer);
        lastSentScore = score;
        socket.emit('updateScore', score);
    }

    // ===== 9. Core 2048 Algorithm =====
    // slideAndMerge: the single correct algorithm for one row/column.
    // Input: array of 4 values ordered FROM the wall side.
    // It slides toward index 0 (the wall) and merges pairs from the wall side.
    // Returns { line, gained, mergedIndices }
    function slideAndMerge(line) {
        // 1. Remove zeros → slide toward wall
        let filtered = line.filter(x => x > 0);

        // 2. Merge adjacent pairs from the wall side (each tile merges at most once)
        let result = [];
        let mergedIndices = [];
        let gained = 0;
        let i = 0;
        while (i < filtered.length) {
            if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
                const merged = filtered[i] * 2;
                mergedIndices.push(result.length); // track which output position was a merge
                result.push(merged);
                gained += merged;
                i += 2; // skip both tiles
            } else {
                result.push(filtered[i]);
                i++;
            }
        }

        // 3. Pad with zeros
        while (result.length < WIDTH) result.push(0);

        return { line: result, gained, mergedIndices };
    }

    function getValues() {
        return squares.map(sq => parseInt(sq.innerHTML, 10) || 0);
    }

    function setValues(values) {
        for (let i = 0; i < squares.length; i++) {
            squares[i].innerHTML = values[i] > 0 ? values[i] : '';
        }
    }

    function arraysEqual(a, b) {
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    // doMove: execute a move in the given direction.
    // Returns true if the board changed (only then should we generate a new tile).
    function doMove(direction) {
        const before = getValues();
        const after = before.slice();
        let totalGained = 0;
        const mergedCells = new Set();

        if (direction === 'left') {
            for (let row = 0; row < WIDTH; row++) {
                const start = row * WIDTH;
                const positions = [start, start + 1, start + 2, start + 3];
                const line = positions.map(p => after[p]);
                const { line: result, gained, mergedIndices } = slideAndMerge(line);
                positions.forEach((p, i) => { after[p] = result[i]; });
                mergedIndices.forEach(mi => mergedCells.add(positions[mi]));
                totalGained += gained;
            }
        } else if (direction === 'right') {
            for (let row = 0; row < WIDTH; row++) {
                const start = row * WIDTH;
                // Extract right-to-left (wall is on the right)
                const positions = [start + 3, start + 2, start + 1, start];
                const line = positions.map(p => after[p]);
                const { line: result, gained, mergedIndices } = slideAndMerge(line);
                positions.forEach((p, i) => { after[p] = result[i]; });
                mergedIndices.forEach(mi => mergedCells.add(positions[mi]));
                totalGained += gained;
            }
        } else if (direction === 'up') {
            for (let col = 0; col < WIDTH; col++) {
                const positions = [col, col + WIDTH, col + WIDTH * 2, col + WIDTH * 3];
                const line = positions.map(p => after[p]);
                const { line: result, gained, mergedIndices } = slideAndMerge(line);
                positions.forEach((p, i) => { after[p] = result[i]; });
                mergedIndices.forEach(mi => mergedCells.add(positions[mi]));
                totalGained += gained;
            }
        } else if (direction === 'down') {
            for (let col = 0; col < WIDTH; col++) {
                // Extract bottom-to-top (wall is on the bottom)
                const positions = [col + WIDTH * 3, col + WIDTH * 2, col + WIDTH, col];
                const line = positions.map(p => after[p]);
                const { line: result, gained, mergedIndices } = slideAndMerge(line);
                positions.forEach((p, i) => { after[p] = result[i]; });
                mergedIndices.forEach(mi => mergedCells.add(positions[mi]));
                totalGained += gained;
            }
        }

        // Only generate a new tile if the board actually changed
        const changed = !arraysEqual(before, after);
        if (changed) {
            setValues(after);
            score += totalGained;
            scoreDisplay.innerHTML = score;
            mergedCells.forEach(idx => animateMerge(squares[idx]));
            generate();
            updateSquareStyles();
            sendScore();
            checkGameOver();
        }
        return changed;
    }

    // ===== 10. Animations =====
    function animateNew(element) {
        element.animate([
            { transform: 'scale(0)', opacity: 0 },
            { transform: 'scale(1)', opacity: 1 }
        ], { duration: 150, easing: 'ease-out' });
    }

    function animateMerge(element) {
        element.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.18)' },
            { transform: 'scale(1)' }
        ], { duration: 150, easing: 'ease-out' });
    }

    // ===== 11. Tile Styles =====
    function updateSquareStyles() {
        squares.forEach(sq => {
            const val = parseInt(sq.innerHTML, 10) || 0;
            sq.className = '';
            if (val > 0) {
                sq.classList.add(val <= 8192 ? `tile-${val}` : 'tile-super');
            }
        });
    }

    // ===== 12. Board Setup =====
    function createBoard() {
        gridDisplay.innerHTML = '';
        squares = [];
        for (let i = 0; i < WIDTH * WIDTH; i++) {
            const sq = document.createElement('div');
            sq.innerHTML = '';
            gridDisplay.appendChild(sq);
            squares.push(sq);
        }
        generate();
        generate();
        updateSquareStyles();
    }
    createBoard();

    function generate() {
        const values = getValues();
        const emptyIndices = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i] === 0) emptyIndices.push(i);
        }
        if (emptyIndices.length > 0) {
            const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            const val = Math.random() < 0.9 ? 2 : 4;
            squares[idx].innerHTML = val;
            animateNew(squares[idx]);
        }
    }

    // ===== 13. Keyboard Controls (Arrows + WASD) =====
    const KEY_MAP = {
        'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down',
        'a': 'left', 'd': 'right', 'w': 'up', 's': 'down',
        'A': 'left', 'D': 'right', 'W': 'up', 'S': 'down'
    };

    document.addEventListener('keydown', (e) => {
        if (!hasJoined || isGameOver) return;
        const direction = KEY_MAP[e.key];
        if (direction) {
            e.preventDefault();
            doMove(direction);
        }
    });

    // ===== 14. Touch / Swipe Controls (Phone, Tablet, Stylus) =====
    const swipeTarget = gridWrapper || gridDisplay;
    let touchStartX = 0, touchStartY = 0;
    const MIN_SWIPE = 30;

    swipeTarget.addEventListener('touchstart', (e) => {
        if (!hasJoined || isGameOver) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }, { passive: true });

    swipeTarget.addEventListener('touchmove', (e) => {
        e.preventDefault(); // prevent page scroll while swiping on the grid
    }, { passive: false });

    swipeTarget.addEventListener('touchend', (e) => {
        if (!hasJoined || isGameOver) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        handleSwipe(dx, dy);
    });

    function handleSwipe(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < MIN_SWIPE) return;
        if (absDx > absDy) {
            doMove(dx > 0 ? 'right' : 'left');
        } else {
            doMove(dy > 0 ? 'down' : 'up');
        }
    }

    // ===== 15. Game Over Check (NO win limit — game continues forever) =====
    function checkGameOver() {
        const vals = getValues();
        // Any empty cell? Not over.
        if (vals.some(v => v === 0)) return;
        // Any horizontal merge possible?
        for (let r = 0; r < WIDTH; r++) {
            for (let c = 0; c < WIDTH - 1; c++) {
                if (vals[r * WIDTH + c] === vals[r * WIDTH + c + 1]) return;
            }
        }
        // Any vertical merge possible?
        for (let r = 0; r < WIDTH - 1; r++) {
            for (let c = 0; c < WIDTH; c++) {
                if (vals[r * WIDTH + c] === vals[(r + 1) * WIDTH + c]) return;
            }
        }
        // No moves left → Game Over
        isGameOver = true;
        if (gameMessage && gameMessageText) {
            gameMessageText.textContent = 'Game Over!';
            gameMessage.classList.remove('game-won');
            gameMessage.style.display = 'flex';
        }
    }

    // ===== 16. Reset / New Game =====
    function resetGame() {
        score = 0;
        scoreDisplay.innerHTML = '0';
        isGameOver = false;
        if (gameMessage) {
            gameMessage.style.display = 'none';
            gameMessage.classList.remove('game-won');
        }
        createBoard();
        sendScoreNow();
    }

    if (restartBtn) restartBtn.addEventListener('click', resetGame);
    if (retryBtn) retryBtn.addEventListener('click', resetGame);
});