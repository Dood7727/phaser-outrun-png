// Basic Phaser Configuration
const config = {
    type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false // Set to true for collision debugging during development
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
let roadGraphics; // For drawing the road

// Road and Camera parameters
let roadSegments = [];
let cameraZ = 0; // Player's Z position along the track (world units)
const segmentLength = 100; // Length of a single road segment in world units
const roadWidthAtScreenBottom = 2000; // Visual base width of the road
const fieldOfView = 100; // Affects perspective scaling
const cameraHeight = 1000; // Camera height above the road plane
const drawDistance = 300; // How many segments ahead to process and draw

// Player state
let playerSpeed = 0;
// --- MODIFICATION: Increased speed and acceleration ---
const maxSpeed = 1200; // Max speed the player moves along Z axis (world units per second) - Increased
const accel = 400;    // Acceleration (units per second^2) - Increased
const decel = 300;    // Natural deceleration (units per second^2)
const braking = 800;  // Braking deceleration (units per second^2)
let playerX = 0; // Player's horizontal position relative to road center (-1 to 1, can extend slightly)

// Roadside objects
const roadsideObjects = [];

// --- Phaser Scene Functions ---

function preload() {
    this.load.image('audiR8', 'assets/images/audiR8.png');
    this.load.image('tree', 'assets/images/tree.png');
    this.load.image('backgroundSky', 'assets/images/sky.png');
    this.load.image('sign', 'assets/images/sign.png');
    console.log("Preload function complete.");
}

function create() {
    this.add.image(config.width / 2, config.height / 2, 'backgroundSky').setScrollFactor(0).setDepth(-100);

    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8');
    // --- MODIFICATION: Car size reduced by half ---
    playerCar.setScale(0.125); // Was 0.25, now half of that
    playerCar.setDepth(100);

    cursors = this.input.keyboard.createCursorKeys();
    roadGraphics = this.add.graphics();
    roadGraphics.setDepth(1);

    for (let i = 0; i < drawDistance + 50; i++) {
        const isRumbler = Math.floor(i / 5) % 2 === 0;
        roadSegments.push({
            index: i,
            z: i * segmentLength,
            curve: 0,
            hill: 0,
            // --- MODIFICATION: Lighter road colors for better visibility ---
            color: (Math.floor(i / 10) % 2 === 0) ? 0x888888 : 0x777777, // Lighter greys
            rumbleColor: isRumbler ? 0xFFFFFF : 0xDD0000, // White/Red rumblers
        });

        if (i > 10 && i % 15 === 0) {
            const side = (Math.random() > 0.5 ? 1 : -1);
            const isSign = Math.random() > 0.5; // 50% chance of being a sign
            const spriteKey = isSign ? 'sign' : 'tree';
            let initialObjScale = 0.3 + Math.random() * 0.4; // Default for tree

            // --- MODIFICATION: Sign size reduced significantly ---
            if (isSign) {
                initialObjScale = 0.03 + Math.random() * 0.04; // Was (0.3 + Math.random() * 0.4), now 1/10th
            }

            roadsideObjects.push({
                spriteKey: spriteKey,
                worldX: side * (1.5 + Math.random() * 2.5),
                worldZ: i * segmentLength + (Math.random() * segmentLength),
                initialScale: initialObjScale,
                sprite: this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50)
            });
        }
    }
    console.log("Create function complete. Player car:", playerCar, "Cursors enabled:", cursors !== undefined);
}

