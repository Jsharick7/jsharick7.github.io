const gameTiles = document.querySelectorAll('.game-tile');
const gameFocus = document.getElementById('game-focus');
const gameTitle = document.getElementById('game-title');
const pongCanvas = document.getElementById('pongCanvas');
const gameInstructions = document.getElementById('game-instructions');
const comingSoon = document.getElementById('coming-soon');
const closeFocus = document.getElementById('close-focus');
const backendUrl = 'http://localhost:3000';  // Update with your Heroku URL

// Pong game logic
function drawPong(state) {
    const ctx = pongCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, pongCanvas.width, pongCanvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, state.paddles.left, 20, 100);
    ctx.fillRect(pongCanvas.width - 30, state.paddles.right, 20, 100);
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '30px Arial';
    ctx.fillText(state.scores.left, 100, 50);
    ctx.fillText(state.scores.right, pongCanvas.width - 100, 50);
}

function updatePong() {
    fetch(`${backendUrl}/api/pong/state`)
        .then(res => res.json())
        .then(state => {
            drawPong(state);
            if (!gameFocus.classList.contains('hidden')) requestAnimationFrame(updatePong);
        });
}

// Paddle controls
document.addEventListener('keydown', (e) => {
    if (gameFocus.classList.contains('hidden')) return;
    let side, y;
    if (e.key === 'w') { side = 'left'; y = -20; }
    else if (e.key === 's') { side = 'left'; y = 20; }
    else if (e.key === 'ArrowUp') { side = 'right'; y = -20; }
    else if (e.key === 'ArrowDown') { side = 'right'; y = 20; }

    if (side) {
        fetch(`${backendUrl}/api/pong/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side, y: y + (side === 'left' ? state.paddles.left : state.paddles.right) })
        });
    }
});

// Handle game tile clicks
gameTiles.forEach(tile => {
    tile.addEventListener('click', () => {
        const game = tile.dataset.game;
        gameTitle.textContent = tile.querySelector('h3').textContent;
        gameFocus.classList.remove('hidden');

        // Reset visibility
        pongCanvas.classList.add('hidden');
        gameInstructions.classList.add('hidden');
        comingSoon.classList.add('hidden');

        if (game === 'pong') {
            pongCanvas.classList.remove('hidden');
            gameInstructions.classList.remove('hidden');
            updatePong();
        } else {
            comingSoon.classList.remove('hidden');
        }
    });
});

// Close focus view
closeFocus.addEventListener('click', () => {
    gameFocus.classList.add('hidden');
});

let state = { paddles: { left: 300, right: 300 } }; // Initial state