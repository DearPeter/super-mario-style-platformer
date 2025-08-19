/*
 * Simple Mario‑style platformer game
 *
 * This game demonstrates a side‑scrolling platformer using the HTML5 canvas.
 * The player can move left/right and jump, collect coins and reach the end flag.
 * Assets are loaded from the `assets/` directory (courtesy of Kenney.nl, CC0).
 */

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------------------
  // Background cloud system
  // ---------------------------------------------------------------------------
  // To enhance the cartoon feel, we draw a handful of fluffy clouds that drift
  // slowly across the sky. Each cloud has a position and drift speed.
  const clouds = [];
  function initClouds() {
    const numClouds = 5;
    for (let i = 0; i < numClouds; i++) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.4,
        speed: 0.2 + Math.random() * 0.3,
      });
    }
  }
  initClouds();

  /**
   * Draws a rectangle with rounded corners.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r Corner radius
   */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Game world dimensions (can be wider than the canvas for scrolling)
  const WORLD_WIDTH = 2800; // width in pixels
  const WORLD_HEIGHT = canvas.height;

  // Physics constants
  const GRAVITY = 0.4;
  const FRICTION = 0.8;
  const MAX_VEL_X = 6;
  const JUMP_VELOCITY = -12;

  // Player dimensions (scaled down from original sprites)
  const PLAYER_WIDTH = 50;
  const PLAYER_HEIGHT = 70;

  // Coin dimensions
  const COIN_SIZE = 32;

  // Key state tracking
  const keys = {
    left: false,
    right: false,
    up: false,
  };

  // Load images
  const imageFiles = {
    grassMid: 'assets/grassMid.png',
    grassCenter: 'assets/grassCenter.png',
    coin: 'assets/coinGold.png',
    playerFront: 'assets/p1_front.png',
    playerJump: 'assets/p1_jump.png',
  };
  // Add player walking frames separately
  for (let i = 1; i <= 11; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    imageFiles[`playerWalk${num}`] = `assets/p1_walk${num}.png`;
  }

  const images = {};
  function loadImage(name, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve([name, img]);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Create ground/platform data
  const groundTiles = [];
  (function createGround() {
    const tileWidth = 70;
    const tileHeight = 70;
    const tilesAcross = Math.ceil(WORLD_WIDTH / tileWidth);
    for (let i = 0; i < tilesAcross; i++) {
      groundTiles.push({ x: i * tileWidth, y: canvas.height - tileHeight, w: tileWidth, h: tileHeight });
    }
  })();

  // Create some random elevated platforms
  const floatingPlatforms = [
    { x: 300, y: canvas.height - 200, w: 140, h: 40 },
    { x: 600, y: canvas.height - 300, w: 140, h: 40 },
    { x: 1000, y: canvas.height - 250, w: 140, h: 40 },
    { x: 1500, y: canvas.height - 180, w: 140, h: 40 },
    { x: 2000, y: canvas.height - 220, w: 140, h: 40 },
  ];

  // Coins placement
  const coins = [];
  function generateCoins() {
    const positions = [
      { x: 350, y: canvas.height - 250 },
      { x: 650, y: canvas.height - 350 },
      { x: 1050, y: canvas.height - 300 },
      { x: 1550, y: canvas.height - 230 },
      { x: 2050, y: canvas.height - 270 },
      { x: 500, y: canvas.height - 110 },
      { x: 1200, y: canvas.height - 110 },
      { x: 1900, y: canvas.height - 110 },
    ];
    positions.forEach(pos => coins.push({ x: pos.x, y: pos.y, collected: false }));
  }
  generateCoins();

  // Player object
  class Player {
    constructor() {
      this.x = 100;
      this.y = canvas.height - PLAYER_HEIGHT - 70;
      this.velX = 0;
      this.velY = 0;
      this.onGround = false;
      this.walkFrameIndex = 1;
      this.walkFrameTimer = 0;
      this.walkFrameInterval = 100; // ms per frame
    }
    update(dt) {
      // Horizontal movement
      if (keys.left) {
        this.velX = Math.max(this.velX - 0.5, -MAX_VEL_X);
      } else if (keys.right) {
        this.velX = Math.min(this.velX + 0.5, MAX_VEL_X);
      } else {
        // friction slows down when no key pressed
        this.velX *= FRICTION;
        if (Math.abs(this.velX) < 0.1) this.velX = 0;
      }

      // Jumping
      if (keys.up && this.onGround) {
        this.velY = JUMP_VELOCITY;
        this.onGround = false;
      }

      // Apply gravity
      this.velY += GRAVITY;
      // Update position
      this.x += this.velX;
      this.y += this.velY;

      // Prevent going out of world bounds horizontally
      this.x = Math.max(0, Math.min(this.x, WORLD_WIDTH - PLAYER_WIDTH));

      // Collision with ground tiles
      this.onGround = false;
      // Check ground and floating platforms
      const potentialPlatforms = groundTiles.concat(floatingPlatforms);
      for (const plat of potentialPlatforms) {
        // AABB collision detection
        if (
          this.x + PLAYER_WIDTH > plat.x &&
          this.x < plat.x + plat.w &&
          this.y + PLAYER_HEIGHT > plat.y &&
          this.y + PLAYER_HEIGHT < plat.y + plat.h &&
          this.velY >= 0
        ) {
          // Snap player to top of platform
          this.y = plat.y - PLAYER_HEIGHT;
          this.velY = 0;
          this.onGround = true;
        }
      }

      // Prevent falling below the ground (in case missed collision)
      if (this.y + PLAYER_HEIGHT > canvas.height) {
        this.y = canvas.height - PLAYER_HEIGHT;
        this.velY = 0;
        this.onGround = true;
      }

      // Update animation
      if (Math.abs(this.velX) > 0.1 && this.onGround) {
        this.walkFrameTimer += dt;
        if (this.walkFrameTimer > this.walkFrameInterval) {
          this.walkFrameTimer = 0;
          this.walkFrameIndex++;
          if (this.walkFrameIndex > 11) this.walkFrameIndex = 1;
        }
      } else {
        this.walkFrameIndex = 1;
        this.walkFrameTimer = 0;
      }
    }
    draw(offsetX) {
      // Draw a simple cartoon character using canvas primitives.
      const drawX = this.x - offsetX;
      const drawY = this.y;
      ctx.save();
      // Flip horizontally if moving left
      const facingLeft = this.velX < -0.1;
      if (facingLeft) {
        ctx.translate(drawX + PLAYER_WIDTH / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(drawX + PLAYER_WIDTH / 2), 0);
      }
      // Determine animation frame: 0 (stand/walk A), 1 (walk B), 2 (jump)
      let frame;
      if (!this.onGround) {
        frame = 2;
      } else if (Math.abs(this.velX) > 0.1) {
        frame = (this.walkFrameIndex % 2);
      } else {
        frame = 0;
      }
      // Colors
      const bodyColor = '#4FC3F7';
      const headColor = '#FFD54F';
      const limbColor = '#4FC3F7';
      // Dimensions
      const bodyW = PLAYER_WIDTH * 0.4;
      const bodyH = PLAYER_HEIGHT * 0.5;
      const bodyX = drawX + (PLAYER_WIDTH - bodyW) / 2;
      const bodyY = drawY + PLAYER_HEIGHT - bodyH;
      const headRadius = PLAYER_WIDTH * 0.3;
      const headCX = drawX + PLAYER_WIDTH / 2;
      const headCY = bodyY - headRadius + 4;
      // Limb anchors
      const shoulderY = bodyY + 6;
      const leftShoulderX = drawX + PLAYER_WIDTH * 0.3;
      const rightShoulderX = drawX + PLAYER_WIDTH * 0.7;
      const hipY = bodyY + bodyH;
      const leftHipX = drawX + PLAYER_WIDTH * 0.4;
      const rightHipX = drawX + PLAYER_WIDTH * 0.6;
      // Walk cycle definitions
      const WALK_CYCLE = [
        {
          leftArm: { dx: 8, dy: 12 },
          rightArm: { dx: -8, dy: -12 },
          leftLeg: { dx: 8, dy: 12 },
          rightLeg: { dx: -8, dy: 12 },
        },
        {
          leftArm: { dx: -8, dy: -12 },
          rightArm: { dx: 8, dy: 12 },
          leftLeg: { dx: -8, dy: 12 },
          rightLeg: { dx: 8, dy: 12 },
        },
      ];
      let leftArmDir, rightArmDir, leftLegDir, rightLegDir;
      if (frame === 2) {
        leftArmDir = { dx: 0, dy: -16 };
        rightArmDir = { dx: 0, dy: -16 };
        leftLegDir = { dx: 0, dy: 16 };
        rightLegDir = { dx: 0, dy: 16 };
      } else {
        const cycle = WALK_CYCLE[frame];
        leftArmDir = cycle.leftArm;
        rightArmDir = cycle.rightArm;
        leftLegDir = cycle.leftLeg;
        rightLegDir = cycle.rightLeg;
      }
      // Draw body
      ctx.fillStyle = bodyColor;
      roundRect(ctx, bodyX, bodyY, bodyW, bodyH, 8);
      ctx.fill();
      // Draw head
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.arc(headCX, headCY, headRadius, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#333';
      const eyeOffsetX = headRadius * 0.4;
      const eyeOffsetY = headRadius * 0.2;
      const eyeRadius = headRadius * 0.15;
      ctx.beginPath();
      ctx.arc(headCX - eyeOffsetX, headCY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
      ctx.arc(headCX + eyeOffsetX, headCY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
      // Mouth (smile)
      ctx.beginPath();
      const mouthWidth = headRadius * 0.5;
      const mouthY = headCY + headRadius * 0.3;
      ctx.arc(headCX, mouthY, mouthWidth / 2, 0, Math.PI, false);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Limbs
      ctx.strokeStyle = limbColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      // Left arm
      ctx.beginPath();
      ctx.moveTo(leftShoulderX, shoulderY);
      ctx.lineTo(leftShoulderX + leftArmDir.dx, shoulderY + leftArmDir.dy);
      ctx.stroke();
      // Right arm
      ctx.beginPath();
      ctx.moveTo(rightShoulderX, shoulderY);
      ctx.lineTo(rightShoulderX + rightArmDir.dx, shoulderY + rightArmDir.dy);
      ctx.stroke();
      // Left leg
      ctx.beginPath();
      ctx.moveTo(leftHipX, hipY);
      ctx.lineTo(leftHipX + leftLegDir.dx, hipY + leftLegDir.dy);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(rightHipX, hipY);
      ctx.lineTo(rightHipX + rightLegDir.dx, hipY + rightLegDir.dy);
      ctx.stroke();
      ctx.restore();
    }
  }

  const player = new Player();
  let score = 0;

  // Camera offset for scrolling
  let cameraX = 0;

  // Main game loop
  let lastTimestamp = 0;
  function gameLoop(timestamp) {
    const dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // Update player
    player.update(dt);
    // Update camera to follow player
    const centerX = player.x + PLAYER_WIDTH / 2;
    const halfCanvas = canvas.width / 2;
    cameraX = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, centerX - halfCanvas));
    // Coin collisions
    coins.forEach(coin => {
      if (!coin.collected) {
        const coinRect = { x: coin.x, y: coin.y, w: COIN_SIZE, h: COIN_SIZE };
        const playerRect = { x: player.x, y: player.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
        if (
          playerRect.x < coinRect.x + coinRect.w &&
          playerRect.x + playerRect.w > coinRect.x &&
          playerRect.y < coinRect.y + coinRect.h &&
          playerRect.y + playerRect.h > coinRect.y
        ) {
          coin.collected = true;
          score++;
        }
      }
    });

    // -------------------------------------------------------------------------
    // Update cloud positions for parallax effect. Clouds drift slowly across
    // the sky to provide a sense of motion and depth. When a cloud moves off
    // the right side of the canvas, wrap it back to the left with a new
    // randomized vertical position.
    clouds.forEach(cloud => {
      cloud.x += cloud.speed * (dt / 16);
      if (cloud.x - 100 > canvas.width) {
        cloud.x = -150;
        cloud.y = Math.random() * canvas.height * 0.4;
      }
    });
  }

  function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw a custom gradient sky and drifting clouds. The gradient provides
    // a gentle transition from bright blue to pale white across the scene,
    // while the clouds add depth and whimsy.
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#a7dfff');
    skyGrad.addColorStop(1, '#eaf4ff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw each cloud composed of three overlapping circles with a subtle
    // outline. Clouds drift horizontally based on their speed values.
    clouds.forEach(cloud => {
      const { x, y } = cloud;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.arc(x + 25, y + 10, 25, 0, Math.PI * 2);
      ctx.arc(x + 55, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    // Draw ground tiles as cartoon blocks
    for (const tile of groundTiles) {
      const drawX = tile.x - cameraX;
      if (drawX + tile.w >= 0 && drawX <= canvas.width) {
        // Dirt base
        ctx.fillStyle = '#a67c52';
        ctx.fillRect(drawX, tile.y, tile.w, tile.h);
        // Grass top
        const grassH = tile.h * 0.3;
        ctx.fillStyle = '#8BC34A';
        ctx.fillRect(drawX, tile.y, tile.w, grassH);
      }
    }
    // Draw floating platforms as cartoon blocks
    for (const plat of floatingPlatforms) {
      const drawX = plat.x - cameraX;
      if (drawX + plat.w >= 0 && drawX <= canvas.width) {
        ctx.fillStyle = '#a67c52';
        ctx.fillRect(drawX, plat.y, plat.w, plat.h);
        const grassH = plat.h * 0.3;
        ctx.fillStyle = '#8BC34A';
        ctx.fillRect(drawX, plat.y, plat.w, grassH);
      }
    }
    // Draw coins as golden circles
    coins.forEach(coin => {
      if (!coin.collected) {
        const drawX = coin.x - cameraX;
        if (drawX + COIN_SIZE >= 0 && drawX <= canvas.width) {
          const radius = COIN_SIZE / 2;
          const cx = drawX + radius;
          const cy = coin.y + radius;
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFC107';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });
    // Draw player
    player.draw(cameraX);
    // Draw score HUD
    ctx.fillStyle = '#000';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Coins: ${score}/${coins.length}`, 10, 25);
  }

  // Keyboard events
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = false;
  });

  // Start the game loop immediately (no assets to load)
  requestAnimationFrame((ts) => {
    lastTimestamp = ts;
    gameLoop(ts);
  });
})();