const pongCanvas = document.getElementById('pongCanvas');
const ctx = pongCanvas.getContext('2d');

// Pong game state
const pongState = {
    ball: { x: 400, y: 300, dx: 5, dy: -5, radius: 10 },
    paddles: { 
        left: { y: 300, width: 20, height: 100, health: 5, maxHealth: 5, lastShot: 0, dy: 0 }, 
        right: { y: 300, width: 20, height: 100, health: 5, maxHealth: 5, lastShot: 0 } 
    },
    lasers: [],
    powerUp: null,
    scores: { left: 0, right: 0 },
    width: 800,
    height: 600,
    roundPaused: false,
    roundStartTime: Date.now(),
    lastPowerUpTime: 0,
    touchY: null,
    aiNextShot: Date.now() + Math.random() * 3000 + 2000,
    gameOver: false,
    winner: null
};

// SFX with Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(frequency, duration, type = 'square') {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    oscillator.stop(audioCtx.currentTime + duration);
}

let animationFrameId;

// Draw Pong
function drawPong() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, pongState.width, pongState.height);

    ctx.fillStyle = pongState.paddles.left.health > 0 ? '#00d4ff' : 'rgba(0, 212, 255, 0.2)';
    ctx.fillRect(10, pongState.paddles.left.y, pongState.paddles.left.width, pongState.paddles.left.height);
    ctx.fillStyle = pongState.paddles.right.health > 0 ? '#ff007a' : 'rgba(255, 0, 122, 0.2)';
    ctx.fillRect(pongState.width - 30, pongState.paddles.right.y, pongState.paddles.right.width, pongState.paddles.right.height);

    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(pongState.ball.x, pongState.ball.y, pongState.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    pongState.lasers.forEach(laser => {
        ctx.fillStyle = laser.double ? '#ffcc00' : laser.from === 'left' ? '#00ffcc' : '#ff007a';
        ctx.fillRect(laser.x, laser.y, laser.width, 5);
    });

    if (pongState.powerUp) {
        ctx.save();
        ctx.translate(pongState.powerUp.x, pongState.powerUp.y);
        ctx.rotate(Date.now() / 500);
        ctx.fillStyle = pongState.powerUp.type === 'health' ? '#00ff00' : pongState.powerUp.type === 'shield' ? '#00d4ff' : pongState.powerUp.type === 'double' ? '#ff007a' : '#ffcc00';
        if (pongState.powerUp.type === 'health') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 15, Math.sin((18 + i * 72) * Math.PI / 180) * 15);
                ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 7, Math.sin((54 + i * 72) * Math.PI / 180) * 7);
            }
            ctx.closePath();
            ctx.fill();
        } else if (pongState.powerUp.type === 'shield') {
            ctx.beginPath();
            ctx.moveTo(-10, -15);
            ctx.lineTo(10, -15);
            ctx.lineTo(15, 0);
            ctx.lineTo(10, 15);
            ctx.lineTo(-10, 15);
            ctx.closePath();
            ctx.fill();
        } else if (pongState.powerUp.type === 'double') {
            ctx.fillRect(-15, -5, 10, 10);
            ctx.fillRect(5, -5, 10, 10);
        } else if (pongState.powerUp.type === 'wide') {
            ctx.fillRect(-15, -10, 30, 20);
        }
        ctx.restore();
    }

    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 10, pongState.height - 40);
    ctx.fillText('AI', pongState.width - 60, pongState.height - 40);
    ctx.fillStyle = 'linear-gradient(90deg, #00d4ff, #00ffcc)';
    ctx.fillRect(10, pongState.height - 30, (pongState.paddles.left.health / pongState.paddles.left.maxHealth) * 100, 20);
    ctx.fillStyle = 'linear-gradient(90deg, #ff007a, #ffcc00)';
    ctx.fillRect(pongState.width - 110, pongState.height - 30, (pongState.paddles.right.health / pongState.paddles.right.maxHealth) * 100, 20);
    ctx.fillText(pongState.scores.left, 100, 50);
    ctx.fillText(pongState.scores.right, pongState.width - 100, 50);

    if (pongState.gameOver) {
        ctx.font = '40px Orbitron';
        ctx.fillStyle = pongState.winner === 'left' ? '#00d4ff' : '#ff007a';
        ctx.textAlign = 'center';
        ctx.fillText(`${pongState.winner === 'left' ? 'Player' : 'AI'} Wins!`, pongState.width / 2, pongState.height / 2);
    }
}

