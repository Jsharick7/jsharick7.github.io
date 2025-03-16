const pongCanvas = document.getElementById('pongCanvas');
const ctx = pongCanvas.getContext('2d');

// Pong game state
const pongState = {
    ball: { x: 400, y: 300, dx: 5, dy: -5, radius: 10 },
    paddles: { 
        left: { y: 300, width: 20, height: 100, health: 5, maxHealth: 5, lastShot: 0 }, 
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
    aiNextShot: Date.now() + Math.random() * 3000 + 2000
};

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
        ctx.fillStyle = pongState.powerUp.type === 'health' ? '#00ff00' : pongState.powerUp.type === 'shield' ? '#00d4ff' : '#ff007a';
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
        } else {
            ctx.fillRect(-15, -5, 10, 10);
            ctx.fillRect(5, -5, 10, 10);
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

    ctx.fillStyle = '#fff';
    ctx.fillText(pongState.scores.left, 100, 50);
    ctx.fillText(pongState.scores.right, pongState.width - 100, 50);
}

// Update Pong logic
function updatePong() {
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
        pongState.ball.dx *= -1;
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.width - 30 && 
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height
    ) {
        if (Math.abs(pongState.ball.dy) > 7 && Math.random() < 0.1) {
            // AI misses
        } else {
            pongState.ball.dx *= -1;
        }
    }

    if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
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
            if (pongState.paddles.right.health <= 0) {
                pongState.roundPaused = true;
                pongState.roundStartTime = now;
            }
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && 
            laser.x <= 30 && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height && 
            pongState.paddles.left.health > 0) {
            pongState.paddles.left.health -= 1;
            if (pongState.paddles.left.health <= 0) {
                pongState.roundPaused = true;
                pongState.roundStartTime = now;
            }
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
    pongState.powerUp = null;
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + Math.random() * 3000 + 2000;
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
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'double':
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
    }
    if (pongState.powerUp.type !== 'shield' && pongState.powerUp.type !== 'double') pongState.powerUp = null;
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
    paddle.lastShot = now;
}

// Controls (Keyboard + Touch)
document.addEventListener('keydown', (e) => {
    const paddleSpeed = 20;
    if (e.key === 'w' && pongState.paddles.left.y > 0) {
        pongState.paddles.left.y -= paddleSpeed;
    } else if (e.key === 's' && pongState.paddles.left.y < pongState.height - pongState.paddles.left.height) {
        pongState.paddles.left.y += paddleSpeed;
    } else if (e.key === ' ') {
        e.preventDefault();
        shootLaser('left');
    }
});

pongCanvas.addEventListener('touchstart', (e) => {
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
    if (pongState.touchY === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = pongCanvas.getBoundingClientRect();
    const y = (touch.clientY - rect.top) * (pongState.height / rect.height);
    pongState.paddles.left.y = Math.max(0, Math.min(pongState.height - pongState.paddles.left.height, y - pongState.paddles.left.height / 2));
});

pongCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    pongState.touchY = null;
});

// Start the game
resetRound();
updatePong();