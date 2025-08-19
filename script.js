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
      let sprite;
      if (!this.onGround) {
        sprite = images.playerJump;
      } else if (Math.abs(this.velX) > 0.1) {
          const index = this.walkFrameIndex < 10 ? `0${this.walkFrameIndex}` : `${this.walkFrameIndex}`;
          sprite = images[`playerWalk${index}`];
      } else {
        sprite = images.playerFront;
      }
      // Flip sprite when moving left by scaling context
      ctx.save();
      const drawX = this.x - offsetX;
      if (this.velX < -0.1) {
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          0,
          0,
          sprite.width,
          sprite.height,
          -(drawX + PLAYER_WIDTH),
          this.y,
          PLAYER_WIDTH,
          PLAYER_HEIGHT
        );
      } else {
        ctx.drawImage(
          sprite,
          drawX,
          this.y,
          PLAYER_WIDTH,
          PLAYER_HEIGHT
        );
      }
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
  }

  function render() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw sky background (gradient via CSS already set)
    // Draw ground tiles
    for (const tile of groundTiles) {
      const drawX = tile.x - cameraX;
      if (drawX + tile.w >= 0 && drawX <= canvas.width) {
        ctx.drawImage(images.grassMid, drawX, tile.y, tile.w, tile.h);
      }
    }
    // Draw floating platforms (use grassCenter as simple board)
    for (const plat of floatingPlatforms) {
      const drawX = plat.x - cameraX;
      if (drawX + plat.w >= 0 && drawX <= canvas.width) {
        const tileCount = Math.ceil(plat.w / 70);
        for (let i = 0; i < tileCount; i++) {
          ctx.drawImage(images.grassCenter, drawX + i * 70, plat.y, 70, plat.h);
        }
      }
    }
    // Draw coins
    coins.forEach(coin => {
      if (!coin.collected) {
        const drawX = coin.x - cameraX;
        if (drawX + COIN_SIZE >= 0 && drawX <= canvas.width) {
          ctx.drawImage(images.coin, drawX, coin.y, COIN_SIZE, COIN_SIZE);
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

  // Load all assets then start game
  Promise.all(Object.entries(imageFiles).map(([name, src]) => loadImage(name, src)))
    .then(results => {
      results.forEach(([name, img]) => {
        images[name] = img;
      });
      // Start the game loop
      requestAnimationFrame((ts) => {
        lastTimestamp = ts;
        gameLoop(ts);
      });
    })
    .catch(err => {
      console.error('Error loading images', err);
    });
})();