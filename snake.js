const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const tileCount = 66;
const gridSize = 8;
let snake = [];
let dx = 0;
let dy = 0;
let moveQueue = [];
let bitsCollected = 0;
let highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 0;
let targetBit = null;
let gameRunning = true;
let deathAnimation = false;
let blinkCount = 0;
let timer = 10;
let lastUpdateTime = performance.now();
let bugs = [];
let partitions = [];
let partitionsTimer = 0;
let corruptedDriversActive = false;
let corruptedTimer = 0;
let fragmentedDriveActive = false;
let fragmentedTimer = 0;
let dataScrambleActive = false;
let dataScrambleMap = [];
let magneticActive = false;
let magneticTimer = 0;
let lostSegments = [];
let rejoiningSegments = [];
let deathColumns = [0, 0];
let eventMessage = '';
let eventTimer = 0;
const tickSpeed = 1000 / 15; // ~66ms per tick
const sectionSize = 16;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
}

function resizeCanvas() {
    const size = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7);
    canvas.width = tileCount * gridSize;
    canvas.height = tileCount * gridSize + 80;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
}

function startGame() {
    snake = [{ x: 33, y: 33 }];
    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    dx = randomDir.dx;
    dy = randomDir.dy;

    spawnBit();
    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    const deltaTime = (currentTime - lastUpdateTime) / 1000;
    if (deltaTime >= tickSpeed / 1000) {
        lastUpdateTime = currentTime;
        if (gameRunning) {
            update(deltaTime);
        }
    }

    if (fragmentedDriveActive) {
        drawFragmented();
    } else {
        draw();
    }
}