// Update Pong logic
function updatePong() {
    if (pongState.gameOver) {
        drawPong();
        return;
    }

    if (pongState.roundPaused) {
        if (Date.now() - pongState.roundStartTime > 2000) {
            pongState.roundPaused = false;
            resetRound();
        }
        drawPong();
        animationFrameId = requestAnimationFrame(updatePong);
        return;
    }

    const now = Date.now();
    const roundTime = (now - pongState.roundStartTime) / 1000;

    pongState.paddles.left.y += pongState.paddles.left.dy;
    pongState.paddles.left.y = Math.max(0, Math.min(pongState.height - pongState.paddles.left.height, pongState.paddles.left.y));

    pongState.ball.x += pongState.ball.dx;
    pongState.ball.y += pongState.ball.dy;

    if (pongState.ball.y - pongState.ball.radius <= 0 || pongState.ball.y + pongState.ball.radius >= pongState.height) {
        pongState.ball.dy *= -1;
    }

    if (
        pongState.paddles.left.health > 0 &&
        pongState.ball.x - pongState.ball.radius <= 30 && 
        pongState.ball.y >= pongState.paddles.left.y && 
        pongState.ball.y <= pongState.paddles.left.y + pongState.paddles.left.height
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.left.y + pongState.paddles.left.height / 2)) / (pongState.paddles.left.height / 2);
        pongState.ball.dy += pongState.paddles.left.dy * 0.5 + relativeHit * 2;
        pongState.ball.dx = -pongState.ball.dx * 1.05; // Slight speed increase
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.width - 30 && 
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.right.y + pongState.paddles.right.height / 2)) / (pongState.paddles.right.height / 2);
        pongState.ball.dy += relativeHit * 2;
        pongState.ball.dx = -pongState.ball.dx * 1.05;
        if (Math.abs(pongState.ball.dy) > 7 && Math.random() < 0.1) {
            // AI misses (no bounce)
        } else {
            pongState.ball.dx *= -1;
        }
    }

    if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        if (pongState.scores.left >= 10 || pongState.scores.right >= 10) {
            pongState.gameOver = true;
            pongState.winner = pongState.scores.left >= 10 ? 'left' : 'right';
            playSound(pongState.winner === 'left' ? 800 : 300, 0.5); // Victory (high) or Loss (low)
        } else {
            pongState.roundPaused = true;
            pongState.roundStartTime = now;
        }
    }

    if (pongState.paddles.right.health > 0) {
        const aiTarget = pongState.ball.y - pongState.paddles.right.height / 2;
        pongState.paddles.right.y += (aiTarget - pongState.paddles.right.y) * 0.1;
        pongState.paddles.right.y = Math.max(0, Math.min(pongState.height - pongState.paddles.right.height, pongState.paddles.right.y));
    }

    if (now > pongState.aiNextShot && pongState.paddles.right.health > 0) {
        shootLaser('right');
        pongState.aiNextShot = now + Math.random() * 3000 + 2000;
    }

    pongState.lasers = pongState.lasers.filter(laser => laser.x >= 0 && laser.x <= pongState.width);
    pongState.lasers.forEach(laser => {
        laser.x += laser.dx;
        if (laser.from === 'left' && 
            laser.x >= pongState.width - 30 && 
            laser.y >= pongState.paddles.right.y && 
            laser.y <= pongState.paddles.right.y + pongState.paddles.right.height && 
            pongState.paddles.right.health > 0) {
            pongState.paddles.right.health -= laser.double ? 2 : 1;
            playSound(500, 0.1); // Hit sound
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && 
            laser.x <= 30 && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height && 
            pongState.paddles.left.health > 0) {
            pongState.paddles.left.health -= 1;
            playSound(500, 0.1); // Hit sound
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
    });

    if (pongState.powerUp) {
        pongState.lasers.forEach(laser => {
            if (laser.from === 'left' && 
                laser.x >= pongState.powerUp.x - 15 && 
                laser.x <= pongState.powerUp.x + 15 && 
                laser.y >= pongState.powerUp.y - 15 && 
                laser.y <= pongState.powerUp.y + 15) {
                applyPowerUp();
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
            }
        });
    }

    if (roundTime > 10 && !pongState.powerUp && now - pongState.lastPowerUpTime > 20000) {
        spawnPowerUp();
    }

    drawPong();
    animationFrameId = requestAnimationFrame(updatePong);
}

