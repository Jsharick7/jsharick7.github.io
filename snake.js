const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');
const tileCount = 64; // 64x64 grid
const gridSize = 8; // 8px per square
let snake = [{ x: 32, y: 32 }];
let dx = 0;
let dy = 0;
let moveQueue = [];
let bitsCollected = 0;
let targetBit = null;
let gameRunning = true;
let deathAnimation = false;
let blinkCount = 0;
let timer = 15;
let lastUpdateTime = performance.now();
let glitchActive = false;
let bugs = [];
let partitions = [];
let glitchDuration = 0;
let eventMessage = '';
let eventTimer = 0;
let lostSegments = []; // Blue segments to rejoin
const tickSpeed = 1000 / 15; // 15 squares per second (~66.67ms)

function resizeCanvas() {
    const size = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7); // 70vh/vw
    canvas.width = tileCount * gridSize; // 512px
    canvas.height = tileCount * gridSize; // 512px
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
}

function startGame() {
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

    draw();
}

function update(deltaTime) {
    if (!glitchActive) {
        timer -= deltaTime;
        if (timer <= 0) {
            triggerGlitch();
            return;
        }
    } else {
        updateGlitch();
    }

    if (moveQueue.length > 0) {
        const nextMove = moveQueue.shift();
        dx = nextMove.dx;
        dy = nextMove.dy;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    if (checkCollision(head)) {
        gameRunning = false;
        startDeathAnimation();
        return;
    }

    snake.unshift(head);

    // Check for lost segment reconnection
    lostSegments = lostSegments.filter(segment => {
        if (head.x === segment.x && head.y === segment.y) {
            snake.push(...segment.tail); // Rejoin full length
            return false;
        }
        return true;
    });

    if (targetBit && head.x === targetBit.x && head.y === targetBit.y) {
        bitsCollected++;
        timer += 3;
        if (targetBit.isStabilizing) {
            timer += 10; // Pause timer for 10 seconds
            showEvent('Stabilizing Bit Collected!');
        }
        spawnBit();
    } else {
        snake.pop();
    }

    if (eventTimer > 0) {
        eventTimer -= deltaTime;
        if (eventTimer <= 0) eventMessage = '';
    }
}

function draw() {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const timerHeight = canvas.height * 0.05;
    const playfieldHeight = canvas.height - timerHeight * 2;

    // Draw border using grid squares
    ctx.fillStyle = '#00ffcc';
    for (let i = 0; i < tileCount; i++) {
        ctx.fillRect(i * gridSize, 0, gridSize - 1, gridSize - 1);
        ctx.fillRect(i * gridSize, (tileCount - 1) * gridSize, gridSize - 1, gridSize - 1);
        ctx.fillRect(0, i * gridSize, gridSize - 1, gridSize - 1);
        ctx.fillRect((tileCount - 1) * gridSize, i * gridSize, gridSize - 1, gridSize - 1);
    }

    snake.forEach(segment => {
        ctx.fillStyle = '#ff007a';
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = '#ff007a';
        ctx.lineWidth = 1;
        ctx.strokeRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
    });

    lostSegments.forEach(segment => {
        segment.tail.forEach(seg => {
            ctx.fillStyle = '#0000ff'; // Blue for lost segments
            ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize - 1, gridSize - 1);
        });
    });

    if (targetBit) {
        ctx.fillStyle = targetBit.isStabilizing ? '#00ff00' : '#00ffcc';
        if (targetBit.isStabilizing) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.roundRect(targetBit.x * gridSize - gridSize, targetBit.y * gridSize - gridSize, gridSize * 3, gridSize * 3, gridSize);
            ctx.fill();
            ctx.fillStyle = '#00ff00';
        }
        ctx.fillRect(targetBit.x * gridSize, targetBit.y * gridSize, gridSize - 1, gridSize - 1);
        ctx.strokeStyle = targetBit.isStabilizing ? '#00ff00' : '#00ffcc';
        ctx.lineWidth = 1;
        ctx.strokeRect(targetBit.x * gridSize, targetBit.y * gridSize, gridSize - 1, gridSize - 1);
    }

    if (glitchActive) {
        drawGlitch();
    }

    drawTimerBar(playfieldHeight);
    drawScore();
    drawEventMessage(playfieldHeight);

    if (deathAnimation) {
        drawDeathAnimation();
    }
}

