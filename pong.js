const pongCanvas = document.getElementById('pongCanvas');
pongCanvas.width = 700; // Reduced from 1000 to 700
pongCanvas.height = 600;
const ctx = pongCanvas.getContext('2d');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const shootButton = document.getElementById('shoot-button');

const pongState = {
    ball: { x: 350, y: 300, dx: 5, dy: -5, radius: 10 },
    paddles: { 
        left: { x: 55, y: 300, width: 20, height: 90, health: 15, maxHealth: 15, lastShot: 0, dy: 0, shield: null, uncontactable: 0 },
        right: { 
            x: 625, 
            y: 300, 
            width: 20, 
            height: 90, 
            health: 15, 
            maxHealth: 15, 
            lastShot: 0, 
            shield: null, 
            uncontactable: Infinity, 
            lastTaskChange: 0, 
            currentTask: 'ball' // 'ball' or 'player'
        }
    },
    lasers: [],
    powerUp: null,
    powerUpText: { text: '', timer: 0 },
    playerPowerUpTimer: { active: false, type: null, remaining: 0, max: 0 }, // Player timer (blue)
    enemyPowerUpTimer: { active: false, type: null, remaining: 0, max: 0 }, // Enemy timer (red)
    bricks: { left: [], right: [] },
    scores: { left: 0, right: 0 },
    width: 700,
    height: 600,
    roundPaused: false,
    roundStartTime: Date.now(),
    lastPowerUpTime: 0,
    nextPowerUpTime: Date.now() + Math.random() * 17000 + 8000,
    aiNextShot: Date.now() + 1000,
    aiLastBehaviorChange: 0,
    aiPowerUpDelay: 0,
    aiError: { active: false, offset: 0 },
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
        pongState.bricks.left.push({ x: 30, y: i * 60, width: 20, height: 60, alive: true, invulnerable: 0 });
        pongState.bricks.left.push({ x: 10, y: i * 60, width: 20, height: 60, alive: true, invulnerable: 0 });
        pongState.bricks.right.push({ x: 650, y: i * 60, width: 20, height: 60, alive: true, invulnerable: 0 });
        pongState.bricks.right.push({ x: 670, y: i * 60, width: 20, height: 60, alive: true, invulnerable: 0 });
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
        if (brick.alive && brick.invulnerable <= 0) {
            ctx.fillStyle = '#00d4ff';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
    });
    pongState.bricks.right.forEach(brick => {
        if (brick.alive && brick.invulnerable <= 0) {
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

    if (pongState.powerUp && !pongState.powerUp.active) {
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

    if (pongState.playerPowerUpTimer.active) {
        const timerWidth = (pongState.playerPowerUpTimer.remaining / pongState.playerPowerUpTimer.max) * pongState.width;
        ctx.fillStyle = '#00d4ff'; // Blue for player
        ctx.fillRect(0, pongState.height - 10, timerWidth, 10);
    }
    if (pongState.enemyPowerUpTimer.active) {
        const timerWidth = (pongState.enemyPowerUpTimer.remaining / pongState.enemyPowerUpTimer.max) * pongState.width;
        ctx.fillStyle = '#ff007a'; // Red for enemy
        ctx.fillRect(0, pongState.height - 25, timerWidth, 10);
    }

    ctx.font = '20px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player', 100, pongState.height - 60);
    ctx.fillText('AI', pongState.width - 100, pongState.height - 60);
 
    const gradientLeft = ctx.createLinearGradient(50, 0, 200, 0);
    gradientLeft.addColorStop(0, '#ff0000');
    gradientLeft.addColorStop(1, '#00ff00');
    ctx.fillStyle = gradientLeft;
    ctx.beginPath();
    ctx.roundRect(50, pongState.height - 50, (pongState.paddles.left.health / pongState.paddles.left.maxHealth) * 150, 30, 15); // Oval health bar
    ctx.fill();

    const gradientRight = ctx.createLinearGradient(pongState.width - 200, 0, pongState.width - 50, 0);
    gradientRight.addColorStop(0, '#ff0000');
    gradientRight.addColorStop(1, '#00ff00');
    ctx.fillStyle = gradientRight;
    ctx.beginPath();
    ctx.roundRect(pongState.width - 200, pongState.height - 50, (pongState.paddles.right.health / pongState.paddles.right.maxHealth) * 150, 30, 15); // Oval health bar
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(pongState.scores.left, 100, 50);
    ctx.fillText(pongState.scores.right, pongState.width - 100, 50);

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
        if (pongState.paddles.right.health > 0) {
            let targetY = pongState.paddles.left.y + pongState.paddles.left.height / 2 - pongState.paddles.right.height / 2;
            if (isNaN(targetY)) targetY = pongState.paddles.right.y;
            let dy = (targetY - pongState.paddles.right.y) * 0.2;
            dy = Math.max(-6.5, Math.min(6.5, dy)); // AI max speed 65% of player (6.5 vs 10)
            pongState.paddles.right.y += dy;
            pongState.paddles.right.y = Math.max(0, Math.min(pongState.height - pongState.paddles.right.height, pongState.paddles.right.y));
            if (pongState.paddles.right.shield) pongState.paddles.right.shield.y = pongState.paddles.right.y;

            const now = Date.now();
            if (now > pongState.aiNextShot) {
                shootLaser('right');
                pongState.aiNextShot = now + Math.random() * 1000 + 500;
            }
        }
        drawPong();
        animationFrameId = requestAnimationFrame(updatePong);
        return;
    }

    if (pongState.gameOver) {
        drawPong();
        animationFrameId = requestAnimationFrame(updatePong); // Keep drawing game over screen
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
    let speed = Math.sqrt(pongState.ball.dx * pongState.ball.dx + pongState.ball.dy * pongState.ball.dy);
    if (speed > maxSpeed * 1.25) {
        const scale = (maxSpeed * 1.25) / speed;
        pongState.ball.dx *= scale;
        pongState.ball.dy *= scale;
    }

    if (pongState.ball.y - pongState.ball.radius <= 0 || pongState.ball.y + pongState.ball.radius >= pongState.height) {
        pongState.ball.dy *= -1;
    }

    let brickHitThisFrame = false;
    if (
        pongState.paddles.left.health > 0 &&
        pongState.ball.x - pongState.ball.radius <= pongState.paddles.left.x + pongState.paddles.left.width && 
        pongState.ball.x + pongState.ball.radius >= pongState.paddles.left.x &&
        pongState.ball.y >= pongState.paddles.left.y && 
        pongState.ball.y <= pongState.paddles.left.y + pongState.paddles.left.height &&
        pongState.ball.dx < 0 && pongState.paddles.left.uncontactable <= 0
    ) {
        const paddleCenterY = pongState.paddles.left.y + pongState.paddles.left.height / 2;
        const relativeHit = (pongState.ball.y - paddleCenterY) / (pongState.paddles.left.height / 2);
        let spinFactor = pongState.paddles.left.dy * 0.1 * 1.7;
        const distanceFromCenter = Math.abs(pongState.ball.y - paddleCenterY) / (pongState.paddles.left.height / 2);
        spinFactor += distanceFromCenter * 0.5 * 1.7 * (pongState.ball.y > paddleCenterY ? -1 : 1);
        pongState.ball.dy += spinFactor;
        pongState.ball.dx = -pongState.ball.dx;
        pongState.ballFromPlayer = true;
        speed = Math.sqrt(pongState.ball.dx * pongState.ball.dx + pongState.ball.dy * pongState.ball.dy);
        if (speed > maxSpeed * 1.25) {
            const scale = (maxSpeed * 1.25) / speed;
            pongState.ball.dx *= scale;
            pongState.ball.dy *= scale;
        }
        pongState.paddles.left.uncontactable = Infinity;
        pongState.bricks.left.forEach(brick => brick.invulnerable = Infinity);
        pongState.bricks.right.forEach(brick => brick.invulnerable = Infinity);
    } else if (
        pongState.paddles.right.health > 0 &&
        pongState.ball.x + pongState.ball.radius >= pongState.paddles.right.x && 
        pongState.ball.x - pongState.ball.radius <= pongState.paddles.right.x + pongState.paddles.right.width &&
        pongState.ball.y >= pongState.paddles.right.y && 
        pongState.ball.y <= pongState.paddles.right.y + pongState.paddles.right.height &&
        pongState.ball.dx > 0
    ) {
        const paddleCenterY = pongState.paddles.right.y + pongState.paddles.right.height / 2;
        const relativeHit = (pongState.ball.y - paddleCenterY) / (pongState.paddles.right.height / 2);
        let spinFactor = 0;
        const distanceFromCenter = Math.abs(pongState.ball.y - paddleCenterY) / (pongState.paddles.right.height / 2);
        spinFactor += distanceFromCenter * 0.5 * 1.7 * (pongState.ball.y > paddleCenterY ? -1 : 1);
        pongState.ball.dy += spinFactor;
        pongState.ball.dx = -pongState.ball.dx;
        pongState.ballFromPlayer = false;
        speed = Math.sqrt(pongState.ball.dx * pongState.ball.dx + pongState.ball.dy * pongState.ball.dy);
        if (speed > maxSpeed * 1.25) {
            const scale = (maxSpeed * 1.25) / speed;
            pongState.ball.dx *= scale;
            pongState.ball.dy *= scale;
        }
        pongState.paddles.right.uncontactable = Infinity;
        pongState.bricks.left.forEach(brick => brick.invulnerable = Infinity);
        pongState.bricks.right.forEach(brick => brick.invulnerable = Infinity);
    }

    pongState.bricks.left.forEach(brick => {
        if (brick.alive && brick.invulnerable <= 0 && !brickHitThisFrame &&
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            brick.invulnerable = Infinity;
            pongState.ball.dx = -pongState.ball.dx;
            pongState.ballFromPlayer = true;
            pongState.paddles.left.uncontactable = Infinity;
            pongState.bricks.left.forEach(b => b.invulnerable = Infinity);
            pongState.bricks.right.forEach(b => b.invulnerable = Infinity);
            playSound(200, 0.1);
            brickHitThisFrame = true;
        }
    });
    pongState.bricks.right.forEach(brick => {
        if (brick.alive && brick.invulnerable <= 0 && !brickHitThisFrame &&
            pongState.ball.x + pongState.ball.radius >= brick.x && 
            pongState.ball.x - pongState.ball.radius <= brick.x + brick.width && 
            pongState.ball.y >= brick.y && 
            pongState.ball.y <= brick.y + brick.height) {
            brick.alive = false;
            brick.invulnerable = Infinity;
            pongState.ball.dx = -pongState.ball.dx;
            pongState.ballFromPlayer = false;
            pongState.paddles.right.uncontactable = Infinity;
            pongState.bricks.left.forEach(b => b.invulnerable = Infinity);
            pongState.bricks.right.forEach(b => b.invulnerable = Infinity);
            playSound(200, 0.1);
            brickHitThisFrame = true;
        }
    });

    if (pongState.ball.dx > 0 && pongState.ballFromPlayer) {
        pongState.paddles.left.uncontactable = 0;
        pongState.bricks.left.forEach(brick => brick.invulnerable = 0);
        pongState.bricks.right.forEach(brick => brick.invulnerable = 0);
    } else if (pongState.ball.dx < 0 && !pongState.ballFromPlayer) {
        pongState.paddles.right.uncontactable = 0;
        pongState.bricks.left.forEach(brick => brick.invulnerable = 0);
        pongState.bricks.right.forEach(brick => brick.invulnerable = 0);
    }

    if (pongState.paddles.left.health <= 0) {
        pongState.scores.right++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 90; // Reset to 90
        pongState.paddles.right.height = 90; // Reset to 90
        pongState.playerPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
        pongState.enemyPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    } else if (pongState.paddles.right.health <= 0) {
        pongState.scores.left++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 90; // Reset to 90
        pongState.paddles.right.height = 90; // Reset to 90
        pongState.playerPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
        pongState.enemyPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    } else if (pongState.ball.x <= 0 || pongState.ball.x >= pongState.width) {
        pongState.scores[pongState.ball.x <= 0 ? 'right' : 'left']++;
        pongState.roundPaused = true;
        pongState.roundStartTime = now;
        pongState.powerUp = null;
        pongState.paddles.left.shield = null;
        pongState.paddles.right.shield = null;
        pongState.paddles.left.height = 90; // Reset to 90
        pongState.paddles.right.height = 90; // Reset to 90
        pongState.playerPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
        pongState.enemyPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    }

    if (pongState.scores.left >= 5 || pongState.scores.right >= 5) {
        pongState.gameOver = true;
        pongState.winner = pongState.scores.left >= 5 ? 'left' : 'right';
        playSound(pongState.winner === 'left' ? 800 : 300, 0.5);
        pongState.playerPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
        pongState.enemyPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    }

    // AI movement logic
    if (pongState.paddles.right.health > 0) {
        let targetY = pongState.paddles.right.y;
        const now = Date.now();
        
        // Shooting logic (independent of movement task)
        if (now > pongState.aiNextShot) {
            shootLaser('right');
            pongState.aiNextShot = now + Math.random() * 1000 + 500; // 0.5-1.5s cooldown
        }

        // Check if ball is within 0.3 seconds (18 frames) of reaching AI
        const timeToReachAI = pongState.ball.dx > 0 ? (pongState.paddles.right.x - pongState.ball.x - pongState.ball.radius) / pongState.ball.dx : Infinity;
        const paddleCenterY = pongState.paddles.right.y + pongState.paddles.right.height / 2;

        if (timeToReachAI <= 18 && timeToReachAI >= 0) { // Last 0.3 seconds
            const anticipatedY = pongState.ball.y + pongState.ball.dy * timeToReachAI;
            targetY = anticipatedY - pongState.paddles.right.height / 2;
        } else {
            // Task-switching logic (every 0.3 seconds)
            if (now - pongState.paddles.right.lastTaskChange >= 300) {
                pongState.paddles.right.currentTask = Math.random() < 0.5 ? 'ball' : 'player';
                pongState.paddles.right.lastTaskChange = now;
            }

            // Set target based on current task
            if (pongState.powerUp && !pongState.powerUp.active && now - pongState.aiPowerUpDelay >= 3500) {
                targetY = pongState.powerUp.y - pongState.paddles.right.height / 2; // Power-up priority
            } else if (pongState.paddles.right.currentTask === 'ball') {
                targetY = pongState.ball.y - pongState.paddles.right.height / 2; // Track ball vertically
            } else { // 'player'
                targetY = pongState.paddles.left.y + pongState.paddles.left.height / 2 - pongState.paddles.right.height / 2; // Track player
            }
        }

        // Hot zone check (±7px from center)
        const targetInHotZone = Math.abs(paddleCenterY - (targetY + pongState.paddles.right.height / 2)) <= 7;
        if (!targetInHotZone) {
            // Smooth movement toward target (max speed 6.5)
            let dy = (targetY - pongState.paddles.right.y) * 0.2; // 20% of distance per frame
            dy = Math.max(-6.5, Math.min(6.5, dy)); // Max speed 65% of player (10 * 0.65 = 6.5)
            pongState.paddles.right.y += dy;
        }

        // Clamp paddle position
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
            pongState.paddles.right.health -= 1; // Single damage per laser
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
            pongState.paddles.left.health -= 1; // Single damage per laser
            playSound(500, 0.1);
            pongState.lasers = pongState.lasers.filter(l => l !== laser);
        }
    });

    if (pongState.powerUp && !pongState.powerUp.active) {
        let powerUpClaimed = false;
        pongState.lasers.forEach(laser => {
            if (!powerUpClaimed && (laser.from === 'left' || laser.from === 'right') && 
                laser.x + laser.width >= pongState.powerUp.x - 25 && 
                laser.x <= pongState.powerUp.x + 25 && 
                laser.y + 5 >= pongState.powerUp.y - 25 && 
                laser.y <= pongState.powerUp.y + 25) {
                applyPowerUp(laser.from);
                pongState.lasers = pongState.lasers.filter(l => l !== laser);
                powerUpClaimed = true;
            }
        });
        if (!powerUpClaimed && 
            pongState.powerUp.x + 25 >= pongState.paddles.right.x && 
            pongState.powerUp.x - 25 <= pongState.paddles.right.x + pongState.paddles.right.width &&
            pongState.powerUp.y + 25 >= pongState.paddles.right.y && 
            pongState.powerUp.y - 25 <= pongState.paddles.right.y + pongState.paddles.right.height) {
            applyPowerUp('right');
            powerUpClaimed = true;
        }
    }

    if (now > pongState.nextPowerUpTime && !pongState.powerUp) {
        spawnPowerUp();
        pongState.nextPowerUpTime = now + Math.random() * 17000 + 8000;
    }

    if (pongState.playerPowerUpTimer.active) {
        pongState.playerPowerUpTimer.remaining -= 16;
        if (pongState.playerPowerUpTimer.remaining <= 0) {
            if (pongState.playerPowerUpTimer.type === 'shield') {
                pongState.paddles.left.shield = null;
            } else if (pongState.playerPowerUpTimer.type === 'wide') {
                pongState.paddles.left.height = 90; // Reset to 90
            }
            pongState.playerPowerUpTimer.active = false;
        }
    }

    if (pongState.enemyPowerUpTimer.active) {
        pongState.enemyPowerUpTimer.remaining -= 16;
        if (pongState.enemyPowerUpTimer.remaining <= 0) {
            if (pongState.enemyPowerUpTimer.type === 'shield') {
                pongState.paddles.right.shield = null;
            } else if (pongState.enemyPowerUpTimer.type === 'wide') {
                pongState.paddles.right.height = 90; // Reset to 90
            }
            pongState.enemyPowerUpTimer.active = false;
        }
    }

    drawPong();
    animationFrameId = requestAnimationFrame(updatePong);
}