function update(time, delta) {
    const dt = delta / 1000;

    let targetPlayerXInput = 0;
    if (cursors.left.isDown) {
        targetPlayerXInput = -1.5;
    } else if (cursors.right.isDown) {
        targetPlayerXInput = 1.5;
    }
    playerX = Phaser.Math.Linear(playerX, targetPlayerXInput, 0.1);

    if (roadSegments.length > 0) {
        const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
        const currentCurve = roadSegments[currentSegmentIndex]?.curve || 0;
        playerX -= currentCurve * dt * (playerSpeed / maxSpeed) * 0.05;
    }
    playerX = Phaser.Math.Clamp(playerX, -2.5, 2.5);

    playerCar.x = config.width / 2 + playerX * 80;
    playerCar.angle = playerX * 5;

    if (cursors.up.isDown) {
        playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
    } else if (cursors.down.isDown) {
        playerSpeed = Math.max(0, playerSpeed - braking * dt);
    } else {
        playerSpeed = Math.max(0, playerSpeed - decel * dt);
    }

    cameraZ += playerSpeed * dt;

    renderRoadAndObjects.call(this, dt);

    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) {
        const oldSegment = roadSegments.shift();
        oldSegment.index = roadSegments[roadSegments.length - 1].index + 1;
        oldSegment.z = roadSegments[roadSegments.length - 1].z + segmentLength;

        if (Math.random() < 0.05) {
             oldSegment.curve = (Math.random() - 0.5) * (3 + Math.random() * 4);
             oldSegment.hill = (Math.random() < 0.2) ? (Math.random() - 0.5) * 40 : 0;
        } else {
             if (oldSegment.curve !== 0 && Math.random() < 0.2) {
                oldSegment.curve *= 0.85;
                if (Math.abs(oldSegment.curve) < 0.1) oldSegment.curve = 0;
             }
             if (oldSegment.hill !== 0 && Math.random() < 0.3) {
                oldSegment.hill *= 0.8;
                if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
             }
        }

        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        // --- MODIFICATION: Lighter road colors for better visibility (repeated for recycled segments) ---
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x888888 : 0x777777;
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xDD0000;

        roadSegments.push(oldSegment);
    }

    for (const obj of roadsideObjects) {
        if (obj.worldZ < cameraZ - segmentLength * 2) {
            obj.worldZ = roadSegments[roadSegments.length - 1].z + (Math.random() * segmentLength * 10);
            obj.worldX = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3.5);
            const isSign = Math.random() > 0.5;
            obj.spriteKey = isSign ? 'sign' : 'tree';
            obj.sprite.setTexture(obj.spriteKey);
            // --- MODIFICATION: Sign size reduced (repeated for recycled objects) ---
            if (isSign) {
                obj.initialScale = 0.03 + Math.random() * 0.04;
            } else {
                obj.initialScale = 0.3 + Math.random() * 0.4;
            }
        }
    }
}

function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZOffset, fov, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldY - cameraY;
    const dz = worldZ - cameraZOffset;

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

        const segmentInitialZRelativeToCamera = segment.z - cameraZ;
        if (segmentInitialZRelativeToCamera < 0.1) continue;

        const p1 = project(
            accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5,
            cameraHeight + accumulatedWorldYOffset,
            segment.z,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        accumulatedWorldXOffset += segment.curve * segmentLength * 0.01;
        accumulatedWorldYOffset += segment.hill;

        const p2 = project(
            (accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5),
            cameraHeight + accumulatedWorldYOffset,
            segment.z + segmentLength,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height || p1.y < 0 ) {
            continue;
        }

        const roadHalfWidthAtP1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidthAtP2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p1.x + roadHalfWidthAtP1, y: p1.y },
            { x: p2.x + roadHalfWidthAtP2, y: p2.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }
        ], true);

        const rumbleWidthRatio = 0.05;
        roadGraphics.fillStyle(segment.rumbleColor, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p1.x - roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p2.x - roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }
        ], true);
        roadGraphics.fillPoints([
            { x: p1.x + roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y }, { x: p1.x + roadHalfWidthAtP1, y: p1.y },
            { x: p2.x + roadHalfWidthAtP2, y: p2.y }, { x: p2.x + roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y }
        ], true);

        currentVisualScreenY = Math.min(currentVisualScreenY, p2.y);
    }

    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ);

    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;

        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) {
            let roadXOffsetAtObjectZ = 0;
            let roadYOffsetAtObjectZ = 0;
            for(let k=0; k < roadSegments.length; k++) {
                if (roadSegments[k].z >= obj.worldZ) break;
                if (roadSegments[k].z < cameraZ - segmentLength) continue;
                roadXOffsetAtObjectZ += roadSegments[k].curve * segmentLength * 0.01;
                roadYOffsetAtObjectZ += roadSegments[k].hill;
            }

            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + roadXOffsetAtObjectZ - playerX * roadWidthAtScreenBottom * 0.5,
                cameraHeight + roadYOffsetAtObjectZ,
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height && pObj.y > currentVisualScreenY * 0.8) {
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
                // --- MODIFICATION: Adjusted general object scaling factor for potentially smaller signs ---
                const finalScale = pObj.scale * obj.initialScale * 30; // Increased multiplier a bit to compensate for very small initialScale of sign
                obj.sprite.setScale(finalScale);
                obj.sprite.setDepth(10 + Math.floor(100000 / pObj.dz) );
            } else {
                obj.sprite.setVisible(false);
            }
        } else {
            obj.sprite.setVisible(false);
        }
    }
}