function drawTimerBar(playfieldHeight) {
    const timerHeight = canvas.height * 0.05;
    const barWidth = Math.max(0, (timer / 15) * canvas.width);
    
    ctx.fillStyle = '#ffff00';
    ctx.font = `${timerHeight * 0.6}px Orbitron`;
    ctx.textAlign = 'left';
    ctx.fillText('Time to Next Glitch', 10, playfieldHeight + timerHeight * 0.75);

    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, playfieldHeight + timerHeight, barWidth, timerHeight);
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, playfieldHeight + timerHeight, canvas.width, timerHeight);

    ctx.textAlign = 'right';
    const minutes = Math.floor(timer / 60);
    const seconds = Math.floor(timer % 60);
    const tenths = Math.floor((timer % 1) * 10);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
    ctx.fillText(timeStr, canvas.width - 10, playfieldHeight + timerHeight * 1.75);
}

function drawScore() {
    const timerHeight = canvas.height * 0.05;
    ctx.fillStyle = '#00ffcc';
    ctx.font = `${timerHeight * 0.6}px Orbitron`;
    ctx.textAlign = 'right';
    ctx.fillText(`Bits: ${bitsCollected}`, canvas.width - 10, timerHeight * 0.75); // Top-right, above board
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
            ctx.fillStyle = '#ff007a';
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
            ctx.strokeStyle = '#ff007a';
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
}

// Utility Functions
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
    if (targetBit.isStabilizing) showEvent('Stabilizing Bit!');
}

function checkCollision(head) {
    return head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount || 
           snake.some(segment => segment.x === head.x && segment.y === head.y) ||
           bugs.some(b => b.segments.some(seg => seg.x === head.x && seg.y === head.y)) ||
           partitions.some(p => p.some(seg => seg.x === head.x && seg.y === head.y));
}

function resetGame() {
    snake = [{ x: 32, y: 32 }];
    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    dx = randomDir.dx;
    dy = randomDir.dy;
    moveQueue = [];
    bitsCollected = 0;
    timer = 15;
    bugs = [];
    partitions = [];
    lostSegments = [];
    glitchActive = false;
    eventMessage = '';
    eventTimer = 0;
    spawnBit();
    gameRunning = true;
    deathAnimation = false;
}

function showEvent(message) {
    eventMessage = message;
    eventTimer = 2;
}

// Glitch Functions
function triggerGlitch() {
    glitchActive = true;
    const glitches = [bugAttack, dataScramble, partitionsCreated]; // Re-added partitionsCreated
    const glitch = glitches[Math.floor(Math.random() * glitches.length)];
    glitch();
}

function updateGlitch() {
    if (glitchDuration > 0) {
        glitchDuration -= tickSpeed / 1000;
        if (glitchDuration <= 0) {
            endGlitch();
        }
    }
    updateBugs();
}

function drawGlitch() {
    bugs.forEach(bug => {
        bug.segments.forEach(segment => {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
        });
    });
    partitions.forEach(partition => {
        partition.forEach(segment => {
            ctx.fillStyle = '#ff8000';
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
        });
    });
}

function endGlitch() {
    bugs = [];
    partitions = [];
    glitchActive = false;
    timer = 15;
}

function bugAttack() {
    bugs = [];
    for (let i = 0; i < 5; i++) {
        const bug = spawnBug();
        if (bug) bugs.push(bug);
    }
    glitchDuration = Infinity;
    showEvent('Bug Attack!');
}

