// Basic Phaser Configuration
const config = {
    type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- Global Variables ---
let playerCar;
let cursors;
let roadGraphics;

let roadSegments = [];
let cameraZ = 0;
const segmentLength = 100;
const roadWidthAtScreenBottom = 2400;
const fieldOfView = 100;
const cameraHeight = 1000;
const drawDistance = 300;

let playerSpeed = 0;
const maxSpeed = 2400;
const accel = 800;
const decel = 600;
const braking = 1600;
let playerX = 0;

let horizontalPull = 0;
const pullIncrement = 0.4;
const maxHorizontalPull = 2.0;
const sidewaysSpeedFactor = 1.2;
const naturalPullReduction = 1.5;

const roadsideObjects = [];
const objectVerticalOffset = 500;

let currentRoadCurveValue = 0;
let curveDirection = 0;
let curveDuration = 0;
const maxCurveStrength = 250;
const minCurveDuration = 30;
const maxCurveDuration = 100;

const grassColor = 0x006400;

let score = 0;
let scoreText;
const scoreBaseIncrement = 1;
const scoreMultiplierCenter = 2.0;
const scoreMultiplierRumble = 0.5;
const scoreMultiplierOffTrack = 0.1;
const playerXCenterThreshold = 0.15;
const playerXRumbleThresholdMin = 0.7;
const playerXRumbleThresholdMax = 1.2;

let playerLives = 3;
let livesText;
let isGameOver = false;
let gameOverTextObj;
let playerInvincible = false;
const invincibilityDuration = 2000;
let lastHitTime = 0;
let restartKey;


// --- Phaser Scene Functions ---

function preload() {
    this.load.image('audiR8', 'assets/images/audiR8.png');
    this.load.image('tree', 'assets/images/tree.png');
    this.load.image('backgroundSky', 'assets/images/sky.png');
    this.load.image('stone', 'assets/images/stone.png');
    console.log("Preload function complete.");
}

function create() {
    let sky = this.add.image(0, 0, 'backgroundSky').setOrigin(0,0).setScrollFactor(0).setDepth(-100);
    sky.displayWidth = config.width;
    sky.displayHeight = config.height;

    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8');
    playerCar.setScale(0.125);
    playerCar.setDepth(100);

    cursors = this.input.keyboard.createCursorKeys();
    roadGraphics = this.add.graphics();
    roadGraphics.setDepth(1);

    score = 0;
    scoreText = this.add.text(16, 16, 'Score: 0', {
        fontSize: '24px', fill: '#ffffff', fontFamily: 'Arial, sans-serif',
        stroke: '#000000', strokeThickness: 4
    });
    scoreText.setScrollFactor(0).setDepth(200);

    playerLives = 3;
    livesText = this.add.text(16, 50, 'Lives: ' + playerLives, {
        fontSize: '24px', fill: '#ffffff', fontFamily: 'Arial, sans-serif',
        stroke: '#000000', strokeThickness: 4
    });
    livesText.setScrollFactor(0).setDepth(200);

    gameOverTextObj = this.add.text(config.width / 2, config.height / 2, 'GAME OVER\nPress R to Restart', {
        fontSize: '48px', fill: '#ff0000', fontFamily: 'Arial, sans-serif',
        align: 'center', stroke: '#000000', strokeThickness: 6
    });
    gameOverTextObj.setOrigin(0.5).setScrollFactor(0).setDepth(300).setVisible(false);

    isGameOver = false;
    playerInvincible = false;
    lastHitTime = 0;

    restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    roadSegments = [];
    for (let i = 0; i < drawDistance + 50; i++) {
        const isRumbler = Math.floor(i / 5) % 2 === 0;
        roadSegments.push({
            index: i, z: i * segmentLength, curve: 0, hill: 0,
            color: (Math.floor(i / 10) % 2 === 0) ? 0x888888 : 0x777777,
            // --- MODIFICATION: Rumble strip color changed to white/grey ---
            rumbleColor: isRumbler ? 0xFFFFFF : 0xCCCCCC, // Was 0xDD0000 (red)
            grassColor1: (Math.floor(i / 3) % 2 === 0) ? grassColor : 0x005000,
            grassColor2: (Math.floor(i / 3) % 2 === 0) ? 0x005A00 : grassColor
        });
    }

    while(roadsideObjects.length) {
        const objToDestroy = roadsideObjects.pop();
        if (objToDestroy.sprite) {
            objToDestroy.sprite.destroy();
        }
    }

    const numInitialObjects = Math.floor((drawDistance + 50) / 2.5);
    for (let i = 0; i < numInitialObjects ; i++) {
         const side = (Math.random() > 0.5 ? 1 : -1);
         const isStone = Math.random() > 0.5;
         const spriteKey = isStone ? 'stone' : 'tree';
         let initialObjScale = 0.3 + Math.random() * 0.4;
         if (isStone) initialObjScale = 0.03 + Math.random() * 0.04;

         const newSprite = this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50).setOrigin(0.5, 1);
         newSprite.setData('activeForCollision', true);

         roadsideObjects.push({
             spriteKey: spriteKey, worldX: side * (1.5 + Math.random() * 2.5),
             worldZ: (i * segmentLength * 2.5) + (Math.random() * segmentLength * 2),
             initialScale: initialObjScale, sprite: newSprite
         });
    }
    console.log("Create function complete. Number of roadside objects:", roadsideObjects.length);
}


