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
    this.load.image('audiR8', 'https://www.seekpng.com/png/full/273-2732212_33-audi-r8-back-view.png');

    // Placeholder paths - replace with your actual assets
    this.load.image('tree', 'https://png.pngtree.com/png-vector/20240208/ourmid/pngtree-green-tree-plant-forest-png-image_11716383.png'); // Example: create an 'assets/images' folder
    this.load.image('backgroundSky', 'https://png.pngtree.com/png-clipart/20230131/ourmid/pngtree-realistic-fluffy-white-cloud-in-dark-blue-sky-png-image_6577240.png');
    this.load.image('sign', 'https://www.textures4photoshop.com/tex/thumbs/free-wood-sign-PNG-thumb18.png');

    // Load sounds if you have them
    // this.load.audio('engine', 'assets/sounds/engine.mp3');
    // this.load.audio('bgMusic', 'assets/sounds/your_awesome_track.mp3');
}

function create() {
    // Background
    // For a dynamic sky, you might have multiple layers or a shader
    this.add.image(config.width / 2, config.height / 2, 'backgroundSky').setScrollFactor(0).setDepth(-100);

    // Player Car
    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8'); // Positioned lower
    playerCar.setScale(0.25); // Adjust scale
    playerCar.setDepth(100); // Ensure car is on top of the road segments and most objects

    // Input
    cursors = this.input.keyboard.createCursorKeys();

    // Road Graphics - using Phaser's Graphics object to draw polygons
    roadGraphics = this.add.graphics();
    roadGraphics.setDepth(1); // Draw road below car but above deep background

    // Initialize Road Segments
    for (let i = 0; i < drawDistance + 50; i++) {
        const isRumbler = Math.floor(i / 5) % 2 === 0; // Wider stripes for rumblers
        roadSegments.push({
            index: i,
            z: i * segmentLength, // World Z position
            curve: 0, // Positive for right curve, negative for left
            hill: 0,  // Positive for uphill, negative for downhill
            color: (Math.floor(i / 10) % 2 === 0) ? 0x444444 : 0x3D3D3D, // Alternating road colors
            rumbleColor: isRumbler ? 0xFFFFFF : 0xBB0000, // White/Red rumblers
        });

        // Add initial roadside objects (example logic)
        if (i > 10 && i % 15 === 0) { // Every 15 segments after the initial few
            const side = (Math.random() > 0.5 ? 1 : -1);
            roadsideObjects.push({
                spriteKey: (Math.random() > 0.5 ? 'tree' : 'sign'),
                worldX: side * (1.5 + Math.random() * 2.5), // Randomly left or right, outside road edges
                worldZ: i * segmentLength + (Math.random() * segmentLength), // Random Z within segment
                initialScale: 0.3 + Math.random() * 0.4, // Base scale for the object
                sprite: this.add.sprite(0, 0, (Math.random() > 0.5 ? 'tree' : 'sign')).setVisible(false).setDepth(50) // Initially hidden
            });
        }
    }

    // Start background music if loaded
    // this.sound.play('bgMusic', { loop: true, volume: 0.5 });
}

function update(time, delta) {
    const dt = delta / 1000; // Delta time in seconds

    // --- Player Input & Movement ---
    const targetPlayerX = (cursors.left.isDown ? -1.5 : (cursors.right.isDown ? 1.5 : 0));
    playerX = Phaser.Math.Linear(playerX, targetPlayerX, 0.1); // Smooth horizontal movement

    // Centrifugal force simulation (pushes player outwards on curves)
    const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
    const currentCurve = roadSegments[currentSegmentIndex]?.curve || 0;
    playerX -= currentCurve * dt * (playerSpeed / maxSpeed) * 0.05; // Adjust multiplier

    playerCar.x = config.width / 2 + playerX * 80; // Adjust multiplier for visual movement
    playerCar.angle = playerX * 5; // Car tilts slightly

    if (cursors.up.isDown) {
        playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
    } else if (cursors.down.isDown) {
        playerSpeed = Math.max(0, playerSpeed - braking * dt);
    } else {
        playerSpeed = Math.max(0, playerSpeed - decel * dt);
    }

    cameraZ += playerSpeed * dt;

    // --- Pseudo 3D Road and Object Rendering ---
    renderRoadAndObjects.call(this, dt); // Pass delta time if needed for animations

    // --- Endless Track Generation ---
    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) { // Keep a buffer segment
        const oldSegment = roadSegments.shift();
        oldSegment.index = roadSegments[roadSegments.length - 1].index + 1;
        oldSegment.z = roadSegments[roadSegments.length - 1].z + segmentLength;

        // Generate new curve/hill data (example of procedural generation)
        // Simple: random short curves/hills, or longer smooth waves
        if (Math.random() < 0.05) { // Chance to start/end a curve/hill
            oldSegment.curve = (Math.random() - 0.5) * (3 + Math.random() * 4); // Random curve strength
            oldSegment.hill = (Math.random() < 0.2) ? (Math.random() - 0.5) * 40 : 0; // Less frequent hills
        } else if (oldSegment.curve !== 0 && Math.random() < 0.2) {
            oldSegment.curve *= 0.85; // Smoothly straighten out
            if (Math.abs(oldSegment.curve) < 0.1) oldSegment.curve = 0;
        }
         if (oldSegment.hill !== 0 && Math.random() < 0.3) {
            oldSegment.hill *= 0.8; // Smoothly flatten out
            if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
        }

        // Update colors for variety or zones
        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x444444 : 0x3D3D3D;
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xBB0000;

        roadSegments.push(oldSegment);
    }

    // Recycle roadside objects
    for (const obj of roadsideObjects) {
        if (obj.worldZ < cameraZ - segmentLength * 2) {
            obj.worldZ = roadSegments[roadSegments.length - 1].z + (Math.random() * segmentLength * 10); // Spread them out further
            obj.worldX = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3.5);
            obj.spriteKey = (Math.random() > 0.5 ? 'tree' : 'sign'); // Vary object type
            obj.sprite.setTexture(obj.spriteKey); // Update texture if it changed
            obj.initialScale = 0.3 + Math.random() * 0.4;
        }
    }
}