function spawnBug() {
    const start = { x: Math.floor(Math.random() * (tileCount - 2)) + 1, y: Math.floor(Math.random() * (tileCount - 2)) + 1 };
    if (isOccupied(start)) return null;
    const bug = [start];
    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    for (let i = 1; i < 9; i++) {
        const prev = bug[i - 1];
        const segment = { x: prev.x - direction.dx, y: prev.y - direction.dy };
        if (isOccupied(segment) || segment.x < 1 || segment.x >= tileCount - 1 || segment.y < 1 || segment.y >= tileCount - 1) break;
        bug.push(segment);
    }
    return bug.length === 9 ? { segments: bug, direction, nextTurn: 0.2 + Math.random() * 2.3 } : null;
}

function updateBugs() {
    bugs = bugs.filter(bug => {
        bug.nextTurn -= tickSpeed / 1000;
        if (bug.nextTurn <= 0) {
            const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
            bug.direction = directions[Math.floor(Math.random() * directions.length)];
            bug.nextTurn = 0.2 + Math.random() * 2.3;
        }

        const head = { x: bug.segments[0].x + bug.direction.dx, y: bug.segments[0].y + bug.direction.dy };
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount || 
            snake.some(s => s.x === head.x && s.y === head.y && (s !== snake[0] || (s === snake[0] && (gameRunning = false)))) ||
            bugs.some(b => b !== bug && b.segments.some(seg => seg.x === head.x && seg.y === head.y)) ||
            partitions.some(p => p.some(seg => seg.x === head.x && seg.y === head.y))) {
            return false;
        }
        bug.segments.unshift(head);
        bug.segments.pop();
        return true;
    });
    if (bugs.length === 0 && glitchDuration === Infinity) endGlitch();
}