function update(deltaTime) {
    if (corruptedDriversActive) {
        corruptedTimer -= deltaTime;
        if (corruptedTimer <= 0) {
            corruptedDriversActive = false;
            timer = 10;
            showEvent('Controls Restored!');
        }
    }

    if (fragmentedDriveActive) {
        fragmentedTimer -= deltaTime;
        if (fragmentedTimer <= 0) {
            fragmentedDriveActive = false;
            timer = 10;
        }
    }

    if (partitions.length > 0) {
        partitionsTimer -= deltaTime;
        if (partitionsTimer <= 0) {
            partitions = [];
            timer = 10;
        }
    }

    if (magneticActive) {
        magneticTimer -= deltaTime;
        if (magneticTimer <= 0) {
            magneticActive = false;
        }
    }

    if (!corruptedDriversActive && !fragmentedDriveActive && !partitions.length) {
        timer -= deltaTime;
        if (timer <= 0) {
            triggerGlitch();
        }
    }

    if (moveQueue.length > 0) {
        const nextMove = moveQueue.shift();
        dx = corruptedDriversActive ? -nextMove.dx : nextMove.dx;
        dy = corruptedDriversActive ? -nextMove.dy : nextMove.dy;
    }

    let head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (fragmentedDriveActive) {
        if (head.x <= 0) {
            head.x = 64;
            dx = -1;
        } else if (head.x >= tileCount - 1) {
            head.x = 1;
            dx = 1;
        }
    }

    let safeMove = false;

    lostSegments = lostSegments.filter(segment => {
        const touched = segment.tail.some(seg => head.x === seg.x && head.y === seg.y);
        if (touched) {
            rejoiningSegments.push(...segment.tail);
            safeMove = true;
            return false;
        }
        return true;
    });

    if (!safeMove && checkCollision(head)) {
        gameRunning = false;
        playSound(200, 500, 'square');
        startDeathAnimation();
        return;
    }

    snake.unshift(head);

    if (magneticActive && targetBit) {
        const dxBit = head.x - targetBit.x;
        const dyBit = head.y - targetBit.y;
        const distance = Math.sqrt(dxBit * dxBit + dyBit * dyBit);
        if (distance <= 1) {
            bitsCollected++;
            playSound(800, 100);
            timer += 3;
            if (targetBit.isStabilizing) timer += 10;
            if (targetBit.isMagnetic) {
                magneticActive = true;
                magneticTimer = 30;
                showEvent('Magnetic Field Active!');
            }
            targetBit = null;
            spawnBit();
        } else if (distance <= 5) {
            const moveSpeed = 2;
            if (Math.abs(dxBit) > Math.abs(dyBit)) {
                targetBit.x += dxBit > 0 ? moveSpeed : -moveSpeed;
                if (Math.abs(dyBit) > 0) targetBit.y += dyBit > 0 ? 1 : -1;
            } else {
                targetBit.y += dyBit > 0 ? moveSpeed : -moveSpeed;
                if (Math.abs(dxBit) > 0) targetBit.x += dxBit > 0 ? 1 : -1;
            }
            targetBit.x = Math.max(1, Math.min(tileCount - 2, targetBit.x));
            targetBit.y = Math.max(1, Math.min(tileCount - 2, targetBit.y));
        }
    }

    if (targetBit && head.x === targetBit.x && head.y === targetBit.y) {
        bitsCollected++;
        playSound(800, 100);
        timer += 3;
        if (targetBit.isStabilizing) timer += 10;
        if (targetBit.isMagnetic) {
            magneticActive = true;
            magneticTimer = 30;
            showEvent('Magnetic Field Active!');
        }
        targetBit = null;
        spawnBit();
    } else if (rejoiningSegments.length > 0 && (dx !== 0 || dy !== 0)) {
        rejoiningSegments.shift();
    } else {
        snake.pop();
    }

    if (bugs.length > 0) {
        console.log(`Updating ${bugs.length} bugs`);
        bugs = bugs.filter(bug => {
            const head = bug.segments[0];
            let direction = bug.direction;
            let newHead = { x: head.x + direction.dx, y: head.y + direction.dy };

            // Initial 10 moves: invincible, straight movement
            if (bug.distanceMoved < bug.initialMove) {
                bug.segments.unshift(newHead);
                bug.segments.pop();
                bug.distanceMoved++;
                console.log(`Bug moved to (${newHead.x}, ${newHead.y}) - invincible (${bug.distanceMoved}/${bug.initialMove})`);
                return true;
            }

            // After 10 moves: random direction changes
            bug.directionChangeTimer--;
            if (bug.directionChangeTimer <= 0) {
                const directions = [
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                ].filter(d => d.dx !== -direction.dx || d.dy !== -direction.dy); // Avoid reversing
                direction = directions[Math.floor(Math.random() * directions.length)];
                bug.direction = direction;
                bug.directionChangeTimer = Math.floor(Math.random() * 38) + 7; // 7-45 ticks (~0.47-3 sec)
                console.log(`Bug at (${head.x}, ${head.y}) changed direction to (${direction.dx}, ${direction.dy})`);
            }

            newHead = { x: head.x + direction.dx, y: head.y + direction.dy };

            // Death conditions
            if (newHead.x < 1 || newHead.x > tileCount - 2 || newHead.y < 1 || newHead.y > tileCount - 2 ||
                snake.some(s => s.x === newHead.x && s.y === newHead.y) ||
                bug.segments.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
                console.log(`Bug died at (${newHead.x}, ${newHead.y})`);
                return false;
            }

            // Move if valid
            if (newHead.x >= 1 && newHead.x <= tileCount - 2 && newHead.y >= 1 && newHead.y <= tileCount - 2 && !isOccupied(newHead)) {
                bug.segments.unshift(newHead);
                bug.segments.pop();
                bug.distanceMoved++;
                console.log(`Bug moved to (${newHead.x}, ${newHead.y})`);
                return true;
            }

            console.log(`Bug died at (${newHead.x}, ${newHead.y}) - no valid move`);
            return false;
        });
    }

    if (eventTimer > 0) {
        eventTimer -= deltaTime;
        if (eventTimer <= 0) eventMessage = '';
    }

    scoreDisplay.textContent = `Bits: ${bitsCollected} --- High Score: ${highScore}`;
}

function draw() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (dataScrambleActive) {
        drawScrambled();
    } else {
        drawGameElements(x => x, y => y);
    }

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, tileCount * gridSize);
    ctx.moveTo(canvas.width - 1, 0);
    ctx.lineTo(canvas.width - 1, tileCount * gridSize);
    ctx.moveTo(0, tileCount * gridSize - 1);
    ctx.lineTo(canvas.width, tileCount * gridSize - 1);
    ctx.stroke();

    drawTimers();
    drawEventMessage(tileCount * gridSize);
    if (deathAnimation) drawDeathAnimation();
}

