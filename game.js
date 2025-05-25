// Basic Phaser Configuration
const config = {
    type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
    width: 800,
    height: 600,
    // parent: 'phaser-game', // Optional: ID of the DOM element to inject the canvas
    physics: {
        default: 'arcade', // Using arcade physics for simple collisions
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
const maxSpeed = 600; // Max speed the player moves along Z axis (world units per second)
const accel = 200; // Acceleration
const decel = 300; // Deceleration (when not pressing up)
const braking = 800; // Braking deceleration
let playerX = 0; // Player's horizontal position relative to road center (-1 to 1)

// Roadside objects
const roadsideObjects = [];

// --- Phaser Scene Functions ---

function preload() {
    // Load your Audi R8 image
 this.load.image('tree', 'https://png.pngtree.com/png-vector/20240208/ourmid/pngtree-green-tree-plant-forest-png-image_11716383.png'); // Example: create an 'assets/images' folder
    this.load.image('backgroundSky', 'https://png.pngtree.com/png-clipart/20230131/ourmid/pngtree-realistic-fluffy-white-cloud-in-dark-blue-sky-png-image_6577240.png');
    this.load.image('sign', 'https://www.textures4photoshop.com/tex/thumbs/free-wood-sign-PNG-thumb18.png');

    // Load sounds if you have them
    // this.load.audio('engine', 'assets/sounds/engine.mp3');
    // this.load.audio('bgMusic', 'assets/sounds/your_awesome_track.mp3');

    // Log to confirm preload completes
    console.log("Preload complete.");
}

function create() {
    // Background
    this.add.image(config.width / 2, config.height / 2, 'backgroundSky').setScrollFactor(0).setDepth(-100);

    // Player Car
    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8');
    playerCar.setScale(0.25);
    playerCar.setDepth(100);

    // Input
    cursors = this.input.keyboard.createCursorKeys();

    // Road Graphics
    roadGraphics = this.add.graphics();
    roadGraphics.setDepth(1);

    // Initialize Road Segments
    for (let i = 0; i < drawDistance + 50; i++) {
        const isRumbler = Math.floor(i / 5) % 2 === 0;
        roadSegments.push({
            index: i,
            z: i * segmentLength,
            curve: 0,
            hill: 0,
            color: (Math.floor(i / 10) % 2 === 0) ? 0x444444 : 0x3D3D3D,
            rumbleColor: isRumbler ? 0xFFFFFF : 0xBB0000,
        });

        if (i > 10 && i % 15 === 0) {
            const side = (Math.random() > 0.5 ? 1 : -1);
            const spriteKey = (Math.random() > 0.5 ? 'tree' : 'sign');
            roadsideObjects.push({
                spriteKey: spriteKey,
                worldX: side * (1.5 + Math.random() * 2.5),
                worldZ: i * segmentLength + (Math.random() * segmentLength),
                initialScale: 0.3 + Math.random() * 0.4,
                sprite: this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50)
            });
        }
    }
    // Log to confirm create completes
    console.log("Create complete. Player car:", playerCar, "Cursors:", cursors);
}

function update(time, delta) {
    const dt = delta / 1000;
    // console.log("Update loop running. Delta time (dt):", dt); // CHECK: Is this logging continuously?

    // --- Player Input & Movement ---
    const targetPlayerX = (cursors.left.isDown ? -1.5 : (cursors.right.isDown ? 1.5 : 0));
    playerX = Phaser.Math.Linear(playerX, targetPlayerX, 0.1);

    const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
    const currentCurve = roadSegments[currentSegmentIndex]?.curve || 0;
    playerX -= currentCurve * dt * (playerSpeed / maxSpeed) * 0.05;

    playerCar.x = config.width / 2 + playerX * 80;
    playerCar.angle = playerX * 5;

    // DEBUG: Check cursor states
    // if (cursors.up.isDown) console.log("UP is pressed");
    // if (cursors.left.isDown) console.log("LEFT is pressed");

    if (cursors.up.isDown) {
        playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
    } else if (cursors.down.isDown) {
        playerSpeed = Math.max(0, playerSpeed - braking * dt);
    } else {
        playerSpeed = Math.max(0, playerSpeed - decel * dt);
    }
    // console.log("Player Speed:", playerSpeed); // CHECK: Does playerSpeed change with UP/DOWN arrows?

    cameraZ += playerSpeed * dt;
    // console.log("Camera Z:", cameraZ); // CHECK: Does cameraZ change when playerSpeed is > 0?

    // --- Pseudo 3D Road and Object Rendering ---
    renderRoadAndObjects.call(this, dt);

    // --- Endless Track Generation ---
    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) {
        const oldSegment = roadSegments.shift();
        oldSegment.index = roadSegments[roadSegments.length - 1].index + 1;
        oldSegment.z = roadSegments[roadSegments.length - 1].z + segmentLength;

        if (Math.random() < 0.05) {
            oldSegment.curve = (Math.random() - 0.5) * (3 + Math.random() * 4);
            oldSegment.hill = (Math.random() < 0.2) ? (Math.random() - 0.5) * 40 : 0;
        } else if (oldSegment.curve !== 0 && Math.random() < 0.2) {
            oldSegment.curve *= 0.85;
            if (Math.abs(oldSegment.curve) < 0.1) oldSegment.curve = 0;
        }
         if (oldSegment.hill !== 0 && Math.random() < 0.3) {
            oldSegment.hill *= 0.8;
            if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
        }

        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x444444 : 0x3D3D3D;
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xBB0000;

        roadSegments.push(oldSegment);
    }

    for (const obj of roadsideObjects) {
        if (obj.worldZ < cameraZ - segmentLength * 2) {
            obj.worldZ = roadSegments[roadSegments.length - 1].z + (Math.random() * segmentLength * 10);
            obj.worldX = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3.5);
            obj.spriteKey = (Math.random() > 0.5 ? 'tree' : 'sign');
            obj.sprite.setTexture(obj.spriteKey);
            obj.initialScale = 0.3 + Math.random() * 0.4;
        }
    }
}


