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
const maxSpeed = 600; // Max speed the player moves along Z axis (world units per second)
const accel = 200; // Acceleration (units per second^2)
const decel = 300; // Natural deceleration (units per second^2)
const braking = 800; // Braking deceleration (units per second^2)
let playerX = 0; // Player's horizontal position relative to road center (-1 to 1, can extend slightly)

// Roadside objects
const roadsideObjects = [];

// --- Phaser Scene Functions ---

function preload() {
    // IMPORTANT: Make sure these paths match your local asset structure!
    // Images should be in an 'assets/images/' subfolder.
    this.load.image('audiR8', 'assets/images/audiR8.png');
    this.load.image('tree', 'assets/images/tree.png');
    this.load.image('backgroundSky', 'assets/images/sky.png');
    this.load.image('sign', 'assets/images/sign.png');

    // Example: Load sounds if you have them in 'assets/sounds/'
    // this.load.audio('engineSound', 'assets/sounds/engine.mp3');
    // this.load.audio('bgMusic', 'assets/sounds/your_awesome_track.mp3');

    console.log("Preload function complete.");
}

function create() {
    // Background
    // If 'backgroundSky' fails to load, this might cause an error or a black background.
    this.add.image(config.width / 2, config.height / 2, 'backgroundSky').setScrollFactor(0).setDepth(-100);

    // Player Car
    // If 'audiR8' texture is missing, playerCar will be created but might be invisible or very small.
    playerCar = this.add.sprite(config.width / 2, config.height - 80, 'audiR8');
    playerCar.setScale(0.25); // Adjust scale as needed for your car sprite
    playerCar.setDepth(100); // Ensure car is on top of the road segments

    // Input
    cursors = this.input.keyboard.createCursorKeys();

    // Road Graphics - using Phaser's Graphics object to draw polygons
    roadGraphics = this.add.graphics();
    roadGraphics.setDepth(1); // Draw road below car but above deep background

    // Initialize Road Segments
    for (let i = 0; i < drawDistance + 50; i++) { // Pre-populate more than drawDistance
        const isRumbler = Math.floor(i / 5) % 2 === 0;
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
            const spriteKey = (Math.random() > 0.5 ? 'tree' : 'sign');
            roadsideObjects.push({
                spriteKey: spriteKey,
                worldX: side * (1.5 + Math.random() * 2.5), // Randomly left or right, outside road edges
                worldZ: i * segmentLength + (Math.random() * segmentLength), // Random Z within segment
                initialScale: 0.3 + Math.random() * 0.4, // Base scale for the object
                sprite: this.add.sprite(0, 0, spriteKey).setVisible(false).setDepth(50) // Initially hidden
            });
        }
    }

    // Log to confirm create completes and check critical objects
    // Expand playerCar in the console to check its properties like 'texture.key', 'width', 'height'
    console.log("Create function complete. Player car:", playerCar, "Cursors enabled:", cursors !== undefined);

    // Example: Start background music if loaded
    // this.sound.play('bgMusic', { loop: true, volume: 0.5 });
}

