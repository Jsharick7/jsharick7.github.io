const pongCanvas = document.getElementById('pongCanvas');
const ctx = pongCanvas.getContext('2d');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const shootButton = document.getElementById('shoot-button');

// Pong game state
const pongState = {
    ball: { x: 500, y: 300, dx: 5, dy: -5, radius: 10 },
    paddles: { 
        left: { x: 55, y: 300, width: 20, height: 100, health: 15, maxHealth: 15, lastShot: 0, dy: 0, shield: null, uncontactable: 0 }, 
        right: { x: 925, y: 300, width: 20, height: 100, health: 15, maxHealth: 15, lastShot: 0, shield: null } 
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
    nextPowerUpTime: Date.now() + Math.random() * 17000 + 8000,
    aiNextShot: Date.now() + 1000,
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
    pongState.bricks.left = [];
    pongState.bricks.right = [];
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
    if (pongState.paddles.left.shield) {
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(pongState.paddles.left.x + pongState.paddles.left.width + 5, pongState.paddles.left.y, 5, pongState.paddles.left.height);
    }
    ctx.fillStyle = pongState.paddles.right.health > 0 ? '#ff007a' : 'rgba(255, 0, 122, 0.2)';
    ctx.fillRect(pongState.paddles.right.x, pongState.paddles.right.y, pongState.paddles.right.width, pongState.paddles.right.height);
    if (pongState.paddles.right.shield) {
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(pongState.paddles.right.x - 10, pongState.paddles.right.y, 5, pongState.paddles.right.height);
    }

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
        ctx.fillStyle = '#ffffff';
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
        pongState.powerUpText.timer -= 16;
    }

    if (pongState.powerUp && pongState.powerUp.timer) {
        const timerWidth = (pongState.powerUp.timer / pongState.powerUp.maxTimer) * pongState.width;
        ctx.fillStyle = '#00d4ff';
        ctx.fillRect(0, pongState.height - 10, timerWidth, 10);
    }

    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 150, pongState.height - 60);
    ctx.fillText('AI', pongState.width - 150, pongState.height - 60);
    
    const gradientLeft = ctx.createLinearGradient(50, 0, 250, 0);
    gradientLeft.addColorStop(0, '#ff0000');
    gradientLeft.addColorStop(1, '#00ff00');
    ctx.fillStyle = gradientLeft;
    ctx.fillRect(50, pongState.height - 50, (pongState.paddles.left.health / pongState.paddles.left.maxHealth) * 200, 30);

    const gradientRight = ctx.createLinearGradient(pongState.width - 250, 0, pongState.width - 50, 0);
    gradientRight.addColorStop(0, '#ff0000');
    gradientRight.addColorStop(1, '#00ff00');
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
        ctx.font = '20px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.fillText('Press Space or Tap to Replay', pongState.width / 2, pongState.height / 2 + 50);
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
    if (pongState.paddles.left.shield) pongState.paddles.left.shield.y = pongState.paddles.left.y;

    pongState.ball.x += pongState.ball.dx;
    pongState.ball.y += pongState.ball.dy;

    const maxSpeed = 6.25;
    pongState.ball.dx = Math.max(-maxSpeed, Math.min(maxSpeed, pongState.ball.dx));
    pongState.ball.dy = Math.max(-maxSpeed, Math.min(maxSpeed, pongState.ball.dy));

    if (pongState.ball.y - pongState.ball.radius <= 0 || pongState.ball.y + pongState.ball.radius >= pongState.height) {
        pongState.ball.dy *= -1;
    }

    if (
        pongState.paddles.left.health > 0 &&
        pongState.ball.x - pongState.ball.radius <= pongState.paddles.left.x + pongState.paddles.left.width && 
        pongState.ball.x + pongState.ball.radius >= pongState.paddles.left.x &&
        pongState.ball.y >= pongState.paddles.left.y && 
        pongState.ball.y <= pongState.paddles.left.y + pongState.paddles.left.height &&
        pongState.ball.dx < 0 && pongState.paddles.left.uncontactable <= 0
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.left.y + pongState.paddles.left.height / 2)) / (pongState.paddles.left.height / 2);
        pongState.ball.dy += relativeHit * 1;
        pongState.ball.dx = -pongState.ball.dx;
        pongState.ballFromPlayer = true;
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.paddles.right.x && 
        pongState.ball.x - pongState.ball.radius <= pongState.paddles.right.x + pongState.paddles.right.width &&
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height &&
        pongState.ball.dx > 0
    ) {
        const relativeHit = (pongState.ball.y - (pongState.paddles.right.y + pongState.paddles.right.height / 2)) / (pongState.paddles.right.height / 2);
        pongState.ball.dy += relativeHit * 1;
        pongState.ball.dx = -pongState.ball.dx;
        pongState.ballFromPlayer = false;
    }

    pongState.bricks.left.forEach(brick => {
        if (brick.alive && 
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            pongState.ball.dx = -pongState.ball.dx;
            pongState.ballFromPlayer = true;
            pongState.paddles.left.uncontactable = 500;
            playSound(200, 0.1);
        }
    });
    pongState.bricks.right.forEach(brick => {
        if (brick.alive && 
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            pongState.ball.dx = -pongState.ball.dx;
            pongState.ballFromPlayer = false;
            playSound(200, 0.1);
        }
    });

    if (pongState.paddles.left.health <= 0) {
        pongState.scores.right++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 100;
    } else if (pongState.paddles.right.health <= 0) {
        pongState.scores.left++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 100;
    } else if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 100;
    }

    if (pongState.scores.left >= 5 || pongState.scores.right >= 5) {
        pongState.gameOver = true;
        pongState.winner = pongState.scores.left >= 5 ? 'left' : 'right';
        playSound(pongState.winner === 'left' ? 800 : 300, 0.5);
    }

    // AI movement logic
    if (pongState.paddles.right.health > 0) {
        let targetY = pongState.paddles.right.y; // Default to current position
        if (pongState.powerUp && !pongState.powerUp.active) {
            // Chase power-up
            targetY = pongState.powerUp.y - pongState.paddles.right.height / 2;
        } else if (pongState.ball.dx < 0) {
            // Ball moving away, shoot at player
            targetY = pongState.paddles.left.y + pongState.paddles.left.height / 2 - pongState.paddles.right.height / 2;
            if (now > pongState.aiNextShot) {
                shootLaser('right');
                pongState.aiNextShot = now + Math.random() * 1000 + 1000;
            }
        } else {
            // Ball coming toward AI, hit it
            targetY = pongState.ball.y - pongState.paddles.right.height / 2;
        }
        // Ensure targetY is a valid number
        if (isNaN(targetY)) {
            targetY = pongState.paddles.right.y; // Fallback to current position
        }
        // Move AI paddle toward targetY (increased speed to 0.15)
        pongState.paddles.right.y += (targetY - pongState.paddles.right.y) * 0.15;
        // Clamp position within canvas bounds
        pongState.paddles.right.y = Math.max(0, Math.min(pongState.height - pongState.paddles.right.height, pongState.paddles.right.y));
        if (pongState.paddles.right.shield) pongState.paddles.right.shield.y = pongState.paddles.right.y;
    }

    pongState.lasers = pongState.lasers.filter(laser => laser.x >= 0 && laser.x <= pongState.width);
    pongState.lasers.forEach(laser => {
        laser.x += laser.dx;
        if (laser.from === 'left' && pongState.paddles.right.shield && 
            laser.x >= pongState.paddles.right.x - 5 && 
            laser.y >= pongState.paddles.right.y && 
            laser.y <= pongState.paddles.right.y + pongState.paddles.right.height) {
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'left' && 
            laser.x >= pongState.paddles.right.x && 
            laser.y >= pongState.paddles.right.y && 
            laser.y <= pongState.paddles.right.y + pongState.paddles.right.height && 
            pongState.paddles.right.health > 0) {
            pongState.paddles.right.health -= laser.double ? 2 : 1;
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && pongState.paddles.left.shield && 
            laser.x <= pongState.paddles.left.x + pongState.paddles.left.width + 10 && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height) {
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        } else if (laser.from === 'right' && 
            laser.x <= pongState.paddles.left.x + pongState.paddles.left.width && 
            laser.y >= pongState.paddles.left.y && 
            laser.y <= pongState.paddles.left.y + pongState.paddles.left.height && 
            pongState.paddles.left.health > 0) {
            pongState.paddles.left.health -= 1;
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
    });

    if (pongState.powerUp && !pongState.powerUp.active) {
        pongState.lasers.forEach(laser => {
            if ((laser.from === 'left' || laser.from === 'right') && 
                laser.x >= pongState.powerUp.x - 20 && 
                laser.x <= pongState.powerUp.x + 20 && 
                laser.y >= pongState.powerUp.y - 20 && 
                laser.y <= pongState.powerUp.y + 20) {
                applyPowerUp(laser.from);
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
            }
        });
    }

    if (now > pongState.nextPowerUpTime && !pongState.powerUp) {
        spawnPowerUp();
        pongState.nextPowerUpTime = now + Math.random() * 17000 + 8000;
    }

    if (pongState.paddles.left.uncontactable > 0) pongState.paddles.left.uncontactable -= 16;

    drawPong();
    animationFrameId = requestAnimationFrame(updatePong);
}