function resetRound() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = (Math.random() > 0.5 ? 5 : -5) * 1.25;
    pongState.ball.dy = (Math.random() > 0.5 ? 5 : -5) * 1.25;
    pongState.ballFromPlayer = false;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth;
    pongState.paddles.left.y = pongState.height / 2 - pongState.paddles.left.height / 2;
    pongState.paddles.right.y = pongState.height / 2 - pongState.paddles.right.height / 2;
    pongState.paddles.left.uncontactable = 0;
    pongState.paddles.right.uncontactable = Infinity;
    pongState.bricks.left.forEach(brick => { brick.alive = true; brick.invulnerable = 0; });
    pongState.bricks.right.forEach(brick => { brick.alive = true; brick.invulnerable = 0; });
    pongState.lasers = [];
    pongState.powerUp = null;
    pongState.paddles.left.shield = null;
    pongState.paddles.right.shield = null;
    pongState.paddles.left.height = 90; // Reset to 90
    pongState.paddles.right.height = 90; // Reset to 90
    pongState.playerPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    pongState.enemyPowerUpTimer = { active: false, type: null, remaining: 0, max: 0 };
    pongState.paddles.right.lastTaskChange = 0;
    pongState.paddles.right.currentTask = 'ball';
}

function resetGame() {
    pongState.ball.x = pongState.width / 2;
    pongState.ball.y = pongState.height / 2;
    pongState.ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
    pongState.ball.dy = -5;
    pongState.paddles.left.health = pongState.paddles.left.maxHealth;
    pongState.paddles.right.health = pongState.paddles.right.maxHealth;
    pongState.lasers = [];
    pongState.powerUp = null;
    pongState.paddles.left.shield = null;
    pongState.paddles.right.shield = null;
    pongState.paddles.left.height = 90; // Reset to 90
    pongState.paddles.right.height = 90; // Reset to 90
    pongState.scores.left = 0;
    pongState.scores.right = 0;
    pongState.roundStartTime = Date.now();
    pongState.aiNextShot = Date.now() + 500;
    pongState.ballFromPlayer = false;
    pongState.gameOver = false;
    pongState.winner = null;
    pongState.started = true; // Ensure game starts immediately after reset
    pongState.roundPaused = false;
    pongState.paddles.right.lastTaskChange = 0;
    pongState.paddles.right.currentTask = 'ball';
    initBricks();
    spawnPowerUp();
}