function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ, fieldOfView, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldY - cameraY;
    const dz = worldZ - cameraZ;

    if (dz <= 0.1) return null;

    const perspectiveFactor = fieldOfView / dz;
    const screenX = (screenWidth / 2) + (dx * perspectiveFactor);
    const screenY = (screenHeight / 2) - (dy * perspectiveFactor);
    const scale = perspectiveFactor;

    return { x: screenX, y: screenY, scale: scale, dz: dz };
}


function renderRoadAndObjects(dt) {
    roadGraphics.clear();

    let currentScreenY = config.height;
    let currentWorldXOffset = 0;
    let currentWorldYOffset = 0;

    for (let i = 0; i < drawDistance; i++) {
        const segment = roadSegments[i];
        if (!segment) continue;

        const segmentCameraZ = segment.z - cameraZ;
        if (segmentCameraZ < 0.1) continue;

        const p1 = project(
            currentWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5,
            cameraHeight + currentWorldYOffset,
            segment.z,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        currentWorldXOffset += segment.curve * segmentLength * 0.01;
        currentWorldYOffset += segment.hill;

        const p2 = project(
            (currentWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5),
            cameraHeight + currentWorldYOffset,
            segment.z + segmentLength,
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height || p1.y < 0) {
            continue;
        }

        const roadHalfWidth1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidth2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidth1, y: p1.y }, { x: p1.x + roadHalfWidth1, y: p1.y },
            { x: p2.x + roadHalfWidth2, y: p2.y }, { x: p2.x - roadHalfWidth2, y: p2.y }
        ], true);

        const rumbleWidthRatio = 0.05;
        roadGraphics.fillStyle(segment.rumbleColor, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidth1, y: p1.y }, { x: p1.x - roadHalfWidth1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p2.x - roadHalfWidth2 * (1 - rumbleWidthRatio), y: p2.y }, { x: p2.x - roadHalfWidth2, y: p2.y }
        ], true);
        roadGraphics.fillPoints([
            { x: p1.x + roadHalfWidth1 * (1 - rumbleWidthRatio), y: p1.y }, { x: p1.x + roadHalfWidth1, y: p1.y },
            { x: p2.x + roadHalfWidth2, y: p2.y }, { x: p2.x + roadHalfWidth2 * (1 - rumbleWidthRatio), y: p2.y }
        ], true);

        currentScreenY = Math.min(currentScreenY, p2.y); // Track the highest point road reached for object culling
    }

    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ);

    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;

        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) {
            let cumulativeCurve = 0;
            let cumulativeHill = 0;
            for(let k=0; k < roadSegments.length; k++) {
                if (roadSegments[k].z >= obj.worldZ) break;
                if (roadSegments[k].z < cameraZ - segmentLength) continue;
                cumulativeCurve += roadSegments[k].curve * segmentLength * 0.01;
                cumulativeHill += roadSegments[k].hill;
            }

            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + cumulativeCurve - playerX * roadWidthAtScreenBottom * 0.5,
                cameraHeight + cumulativeHill,
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height && pObj.y > currentScreenY * 0.8) { // check against currentScreenY
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
                const finalScale = pObj.scale * obj.initialScale * 20;
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