function update(time, delta) {
    const dt = delta / 1000; // Delta time in seconds
    // console.log("Update loop running. Delta time (dt):", dt); // UNCOMMENT to check if update loop is running

    // --- Player Input & Movement ---
    let targetPlayerXInput = 0;
    if (cursors.left.isDown) {
        targetPlayerXInput = -1.5;
        // console.log("LEFT key is pressed"); // UNCOMMENT to check input
    } else if (cursors.right.isDown) {
        targetPlayerXInput = 1.5;
        // console.log("RIGHT key is pressed"); // UNCOMMENT to check input
    }
    playerX = Phaser.Math.Linear(playerX, targetPlayerXInput, 0.1); // Smooth horizontal input

    // Centrifugal force simulation (pushes player outwards on curves)
    // Ensure roadSegments has items before accessing it.
    if (roadSegments.length > 0) {
        const currentSegmentIndex = Math.floor((cameraZ + cameraHeight) / segmentLength) % roadSegments.length;
        const currentCurve = roadSegments[currentSegmentIndex]?.curve || 0; // Optional chaining for safety
        playerX -= currentCurve * dt * (playerSpeed / maxSpeed) * 0.05; // Adjust multiplier for effect
    }
    
    // Clamp playerX to prevent going too far off-road (adjust as needed)
    playerX = Phaser.Math.Clamp(playerX, -2.5, 2.5);


    // Update car sprite's screen position and angle based on playerX
    playerCar.x = config.width / 2 + playerX * 80; // Multiplier affects how much car moves on screen
    playerCar.angle = playerX * 5; // Car tilts slightly with playerX

    // Acceleration and Speed
    if (cursors.up.isDown) {
        playerSpeed = Math.min(maxSpeed, playerSpeed + accel * dt);
        // console.log("UP key is pressed, playerSpeed:", playerSpeed); // UNCOMMENT to check input & speed
    } else if (cursors.down.isDown) {
        playerSpeed = Math.max(0, playerSpeed - braking * dt);
    } else {
        playerSpeed = Math.max(0, playerSpeed - decel * dt); // Natural deceleration
    }
    // console.log("Player Speed:", playerSpeed); // UNCOMMENT to monitor playerSpeed

    cameraZ += playerSpeed * dt; // Advance camera position based on speed
    // console.log("Camera Z:", cameraZ); // UNCOMMENT to monitor cameraZ position

    // --- Pseudo 3D Road and Object Rendering ---
    renderRoadAndObjects.call(this, dt); // Use .call(this) to maintain scene context

    // --- Endless Track Generation ---
    // If cameraZ has passed the first segment, move it to the end of the array
    while (roadSegments.length > 0 && roadSegments[0].z < cameraZ - segmentLength * 2) { // Keep a buffer
        const oldSegment = roadSegments.shift();
        oldSegment.index = roadSegments[roadSegments.length - 1].index + 1; // Ensure index increments
        oldSegment.z = roadSegments[roadSegments.length - 1].z + segmentLength;
        
        // Generate new curve/hill data for this recycled segment (example logic)
        if (Math.random() < 0.05) { // Chance to start/end a curve/hill
             oldSegment.curve = (Math.random() - 0.5) * (3 + Math.random() * 4); // Random curve strength
             oldSegment.hill = (Math.random() < 0.2) ? (Math.random() - 0.5) * 40 : 0; // Less frequent hills
        } else { // Smoothly return to straight/flat
             if (oldSegment.curve !== 0 && Math.random() < 0.2) {
                oldSegment.curve *= 0.85; 
                if (Math.abs(oldSegment.curve) < 0.1) oldSegment.curve = 0;
             }
             if (oldSegment.hill !== 0 && Math.random() < 0.3) {
                oldSegment.hill *= 0.8;
                if (Math.abs(oldSegment.hill) < 1) oldSegment.hill = 0;
             }
        }

        // Update colors for variety or zones
        const isRumbler = Math.floor(oldSegment.index / 5) % 2 === 0;
        oldSegment.color = (Math.floor(oldSegment.index / 10) % 2 === 0) ? 0x444444 : 0x3D3D3D;
        oldSegment.rumbleColor = isRumbler ? 0xFFFFFF : 0xBB0000;

        roadSegments.push(oldSegment);
    }

    // Recycle roadside objects that have moved behind the camera
    for (const obj of roadsideObjects) {
        if (obj.worldZ < cameraZ - segmentLength * 2) {
            obj.worldZ = roadSegments[roadSegments.length - 1].z + (Math.random() * segmentLength * 10); // Spread them out further ahead
            obj.worldX = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 3.5); // New horizontal position
            obj.spriteKey = (Math.random() > 0.5 ? 'tree' : 'sign'); // Vary object type
            obj.sprite.setTexture(obj.spriteKey); // Update texture if it changed
            obj.initialScale = 0.3 + Math.random() * 0.4; // Vary base scale
        }
    }
}

// --- Helper function for 3D projection ---
function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZOffset, fov, screenWidth, screenHeight) {
    const dx = worldX - cameraX;
    const dy = worldY - cameraY;
    const dz = worldZ - cameraZOffset; // Z distance from camera to point

    if (dz <= 0.1) return null; // Avoid division by zero or objects behind camera

    const perspectiveFactor = fov / dz;
    const screenX = (screenWidth / 2) + (dx * perspectiveFactor);
    const screenY = (screenHeight / 2) - (dy * perspectiveFactor); // Y is inverted in screen space
    const scale = perspectiveFactor; // Scale factor for width/height of objects at this Z

    return { x: screenX, y: screenY, scale: scale, dz: dz };
}