function dataScramble() {
    const chunkSize = tileCount / 4; // 16x16 chunks
    const grid = Array(16).fill().map(() => ({ snake: [], bugs: [], partitions: [], bit: null }));
    
    snake.forEach((segment, i) => {
        const chunkX = Math.floor(segment.x / chunkSize);
        const chunkY = Math.floor(segment.y / chunkSize);
        grid[chunkY * 4 + chunkX].snake.push({ ...segment, originalIndex: i });
    });
    if (targetBit) {
        const bitX = Math.floor(targetBit.x / chunkSize);
        const bitY = Math.floor(targetBit.y / chunkSize);
        grid[bitY * 4 + bitX].bit = { ...targetBit };
    }
    bugs.forEach(bug => {
        bug.segments.forEach((segment, i) => {
            const chunkX = Math.floor(segment.x / chunkSize);
            const chunkY = Math.floor(segment.y / chunkSize);
            grid[chunkY * 4 + chunkX].bugs.push({ ...segment, bugIndex: bugs.indexOf(bug), segIndex: i });
        });
    });
    partitions.forEach(partition => {
        partition.forEach((segment, i) => {
            const chunkX = Math.floor(segment.x / chunkSize);
            const chunkY = Math.floor(segment.y / chunkSize);
            grid[chunkY * 4 + chunkX].partitions.push({ ...segment, partIndex: partitions.indexOf(partition), segIndex: i });
        });
    });

    const headChunk = Math.floor(snake[0].x / chunkSize) + Math.floor(snake[0].y / chunkSize) * 4;
    const centerChunks = [5, 6, 9, 10];

    const shuffled = grid.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        if (i === headChunk) continue;
        let j = Math.floor(Math.random() * (i + 1));
        if (j === headChunk) j = (j + 1) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const headDest = centerChunks[Math.floor(Math.random() * 4)];
    const headSrcIdx = shuffled.indexOf(grid[headChunk]);
    [shuffled[headSrcIdx], shuffled[headDest]] = [shuffled[headDest], shuffled[headSrcIdx]];

    let newSnake = [];
    lostSegments = [];
    bugs = [];
    partitions = [];
    targetBit = null;

    shuffled.forEach((chunk, idx) => {
        const newChunkX = (idx % 4) * chunkSize;
        const newChunkY = Math.floor(idx / 4) * chunkSize;

        if (idx === headDest) {
            chunk.snake.forEach(segment => {
                const newX = newChunkX + (segment.x % chunkSize);
                const newY = newChunkY + (segment.y % chunkSize);
                newSnake.push({ x: newX, y: newY });
            });
        } else if (chunk.snake.length > 0) {
            const tail = chunk.snake.map(segment => ({
                x: newChunkX + (segment.x % chunkSize),
                y: newChunkY + (segment.y % chunkSize)
            }));
            lostSegments.push({ x: tail[0].x, y: tail[0].y, tail });
        }

        if (chunk.bit) {
            const newX = newChunkX + (chunk.bit.x % chunkSize);
            const newY = newChunkY + (chunk.bit.y % chunkSize);
            if (!isOccupied({ x: newX, y: newY })) {
                targetBit = { x: newX, y: newY, isStabilizing: chunk.bit.isStabilizing };
            }
        }

        chunk.bugs.forEach(seg => {
            const newX = newChunkX + (seg.x % chunkSize);
            const newY = newChunkY + (seg.y % chunkSize);
            if (!bugs[seg.bugIndex]) bugs[seg.bugIndex] = { segments: [], direction: { dx: 1, dy: 0 }, nextTurn: 0.2 + Math.random() * 2.3 };
            bugs[seg.bugIndex].segments[seg.segIndex] = { x: newX, y: newY };
        });

        chunk.partitions.forEach(seg => {
            const newX = newChunkX + (seg.x % chunkSize);
            const newY = newChunkY + (seg.y % chunkSize);
            if (!partitions[seg.partIndex]) partitions[seg.partIndex] = [];
            partitions[seg.partIndex][seg.segIndex] = { x: newX, y: newY };
        });
    });

    snake = newSnake.sort((a, b) => a.originalIndex - b.originalIndex);
    bugs = bugs.filter(b => b && b.segments.length === 9);
    partitions = partitions.filter(p => p && p.length > 1);

    glitchDuration = 0;
    endGlitch();
    showEvent('Data Scramble!');
}

function partitionsCreated() {
    partitions = [];
    const numSegments = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numSegments; i++) {
        const length = 3 + Math.floor(Math.random() * 8);
        const segment = spawnPartition(length);
        if (segment) partitions.push(segment);
    }
    glitchDuration = 15;
    showEvent('Partitions Created!');
}

function spawnPartition(length) {
    const start = { x: Math.floor(Math.random() * (tileCount - 2)) + 1, y: Math.floor(Math.random() * (tileCount - 2)) + 1 };
    if (isOccupied(start)) return null;
    
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const dir = directions[Math.floor(Math.random() * 4)];
    const partition = [start];
    
    const head = snake[0];
    const vectorX = dx !== 0 ? head.x + dx * tileCount : null;
    const vectorY = dy !== 0 ? head.y + dy * tileCount : null;

    for (let i = 1; i < length; i++) {
        const prev = partition[i - 1];
        const segment = { x: prev.x + dir[0], y: prev.y + dir[1] };
        
        if (segment.x < 1 || segment.x >= tileCount - 1 || segment.y < 1 || segment.y >= tileCount - 1 || isOccupied(segment) ||
            (dx !== 0 && segment.y === head.y && ((dx > 0 && segment.x > head.x) || (dx < 0 && segment.x < head.x))) ||
            (dy !== 0 && segment.x === head.x && ((dy > 0 && segment.y > head.y) || (dy < 0 && segment.y < head.y)))) {
            break;
        }
        partition.push(segment);
    }
    return partition.length > 1 ? partition : null;
}

// Controls
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

// Initialization
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
startGame();

// Add roundRect support for glow effect
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