function resetRound() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth;
    pongState.lasers = [];
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + Math.random() * 3000 + 2000;
}

function spawnPowerUp() {
    const types = ['health', 'shield', 'double', 'wide'];
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
            playSound(600, 0.2); // Health sound
            pongState.powerUp = null;
            break;
        case 'shield':
            playSound(700, 0.2); // Shield sound
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'double':
            playSound(650, 0.2); // Double sound
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'wide':
            pongState.paddles.left.height = 200;
            playSound(750, 0.2); // Wide sound
            setTimeout(() => {
                pongState.paddles.left.height = 100;
                if (pongState.powerUp && pongState.powerUp.type === 'wide') pongState.powerUp = null;
            }, 20000);
            break;
    }
}

function shootLaser(from) {
    const now = Date.now();
    const paddle = pongState.paddles[from];
    if (now - paddle.lastShot < 1000) return;
    const laser = {
        x: from === 'left' ? 30 : pongState.width - 30,
        y: paddle.y + paddle.height / 2,
        width: 20,
        dx: from === 'left' ? 10 : -10,
        double: from === 'left' && pongState.powerUp && pongState.powerUp.type === 'double',
        from: from
    };
    pongState.lasers.push(laser);
    if (laser.double) {
        const laser2 = { ...laser, y: paddle.y + paddle.height / 4 }; // Second laser offset
        pongState.lasers.push(laser2);
    }
    paddle.lastShot = now;
    playSound(400, 0.1); // Laser sound
}

// Controls (Keyboard + Touch)
let keys = { w: false, s: false };
document.addEventListener('keydown', (e) => {
    if (pongState.gameOver) return;
    if (e.key === 'w') {
        keys.w = true;
        pongState.paddles.left.dy = -10;
        playSound(200, 0.05);
    } else if (e.key === 's') {
        keys.s = true;
        pongState.paddles.left.dy = 10;
        playSound(200, 0.05);
    } else if (e.key === ' ') {
        e.preventDefault();
        shootLaser('left');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w') {
        keys.w = false;
        if (!keys.s) pongState.paddles.left.dy = 0;
    } else if (e.key === 's') {
        keys.s = false;
        if (!keys.w) pongState.paddles.left.dy = 0;
    }
});

pongCanvas.addEventListener('touchstart', (e) => {
    if (pongState.gameOver) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = pongCanvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (pongState.width / rect.width);
    const y = (touch.clientY - rect.top) * (pongState.height / rect.height);
    if (x < pongState.width / 2) {
        pongState.touchY = y - pongState.paddles.left.height / 2;
    } else {
        shootLaser('left');
    }
});

pongCanvas.addEventListener('touchmove', (e) => {
    if (pongState.gameOver || pongState.touchY === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = pongCanvas.getBoundingClientRect();
    const y = (touch.clientY - rect.top) * (pongState.height / rect.height);
    pongState.paddles.left.y = Math.max(0, Math.min(pongState.height - pongState.paddles.left.height, y - pongState.paddles.left.height / 2));
    playSound(200, 0.05);
});

pongCanvas.addEventListener('touchend', (e) => {
    if (pongState.gameOver) return;
    e.preventDefault();
    pongState.touchY = null;
});

// Start the game
resetRound();
updatePong();