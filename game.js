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
const cameraHeight = 1000; // Camera height above the road plane (Y=0)
const drawDistance = 300; // How many segments ahead to process and draw

// Player state
let playerSpeed = 0;
const maxSpeed = 1200;
const accel = 400;
const decel = 300;
const braking = 800;
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
    // --- MODIFICATION: Make sky fill the screen ---
    let sky = this.add.image(0, 0, 'backgroundSky').setOrigin(0,0).setScrollFactor(0).setDepth(-100);
    sky.displayWidth = config.width;
    sky.displayHeight = config.height;

    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8');
    playerCar.setScale(0.125);
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
            hill: 0, // This 'hill' value is the Y-offset from the base Y=0 plane
            color: (Math.floor(i / 10) % 2 === 0) ? 0x888888 : 0x777777,
            rumbleColor: isRumbler ? 0xFFFFFF : 0xDD0000,
        });

        if (i > 10 && i % 15 === 0) {
            const side = (Math.random() > 0.5 ? 1 : -1);
            const isSign = Math.random() > 0.5;
            const spriteKey = isSign ? 'sign' : 'tree';
            let initialObjScale = 0.3 + Math.random() * 0.4;
            if (isSign) {
                initialObjScale = 0.03 + Math.random() * 0.04;
            }

            roadsideObjects.push({
                spriteKey: spriteKey,
                worldX: side * (1.5 + Math.random() * 2.5),
                worldZ: i * segmentLength + (Math.random() * segmentLength),
                initialScale: initialObjScale,
                // --- MODIFICATION: Set origin to bottom-center for roadside objects ---
                sprite: this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50).setOrigin(0.5, 1)
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
            if (isSign) {
                obj.initialScale = 0.03 + Math.random() * 0.04;
            } else {
                obj.initialScale = 0.3 + Math.random() * 0.4;
            }
        }
    }
}

// Project a 3D world point (worldX, worldY, worldZ) to 2D screen coordinates
// cameraX, cameraActualY, cameraActualZ are the camera's 3D position
function project(worldX, worldActualY, worldZ, cameraX, cameraActualY, cameraActualZ, fov, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldActualY - cameraActualY; // Difference between point's Y and camera's Y
    const dz = worldZ - cameraActualZ;       // Distance from camera's Z plane to point's Z plane

    if (dz <= 0.1) return null; // Point is behind or too close to the camera's near plane

    const perspectiveFactor = fov / dz;
    const screenX = (screenWidth / 2) + (dx * perspectiveFactor);
    // Screen Y: positive dy (point is above camera) means screenY moves up (smaller Y value)
    // negative dy (point is below camera) means screenY moves down (larger Y value)
    const screenY = (screenHeight / 2) - (dy * perspectiveFactor);
    const scale = perspectiveFactor; // Scale factor for objects at this distance

    return { x: screenX, y: screenY, scale: scale, dz: dz };
}

function renderRoadAndObjects(dt) {
    roadGraphics.clear();

    let currentVisualScreenY = config.height; // Tracks the highest point road reaches on screen (horizon)
    let accumulatedWorldXOffset = 0; // Current X offset of the road due to curves
    let accumulatedWorldYOffset = 0; // Current Y offset of the road due to hills (world Y of road surface)

    for (let i = 0; i < drawDistance; i++) {
        const segment = roadSegments[i];
        if (!segment) continue;

        // --- MODIFICATION: Road Projection Logic ---
        // Project the bottom edge of the current road segment strip
        const p1 = project(
            accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5, // X position of road center, adjusted by player
            accumulatedWorldYOffset,           // World Y of the road surface at the start of this segment
            segment.z,                         // World Z of the start of this segment
            0,                                 // Camera's world X (playerX handles relative view)
            cameraHeight,                      // Camera's actual world Y
            cameraZ,                           // Camera's actual world Z
            fieldOfView, config.width, config.height
        );

        // Determine the world X and Y for the top edge of this segment strip
        let topOfSegmentWorldX = accumulatedWorldXOffset + segment.curve * segmentLength * 0.01;
        let topOfSegmentWorldY = accumulatedWorldYOffset + segment.hill;

        // Project the top edge of the current road segment strip
        const p2 = project(
            (topOfSegmentWorldX - playerX * roadWidthAtScreenBottom * 0.5),
            topOfSegmentWorldY,                // World Y of the road surface at the end of this segment
            segment.z + segmentLength,         // World Z of the end of this segment
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        // Update accumulators for the *next* segment's bottom edge
        accumulatedWorldXOffset = topOfSegmentWorldX;
        accumulatedWorldYOffset = topOfSegmentWorldY;


        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height || p1.y < 0 ) {
            // Segment is off-screen, inverted, or behind camera effectively
            continue;
        }

        const roadHalfWidthAtP1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidthAtP2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        // Draw Road Segment
        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidthAtP1, y: p1.y }, { x: p1.x + roadHalfWidthAtP1, y: p1.y },
            { x: p2.x + roadHalfWidthAtP2, y: p2.y }, { x: p2.x - roadHalfWidthAtP2, y: p2.y }
        ], true);

        // Draw Rumble Strips
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

    // --- Render Roadside Objects ---
    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ); // Draw furthest first

    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;

        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) {
            let roadXOffsetAtObjectZ = 0;
            let roadYOffsetAtObjectZ = 0; // This will be the world Y of the road surface at object's Z

            for(let k=0; k < roadSegments.length; k++) {
                if (roadSegments[k].z >= obj.worldZ) break;
                if (roadSegments[k].z < cameraZ - segmentLength * 2) continue; // Optimization
                roadXOffsetAtObjectZ += roadSegments[k].curve * segmentLength * 0.01;
                roadYOffsetAtObjectZ += roadSegments[k].hill;
            }

            // --- MODIFICATION: Object Projection Logic ---
            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + roadXOffsetAtObjectZ - playerX * roadWidthAtScreenBottom * 0.5,
                roadYOffsetAtObjectZ, // World Y of the road surface where object sits
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height + (obj.sprite.height * pObj.scale * obj.initialScale * 30) && pObj.y > currentVisualScreenY * 0.8) { // Check if on screen
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y); // Origin (0.5,1) will place bottom-center here
                const finalScale = pObj.scale * obj.initialScale * 30;
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