function drawFragmented() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGameElements(x => x, y => y);

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(canvas.width, 0);
    ctx.moveTo(0, tileCount * gridSize - 1);
    ctx.lineTo(canvas.width, tileCount * gridSize - 1);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, tileCount * gridSize);
    ctx.moveTo(canvas.width - 1, 0);
    ctx.lineTo(canvas.width - 1, tileCount * gridSize);
    ctx.moveTo(deathColumns[0] * gridSize, 0);
    ctx.lineTo(deathColumns[0] * gridSize, tileCount * gridSize);
    ctx.moveTo((deathColumns[1] + 1) * gridSize - 1, 0);
    ctx.lineTo((deathColumns[1] + 1) * gridSize - 1, tileCount * gridSize);
    ctx.stroke();

    drawTimers();
    drawEventMessage(tileCount * gridSize);
    if (deathAnimation) drawDeathAnimation();
}

function drawScrambled() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    snake.forEach(segment => {
        const drawX = segment.x;
        const drawY = segment.y;
        ctx.fillStyle = magneticActive ? '#c0c0c0' : '#ff007a';
        ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = magneticActive ? '#c0c0c0' : '#ff007a';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
    });

    lostSegments.forEach(segment => {
        segment.tail.forEach(seg => {
            const drawX = seg.x;
            const drawY = seg.y;
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });

    if (targetBit) {
        const drawX = targetBit.x;
        const drawY = targetBit.y;
        ctx.fillStyle = targetBit.isStabilizing ? '#00ff00' : (targetBit.isMagnetic ? '#0000ff' : '#00ffcc');
        if (targetBit.isStabilizing) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.roundRect(drawX * gridSize - gridSize, drawY * gridSize - gridSize, gridSize * 3, gridSize * 3, gridSize);
            ctx.fill();
            ctx.fillStyle = '#00ff00';
        } else if (targetBit.isMagnetic) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.roundRect(drawX * gridSize - gridSize, drawY * gridSize - gridSize, gridSize * 3, gridSize * 3, gridSize);
            ctx.fill();
            ctx.fillStyle = '#0000ff';
        }
        ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = targetBit.isStabilizing ? '#00ff00' : (targetBit.isMagnetic ? '#0000ff' : '#00ffcc');
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
    }

    bugs.forEach(bug => {
        bug.segments.forEach(segment => {
            const drawX = segment.x;
            const drawY = segment.y;
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });

    partitions.forEach(partition => {
        partition.forEach(segment => {
            const drawX = segment.x;
            const drawY = segment.y;
            ctx.fillStyle = '#ff8000';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });
}

function drawGameElements(transformX, transformY) {
    snake.forEach(segment => {
        const drawX = transformX(segment.x);
        const drawY = transformY(segment.y);
        ctx.fillStyle = magneticActive ? '#c0c0c0' : '#ff007a';
        ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = magneticActive ? '#c0c0c0' : '#ff007a';
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
    });

    lostSegments.forEach(segment => {
        segment.tail.forEach(seg => {
            const drawX = transformX(seg.x);
            const drawY = transformY(seg.y);
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });

    if (targetBit) {
        const drawX = transformX(targetBit.x);
        const drawY = transformY(targetBit.y);
        ctx.fillStyle = targetBit.isStabilizing ? '#00ff00' : (targetBit.isMagnetic ? '#0000ff' : '#00ffcc');
        if (targetBit.isStabilizing) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.roundRect(drawX * gridSize - gridSize, drawY * gridSize - gridSize, gridSize * 3, gridSize * 3, gridSize);
            ctx.fill();
            ctx.fillStyle = '#00ff00';
        } else if (targetBit.isMagnetic) {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
            ctx.roundRect(drawX * gridSize - gridSize, drawY * gridSize - gridSize, gridSize * 3, gridSize * 3, gridSize);
            ctx.fill();
            ctx.fillStyle = '#0000ff';
        }
        ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = targetBit.isStabilizing ? '#00ff00' : (targetBit.isMagnetic ? '#0000ff' : '#00ffcc');
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
    }

    bugs.forEach(bug => {
        bug.segments.forEach(segment => {
            const drawX = transformX(segment.x);
            const drawY = transformY(segment.y);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });

    partitions.forEach(partition => {
        partition.forEach(segment => {
            const drawX = transformX(segment.x);
            const drawY = transformY(segment.y);
            ctx.fillStyle = '#ff8000';
            ctx.fillRect(drawX * gridSize, drawY * gridSize, gridSize - 1, gridSize - 1);
        });
    });
}

function drawTimers() {
    let yOffset = tileCount * gridSize + 5;

    const glitchBarWidth = Math.max(0, (timer / 10) * canvas.width);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, yOffset, glitchBarWidth, 15);
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, yOffset, canvas.width, 15);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 14px Orbitron';
    ctx.textAlign = 'right';
    const glitchMinutes = Math.floor(timer / 60);
    const glitchSeconds = Math.floor(timer % 60);
    const glitchTenths = Math.floor((timer % 1) * 10);
    const glitchTimeStr = `${String(glitchMinutes).padStart(2, '0')}:${String(glitchSeconds).padStart(2, '0')}.${glitchTenths}`;
    ctx.fillText(glitchTimeStr, canvas.width - 10, yOffset + 12);
    yOffset += 15;

    if (corruptedDriversActive) {
        const corruptedBarWidth = Math.max(0, (corruptedTimer / 15) * canvas.width);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, yOffset, corruptedBarWidth, 15);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, yOffset, canvas.width, 15);
        ctx.fillStyle = '#00ff00';
        const corruptedSeconds = Math.floor(corruptedTimer);
        const corruptedTenths = Math.floor((corruptedTimer % 1) * 10);
        const corruptedTimeStr = `${String(corruptedSeconds).padStart(2, '0')}.${corruptedTenths}`;
        ctx.fillText(corruptedTimeStr, canvas.width - 10, yOffset + 12);
        yOffset += 15;
    }

    if (partitions.length > 0) {
        const partitionsBarWidth = Math.max(0, (partitionsTimer / 15) * canvas.width);
        ctx.fillStyle = '#ff8000';
        ctx.fillRect(0, yOffset, partitionsBarWidth, 15);
        ctx.strokeStyle = '#ff8000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, yOffset, canvas.width, 15);
        ctx.fillStyle = '#00ff00';
        const partitionsSeconds = Math.floor(partitionsTimer);
        const partitionsTenths = Math.floor((partitionsTimer % 1) * 10);
        const partitionsTimeStr = `${String(partitionsSeconds).padStart(2, '0')}.${partitionsTenths}`;
        ctx.fillText(partitionsTimeStr, canvas.width - 10, yOffset + 12);
        yOffset += 15;
    }

    if (magneticActive) {
        const magneticBarWidth = Math.max(0, (magneticTimer / 30) * canvas.width);
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, yOffset, magneticBarWidth, 15);
        ctx.strokeStyle = '#0000ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, yOffset, canvas.width, 15);
        ctx.fillStyle = '#00ff00';
        const magneticSeconds = Math.floor(magneticTimer);
        const magneticTenths = Math.floor((magneticTimer % 1) * 10);
        const magneticTimeStr = `${String(magneticSeconds).padStart(2, '0')}.${magneticTenths}`;
        ctx.fillText(magneticTimeStr, canvas.width - 10, yOffset + 12);
        yOffset += 15;
    }

    if (fragmentedDriveActive) {
        const fragmentedBarWidth = Math.max(0, (fragmentedTimer / 30) * canvas.width);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, yOffset, fragmentedBarWidth, 15);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, yOffset, canvas.width, 15);
        ctx.fillStyle = '#00ff00';
        const fragmentedSeconds = Math.floor(fragmentedTimer);
        const fragmentedTenths = Math.floor((fragmentedTimer % 1) * 10);
        const fragmentedTimeStr = `${String(fragmentedSeconds).padStart(2, '0')}.${fragmentedTenths}`;
        ctx.fillText(fragmentedTimeStr, canvas.width - 10, yOffset + 12);
    }
}

