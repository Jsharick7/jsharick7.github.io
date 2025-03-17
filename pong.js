const pongCanvas = document.getElementById('pongCanvas');
const ctx = pongCanvas.getContext('2d');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const shootButton = document.getElementById('shoot-button');

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
    winner: null,
    started: false
};

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

    if (!pongState.started) {
        ctx.font = '40px Orbitron';
        ctx.fillStyle = '#00d4ff';
        ctx.textAlign = 'center';
        ctx.fillText('Press Space to Start', pongState.width / 2, pongState.height / 2);
        return;
    }

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
                ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 20, Math.sin((18 + i * 72) * Math.PI / 180) * 20);
                ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 10, Math.sin((54 + i * 72) * Math.PI / 180) * 10);
            }
            ctx.closePath();
            ctx.fill();
        } else if (pongState.powerUp.type === 'shield') {
            ctx.beginPath();
            ctx.moveTo(-15, -20);
            ctx.lineTo(15, -20);
            ctx.lineTo(20, 0);
            ctx.lineTo(15, 20);
            ctx.lineTo(-15, 20);
            ctx.closePath();
            ctx.fill();
        } else if (pongState.powerUp.type === 'double') {
            ctx.fillRect(-20, -7, 15, 14);
            ctx.fillRect(5, -7, 15, 14);
        } else if (pongState.powerUp.type === 'wide') {
            ctx.fillRect(-20, -15, 40, 30);
        }
        ctx.restore();
    }

    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 50, pongState.height - 50);
    ctx.fillText('AI', pongState.width - 50, pongState.height - 50);
    const leftHealthRatio = pongState.paddles.left.health / pongState.paddles.left.maxHealth;
    const rightHealthRatio = pongState.paddles.right.health / pongState.paddles.right.maxHealth;
    ctx.fillStyle = `linear-gradient(90deg, #00ff00 ${leftHealthRatio * 100}%, #ff0000)`;
    ctx.fillRect(50, pongState.height - 40, leftHealthRatio * 100, 20);
    ctx.fillStyle = `linear-gradient(90deg, #00ff00 ${rightHealthRatio * 100}%, #ff0000)`;
    ctx.fillRect(pongState.width - 150, pongState.height - 40, rightHealthRatio * 100, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(pongState.scores.left, 150, 50);
    ctx.fillText(pongState.scores.right, pongState.width - 150, 50);

    if (pongState.gameOver) {
        ctx.font = '40px Orbitron';
        ctx.fillStyle = pongState.winner === 'left' ? '#00d4ff' : '#ff007a';
        ctx.textAlign = 'center';
        ctx.fillText(`${pongState.winner === 'left' ? 'Player' : 'AI'} Wins!`, pongState.width / 2, pongState.height / 2);
    }
}

// Update Pong logic
function updatePong() {
    if (!pongState.started) {
        drawPong();
        animationFrameId = requestAnimationFrame(updatePong);
        return;
    }

    if (pongState.gameOver) {
        drawPong();
        return;
    }

    if (pongState.roundPaused) {
        if (Date.now() - pongState.roundStartTime > 2000) {
            pongState.roundPaused = false;
            resetRound();
            spawnPowerUp(); // Spawn power-up at round start
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
        pongState.ball.dy += pongState.paddles.left.dy * 0.25 + relativeHit * 1; // Reduced by 50%
        pongState.ball.dx = -pongState.ball.dx * 1.05;
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.width - 30 && 
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.right.y + pongState.paddles.right.height / 2)) / (pongState.paddles.right.height / 2);
        pongState.ball.dy += relativeHit * 1;
        pongState.ball.dx = -pongState.ball.dx * 1.05;
        if (Math.abs(pongState.ball.dy) > 7 && Math.random() < 0.1) {
            // AI misses
        } else {
            pongState.ball.dx *= -1;
        }
    }

    if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        if (pongState.scores.left >= 10 || pongState.scores.right >= 10) {
            pongState.gameOver = true;
            pongState.winner = pongState.scores.left >= 10 ? 'left' : 'right';
            playSound(pongState.winner === 'left' ? 800 : 300, 0.5);
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
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && 
            laser.x <= 30 && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height && 
            pongState.paddles.left.health > 0) {
            pongState.paddles.left.health -= 1;
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
    });

    if (pongState.powerUp) {
        pongState.lasers.forEach(laser => {
            if (laser.from === 'left' && 
                laser.x >= pongState.powerUp.x - 20 && 
                laser.x <= pongState.powerUp.x + 20 && 
                laser.y >= pongState.powerUp.y - 20 && 
                laser.y <= pongState.powerUp.y + 20) {
                applyPowerUp();
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
            }
        });
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
            playSound(600, 0.2);
            pongState.powerUp = null;
            break;
        case 'shield':
            playSound(700, 0.2);
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'double':
            playSound(650, 0.2);
            setTimeout(() => pongState.powerUp = null, 7000);
            break;
        case 'wide':
            pongState.paddles.left.height = 200;
            playSound(750, 0.2);
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
    if (now - paddle.lastShot < 500) return; // 0.5s limit
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
        const laser2 = { ...laser, y: paddle.y + paddle.height / 4 };
        pongState.lasers.push(laser2);
    }
    paddle.lastShot = now;
    playSound(400, 0.1);
}

// Controls (Keyboard + Touch + Joystick)
let keys = { w: false, s: false };
document.addEventListener('keydown', (e) => {
    if (!pongState.started && e.key === ' ') {
        pongState.started = true;
        resetRound();
        spawnPowerUp();
        return;
    }
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

// Mobile Joystick
let joystickActive = false;
joystick.addEventListener('touchstart', (e) => {
    if (pongState.gameOver || pongState.started) return;
    e.preventDefault();
    joystickActive = true;
});

joystick.addEventListener('touchmove', (e) => {
    if (!pongState.started || pongState.gameOver || !joystickActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = joystick.getBoundingClientRect();
    const x = touch.clientX - rect.left - rect.width / 2;
    const y = touch.clientY - rect.top - rect.height / 2;
    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = rect.width / 2 - stick.offsetWidth / 2;
    const angle = Math.atan2(y, x);
    const limitedDistance = Math.min(distance, maxDistance);
    stick.style.transform = `translate(${limitedDistance * Math.cos(angle) - stick.offsetWidth / 2}px, ${limitedDistance * Math.sin(angle) - stick.offsetHeight / 2}px)`;

    const targetY = pongState.paddles.left.y + pongState.paddles.left.height / 2 + (y / maxDistance) * (pongState.height / 2);
    if (targetY < pongState.paddles.left.y + pongState.paddles.left.height / 2) {
        pongState.paddles.left.dy = -10;
    } else if (targetY > pongState.paddles.left.y + pongState.paddles.left.height / 2) {
        pongState.paddles.left.dy = 10;
    }
    playSound(200, 0.05);
});

joystick.addEventListener('touchend', (e) => {
    if (pongState.gameOver) return;
    e.preventDefault();
    joystickActive = false;
    stick.style.transform = 'translate(-50%, -50%)';
    pongState.paddles.left.dy = 0;
});

shootButton.addEventListener('touchstart', (e) => {
    if (!pongState.started) {
        pongState.started = true;
        resetRound();
        spawnPowerUp();
        return;
    }
    if (pongState.gameOver) return;
    e.preventDefault();
    shootLaser('left');
});

// Start the game
animationFrameId = requestAnimationFrame(updatePong);