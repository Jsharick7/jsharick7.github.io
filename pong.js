const pongCanvas = document.getElementById('pongCanvas');
const ctx = pongCanvas.getContext('2d');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const shootButton = document.getElementById('shoot-button');

// Pong game state
const pongState = {
    ball: { x: 500, y: 300, dx: 2.5, dy: -2.5, radius: 10 },
    paddles: { 
        left: { x: 50, y: 300, width: 20, height: 100, health: 15, maxHealth: 15, lastShot: 0, dy: 0, shielded: false }, 
        right: { x: 930, y: 300, width: 20, height: 100, health: 15, maxHealth: 15, lastShot: 0 } 
    },
    lasers: [],
    powerUp: null,
    powerUpText: { text: '', timer: 0 },
    bricks: { left: [], right: [] },
    scores: { left: 0, right: 0 },
    width: 1000,
    height: 600,
    roundPaused: false,
    roundStartTime: Date.now(),
    lastPowerUpTime: 0,
    aiNextShot: Date.now() + Math.random() * 3000 + 2000,
    gameOver: false,
    winner: null,
    started: false,
    ballFromPlayer: false
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

function initBricks() {
    for (let i = 0; i < 10; i++) {
        pongState.bricks.left.push({ x: 30, y: i * 60, width: 20, height: 60, alive: true });
        pongState.bricks.left.push({ x: 10, y: i * 60, width: 20, height: 60, alive: true });
        pongState.bricks.right.push({ x: 950, y: i * 60, width: 20, height: 60, alive: true });
        pongState.bricks.right.push({ x: 970, y: i * 60, width: 20, height: 60, alive: true });
    }
}

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
    ctx.fillRect(pongState.paddles.left.x, pongState.paddles.left.y, pongState.paddles.left.width, pongState.paddles.left.height);
    if (pongState.paddles.left.shielded) {
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.strokeRect(pongState.paddles.left.x, pongState.paddles.left.y, pongState.paddles.left.width, pongState.paddles.left.height);
    }
    ctx.fillStyle = pongState.paddles.right.health > 0 ? '#ff007a' : 'rgba(255, 0, 122, 0.2)';
    ctx.fillRect(pongState.paddles.right.x, pongState.paddles.right.y, pongState.paddles.right.width, pongState.paddles.right.height);

    pongState.bricks.left.forEach(brick => {
        if (brick.alive) {
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
    });
    pongState.bricks.right.forEach(brick => {
        if (brick.alive) {
            ctx.fillStyle = '#ff007a';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
    });

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

    if (pongState.powerUpText.timer > 0) {
        ctx.font = '30px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(pongState.powerUpText.text, pongState.width / 2, pongState.height / 2);
        pongState.powerUpText.timer -= 16; // ~60 FPS
    }

    if (pongState.powerUp && pongState.powerUp.timer) {
        const timerWidth = (pongState.powerUp.timer / pongState.powerUp.maxTimer) * pongState.width;
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(0, pongState.height - 10, timerWidth, 10);
    }

    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 50, pongState.height - 60);
    ctx.fillText('AI', pongState.width - 50, pongState.height - 60);
    
    const gradientLeft = ctx.createLinearGradient(50, 0, 250, 0);
    gradientLeft.addColorStop(0, '#00ff00');
    gradientLeft.addColorStop(1, '#ff0000');
    ctx.fillStyle = gradientLeft;
    ctx.fillRect(50, pongState.height - 50, (pongState.paddles.left.health / pongState.paddles.left.maxHealth) * 200, 30);

    const gradientRight = ctx.createLinearGradient(pongState.width - 250, 0, pongState.width - 50, 0);
    gradientRight.addColorStop(0, '#00ff00');
    gradientRight.addColorStop(1, '#ff0000');
    ctx.fillStyle = gradientRight;
    ctx.fillRect(pongState.width - 250, pongState.height - 50, (pongState.paddles.right.health / pongState.paddles.right.maxHealth) * 200, 30);

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
            spawnPowerUp();
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
        pongState.ball.x - pongState.ball.radius <= pongState.paddles.left.x + pongState.paddles.left.width && 
        pongState.ball.y >= pongState.paddles.left.y && 
        pongState.ball.y <= pongState.paddles.left.y + pongState.paddles.left.height
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.left.y + pongState.paddles.left.height / 2)) / (pongState.paddles.left.height / 2);
        pongState.ball.dy += pongState.paddles.left.dy * 0.25 + relativeHit * 1;
        pongState.ball.dx = -pongState.ball.dx * 1.05;
        pongState.ballFromPlayer = true;
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.paddles.right.x && 
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.right.y + pongState.paddles.right.height / 2)) / (pongState.paddles.right.height / 2);
        pongState.ball.dy += relativeHit * 1;
        pongState.ball.dx = -pongState.ball.dx * 1.05;
        pongState.ballFromPlayer = false;
    }

    pongState.bricks.left.forEach(brick => {
        if (brick.alive && 
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            pongState.ball.dx = -pongState.ball.dx * 1.05;
            pongState.ballFromPlayer = true;
        }
    });
    pongState.bricks.right.forEach(brick => {
        if (brick.alive && 
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            pongState.ball.dx = -pongState.ball.dx * 1.05;
            pongState.ballFromPlayer = false;
        }
    });

    if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        if (pongState.scores.left >= 10 || pongState.scores.right >= 10) {
            pongState.gameOver = true;
            pongState.winner = pongState.scores.left >= 10 ? 'left' : 'right';
            playSound(pongState.winner === 'left' ? 800 : 300, 0.5);
        } else {
            pongState.roundPaused = true;
            pongState.roundStartTime = now;
            pongState.powerUp = null; // Lose power-up on round end
            pongState.paddles.left.shielded = false;
            pongState.paddles.left.height = 100;
        }
    }

    if (pongState.paddles.right.health > 0 && pongState.ballFromPlayer) {
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
            laser.x >= pongState.paddles.right.x && 
            laser.y >= pongState.paddles.right.y && 
            laser.y <= pongState.paddles.right.y + pongState.paddles.right.height && 
            pongState.paddles.right.health > 0) {
            pongState.paddles.right.health -= laser.double ? 2 : 1;
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && 
            laser.x <= pongState.paddles.left.x + pongState.paddles.left.width && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height && 
            pongState.paddles.left.health > 0 && 
            !pongState.paddles.left.shielded) {
            pongState.paddles.left.health -= 1;
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
        pongState.bricks.left.forEach(brick => {
            if (brick.alive && laser.from === 'right' && 
                laser.x <= brick.x + brick.width && 
                laser.y >= brick.y && 
                laser.y <= brick.y + brick.height) {
                brick.alive = false;
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
            }
        });
        pongState.bricks.right.forEach(brick => {
            if (brick.alive && laser.from === 'left' && 
                laser.x >= brick.x && 
                laser.y >= brick.y && 
                laser.y <= brick.y + brick.height) {
                brick.alive = false;
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
            }
        });
    });

    if (pongState.powerUp && !pongState.powerUp.active) {
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

    if (pongState.powerUp && pongState.powerUp.timer) {
        pongState.powerUp.timer -= 16; // ~60 FPS
        if (pongState.powerUp.timer <= 0) {
            if (pongState.powerUp.type === 'shield') pongState.paddles.left.shielded = false;
            if (pongState.powerUp.type === 'wide') pongState.paddles.left.height = 100;
            pongState.powerUp = null;
        }
    }

    drawPong();
    animationFrameId = requestAnimationFrame(updatePong);
}