function spawnPowerUp() {
    const types = ['health', 'shield', 'double', 'wide'];
    pongState.powerUp = {
        x: Math.random() * (500) + 100, // Spawn between x: 100 and 600
        y: Math.random() * (400) + 100, // Spawn between y: 100 and 500
        type: types[Math.floor(Math.random() * types.length)],
        active: false
    };
    pongState.lastPowerUpTime = Date.now();
}

function applyPowerUp(from) {
    const paddle = pongState.paddles[from];
    const timer = from === 'left' ? pongState.playerPowerUpTimer : pongState.enemyPowerUpTimer;

    if (from === 'left') {
        pongState.paddles.left.shield = null;
        pongState.paddles.left.height = 90; // Reset to 90
        pongState.playerPowerUpTimer.active = false;
    } else {
        pongState.paddles.right.shield = null;
        pongState.paddles.right.height = 90; // Reset to 90
        pongState.enemyPowerUpTimer.active = false;
    }

    if (pongState.powerUp && !pongState.powerUp.active) {
        switch (pongState.powerUp.type) {
            case 'health':
                paddle.health = Math.min(paddle.maxHealth, paddle.health + 3);
                if (from === 'left') pongState.powerUpText = { text: 'Health Up!', timer: 2000 };
                playSound(600, 0.2);
                pongState.powerUp.active = true;
                break;
            case 'shield':
                paddle.shield = { x: from === 'left' ? paddle.x + paddle.width + 5 : paddle.x - 10, y: paddle.y, width: 5, height: paddle.height };
                if (from === 'left') {
                    pongState.playerPowerUpTimer = { active: true, type: 'shield', remaining: 7000, max: 7000 };
                    pongState.powerUpText = { text: 'Shield!', timer: 2000 };
                } else {
                    pongState.enemyPowerUpTimer = { active: true, type: 'shield', remaining: 7000, max: 7000 };
                }
                playSound(700, 0.2);
                pongState.powerUp.active = true;
                break;
            case 'double':
                if (from === 'left') {
                    pongState.playerPowerUpTimer = { active: true, type: 'double', remaining: 7000, max: 7000 };
                    pongState.powerUpText = { text: 'FirePower!', timer: 2000 };
                } else {
                    pongState.enemyPowerUpTimer = { active: true, type: 'double', remaining: 7000, max: 7000 };
                }
                playSound(650, 0.2);
                pongState.powerUp.active = true;
                break;
            case 'wide':
                paddle.height = 200;
                if (from === 'left') {
                    pongState.playerPowerUpTimer = { active: true, type: 'wide', remaining: 20000, max: 20000 };
                    pongState.powerUpText = { text: 'Stretch!', timer: 2000 };
                } else {
                    pongState.enemyPowerUpTimer = { active: true, type: 'wide', remaining: 20000, max: 20000 };
                }
                playSound(750, 0.2);
                pongState.powerUp.active = true;
                break;
        }
        pongState.powerUp = null;
    }
}

