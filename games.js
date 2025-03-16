const gameTiles = document.querySelectorAll('.game-tile');
const gameFocus = document.getElementById('game-focus');
const gameTitle = document.getElementById('game-title');
const pongCanvas = document.getElementById('pongCanvas');
const gameInstructions = document.getElementById('game-instructions');
const comingSoon = document.getElementById('coming-soon');
const closeFocus = document.getElementById('close-focus');

const ctx = pongCanvas.getContext('2d');

// Pong game state
const pongState = {
    ball: { x: 400, y: 300, dx: 5, dy: -5, radius: 10 },
    paddles: { 
        left: { y: 300, width: 20, height: 100, health: 5, maxHealth: 5 }, 
        right: { y: 300, width: 20, height: 100, health: 5, maxHealth: 5 } 
    },
    lasers: [],
    powerUp: null,
    scores: { left: 0, right: 0 },
    width: 800,
    height: 600,
    roundPaused: false,
    roundStartTime: Date.now(),
    lastPowerUpTime: 0
};

let animationFrameId;

// Draw Pong
function drawPong() {
    ctx.fillStyle = '#1a1a2e'; // Space-like dark background
    ctx.fillRect(0, 0, pongState.width, pongState.height);

    // Draw paddles (if health > 0)
    ctx.fillStyle = pongState.paddles.left.health > 0 ? '#00d4ff' : 'rgba(0, 212, 255, 0.2)';
    ctx.fillRect(10, pongState.paddles.left.y, pongState.paddles.left.width, pongState.paddles.left.height);
    ctx.fillStyle = pongState.paddles.right.health > 0 ? '#ff007a' : 'rgba(255, 0, 122, 0.2)';
    ctx.fillRect(pongState.width - 30, pongState.paddles.right.y, pongState.paddles.right.width, pongState.paddles.right.height);

    // Draw ball
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pongState.ball.x, pongState.ball.y, pongState.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw lasers
    pongState.lasers.forEach(laser => {
        ctx.fillStyle = laser.double ? '#ffcc00' : '#00ffcc'; // Neon cyan or yellow for double
        ctx.fillRect(laser.x, laser.y, laser.width, 5);
    });

    // Draw power-up
    if (pongState.powerUp) {
        ctx.fillStyle = pongState.powerUp.type === 'health' ? '#00ff00' : pongState.powerUp.type === 'shield' ? '#00d4ff' : '#ff007a';
        ctx.beginPath();
        ctx.arc(pongState.powerUp.x, pongState.powerUp.y, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw health bars
    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 10, pongState.height - 40);
    ctx.fillText('AI', pongState.width - 60, pongState.height - 40);
    ctx.fillStyle = 'linear-gradient(90deg, #00d4ff, #00ffcc)'; // Cyan gradient
    ctx.fillRect(10, pongState.height - 30, (pongState.paddles.left.health / pongState.paddles.left.maxHealth) * 100, 20);
    ctx.fillStyle = 'linear-gradient(90deg, #ff007a, #ffcc00)'; // Pink-yellow gradient
    ctx.fillRect(pongState.width - 110, pongState.height - 30, (pongState.paddles.right.health / pongState.paddles.right.maxHealth) * 100, 20);

    // Draw scores
    ctx.fillStyle = '#fff';
    ctx.fillText(pongState.scores.left, 100, 50);
    ctx.fillText(pongState.scores.right, pongState.width - 100, 50);
}

// Update Pong logic
function updatePong() {
    if (pongState.roundPaused) {
        if (Date.now() - pongState.roundStartTime > 2000) { // 2-second pause
            pongState.roundPaused = false;
            resetRound();
        }
        drawPong();
        animationFrameId = requestAnimationFrame(updatePong);
        return;
    }

    const now = Date.now();
    const roundTime = (now - pongState.roundStartTime) / 1000; // Seconds

    // Ball movement
    pongState.ball.x += pongState.ball.dx;
    pongState.ball.y += pongState.ball.dy;

    // Ball collision with top/bottom
    if (pongState.ball.y - pongState.ball.radius <= 0 || pongState.ball.y + pongState.ball.radius >= pongState.height) {
        pongState.ball.dy *= -1;
    }

    // Ball collision with paddles
    if (
        pongState.paddles.left.health > 0 &&
        pongState.ball.x - pongState.ball.radius <= 30 && 
        pongState.ball.y >= pongState.paddles.left.y && 
        pongState.ball.y <= pongState.paddles.left.y + pongState.paddles.left.height
    ) {
        pongState.ball.dx *= -1;
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.width - 30 && 
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height
    ) {
        pongState.ball.dx *= -1;
    }

    // Ball out of bounds
    if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
    }

    // AI movement
    if (pongState.paddles.right.health > 0) {
        const aiTarget = pongState.ball.y - pongState.paddles.right.height / 2;
        pongState.paddles.right.y += (aiTarget - pongState.paddles.right.y) * 0.1; // Smooth AI tracking
        pongState.paddles.right.y = Math.max(0, Math.min(pongState.height - pongState.paddles.right.height, pongState.paddles.right.y));
    }

    // Laser movement and collision
    pongState.lasers = pongState.lasers.filter(laser => laser.x >= 0 && laser.x <= pongState.width);
    pongState.lasers.forEach(laser => {
        laser.x += laser.dx;
        if (laser.x >= pongState.width - 30 && 
            laser.y >= pongState.paddles.right.y && 
            laser.y <= pongState.paddles.right.y + pongState.paddles.right.height && 
            pongState.paddles.right.health > 0) {
            pongState.paddles.right.health -= laser.double ? 2 : 1;
            if (pongState.paddles.right.health <= 0) {
                pongState.roundPaused = true;
                pongState.roundStartTime = now;
            }
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
    });

    // Power-up logic
    if (roundTime > 10 && !pongState.powerUp && now - pongState.lastPowerUpTime > 20000) {
        spawnPowerUp();
    }
    if (pongState.powerUp && 
        pongState.ball.x >= pongState.powerUp.x - 15 && 
        pongState.ball.x <= pongState.powerUp.x + 15 && 
        pongState.ball.y >= pongState.powerUp.y - 15 && 
        pongState.ball.y <= pongState.powerUp.y + 15) {
        applyPowerUp();
    }

    drawPong();
    if (!gameFocus.classList.contains('hidden')) {
        animationFrameId = requestAnimationFrame(updatePong);
    }
}

function resetRound() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth;
    pongState.lasers = [];
    pongState.powerUp = null;
    pongState.roundStartTime = Date.now();
}