function resetRound() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 2.5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -2.5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth;
    pongState.lasers = [];
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + Math.random() * 3000 + 2000;
    pongState.ballFromPlayer = false;
    initBricks();
}

function spawnPowerUp() {
    const types = ['health', 'shield', 'double', 'wide'];
    pongState.powerUp = {
        x: Math.random() * (pongState.width - 60) + 60,
        y: Math.random() * (pongState.height - 60) + 30,
        type: types[Math.floor(Math.random() * types.length)],
        active: false
    };
    pongState.lastPowerUpTime = Date.now();
}

function applyPowerUp() {
    switch (pongState.powerUp.type) {
        case 'health':
            pongState.paddles.left.health = Math.min(pongState.paddles.left.maxHealth, pongState.paddles.left.health + 3);
            pongState.powerUpText = { text: 'Health Up!', timer: 2000 };
            playSound(600, 0.2);
            pongState.powerUp = null;
            break;
        case 'shield':
            pongState.paddles.left.shielded = true;
            pongState.powerUp = { type: 'shield', active: true, timer: 7000, maxTimer: 7000 };
            pongState.powerUpText = { text: 'Shield!', timer: 2000 };
            playSound(700, 0.2);
            break;
        case 'double':
            pongState.powerUp = { type: 'double', active: true, timer: 7000, maxTimer: 7000 };
            pongState.powerUpText = { text: 'FirePower!', timer: 2000 };
            playSound(650, 0.2);
            break;
        case 'wide':
            pongState.paddles.left.height = 200;
            pongState.powerUp = { type: 'wide', active: true, timer: 20000, maxTimer: 20000 };
            pongState.powerUpText = { text: 'Stretch!', timer: 2000 };
            playSound(750, 0.2);
            break;
    }
}

function shootLaser(from) {
    const now = Date.now();
    const paddle = pongState.paddles[from];
    if (now - paddle.lastShot < 500) return;
    const laser = {
        x: from === 'left' ? paddle.x + paddle.width : paddle.x,
        y: paddle.y + paddle.height / 2,
        width: 20,
        dx: from === 'left' ? 10 : -10,
        double: from === 'left' && pongState.powerUp && pongState.powerUp.type === 'double' && pongState.powerUp.active,
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

// Controls
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

let joystickActive = false;
joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!pongState.started) {
        pongState.started = true;
        resetRound();
        spawnPowerUp();
        return;
    }
    if (pongState.gameOver) return;
    joystickActive = true;
});

joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystickActive || pongState.gameOver) return;
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
    e.preventDefault();
    if (pongState.gameOver) return;
    joystickActive = false;
    stick.style.transform = 'translate(-50%, -50%)';
    pongState.paddles.left.dy = 0;
});

shootButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!pongState.started) {
        pongState.started = true;
        resetRound();
        spawnPowerUp();
        return;
    }
    if (pongState.gameOver) return;
    shootLaser('left');
});

// Start the game
initBricks();
animationFrameId = requestAnimationFrame(updatePong);