function shootLaser(from) {
    const now = Date.now();
    const paddle = pongState.paddles[from];
    if (now - paddle.lastShot < 500) return;
    const timer = from === 'left' ? pongState.playerPowerUpTimer : pongState.enemyPowerUpTimer;
    const laser = {
        x: from === 'left' ? paddle.x + paddle.width : paddle.x,
        y: paddle.y + paddle.height / 2,
        width: 20,
        dx: from === 'left' ? 10 : -10,
        from: from
    };
    pongState.lasers.push(laser);

    if (timer.active && timer.type === 'double') {
        const laserTop = { ...laser, y: paddle.y + paddle.height / 4 }; // Top "wing"
        const laserBottom = { ...laser, y: paddle.y + (3 * paddle.height) / 4 }; // Bottom "wing"
        pongState.lasers.push(laserTop);
        pongState.lasers.push(laserBottom);
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
        e.preventDefault(); // Prevent default behavior
        resetGame();
        return;
    }
    if (pongState.gameOver) return;
    if (e.key === 'w') {
        pongState.paddles.left.dy = -10;
        playSound(200, 0.05);
    } else if (e.key === 's') {
        pongState.paddles.left.dy = 10;
        playSound(200, 0.05);
    } else if (e.key === ' ') {
        e.preventDefault();
        shootLaser('left');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w') {
        if (!keys.s) pongState.paddles.left.dy = 0;
    } else if (e.key === 's') {
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

    const deadZone = 10; // Reduced to 10px
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