function spawnPowerUp() {
    const types = ['health', 'shield', 'double'];
    pongState.powerUp = {
        x: Math.random() * (pongState.width - 60) + 30,
        y: Math.random() * (pongState.height - 60) + 30,
        type: types[Math.floor(Math.random() * types.length)]
    };
    pongState.lastPowerUpTime = Date.now();
}

function applyPowerUp() {
    switch (pongState.powerUp.type) {
        case 'health':
            pongState.paddles.left.health = Math.min(pongState.paddles.left.maxHealth, pongState.paddles.left.health + 3);
            break;
        case 'shield':
            // Shield effect (visual only for now)
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'double':
            // Double lasers handled in shootLaser
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
    }
    if (pongState.powerUp.type !== 'shield' && pongState.powerUp.type !== 'double') pongState.powerUp = null;
}

function shootLaser() {
    const laser = {
        x: 30,
        y: pongState.paddles.left.y + pongState.paddles.left.height / 2,
        width: 20,
        dx: 10,
        double: pongState.powerUp && pongState.powerUp.type === 'double'
    };
    pongState.lasers.push(laser);
}

// Controls
document.addEventListener('keydown', (e) => {
    if (gameFocus.classList.contains('hidden')) return;
    const paddleSpeed = 20;
    if (e.key === 'w' && pongState.paddles.left.y > 0) {
        pongState.paddles.left.y -= paddleSpeed;
    } else if (e.key === 's' && pongState.paddles.left.y < pongState.height - pongState.paddles.left.height) {
        pongState.paddles.left.y += paddleSpeed;
    } else if (e.key === ' ') {
        shootLaser();
    }
});

// Handle game tile clicks
gameTiles.forEach(tile => {
    tile.addEventListener('click', () => {
        const game = tile.dataset.game;
        gameTitle.textContent = tile.querySelector('h3').textContent;
        gameFocus.classList.remove('hidden');

        pongCanvas.classList.add('hidden');
        gameInstructions.classList.add('hidden');
        comingSoon.classList.add('hidden');

        if (game === 'pong') {
            pongCanvas.classList.remove('hidden');
            gameInstructions.classList.remove('hidden');
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            resetRound();
            updatePong();
        } else {
            comingSoon.classList.remove('hidden');
        }
    });
});

// Close focus view
closeFocus.addEventListener('click', () => {
    gameFocus.classList.add('hidden');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
});