function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ, fieldOfView, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldY - cameraY;
    const dz = worldZ - cameraZ;

    if (dz <= 0.1) return null; // Avoid division by zero or objects behind camera

    const perspectiveFactor = fieldOfView / dz;
    const screenX = (screenWidth / 2) + (dx * perspectiveFactor);
    const screenY = (screenHeight / 2) - (dy * perspectiveFactor); // Y is inverted in screen space
    const scale = perspectiveFactor; // Scale factor for width/height

    return { x: screenX, y: screenY, scale: scale, dz: dz };
}


function renderRoadAndObjects(dt) {
    roadGraphics.clear();

    let currentScreenY = config.height; // Start drawing from bottom
    let currentWorldXOffset = 0; // Accumulates horizontal road offset from curves
    let currentWorldYOffset = 0; // Accumulates vertical road offset from hills

    for (let i = 0; i < drawDistance; i++) {
        const segment = roadSegments[i];
        if (!segment) continue;

        const segmentCameraZ = segment.z - cameraZ;
        if (segmentCameraZ < 0.1) continue; // Behind or too close to camera

        // Projection for the current segment's start (bottom edge on screen)
        const p1 = project(
            currentWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5, // Road moves opposite to playerX
            cameraHeight + currentWorldYOffset,
            segment.z,
            0, // Camera's world X is effectively 0 for road projection
            cameraHeight,
            cameraZ,
            fieldOfView, config.width, config.height
        );

        // Update world offsets for the next segment
        currentWorldXOffset += segment.curve * segmentLength * 0.01; // Curve effect builds up
        currentWorldYOffset += segment.hill;

        // Projection for the current segment's end (top edge on screen)
        const p2 = project(
            (currentWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5),
            cameraHeight + currentWorldYOffset,
            segment.z + segmentLength,
            0,
            cameraHeight,
            cameraZ,
            fieldOfView, config.width, config.height
        );

        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height) { // Segment is off-screen or inverted
            continue;
        }

        const roadHalfWidth1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidth2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        // Road Segment (Trapezoid)
        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidth1, y: p1.y },
            { x: p1.x + roadHalfWidth1, y: p1.y },
            { x: p2.x + roadHalfWidth2, y: p2.y },
            { x: p2.x - roadHalfWidth2, y: p2.y }
        ], true);

        // Rumble Strips (example)
        const rumbleWidthRatio = 0.05; // 5% of road width
        roadGraphics.fillStyle(segment.rumbleColor, 1);
        // Left Rumble
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidth1, y: p1.y },
            { x: p1.x - roadHalfWidth1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p2.x - roadHalfWidth2 * (1 - rumbleWidthRatio), y: p2.y },
            { x: p2.x - roadHalfWidth2, y: p2.y }
        ], true);
        // Right Rumble
        roadGraphics.fillPoints([
            { x: p1.x + roadHalfWidth1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p1.x + roadHalfWidth1, y: p1.y },
            { x: p2.x + roadHalfWidth2, y: p2.y },
            { x: p2.x + roadHalfWidth2 * (1 - rumbleWidthRatio), y: p2.y }
        ], true);

        currentScreenY = p2.y; // For drawing order of objects (approx)
    }

    // --- Render Roadside Objects (from furthest to nearest for correct overlap) ---
    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ); // Sort by Z distance

    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;

        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) { // Only draw visible
            // Find the road segment this object is "alongside" to get curve/hill context
            // This is a simplification; for accuracy, you'd interpolate between segments
            let segmentXOffset = 0;
            let segmentYOffset = 0;
            let cumulativeCurve = 0;
            let cumulativeHill = 0;

            // Accumulate curve/hill from player up to object's Z
            for(let i=0; i < roadSegments.length; i++) {
                if (roadSegments[i].z >= obj.worldZ) break;
                if (roadSegments[i].z < cameraZ - segmentLength) continue; // Don't sum up segments far behind camera
                cumulativeCurve += roadSegments[i].curve * segmentLength * 0.01;
                cumulativeHill += roadSegments[i].hill;
            }
            segmentXOffset = cumulativeCurve;
            segmentYOffset = cumulativeHill;


            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + segmentXOffset - playerX * roadWidthAtScreenBottom * 0.5,
                cameraHeight + segmentYOffset, // Add object's own Y offset from ground if any
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height && pObj.y > currentScreenY * 0.8) { // Check if on screen and roughly above relevant road part
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
                const finalScale = pObj.scale * obj.initialScale * 20; // Base scale + perspective. Adjust multiplier
                obj.sprite.setScale(finalScale);
                // Depth sorting: Closer objects (smaller pObj.dz) should have higher depth value in Phaser 3 for default camera
                obj.sprite.setDepth(10 + Math.floor(100000 / pObj.dz) );
            } else {
                obj.sprite.setVisible(false);
            }
        } else {
            obj.sprite.setVisible(false);
        }
    }
}
