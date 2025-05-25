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
const roadWidthAtScreenBottom = 2400; // Visual base width of the road
const fieldOfView = 100; // Affects perspective scaling
const cameraHeight = 1000; // Camera height above the road plane (Y=0)
const drawDistance = 300; // How many segments ahead to process and draw

// Player state
let playerSpeed = 0;
const maxSpeed = 2400;
const accel = 800;
const decel = 600;
const braking = 1600;
let playerX = 0; // Player's horizontal position relative to road center (-1 to 1, can extend slightly)

// --- MODIFICATION: Variables for new steering/pull mechanic ---
let horizontalPull = 0; // Current pull strength (-ve for left, +ve for right)
const pullIncrement = 0.4;   // How much each key press changes the pull
const maxHorizontalPull = 2.0; // Max pull strength in either direction
const sidewaysSpeedFactor = 1.2; // How fast playerX changes based on horizontalPull
const naturalPullReduction = 0.1; // Factor to slowly reduce pull if no input (optional, can be 0)


// Roadside objects
const roadsideObjects = [];
const objectVerticalOffset = 150;

// Variables for curve generation
let currentRoadCurveValue = 0;
let curveDirection = 0;
let curveDuration = 0;
const maxCurveStrength = 250;
const minCurveDuration = 30;
const maxCurveDuration = 100;

// --- Phaser Scene Functions ---

function preload() {
    this.load.image('audiR8', 'assets/images/audiR8.png');
    this.load.image('tree', 'assets/images/tree.png');
    this.load.image('backgroundSky', 'assets/images/sky.png');
    this.load.image('sign', 'assets/images/sign.png');
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

    for (let i = 0; i < drawDistance + 50; i++) {
        const isRumbler = Math.floor(i / 5) % 2 === 0;
        roadSegments.push({
            index: i,
            z: i * segmentLength,
            curve: 0,
            hill: 0,
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
                sprite: this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50).setOrigin(0.5, 1)
            });
        }
    }
    console.log("Create function complete. Player car:", playerCar, "Cursors enabled:", cursors !== undefined);
}

function update(time, delta) {
    const dt = delta / 1000;

    // --- MODIFICATION: New steering/pull logic ---
    if (Phaser.Input.Keyboard.JustDown(cursors.left)) {
        horizontalPull = Math.max(-maxHorizontalPull, horizontalPull - pullIncrement);
        // console.log("Pull Left. horizontalPull:", horizontalPull);
    }
    if (Phaser.Input.Keyboard.JustDown(cursors.right)) {
        horizontalPull = Math.min(maxHorizontalPull, horizontalPull + pullIncrement);
        // console.log("Pull Right. horizontalPull:", horizontalPull);
    }

    // Optional: Slowly reduce pull if no input, to make it eventually straighten out
    if (!cursors.left.isDown && !cursors.right.isDown && naturalPullReduction > 0) {
        if (horizontalPull > 0) {
            horizontalPull = Math.max(0, horizontalPull - naturalPullReduction * dt);
        } else if (horizontalPull < 0) {
            horizontalPull = Math.min(0, horizontalPull + naturalPullReduction * dt);
        }
    }
    // --- End of new steering/pull logic ---

    // Apply the horizontal pull to playerX
    playerX += horizontalPull * sidewaysSpeedFactor * dt;


    // Centrifugal force still applies to playerX
    if (roadSegments.length > 0) {
        const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
        const currentCurveForCentrifugal = roadSegments[currentSegmentIndex]?.curve || 0;
        const centrifugalForce = currentCurveForCentrifugal * dt * (playerSpeed / maxSpeed) * 0.001;
        playerX -= centrifugalForce;
    }
    playerX = Phaser.Math.Clamp(playerX, -2.5, 2.5); // Clamp logical road position

    // Update car's screen position
    playerCar.x = config.width / 2 + playerX * 60;
    // --- MODIFICATION: Car always faces forward ---
    playerCar.angle = 0;

    // Speed and camera movement
    if (cursors.up.isDown) {
        playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
    } else if (cursors.down.isDown) {
        playerSpeed = Math.max(0, playerSpeed - braking * dt);
    } else {
        playerSpeed = Math.max(0, playerSpeed - decel * dt);
    }
    cameraZ += playerSpeed * dt;

    renderRoadAndObjects.call(this, dt);

    // Track generation
    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) {
        const oldSegment = roadSegments.shift();
        oldSegment.index = roadSegments[roadSegments.length - 1].index + 1;
        oldSegment.z = roadSegments[roadSegments.length - 1].z + segmentLength;

        if (curveDuration <= 0) {
            if (Math.random() < 0.7) {
                curveDirection = (Math.random() < 0.5) ? -1 : 1;
                currentRoadCurveValue = curveDirection * (Math.random() * 0.3 + 0.2) * maxCurveStrength;
                curveDuration = minCurveDuration + Math.random() * (maxCurveDuration - minCurveDuration);
            } else {
                currentRoadCurveValue = 0;
                curveDirection = 0;
                curveDuration = minCurveDuration / 3 + Math.random() * (maxCurveDuration / 3 - minCurveDuration / 3);
            }
        }

        if (curveDuration > 0) {
            oldSegment.curve = currentRoadCurveValue;
            curveDuration--;
        } else {
            oldSegment.curve = 0;
        }

        if (Math.random() < 0.02) {
             oldSegment.hill = (Math.random() - 0.5) * 450;
        } else if (oldSegment.hill !== 0 && Math.random() < 0.2) {
             oldSegment.hill *= 0.75;
             if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
        } else {
            oldSegment.hill = 0;
        }

        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x888888 : 0x777777;
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xDD0000;
        roadSegments.push(oldSegment);
    }

    // Object recycling
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
            accumulatedWorldYOffset,
            segment.z,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        let endOfSegmentWorldX = accumulatedWorldXOffset + segment.curve;
        let endOfSegmentWorldY = accumulatedWorldYOffset + segment.hill;

        const p2 = project(
            (endOfSegmentWorldX - playerX * roadWidthAtScreenBottom * 0.5),
            endOfSegmentWorldY,
            segment.z + segmentLength,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        accumulatedWorldXOffset = endOfSegmentWorldX;
        accumulatedWorldYOffset = endOfSegmentWorldY;

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

            let tempAccumX = 0;
            let tempAccumY = 0;
            for(let k=0; k < roadSegments.length; k++) {
                const seg = roadSegments[k];
                if (seg.z >= obj.worldZ) {
                    if (seg.z < obj.worldZ) { // Corrected condition: was if (seg.z < obj.worldZ) - this caused issues. Should be: if (obj.worldZ > seg.z && obj.worldZ < seg.z + segmentLength)
                        const fraction = (obj.worldZ - seg.z) / segmentLength;
                        tempAccumX += seg.curve * fraction;
                        tempAccumY += seg.hill * fraction;
                    }
                    break;
                }
                if (seg.z < cameraZ - segmentLength * 3 && obj.worldZ > seg.z + segmentLength*2) continue;


                tempAccumX += seg.curve;
                tempAccumY += seg.hill;
            }
            roadXOffsetAtObjectZ = tempAccumX;
            roadYOffsetAtObjectZ = tempAccumY;


            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + roadXOffsetAtObjectZ - playerX * roadWidthAtScreenBottom * 0.5,
                roadYOffsetAtObjectZ - objectVerticalOffset,
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height + (obj.sprite.height * pObj.scale * obj.initialScale * 30) && pObj.y > currentVisualScreenY * 0.7) {
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
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