function update(time, delta) {
    const dt = delta / 1000;

    if (isGameOver) {
        if (Phaser.Input.Keyboard.JustDown(restartKey)) {
            restartGame();
        }
        return;
    }

    if (playerInvincible) {
        if (time > lastHitTime + invincibilityDuration) {
            playerInvincible = false;
            playerCar.setAlpha(1);
        } else {
            playerCar.setAlpha(Math.floor(time / 100) % 2 === 0 ? 0.5 : 1);
        }
    }


    if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
        horizontalPull = Math.max(-maxHorizontalPull, horizontalPull - pullIncrement);
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
        horizontalPull = Math.min(maxHorizontalPull, horizontalPull + pullIncrement);
    }

    if (!cursors.left.isDown && !cursors.right.isDown && naturalPullReduction > 0) {
        if (horizontalPull > 0) horizontalPull = Math.max(0, horizontalPull - naturalPullReduction * dt);
        else if (horizontalPull < 0) horizontalPull = Math.min(0, horizontalPull + naturalPullReduction * dt);
    }

    playerX += horizontalPull * sidewaysSpeedFactor * dt;

    if (roadSegments.length > 0) {
        const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
        const currentCurveForCentrifugal = roadSegments[currentSegmentIndex]?.curve || 0;
        const centrifugalForce = currentCurveForCentrifugal * dt * (playerSpeed / maxSpeed) * 0.001;
        playerX -= centrifugalForce;
    }
    playerX = Phaser.Math.Clamp(playerX, -2.5, 2.5);

    playerCar.x = config.width / 2 + playerX * 60;
    playerCar.angle = 0;

    if (cursors.up.isDown) playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
    else if (cursors.down.isDown) playerSpeed = Math.max(0, playerSpeed - braking * dt);
    else playerSpeed = Math.max(0, playerSpeed - decel * dt);

    cameraZ += playerSpeed * dt;

    if (playerSpeed > 0) {
        let currentMultiplier = 1.0;
        const absPlayerX = Math.abs(playerX);
        if (absPlayerX <= playerXCenterThreshold) currentMultiplier = scoreMultiplierCenter;
        else if (absPlayerX > playerXRumbleThresholdMin && absPlayerX <= playerXRumbleThresholdMax) currentMultiplier = scoreMultiplierRumble;
        else if (absPlayerX > playerXRumbleThresholdMax) currentMultiplier = scoreMultiplierOffTrack;

        const distanceIncrement = playerSpeed * dt;
        score += (distanceIncrement / 100) * scoreBaseIncrement * currentMultiplier;
        scoreText.setText('Score: ' + Math.floor(score));
    }

    renderRoadAndObjects.call(this, dt);

    if (!playerInvincible) {
        const playerBounds = playerCar.getBounds();
        playerBounds.width *= 0.7;
        playerBounds.height *= 0.8;
        playerBounds.centerX = playerCar.x;
        playerBounds.centerY = playerCar.y;


        for (const obj of roadsideObjects) {
            if (obj.sprite.visible && obj.sprite.getData('activeForCollision')) {
                let objectCollisionBounds;
                if (obj.spriteKey === 'tree') {
                    const treeSprite = obj.sprite;
                    const trunkWidth = treeSprite.displayWidth * 0.20;
                    const trunkHeight = treeSprite.displayHeight * 0.30;
                    objectCollisionBounds = new Phaser.Geom.Rectangle(
                        treeSprite.x - trunkWidth / 2, treeSprite.y - trunkHeight,
                        trunkWidth, trunkHeight
                    );
                } else { 
                    objectCollisionBounds = obj.sprite.getBounds();
                    if (obj.spriteKey === 'stone') {
                        objectCollisionBounds.width *= 0.8; 
                        objectCollisionBounds.height *= 0.6; 
                        const stoneSprite = obj.sprite;
                        objectCollisionBounds.centerX = stoneSprite.x;
                        objectCollisionBounds.centerY = stoneSprite.y - (stoneSprite.displayHeight * (1-0.6) /2) ; 
                    }
                }
                if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, objectCollisionBounds)) {
                    handlePlayerHit.call(this, obj.sprite, time);
                    break;
                }
            }
        }
    }

    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) {
        const oldSegment = roadSegments.shift();
        oldSegment.index = (roadSegments.length > 0 ? roadSegments[roadSegments.length - 1].index : -1) + 1;
        oldSegment.z = (roadSegments.length > 0 ? roadSegments[roadSegments.length - 1].z : cameraZ + (drawDistance -1)*segmentLength ) + segmentLength;


        if (curveDuration <= 0) {
            if (Math.random() < 0.7) {
                curveDirection = (Math.random() < 0.5) ? -1 : 1;
                currentRoadCurveValue = curveDirection * (Math.random() * 0.3 + 0.2) * maxCurveStrength;
                curveDuration = minCurveDuration + Math.random() * (maxCurveDuration - minCurveDuration);
            } else {
                currentRoadCurveValue = 0; curveDirection = 0;
                curveDuration = minCurveDuration / 3 + Math.random() * (maxCurveDuration / 3 - minCurveDuration / 3);
            }
        }
        if (curveDuration > 0) { oldSegment.curve = currentRoadCurveValue; curveDuration--;}
        else oldSegment.curve = 0;

        if (Math.random() < 0.02) oldSegment.hill = (Math.random() - 0.5) * 450;
        else if (oldSegment.hill !== 0 && Math.random() < 0.2) {
            oldSegment.hill *= 0.75; if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
        } else oldSegment.hill = 0;

        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x888888 : 0x777777;
        // --- MODIFICATION: Rumble strip color changed to white/grey ---
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xCCCCCC; // Was 0xDD0000 (red)
        oldSegment.grassColor1 = (Math.floor(oldSegment.index / 3) % 2 === 0) ? grassColor : 0x005000;
        oldSegment.grassColor2 = (Math.floor(oldSegment.index / 3) % 2 === 0) ? 0x005A00 : grassColor;
        roadSegments.push(oldSegment);
    }

    for (const obj of roadsideObjects) {
        if (obj.worldZ < cameraZ - segmentLength * 2) {
            let maxZ = 0;
            if (roadSegments.length > 0) {
                maxZ = roadSegments[roadSegments.length -1].z;
            } else {
                maxZ = cameraZ + drawDistance * segmentLength;
            }

            obj.worldZ = maxZ + segmentLength + (Math.random() * segmentLength * 4);
            obj.worldX = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3.5);
            const isStone = Math.random() > 0.5;
            obj.spriteKey = isStone ? 'stone' : 'tree';
            obj.sprite.setTexture(obj.spriteKey);
            if (isStone) obj.initialScale = 0.03 + Math.random() * 0.04;
            else obj.initialScale = 0.3 + Math.random() * 0.4;
            obj.sprite.setVisible(false);
            obj.sprite.setData('activeForCollision', true);
        }
    }
}