function resetRound() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth; // Ensure AI health resets
    pongState.lasers = [];
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + 1000;
    pongState.ballFromPlayer = false;
    initBricks();
}

function resetGame() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth; // Ensure AI health resets
    pongState.lasers = [];
    pongState.powerUp = null;
    pongState.paddles.left.shield = null;
    pongState.paddles.right.shield = null;
    pongState.paddles.left.height = 100;
    pongState.scores.left = 0;
    pongState.scores.right = 0;
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + 1000;
    pongState.ballFromPlayer = false;
    pongState.gameOver = false;
    pongState.winner = null;
    pongState.roundPaused = false;
    initBricks();
    spawnPowerUp();
}

function spawnPowerUp() {
    const types = ['health', 'shield', 'double', 'wide'];
    pongState.powerUp = {
        x: Math.random() * (pongState.width - 80) + 40,
        y: Math.random() * (pongState.height - 80) + 40,
        type: types[Math.floor(Math.random() * types.length)],
        active: false
    };
    pongState.lastPowerUpTime = Date.now();
}

function applyPowerUp(from) {
    const paddle = pongState.paddles[from];
    switch (pongState.powerUp.type) {
        case 'health':
            paddle.health = Math.min(paddle.maxHealth, paddle.health + 3);
            if (from === 'left') pongState.powerUpText = { text: 'Health Up!', timer: 2000 };
            playSound(600, 0.2);
            pongState.powerUp = null;
            break;
        case 'shield':
            paddle.shield = { x: from === 'left' ? paddle.x + paddle.width + 5 : paddle.x - 10, y: paddle.y, width: 5, height: paddle.height };
            pongState.powerUp = { type: 'shield', active: true, timer: 7000, maxTimer: 7000 };
            if (from === 'left') pongState.powerUpText = { text: 'Shield!', timer: 2000 };
            playSound(700, 0.2);
            break;
        case 'double':
            pongState.powerUp = { type: 'double', active: true, timer: 7000, maxTimer: 7000 };
            if (from === 'left') pongState.powerUpText = { text: 'FirePower!', timer: 2000 };
            playSound(650, 0.2);
            break;
        case 'wide':
            paddle.height = 200;
            pongState.powerUp = { type: 'wide', active: true, timer: 20000, maxTimer: 20000 };
            if (from === 'left') pongState.powerUpText = { text: 'Stretch!', timer: 2000 };
            playSound(750, 0.2);
            break;
    }
    if (pongState.powerUp && pongState.powerUp.timer) {
        setTimeout(() => {
            if (pongState.powerUp && pongState.powerUp.type === 'shield') paddle.shield = null;
            if (pongState.powerUp && pongState.powerUp.type === 'wide') paddle.height = 100;
            if (pongState.powerUp && pongState.powerUp.timer <= 0) pongState.powerUp = null;
        }, pongState.powerUp.timer);
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
        double: pongState.powerUp && pongState.powerUp.type === 'double' && pongState.powerUp.active,
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
    if (pongState.gameOver && e.key === ' ') {
        resetGame();
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
    if (pongState.gameOver) {
        resetGame();
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

    const deadZone = 30;
    if (Math.abs(y) > deadZone) {
        const targetY = pongState.paddles.left.y + pongState.paddles.left.height / 2 + (y / maxDistance) * (pongState.height / 2);
        if (targetY < pongState.paddles.left.y + pongState.paddles.left.height / 2) {
            pongState.paddles.left.dy = -10;
        } else if (targetY > pongState.paddles.left.y + pongState.paddles.left.height / 2) {
            pongState.paddles.left.dy = 10;
        }
    } else {
        pongState.paddles.left.dy = 0;
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
    if (pongState.gameOver) {
        resetGame();
        return;
    }
    if (pongState.gameOver) return;
    shootLaser('left');
});

// Start the game
initBricks();
animationFrameId = requestAnimationFrame(updatePong);