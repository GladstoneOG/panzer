import { Input } from './Input';
import { soundManager } from './SoundManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Collectible } from '../entities/Collectible';
import { Particle } from '../entities/Particle';
import { SpawnManager } from '../systems/SpawnManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { Vector2D } from './Vector2D';
import { Obstacle } from '../entities/Obstacle';

export type GameState = 'menu' | 'character_select' | 'playing' | 'paused' | 'gameover' | 'levelup' | 'chest_open';

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public input: Input;
  public state: GameState = 'menu';

  // Game Entities
  public player: Player | null = null;
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public collectibles: Collectible[] = [];
  public particles: Particle[] = [];

  // Systems
  public spawnManager: SpawnManager;
  public upgradeManager: UpgradeManager;

  // Progression Stats
  public score: number = 0;
  public level: number = 1;
  public xp: number = 0;
  public xpNeeded: number = 100;
  public kills: number = 0;
  public timeElapsed: number = 0; // In seconds

  // Screenshake
  private shakeTimer: number = 0;
  private shakeIntensity: number = 0;
  private shakeOffset = new Vector2D(0, 0);

  // Background scrolling
  private bgY: number = 0;
  public bgSpeed: number = 40; // Pixels per second
  public obstacles: Obstacle[] = [];
  private obstacleSpawnTimer: number = 0;

  // Frame rate & timing
  private lastTime: number = 0;
  private fps: number = 0;
  private fpsTimer: number = 0;
  private frameCount: number = 0;

  // Chest Spin Rewards State
  private pendingChestReward: { name: string; icon: string; desc: string; apply: () => void; isEvolved: boolean } | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.input = new Input();
    this.spawnManager = new SpawnManager(this);
    this.upgradeManager = new UpgradeManager(this);

    this.setupResize();
    this.initBackground();
    this.setupUIEvents();

    // Start loop
    requestAnimationFrame(this.loop);
  }

  private setupResize() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private initBackground() {
    this.obstacles = [];
    const height = window.innerHeight;
    const width = window.innerWidth;

    // Spawn initial obstacles scattered vertically across the canvas
    for (let i = 0; i < 10; i++) {
      const type = Math.random() > 0.4 ? 'tree' : 'mud_pit';
      const x = Math.random() * (width - 100) + 50;
      // Scatter from upper half down to near player
      const y = Math.random() * (height * 1.5) - height * 0.7; 
      this.obstacles.push(new Obstacle(x, y, type));
    }
  }

  private setupUIEvents() {
    // Hook up the chest accept button click
    const btnChestAccept = document.getElementById('btn-chest-accept')!;
    btnChestAccept.addEventListener('click', () => {
      this.acceptChestReward();
    });

    // Toggle pause/resume with Escape or P keys
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'playing') {
          this.pauseGame();
        } else if (this.state === 'paused') {
          this.resumeGame();
        }
      }
    });
  }

  public startGame() {
    this.player = new Player(this.canvas.width / 2, this.canvas.height * 0.8, this);
    this.enemies = [];
    this.projectiles = [];
    this.collectibles = [];
    this.particles = [];
    
    this.score = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeeded = 100;
    this.kills = 0;
    this.timeElapsed = 0;
    
    this.spawnManager.reset();
    this.upgradeManager.reset();
    this.initBackground();

    // Go to Starting weapon select screen
    this.state = 'character_select';
    this.updateUI();
  }

  public selectStartingWeapon(id: string) {
    if (this.state === 'character_select') {
      this.upgradeManager.upgradeWeapon(this, id);
      soundManager.playUpgradeSelected();
      
      this.state = 'playing';
      this.updateUI();
    }
  }

  public pauseGame() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.updateUI();
    }
  }

  public resumeGame() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.updateUI();
    }
  }

  public triggerLevelUp() {
    this.state = 'levelup';
    soundManager.playLevelUp();
    this.upgradeManager.generateChoices();
    this.updateUI();
  }

  public selectUpgrade(index: number) {
    if (this.state === 'levelup') {
      this.upgradeManager.applyUpgrade(index);
      soundManager.playUpgradeSelected();
      this.state = 'playing';
      this.updateUI();
    }
  }

  public triggerGameOver() {
    this.state = 'gameover';
    soundManager.playExplosion();
    this.updateUI();
  }

  public addXp(amount: number) {
    this.xp += amount;
    if (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.xpNeeded = Math.floor(this.xpNeeded * 1.3) + 50;
      this.triggerLevelUp();
    }
    this.syncHud();
  }

  // --- CHEST SPINNER FUNCTIONS ---
  public openChest() {
    this.state = 'chest_open';
    this.updateUI();

    soundManager.playLevelUp(); // play roll chime

    // Fetch randomized chest reward
    this.pendingChestReward = this.upgradeManager.getRandomChestUpgrade();

    // Spinner layout setup
    const cardContainer = document.getElementById('chest-card-spinner')!;
    cardContainer.innerHTML = `
      <div class="spinner-card spinning">
        <div class="upgrade-icon">❓</div>
        <div class="upgrade-title">SCANNING ARSENAL SCHEMA...</div>
        <div class="upgrade-desc">Establishing secure drop uplink...</div>
      </div>
    `;

    const acceptBtn = document.getElementById('btn-chest-accept')!;
    acceptBtn.classList.add('hidden');

    // Spin for 1.8 seconds, then reveal!
    setTimeout(() => {
      if (this.state !== 'chest_open' || !this.pendingChestReward) return;

      const reward = this.pendingChestReward;
      soundManager.playUpgradeSelected(); // pleasant chime on reveal

      cardContainer.innerHTML = `
        <div class="spinner-card reveal ${reward.isEvolved ? 'evolved' : ''}">
          <div class="upgrade-icon">${reward.icon}</div>
          <div class="upgrade-title">${reward.name}</div>
          <div class="upgrade-desc">${reward.desc}</div>
        </div>
      `;

      acceptBtn.classList.remove('hidden');
    }, 1800);
  }

  public acceptChestReward() {
    if (this.state === 'chest_open' && this.pendingChestReward) {
      this.pendingChestReward.apply();
      this.pendingChestReward = null;
      
      soundManager.playUpgradeSelected();
      this.state = 'playing';
      this.updateUI();
    }
  }

  public triggerScreenshake(duration: number, intensity: number) {
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  }

  public spawnParticle(particle: Particle) {
    this.particles.push(particle);
  }

  private loop = (timestamp: number) => {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap delta time to prevent giant jumps
    if (dt > 0.1) dt = 0.1;

    this.calculateFps(dt);

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop);
  };

  private calculateFps(dt: number) {
    this.fpsTimer += dt;
    this.frameCount++;
    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  }

  private update(dt: number) {

    if (this.state !== 'playing') {
      // Pause screen or overlays: skip updating entities
      return;
    }

    this.timeElapsed += dt;
    this.updateHudRealtime();

    // Update screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const currentIntensity = this.shakeIntensity * (this.shakeTimer / 0.3); // Fade shake
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * currentIntensity,
        (Math.random() * 2 - 1) * currentIntensity
      );
      if (this.shakeTimer <= 0) {
        this.shakeOffset.set(0, 0);
      }
    }

    // Scroll background
    this.bgY += this.bgSpeed * dt;
    if (this.bgY > this.canvas.height) {
      this.bgY = 0;
    }

    // Update Player
    if (this.player) {
      this.player.update(dt, this);
    }

    // Update Projectiles
    this.projectiles.forEach((p) => p.update(dt, this));
    this.projectiles = this.projectiles.filter((p) => p.active);

    // Update Enemies
    this.enemies.forEach((e) => e.update(dt, this));
    this.enemies = this.enemies.filter((e) => e.active);

    // Update Collectibles
    this.collectibles.forEach((c) => c.update(dt, this));
    this.collectibles = this.collectibles.filter((c) => c.active);

    // Update Obstacles
    this.obstacles.forEach((o) => o.update(dt, this));
    this.obstacles = this.obstacles.filter((o) => o.active);

    // Spawn Obstacles over time
    this.obstacleSpawnTimer -= dt;
    if (this.obstacleSpawnTimer <= 0) {
      const type = Math.random() > 0.4 ? 'tree' : 'mud_pit';
      const x = Math.random() * (this.canvas.width - 100) + 50;
      this.obstacles.push(new Obstacle(x, -60, type));
      this.obstacleSpawnTimer = 1.5 + Math.random() * 1.5; // Every 1.5 - 3.0s
    }

    // Update Particles
    this.particles.forEach((p) => p.update(dt, this));
    this.particles = this.particles.filter((p) => p.active);

    // Run Systems
    this.spawnManager.update(dt);

    // Resolve Collisions
    this.resolveCollisions();
  }

  private resolveCollisions() {
    if (!this.player || !this.player.active) return;

    // 1. Player colliding with Collectibles
    for (const c of this.collectibles) {
      if (!c.active) continue;
      
      // Implement magnet pull (chest cannot be pulled)
      const dist = this.player.pos.dist(c.pos);
      if (dist < this.player.magnetRadius && c.type !== 'chest') {
        c.pullTowards(this.player.pos, 500);
      }

      if (this.player.isCollidingWith(c)) {
        c.collect(this);
      }
    }

    // 2. Projectiles colliding with targets and obstacles
    for (const p of this.projectiles) {
      if (!p.active) continue;

      if (p.isEnemyOwned) {
        // Collide with player
        if (this.player.isCollidingWith(p)) {
          this.player.takeDamage(p.damage);
          p.hit();
        }
      } else {
        // Collide with enemies
        for (const e of this.enemies) {
          if (!e.active) continue;
          if (e.isCollidingWith(p)) {
            e.takeDamage(p.damage, p.isFlame || false);
            
            if (p.isFlame) {
              e.burnTimer = 3.0; // Burn for 3 seconds
              e.burnDps = p.burnDps || (p.damage * 4.5);
            } else {
              // Apply standard hit knockback (heavy for rockets, light for machine guns)
              const pushDir = p.vel.copy().normalize();
              const force = p.isRocket ? 130 : 65; 
              e.applyKnockback(pushDir, force);
            }

            p.hit();
            if (!p.active) break;
          }
        }

        // Collide with Tree Obstacles (blockers)
        if (p.active) {
          for (const o of this.obstacles) {
            if (!o.active || o.type !== 'tree') continue;
            if (o.isCollidingWith(p)) {
              o.takeDamage(p.damage, this);
              p.hit();
              if (!p.active) break;
            }
          }
        }
      }
    }

    // 3. Solid Tree and slowing Mud Pit collisions
    for (const o of this.obstacles) {
      if (!o.active) continue;

      if (o.type === 'tree') {
        // Player vs Tree solid sliding
        const pDist = this.player.pos.dist(o.pos);
        const pMin = this.player.radius + o.radius;
        if (pDist < pMin) {
          const overlap = pMin - pDist;
          const push = this.player.pos.sub(o.pos).normalize();
          this.player.pos = this.player.pos.add(push.mult(overlap));
        }

        // Enemies vs Tree solid sliding
        for (const e of this.enemies) {
          if (!e.active) continue;
          const eDist = e.pos.dist(o.pos);
          const eMin = e.radius + o.radius;
          if (eDist < eMin) {
            const overlap = eMin - eDist;
            const push = e.pos.sub(o.pos).normalize();
            e.pos = e.pos.add(push.mult(overlap));
          }
        }
      } else if (o.type === 'mud_pit') {
        // Player slows down in mud pits
        const pDist = this.player.pos.dist(o.pos);
        if (pDist < o.radius) {
          this.player.speedMultiplier = 0.6; // 40% speed penalty
        }

        // Enemies slow down in mud pits
        for (const e of this.enemies) {
          if (!e.active) continue;
          const eDist = e.pos.dist(o.pos);
          if (eDist < o.radius) {
            e.speedMultiplier = 0.6; // 40% speed penalty
          }
        }
      }
    }

    // 4. Enemies colliding with Player directly (contact damage)
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (this.player.isCollidingWith(e)) {
        this.player.takeDamage(e.contactDamage);
        
        // Push enemy back using clean physics knockback, rather than teleporting
        const pushDir = e.pos.sub(this.player.pos).normalize();
        e.applyKnockback(pushDir, 350); 
      }
    }
  }

  private draw() {
    this.ctx.save();
    
    // Apply screenshake translation
    if (this.shakeTimer > 0) {
      this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }

    // Draw background
    this.drawBackground();

    // Draw mud pit obstacles on the ground layer
    this.obstacles.forEach((o) => {
      if (o.type === 'mud_pit') o.draw(this.ctx);
    });

    // Draw Collectibles
    this.collectibles.forEach((c) => c.draw(this.ctx));

    // Draw Player Treads/Trails (first, so they are underneath)
    if (this.player && this.player.active) {
      this.player.drawTreads(this.ctx);
    }

    // Draw tree obstacles on the surface layer
    this.obstacles.forEach((o) => {
      if (o.type === 'tree') o.draw(this.ctx);
    });

    // Draw Enemies
    this.enemies.forEach((e) => e.draw(this.ctx));

    // Draw Projectiles
    this.projectiles.forEach((p) => p.draw(this.ctx));

    // Draw Minions trailing player
    if (this.player && this.player.active) {
      this.player.drawMinions(this.ctx);
    }

    // Draw Player Ship/Tank
    if (this.player && this.player.active) {
      this.player.draw(this.ctx);
    }

    // Draw Particles
    this.particles.forEach((p) => p.draw(this.ctx));

    this.ctx.restore();

    // Draw HUD text (FPS overlay, debug status on canvas)
    this.drawCanvasStats();
  }

  private drawBackground() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Grass green terrain background
    this.ctx.fillStyle = '#2c4c23'; // Dark olive army green
    this.ctx.fillRect(0, 0, width, height);

    // Draw mud path/road scrolling down in the middle
    this.ctx.fillStyle = '#423321'; // Muddy brown
    const roadWidth = Math.min(width * 0.5, 600);
    const roadX = (width - roadWidth) / 2;
    this.ctx.fillRect(roadX, 0, roadWidth, height);

    // Draw road shoulder dashes
    this.ctx.strokeStyle = '#5a462e';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([40, 40]);
    this.ctx.beginPath();
    this.ctx.moveTo(roadX + 15, this.bgY - height);
    this.ctx.lineTo(roadX + 15, this.bgY + height * 2);
    this.ctx.moveTo(roadX + roadWidth - 15, this.bgY - height);
    this.ctx.lineTo(roadX + roadWidth - 15, this.bgY + height * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private drawCanvasStats() {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.font = '12px Courier New';
    this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);
    this.ctx.fillText(`E: ${this.enemies.length} | P: ${this.projectiles.length} | FX: ${this.particles.length}`, 10, 35);
  }

  private updateUI() {
    // Toggle main screens in HTML DOM
    const menuEl = document.getElementById('menu-screen')!;
    const charSelectEl = document.getElementById('weapon-select-screen')!;
    const hudEl = document.getElementById('hud')!;
    const pauseEl = document.getElementById('pause-screen')!;
    const gameoverEl = document.getElementById('gameover-screen')!;
    const levelupEl = document.getElementById('levelup-screen')!;
    const chestEl = document.getElementById('chest-screen')!;

    // Hide all
    menuEl.classList.add('hidden');
    charSelectEl.classList.add('hidden');
    hudEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    gameoverEl.classList.add('hidden');
    levelupEl.classList.add('hidden');
    chestEl.classList.add('hidden');

    switch (this.state) {
      case 'menu':
        menuEl.classList.remove('hidden');
        break;
      case 'character_select':
        charSelectEl.classList.remove('hidden');
        this.renderStartingWeaponOptions();
        break;
      case 'playing':
        hudEl.classList.remove('hidden');
        this.syncHud();
        break;
      case 'paused':
        hudEl.classList.remove('hidden');
        pauseEl.classList.remove('hidden');
        break;
      case 'gameover':
        gameoverEl.classList.remove('hidden');
        document.getElementById('final-score')!.innerText = `Score: ${this.score}`;
        document.getElementById('final-kills')!.innerText = `Kills: ${this.kills}`;
        document.getElementById('final-time')!.innerText = `Time Survived: ${this.formatTime(this.timeElapsed)}`;
        break;
      case 'levelup':
        hudEl.classList.remove('hidden');
        levelupEl.classList.remove('hidden');
        this.upgradeManager.renderOptions(document.getElementById('upgrade-options-container')!);
        break;
      case 'chest_open':
        hudEl.classList.remove('hidden');
        chestEl.classList.remove('hidden');
        break;
    }
  }

  private renderStartingWeaponOptions() {
    const container = document.getElementById('starting-weapon-options')!;
    container.innerHTML = '';

    const options = [
      { id: 'mg', name: 'Heavy MG', icon: '🔫', desc: 'Conventional rapid-firing frontal tank machine gun.' },
      { id: 'flame', name: 'Flame Thrower', icon: '🔥', desc: 'Short-range fire projector that torches cohorts of enemy units.' },
      { id: 'rocket', name: 'Heavy Rocket Launcher', icon: '🚀', desc: 'Fires slow explosive shells dealing wide-area blast damage.' },
      { id: 'minion', name: 'Minion Support Vehicle', icon: '🤖', desc: 'Deploys an automated micro-tank that trails you and fires independently.' }
    ];

    options.forEach(opt => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upgrade-icon">${opt.icon}</div>
        <div class="upgrade-title">${opt.name}</div>
        <div class="upgrade-desc">${opt.desc}</div>
      `;
      card.addEventListener('click', () => {
        this.selectStartingWeapon(opt.id);
      });
      container.appendChild(card);
    });
  }

  private updateHudRealtime() {
    if (!this.player) return;
    
    // Constant timer, score, and kills updating every frame
    document.getElementById('time-val')!.innerText = this.formatTime(this.timeElapsed);
    document.getElementById('score-val')!.innerText = this.score.toString();
    document.getElementById('kills-val')!.innerText = this.kills.toString();

    // Health and shield bar smooth synchronization
    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    document.getElementById('hp-fill')!.style.width = `${hpPct}%`;
    document.getElementById('hp-text')!.innerText = `${Math.ceil(this.player.hp)}/${this.player.maxHp}`;
    
    const shieldBar = document.getElementById('shield-fill')!;
    const shieldContainer = document.getElementById('shield-bar')!;
    if (this.player.shieldHp > 0) {
      shieldContainer.style.display = 'block';
      const shieldPct = (this.player.shieldHp / this.player.maxShieldHp) * 100;
      shieldBar.style.width = `${shieldPct}%`;
      document.getElementById('shield-text')!.innerText = `Plasma Shield: ${Math.ceil(this.player.shieldHp)}`;
    } else {
      shieldContainer.style.display = 'none';
    }

    // Slots counters updating
    const slots = this.upgradeManager.getOccupiedSlots();
    document.getElementById('weapon-slots-val')!.innerText = `${slots.active}/3`;
    document.getElementById('passive-slots-val')!.innerText = `${slots.passive}/3`;
  }

  public syncHud() {
    if (!this.player) return;

    // Run realtime updates
    this.updateHudRealtime();

    // XP Bar update
    const xpPct = Math.max(0, (this.xp / this.xpNeeded) * 100);
    const xpBar = document.getElementById('xp-fill')!;
    xpBar.style.width = `${xpPct}%`;
    document.getElementById('xp-text')!.innerText = `Level ${this.level} (${Math.floor(xpPct)}%)`;

    // Weapons & Passives List HUD
    const weaponsList = document.getElementById('weapons-list')!;
    weaponsList.innerHTML = '';
    
    // 1. Draw Active Weapons
    for (const weapon of this.player.weapons) {
      const isEvolved = weapon.level >= 5;
      weaponsList.innerHTML += `
        <div class="hud-weapon-icon ${isEvolved ? 'evolved-weapon' : ''}">
          <span class="weapon-name">🔫 ${weapon.name}</span>
          <span class="weapon-lvl">Lv.${weapon.level}</span>
        </div>
      `;
    }

    // 2. Draw Active Passives
    const passiveMetadata: { [key: string]: { name: string; icon: string } } = {
      firerate: { name: 'Supercharger', icon: '🔌' },
      damage: { name: 'Powder Powder', icon: '💥' },
      range: { name: 'Targeting Array', icon: '🎯' },
      maxhp: { name: 'Heavy Armor', icon: '🧱' },
      speed: { name: 'Turbo Engine', icon: '🏎️' },
      magnet: { name: 'Attraction Magnet', icon: '🧲' },
      regen: { name: 'Repair Kit', icon: '🔧' }
    };

    for (const [key, meta] of Object.entries(passiveMetadata)) {
      const lvl = this.upgradeManager.itemLevels.get(key) || 0;
      if (lvl > 0) {
        weaponsList.innerHTML += `
          <div class="hud-weapon-icon" style="border-color: rgba(255, 200, 0, 0.2); background: rgba(255, 200, 0, 0.03);">
            <span class="weapon-name" style="color: #ffd700;">${meta.icon} ${meta.name}</span>
            <span class="weapon-lvl" style="color: #ffd700; background: rgba(255, 200, 0, 0.15);">Lv.${lvl}</span>
          </div>
        `;
      }
    }
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