// --- Main Rendering Function for Road and Objects ---
function renderRoadAndObjects(dt) {
    roadGraphics.clear(); // Clear previous frame's road drawings

    let currentVisualScreenY = config.height; // Used to cull objects drawn "below" the highest road point
    let accumulatedWorldXOffset = 0; // Accumulates horizontal road offset from curves
    let accumulatedWorldYOffset = 0; // Accumulates vertical road offset from hills

    // Draw road segments from furthest to nearest relevant segment for correct overlap
    for (let i = 0; i < drawDistance; i++) {
        const segment = roadSegments[i];
        if (!segment) continue; // Should not happen if roadSegments is populated

        const segmentInitialZRelativeToCamera = segment.z - cameraZ;
        // Only draw segments that are in front of the camera
        if (segmentInitialZRelativeToCamera < 0.1) continue;

        // Project the bottom-left and bottom-right of the current segment strip
        const p1 = project(
            accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5, // Road appears to move under player
            cameraHeight + accumulatedWorldYOffset, // Current Y position of road strip at this Z
            segment.z,                             // World Z of this strip's start
            0,                                     // Camera's X is effectively the center
            cameraHeight,                          // Camera's Y (height above base plane)
            cameraZ,                               // Current camera Z position
            fieldOfView, config.width, config.height
        );

        // Accumulate curve and hill for the *next* segment's position (or this segment's top edge)
        accumulatedWorldXOffset += segment.curve * segmentLength * 0.01; // Curve strength scaled
        accumulatedWorldYOffset += segment.hill;                         // Hill height change

        // Project the top-left and top-right of the current segment strip
        const p2 = project(
            (accumulatedWorldXOffset - playerX * roadWidthAtScreenBottom * 0.5),
            cameraHeight + accumulatedWorldYOffset, // New Y position of road strip
            segment.z + segmentLength,              // World Z of this strip's end
            0, cameraHeight, cameraZ,
            fieldOfView, config.width, config.height
        );

        // If projection points are invalid, or segment is off-screen or inverted, skip drawing
        if (!p1 || !p2 || p1.y < p2.y || p2.y > config.height || p1.y < 0 ) {
            continue;
        }

        const roadHalfWidthAtP1 = (roadWidthAtScreenBottom / 2) * p1.scale;
        const roadHalfWidthAtP2 = (roadWidthAtScreenBottom / 2) * p2.scale;

        // Road Segment (Trapezoid)
        roadGraphics.fillStyle(segment.color, 1);
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidthAtP1, y: p1.y },
            { x: p1.x + roadHalfWidthAtP1, y: p1.y },
            { x: p2.x + roadHalfWidthAtP2, y: p2.y },
            { x: p2.x - roadHalfWidthAtP2, y: p2.y }
        ], true);

        // Rumble Strips
        const rumbleWidthRatio = 0.05; // 5% of road width for each rumble strip
        roadGraphics.fillStyle(segment.rumbleColor, 1);
        // Left Rumble
        roadGraphics.fillPoints([
            { x: p1.x - roadHalfWidthAtP1, y: p1.y },
            { x: p1.x - roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p2.x - roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y },
            { x: p2.x - roadHalfWidthAtP2, y: p2.y }
        ], true);
        // Right Rumble
        roadGraphics.fillPoints([
            { x: p1.x + roadHalfWidthAtP1 * (1 - rumbleWidthRatio), y: p1.y },
            { x: p1.x + roadHalfWidthAtP1, y: p1.y },
            { x: p2.x + roadHalfWidthAtP2, y: p2.y },
            { x: p2.x + roadHalfWidthAtP2 * (1 - rumbleWidthRatio), y: p2.y }
        ], true);

        currentVisualScreenY = Math.min(currentVisualScreenY, p2.y); // Update highest screen Y road reached
    }

    // --- Render Roadside Objects (from furthest to nearest for correct overlap) ---
    roadsideObjects.sort((a, b) => b.worldZ - a.worldZ); // Sort by Z distance (descending)

    for (const obj of roadsideObjects) {
        const objWorldZRelativeToCamera = obj.worldZ - cameraZ;

        // Only process objects within a reasonable view distance and in front of camera
        if (objWorldZRelativeToCamera > 0.1 && objWorldZRelativeToCamera < drawDistance * segmentLength * 0.8) {
            // To correctly position objects alongside a curving/hilly road,
            // we need to find the road's X and Y offset at the object's Z position.
            // This is an approximation:
            let roadXOffsetAtObjectZ = 0;
            let roadYOffsetAtObjectZ = 0;
            for(let k=0; k < roadSegments.length; k++) { // Iterate through road segments
                if (roadSegments[k].z >= obj.worldZ) break; // Stop if segment is past object
                if (roadSegments[k].z < cameraZ - segmentLength) continue; // Skip segments far behind camera
                roadXOffsetAtObjectZ += roadSegments[k].curve * segmentLength * 0.01;
                roadYOffsetAtObjectZ += roadSegments[k].hill;
            }

            const pObj = project(
                obj.worldX * (roadWidthAtScreenBottom / 2) + roadXOffsetAtObjectZ - playerX * roadWidthAtScreenBottom * 0.5,
                cameraHeight + roadYOffsetAtObjectZ, // Base Y + road's hill offset at object's Z
                obj.worldZ,
                0, cameraHeight, cameraZ,
                fieldOfView, config.width, config.height
            );

            if (pObj && pObj.y < config.height && pObj.y > currentVisualScreenY * 0.8) { // Check if on screen and roughly above horizon
                obj.sprite.setVisible(true);
                obj.sprite.setPosition(pObj.x, pObj.y);
                // Scale is combination of perspective and object's inherent initial scale
                // The '20' is an arbitrary multiplier to make typical sprites look decent, adjust as needed
                const finalScale = pObj.scale * obj.initialScale * 20;
                obj.sprite.setScale(finalScale);
                // Depth sorting: Closer objects (smaller pObj.dz) should have higher depth value
                obj.sprite.setDepth(10 + Math.floor(100000 / pObj.dz) );
            } else {
                obj.sprite.setVisible(false);
            }
        } else {
            obj.sprite.setVisible(false);
        }
    }
}