function drawEventMessage(playfieldHeight) {
    if (!eventMessage) return;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${canvas.width / 20}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText(eventMessage, canvas.width / 2, playfieldHeight / 2);
}

function drawDeathAnimation() {
    if (blinkCount % 2 === 0) {
        snake.forEach(segment => {
            ctx.fillStyle = magneticActive ? '#c0c0c0' : '#ff007a';
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
            ctx.strokeStyle = magneticActive ? '#c0c0c0' : '#ff007a';
            ctx.lineWidth = 1;
            ctx.strokeRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
        });
    }

    ctx.fillStyle = '#ff007a';
    ctx.font = `${canvas.width / 15}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText('Defeat', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#00ffcc';
    ctx.font = `${canvas.width / 25}px Orbitron`;
    ctx.fillText('Press Space or Tap to Restart', canvas.width / 2, canvas.height / 2 + canvas.width / 20);
}

function startDeathAnimation() {
    deathAnimation = true;
    blinkCount = 0;
    setInterval(() => {
        if (deathAnimation) blinkCount++;
    }, 250);

    if (bitsCollected > highScore) {
        highScore = bitsCollected;
        localStorage.setItem('highScore', highScore);
    }
}

function isOccupied(pos) {
    return snake.some(s => s.x === pos.x && s.y === pos.y) || 
           (targetBit && targetBit.x === pos.x && targetBit.y === pos.y) || 
           bugs.some(b => b.segments.some(seg => seg.x === pos.x && seg.y === pos.y)) ||
           partitions.some(p => p.some(seg => seg.x === pos.x && seg.y === pos.y)) ||
           lostSegments.some(ls => ls.tail.some(seg => seg.x === pos.x && seg.y === pos.y));
}

function spawnBit() {
    targetBit = { x: Math.floor(Math.random() * (tileCount - 2)) + 1, y: Math.floor(Math.random() * (tileCount - 2)) + 1 };
    let attempts = 0;
    while (isOccupied(targetBit) && attempts < 100) {
        targetBit = { x: Math.floor(Math.random() * (tileCount - 2)) + 1, y: Math.floor(Math.random() * (tileCount - 2)) + 1 };
        attempts++;
    }
    targetBit.isStabilizing = Math.random() < 1/30;
    targetBit.isMagnetic = Math.random() < 1/45;
    if (targetBit.isStabilizing) showEvent('Stabilizing Bit!');
    if (targetBit.isMagnetic) showEvent('Magnetic Bit!');
}

function spawnBug() {
    const bug = { 
        segments: [], 
        direction: { dx: 0, dy: 0 }, 
        distanceMoved: 0, 
        initialMove: 10, // Fixed at 10
        directionChangeTimer: 0 // Start at 0, set after initial move
    };
    const length = Math.floor(Math.random() * 5) + 5; // 5-9 segments
    const edge = Math.floor(Math.random() * 4);
    let startX, startY, direction;

    switch (edge) {
        case 0: // Left
            startX = 1; // Head at 1
            startY = Math.floor(Math.random() * (tileCount - 2)) + 1; // 1-64
            direction = { dx: 1, dy: 0 }; // Moves right
            break;
        case 1: // Right
            startX = tileCount - 2; // Head at 64
            startY = Math.floor(Math.random() * (tileCount - 2)) + 1; // 1-64
            direction = { dx: -1, dy: 0 }; // Moves left
            break;
        case 2: // Top
            startX = Math.floor(Math.random() * (tileCount - 2)) + 1; // 1-64
            startY = 1; // Head at 1
            direction = { dx: 0, dy: 1 }; // Moves down
            break;
        case 3: // Bottom
            startX = Math.floor(Math.random() * (tileCount - 2)) + 1; // 1-64
            startY = tileCount - 2; // Head at 64
            direction = { dx: 0, dy: -1 }; // Moves up
            break;
    }

    console.log(`Attempting to spawn bug at (${startX}, ${startY}) with direction (${direction.dx}, ${direction.dy}), length ${length}`);

    for (let i = 0; i < length; i++) {
        const pos = { x: startX + i * direction.dx, y: startY + i * direction.dy };
        if (pos.x < 1 || pos.x > tileCount - 2 || pos.y < 1 || pos.y > tileCount - 2 || isOccupied(pos)) {
            console.log(`Spawn failed: Position (${pos.x}, ${pos.y}) out of bounds or occupied`);
            return null;
        }
        bug.segments.push(pos);
    }

    bug.direction = direction;
    console.log(`Bug spawned successfully at (${startX}, ${startY}) with ${bug.segments.length} segments`);
    return bug;
}

function bugAttack() {
    bugs = [];
    let attempts = 0;
    while (bugs.length < 5 && attempts < 20) {
        const bug = spawnBug();
        if (bug) {
            bugs.push(bug);
            console.log(`Bug ${bugs.length} added`);
        }
        attempts++;
    }
    console.log(`Bug Attack triggered: ${bugs.length} bugs spawned`);
    timer = 10;
    dataScrambleActive = false;
    showEvent('Bug Attack!');
}

function dataScramble() {
    timer = 10;
    bugs = [];
    partitions = [];
    dataScrambleActive = true;

    const head = snake[0];
    const headSectionX = Math.floor(head.x / sectionSize);
    const headSectionY = Math.floor(head.y / sectionSize);
    const headSection = headSectionY * 4 + headSectionX;
    const middleSquares = [5, 6, 9, 10];

    dataScrambleMap = Array.from({ length: 16 }, (_, i) => i);
    for (let i = dataScrambleMap.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dataScrambleMap[i], dataScrambleMap[j]] = [dataScrambleMap[j], dataScrambleMap[i]];
    }

    const headMappedTo = dataScrambleMap[headSection];
    if (!middleSquares.includes(headMappedTo)) {
        const randomMiddle = middleSquares[Math.floor(Math.random() * 4)];
        const currentMiddleIndex = dataScrambleMap.indexOf(randomMiddle);
        dataScrambleMap[currentMiddleIndex] = headMappedTo;
        dataScrambleMap[headSection] = randomMiddle;
    }

    const newSnake = [];
    const severedSegments = [];
    snake.forEach(segment => {
        const origSectionX = Math.floor(segment.x / sectionSize);
        const origSectionY = Math.floor(segment.y / sectionSize);
        const origSection = origSectionY * 4 + origSectionX;
        const newSection = dataScrambleMap[origSection];
        const newSectionX = newSection % 4;
        const newSectionY = Math.floor(newSection / 4);
        const offsetX = (newSectionX - origSectionX) * sectionSize;
        const offsetY = (newSectionY - origSectionY) * sectionSize;
        const newPos = { x: segment.x + offsetX, y: segment.y + offsetY };

        if (newSnake.length === 0 || 
            (Math.abs(newPos.x - newSnake[newSnake.length - 1].x) <= 1 && 
             Math.abs(newPos.y - newSnake[newSnake.length - 1].y) <= 1)) {
            newSnake.push(newPos);
        } else {
            severedSegments.push(newPos);
        }
    });
    snake = newSnake;
    if (severedSegments.length > 0) {
        lostSegments.push({ tail: severedSegments });
    }

    if (targetBit) {
        const origSectionX = Math.floor(targetBit.x / sectionSize);
        const origSectionY = Math.floor(targetBit.y / sectionSize);
        const origSection = origSectionY * 4 + origSectionX;
        const newSection = dataScrambleMap[origSection];
        const newSectionX = newSection % 4;
        const newSectionY = Math.floor(newSection / 4);
        const offsetX = (newSectionX - origSectionX) * sectionSize;
        const offsetY = (newSectionY - origSectionY) * sectionSize;
        targetBit.x += offsetX;
        targetBit.y += offsetY;
    }

    showEvent('Data Scramble!');
}

function partitionsCreated() {
    partitions = [];
    const partitionCount = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < partitionCount; i++) {
        const partition = [];
        const length = Math.floor(Math.random() * 5) + 3;
        const startX = Math.floor(Math.random() * (tileCount - 2 - length)) + 1;
        const startY = Math.floor(Math.random() * (tileCount - 2)) + 1;
        const direction = Math.random() < 0.5 ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
        let valid = true;
        for (let j = 0; j < length; j++) {
            const pos = { x: startX + j * direction.dx, y: startY + j * direction.dy };
            if (isOccupied(pos) || pos.x > tileCount - 2 || pos.y > tileCount - 2) {
                valid = false;
                break;
            }
            partition.push(pos);
        }
        if (valid && partition.length > 0) partitions.push(partition);
    }
    partitionsTimer = 15;
    dataScrambleActive = false;
    showEvent('Partitions Created!');
}

function corruptedDrivers() {
    corruptedDriversActive = true;
    corruptedTimer = 15;
    dataScrambleActive = false;
    showEvent('Corrupted Drivers!');
}

function fragmentedDrive() {
    fragmentedDriveActive = true;
    fragmentedTimer = 30;
    dataScrambleActive = false;
    showEvent('Fragmented Drive!');

    const headX = snake[0].x;
    let leftCol;
    do {
        leftCol = Math.floor(Math.random() * 45) + 10;
        deathColumns = [leftCol, leftCol + 1];
    } while (Math.abs(headX - deathColumns[0]) <= 8 || Math.abs(headX - deathColumns[1]) <= 8);

    let severIndex = -1;
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === deathColumns[0] || snake[i].x === deathColumns[1]) {
            severIndex = i;
            break;
        }
    }
    if (severIndex !== -1) {
        const severedTail = snake.splice(severIndex);
        lostSegments.push({ tail: severedTail });
    }
}

function checkCollision(head) {
    if (fragmentedDriveActive) {
        if (head.x === deathColumns[0] || head.x === deathColumns[1]) return true;
    }
    return (head.x <= 0 || head.x >= tileCount - 1 || head.y <= 0 || head.y >= tileCount - 1) && !fragmentedDriveActive || 
           snake.some(segment => segment.x === head.x && segment.y === head.y) ||
           bugs.some(b => b.segments.some(seg => seg.x === head.x && seg.y === head.y)) ||
           partitions.some(p => p.some(seg => seg.x === head.x && seg.y === head.y));
}

function resetGame() {
    snake = [{ x: 33, y: 33 }];
    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    dx = randomDir.dx;
    dy = randomDir.dy;
    moveQueue = [];
    bitsCollected = 0;
    timer = 10;
    bugs = [];
    partitions = [];
    partitionsTimer = 0;
    corruptedDriversActive = false;
    corruptedTimer = 0;
    fragmentedDriveActive = false;
    fragmentedTimer = 0;
    dataScrambleActive = false;
    dataScrambleMap = [];
    magneticActive = false;
    magneticTimer = 0;
    lostSegments = [];
    rejoiningSegments = [];
    eventMessage = '';
    deathColumns = [0, 0];
    spawnBit();
    gameRunning = true;
    deathAnimation = false;
}

function showEvent(message) {
    eventMessage = message;
    eventTimer = 2;
}

function triggerGlitch() {
    const glitchOptions = fragmentedDriveActive 
        ? [bugAttack, dataScramble, partitionsCreated, corruptedDrivers] 
        : [bugAttack, dataScramble, partitionsCreated, corruptedDrivers, fragmentedDrive];
    const glitch = glitchOptions[Math.floor(Math.random() * glitchOptions.length)];
    glitch();
}

document.addEventListener('keydown', e => {
    if (e.key === ' ' && !gameRunning) {
        resetGame();
        return;
    }
    if (!gameRunning) return;
    let newDx = dx, newDy = dy;
    switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': if (dy !== 1) { newDx = 0; newDy = -1; } break;
        case 'a': case 'arrowleft': if (dx !== 1) { newDx = -1; newDy = 0; } break;
        case 's': case 'arrowdown': if (dy !== -1) { newDx = 0; newDy = 1; } break;
        case 'd': case 'arrowright': if (dx !== -1) { newDx = 1; newDy = 0; } break;
    }
    if (newDx !== dx || newDy !== dy) moveQueue.push({ dx: newDx, dy: newDy });
});

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', e => {
    if (!gameRunning) {
        resetGame();
        return;
    }
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener('touchmove', e => {
    if (!gameRunning) return;
    e.preventDefault();
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    let newDx = dx, newDy = dy;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 20 && dx !== -1) { newDx = 1; newDy = 0; }
        else if (deltaX < -20 && dx !== 1) { newDx = -1; newDy = 0; }
    } else {
        if (deltaY > 20 && dy !== -1) { newDx = 0; newDy = 1; }
        else if (deltaY < -20 && dy !== 1) { newDx = 0; newDy = -1; }
    }
    if (newDx !== dx || newDy !== dy) moveQueue.push({ dx: newDx, dy: newDy });

    touchStartX = touchEndX;
    touchStartY = touchEndY;
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
startGame();

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
    };
}