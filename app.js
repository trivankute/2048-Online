document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const API_URL = isLocal ? 'http://localhost:3000' : 'https://two048-online-quo3.onrender.com'; // Thay bằng URL server thực tế khi deploy

    const socket = io('https://two048-online-quo3.onrender.com'); // Trỏ về server Express
    const opponentScoreDisplay = document.querySelector('#opponent-score');

    // 1. Khi ghép được phòng
    socket.on('gameStart', (data) => {
        opponentScoreDisplay.innerHTML = '0';
        alert('Đã ghép trận thành công! Bắt đầu chơi nào!');
    });

    // 2. Nhận điểm mới từ đối thủ và hiển thị
    socket.on('opponentScoreUpdate', (opponentScore) => {
        opponentScoreDisplay.innerHTML = opponentScore;
    });

    // 3. Đối thủ rời trận
    socket.on('opponentLeft', (message) => {
        alert(message);
        opponentScoreDisplay.innerHTML = '-1';
        // reload the page to find a new opponent
        location.reload();
    });


    // // 1. Khi ghép được phòng
    // socket.on('gameStart', (data) => {
    //     opponentScoreDisplay.innerHTML = '0';
    //     console.log('Đã ghép trận thành công!');
    // });

    // // 2. Nhận điểm mới từ đối thủ và hiển thị
    // socket.on('opponentScoreUpdate', (opponentScore) => {
    //     opponentScoreDisplay.innerHTML = opponentScore;
    // });

    // // 3. Đối thủ rời trận
    // socket.on('opponentLeft', (message) => {
    //     alert(message);
    //     opponentScoreDisplay.innerHTML = '-1';
    // });

    // // 4. Gửi điểm của mình đi (đặt dòng này ở chỗ bạn tăng điểm 'score' trong JS hiện tại)
    // // Ví dụ: bên trong 4 hàm combine:
    // function sendScore() {
    //     socket.emit('updateScore', score);
    // }

    const gridDisplay = document.querySelector('.grid')
    const scoreDisplay = document.querySelector('#score')
    const resultDisplay = document.querySelector('#result')
    const width = 4;
    let squares = [];
    let score = 0;

    
    function sendScore() {
        socket.emit('updateScore', score);
    }

    // Hiệu ứng khi ô mới xuất hiện (phóng to nhẹ từ tâm)
    function animateNew(element) {
        element.animate([
            { transform: 'scale(0.2)', opacity: 0 },
            { transform: 'scale(1)', opacity: 1 }
        ], {
            duration: 200,
            easing: 'ease-out'
        });
    }

    // Hiệu ứng khi 2 ô gộp lại (nảy lên và chớp màu)
    function animateMerge(element) {
        element.animate([
            { transform: 'scale(1)', background: 'transparent' },
            { transform: 'scale(1.25)', background: '#edc22e' },
            { transform: 'scale(1)', background: 'transparent' }
        ], {
            duration: 200,
            easing: 'ease-out'
        });
    }


    function createBoard() {
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div')
            square.innerHTML = "";
            gridDisplay.appendChild(square)
            squares.push(square)
        }
        // helo
        // hé nhô
        generate();
        generate();
    }
    createBoard();

    function combineRowLeft() {
        for (let i = 0; i < width * width; i++) {
            // Skip the last column so we never merge across row boundaries (e.g. 3 and 4).
            if (i % width === width - 1) continue;

            const currentValue = parseInt(squares[i].innerHTML);
            const nextValue = parseInt(squares[i + 1].innerHTML);

            if (currentValue !== 0 && currentValue === nextValue) {
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
            // Skip the last column so we never merge across row boundaries (e.g. 3 and 4).
            if (i % width === width - 1) continue;

            const currentValue = parseInt(squares[i].innerHTML);
            const nextValue = parseInt(squares[i + 1].innerHTML);

            if (currentValue !== 0 && currentValue === nextValue) {
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
            const currentValue = parseInt(squares[i].innerHTML);
            const nextValue = parseInt(squares[i + width].innerHTML);
            if (currentValue !== 0 && currentValue === nextValue) {
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
            const currentValue = parseInt(squares[i].innerHTML);
            const nextValue = parseInt(squares[i + width].innerHTML);
            if (currentValue !== 0 && currentValue === nextValue) {
                let combinedTotal = currentValue + nextValue;
                squares[i].innerHTML = combinedTotal;
                squares[i + width].innerHTML = "";
                animateMerge(squares[i]);
                score += combinedTotal;
                scoreDisplay.innerHTML = score;
            }
        }
    }

    // generate a number randomly
    function generate() {
        let emptySquares = squares.filter(square => square.innerHTML == 0);
        const randomNumber = Math.floor(Math.random() * emptySquares.length)
        if (emptySquares.length > 0) {
            emptySquares[randomNumber].innerHTML = 2;
            animateNew(emptySquares[randomNumber]);

        } else {
            resultDisplay.innerHTML = 'Game Over';
        }
    }

    function moveRight() {
        for (let i = 0; i < 16; i++) {
            if (i % 4 === 0) {
                let totalOne = squares[i].innerHTML;
                let totalTwo = squares[i + 1].innerHTML;
                let totalThree = squares[i + 2].innerHTML;
                let totalFour = squares[i + 3].innerHTML;
                let row = [parseInt(totalOne), parseInt(totalTwo), parseInt(totalThree), parseInt(totalFour)];
                let filteredRow = row.filter(num => num);
                let missing = 4 - filteredRow.length;
                let zeros = Array(missing).fill("");
                let newRow = zeros.concat(filteredRow);
                squares[i].innerHTML = newRow[0];
                squares[i + 1].innerHTML = newRow[1];
                squares[i + 2].innerHTML = newRow[2];
                squares[i + 3].innerHTML = newRow[3];
            }
        }
    }

    function moveLeft() {
        for (let i = 0; i < 16; i++) {
            if (i % 4 === 0) {
                let totalOne = squares[i].innerHTML;
                let totalTwo = squares[i + 1].innerHTML;
                let totalThree = squares[i + 2].innerHTML;
                let totalFour = squares[i + 3].innerHTML;
                let row = [parseInt(totalOne), parseInt(totalTwo), parseInt(totalThree), parseInt(totalFour)];
                let filteredRow = row.filter(num => num);
                let missing = 4 - filteredRow.length;
                let zeros = Array(missing).fill("");
                let newRow = filteredRow.concat(zeros);
                squares[i].innerHTML = newRow[0];
                squares[i + 1].innerHTML = newRow[1];
                squares[i + 2].innerHTML = newRow[2];
                squares[i + 3].innerHTML = newRow[3];
            }
        }
    }

    function moveUp() {
        for (let i = 0; i < 4; i++) {
            let totalOne = squares[i].innerHTML;
            let totalTwo = squares[i + width].innerHTML;
            let totalThree = squares[i + (width * 2)].innerHTML;
            let totalFour = squares[i + (width * 3)].innerHTML;
            let column = [parseInt(totalOne), parseInt(totalTwo), parseInt(totalThree), parseInt(totalFour)];
            let filteredColumn = column.filter(num => num);
            let missing = 4 - filteredColumn.length;
            let zeros = Array(missing).fill("");
            let newColumn = filteredColumn.concat(zeros);
            squares[i].innerHTML = newColumn[0];
            squares[i + width].innerHTML = newColumn[1];
            squares[i + (width * 2)].innerHTML = newColumn[2];
            squares[i + (width * 3)].innerHTML = newColumn[3];
        }
    }

    function moveDown() {
        for (let i = 0; i < 4; i++) {
            let totalOne = squares[i].innerHTML;
            let totalTwo = squares[i + width].innerHTML;
            let totalThree = squares[i + (width * 2)].innerHTML;
            let totalFour = squares[i + (width * 3)].innerHTML;
            let column = [parseInt(totalOne), parseInt(totalTwo), parseInt(totalThree), parseInt(totalFour)];
            let filteredColumn = column.filter(num => num);
            let missing = 4 - filteredColumn.length;
            let zeros = Array(missing).fill("");
            let newColumn = zeros.concat(filteredColumn);
            squares[i].innerHTML = newColumn[0];
            squares[i + width].innerHTML = newColumn[1];
            squares[i + (width * 2)].innerHTML = newColumn[2];
            squares[i + (width * 3)].innerHTML = newColumn[3];
        }
    }

    function control(e) {
        if (e.key === 'ArrowRight') {
            keyRight();
            combineRowRight();
            moveRight();
            generate();
        } else if (e.key === 'ArrowLeft') {
            keyLeft();
            combineRowLeft();
            moveLeft();
            generate();
        } else if (e.key === 'ArrowUp') {
            keyUp();
            combineColumnUp();
            moveUp();
            generate();
        } else if (e.key === 'ArrowDown') {
            keyDown();
            combineColumnDown();
            moveDown();
            generate();
        }
    }
    document.addEventListener('keyup', control);

    function keyRight() {
        moveRight();
    }

    function keyLeft() {
        moveLeft();
    }

    function keyUp() {
        moveUp();
    }

    function keyDown() {
        moveDown();
    }

    // check for win
    function checkForWin() {
        for (let i = 0; i < squares.length; i++) {
            if (squares[i].innerHTML == 2048) {
                resultDisplay.innerHTML = 'You Win!';
                document.removeEventListener('keyup', control);
            }
        }
    }




})