function handlePlayerHit(collidedObjectSprite, currentTime) {
    if (isGameOver) return;

    playerLives--;
    livesText.setText('Lives: ' + playerLives);

    playerInvincible = true;
    lastHitTime = currentTime;
    playerCar.setAlpha(0.5);

    collidedObjectSprite.setVisible(false);
    collidedObjectSprite.setData('activeForCollision', false);

    if (playerLives <= 0) {
        triggerGameOver.call(this);
    }
}

function triggerGameOver() {
    isGameOver = true;
    playerSpeed = 0;
    horizontalPull = 0;
    gameOverTextObj.setVisible(true);
}

function restartGame() {
    window.location.reload();
}


function project(worldX, worldActualY, worldZ, cameraX, cameraActualY, cameraActualZ, fov, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldActualY - cameraActualY;
    const dz = worldZ - cameraActualZ;
    if (dz <= 0.1) return null;
    const perspectiveFactor = fov / dz;
    const screenX = (screenWidth / 2) + (dx * perspectiveFactor);
    const screenY = (screenHeight / 2) - (dy * perspectiveFactor);
    const scale = perspectiveFactor;
    return { x: screenX, y: screenY, scale: scale, dz: dz };
}

function renderRoadAndObjects(dt) {
    roadGraphics.clear();
    let currentVisualScreenY = config.height;
    let accumulatedWorldXOffset = 0;
    let accumulatedWorldYOffset = 0;

    for (let i = 0; i < drawDistance; i++) {
        const segment = roadSegments[i];
        if (!segment) continue;

        const p1 = project(
            accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5,
            accumulatedWorldYOffset, segment.z,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );
        let endOfSegmentWorldX = accumulatedWorldXOffset + segment.curve;
        let endOfSegmentWorldY = accumulatedWorldYOffset + segment.hill;
        const p2 = project(
            (endOfSegmentWorldX - playerX * roadWidthAtScreenBottom * 0.5),
            endOfSegmentWorldY, segment.z + segmentLength,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height || p1.y < 0 ) {
            accumulatedWorldXOffset = endOfSegmentWorldX;
            accumulatedWorldYOffset = endOfSegmentWorldY;
            continue;
        }

        const roadHalfWidthAtP1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidthAtP2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        roadGraphics.fillStyle(segment.grassColor1 || grassColor, 1);
        roadGraphics.fillPoints([{ x: 0, y: p1.y }, { x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }, { x: 0, y: p2.y }], true);
        roadGraphics.fillStyle(segment.grassColor2 || grassColor, 1);
        roadGraphics.fillPoints([{ x: p1.x + roadHalfWidthAtP1, y: p1.y }, { x: config.width, y: p1.y }, { x: config.width, y: p2.y }, { x: p2.x + roadHalfWidthAtP2, y: p2.y }], true);

        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([{ x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p1.x + roadHalfWidthAtP1, y: p1.y }, { x: p2.x + roadHalfWidthAtP2, y: p2.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }], true);
        const rumbleWidthRatio = 0.05;
        roadGraphics.fillStyle(segment.rumbleColor, 1);
        roadGraphics.fillPoints([{ x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p1.x - roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y }, { x: p2.x - roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }], true);
        roadGraphics.fillPoints([{ x: p1.x + roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y }, { x: p1.x + roadHalfWidthAtP1, y: p1.y }, { x: p2.x + roadHalfWidthAtP2, y: p2.y }, { x: p2.x + roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y }], true);

        currentVisualScreenY = Math.min(currentVisualScreenY, p2.y);
        accumulatedWorldXOffset = endOfSegmentWorldX;
        accumulatedWorldYOffset = endOfSegmentWorldY;
    }

    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ);
    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;
        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) {
            let roadXOffsetAtObjectZ = 0; let roadYOffsetAtObjectZ = 0;
            let tempAccumX = 0; let tempAccumY = 0;
            for(let k=0; k < roadSegments.length; k++) {
                const seg = roadSegments[k];
                if (seg.z >= obj.worldZ) {
                    if (obj.worldZ > seg.z && obj.worldZ < seg.z + segmentLength) {
                        const fraction = (obj.worldZ - seg.z) / segmentLength;
                        tempAccumX += seg.curve * fraction; tempAccumY += seg.hill * fraction;
                    }
                    break;
                }
                if (seg.z < cameraZ - segmentLength * 3 && obj.worldZ > seg.z + segmentLength*2) continue;
                tempAccumX += seg.curve; tempAccumY += seg.hill;
            }
            roadXOffsetAtObjectZ = tempAccumX; roadYOffsetAtObjectZ = tempAccumY;

            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + roadXOffsetAtObjectZ - playerX * roadWidthAtScreenBottom * 0.5,
                roadYOffsetAtObjectZ - objectVerticalOffset, obj.worldZ,
                0, cameraHeight, cameraZ, fieldOfView, config.width, config.height
            );

            if (pObj && obj.sprite.getData('activeForCollision') && pObj.y < config.height + (obj.sprite.height * pObj.scale * obj.initialScale * 30) && pObj.y > currentVisualScreenY * 0.7) {
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
                const finalScale = pObj.scale * obj.initialScale * 30;
                obj.sprite.setScale(finalScale);
                obj.sprite.setDepth(10 + Math.floor(100000 / pObj.dz) );
            } else if (obj.sprite.getData('activeForCollision')) {
                 obj.sprite.setVisible(false);
            }
        } else if (obj.sprite.getData('activeForCollision')) {
            obj.sprite.setVisible(false);
        }
    }
}
