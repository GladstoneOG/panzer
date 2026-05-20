import { Game } from '../engine/Game';
import { Enemy } from '../entities/Enemy';
import type { EnemyType } from '../entities/Enemy';
import { Particle } from '../entities/Particle';

export class SpawnManager {
  private game: Game;
  private spawnTimer: number = 0;
  private eventTimer: number = 0;
  
  // Wave state
  private baseSpawnInterval: number = 2.0; // Seconds between spawns
  private difficultyMultiplier: number = 1.0;

  constructor(game: Game) {
    this.game = game;
  }

  public reset() {
    this.spawnTimer = 0;
    this.eventTimer = 0;
    this.baseSpawnInterval = 2.0;
    this.difficultyMultiplier = 1.0;
  }

  public update(dt: number) {
    const time = this.game.timeElapsed;

    // 1. Calculate difficulty scaling & spawn speed
    // Spawn speed increases (interval decreases) over time, bottoming at 0.35 seconds
    this.baseSpawnInterval = Math.max(0.35, 2.0 - (time / 180) * 1.55);
    
    // Scale enemy HP/damage slowly over time (5% every 30s)
    this.difficultyMultiplier = 1.0 + Math.floor(time / 30) * 0.05;

    // 2. Continuous Enemy Spawning Loop
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemyWave();
      this.spawnTimer = this.baseSpawnInterval;
    }

    // 3. Special Event Triggers (e.g. boss spawns or mini-swarms)
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.triggerSpecialEvent(time);
      this.eventTimer = 18.0 + Math.random() * 8.0; // run events every 18-26 seconds
    }
  }

  private spawnEnemyWave() {
    const time = this.game.timeElapsed;
    const canvas = this.game.canvas;

    // Determine which pool of enemies to pull from based on time elapsed
    const enemyPool: EnemyType[] = ['infantry'];

    if (time > 20) {
      enemyPool.push('bike');
    }
    if (time > 55) {
      enemyPool.push('jeep');
      // twice as likely to get infantry/bike still
      enemyPool.push('infantry');
    }
    if (time > 115) {
      enemyPool.push('tank');
    }
    if (time > 175) {
      enemyPool.push('bomber');
    }

    // Select random enemy from pool
    const selectedType = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    
    // Position: Spawn just above the screen at random X
    const spawnX = Math.random() * (canvas.width - 80) + 40;
    const spawnY = -40;

    const enemy = new Enemy(spawnX, spawnY, selectedType, this.difficultyMultiplier);
    this.game.enemies.push(enemy);
  }

  private triggerSpecialEvent(time: number) {
    const canvas = this.game.canvas;
    const numEnemies = Math.floor(time / 45) + 3;

    // Boss trigger at 2:00 (120s) and 4:00 (240s)
    const isBossTime = (Math.abs(time - 120) < 15 || Math.abs(time - 240) < 15);
    if (isBossTime && !this.game.enemies.some(e => e.type === 'tank' && e.maxHp > 300)) {
      // Spawn a giant elite boss tank!
      const boss = new Enemy(canvas.width / 2, -60, 'tank', this.difficultyMultiplier * 3.5);
      boss.width *= 1.4;
      boss.height *= 1.4;
      boss.radius *= 1.35;
      boss.speed *= 0.8;
      boss.contactDamage *= 1.5;
      boss.isMiniBoss = true; // drops treasure chest!
      
      // Floating boss message
      this.game.spawnParticle(
        new Particle(canvas.width / 2, canvas.height * 0.3, 0, -0.5, {
          color: '#ff2200',
          size: 24,
          decay: 0.015,
          type: 'text',
          text: 'WARNING: ELITE TANK DETECTED!',
        })
      );
      this.game.enemies.push(boss);
      this.game.triggerScreenshake(0.5, 8);
      return;
    }

    // Bomber squadron event at 3:30 (210s)
    if (Math.abs(time - 210) < 15) {
      this.game.spawnParticle(
        new Particle(canvas.width / 2, canvas.height * 0.3, 0, -0.5, {
          color: '#ffcc00',
          size: 20,
          decay: 0.015,
          type: 'text',
          text: 'INCOMING AIR RAID SQUADRON!',
        })
      );
      // Spawn 3 bombers side-by-side
      for (let i = 0; i < 3; i++) {
        const xPos = canvas.width * 0.25 + i * (canvas.width * 0.25);
        const bomber = new Enemy(xPos, -80, 'bomber', this.difficultyMultiplier);
        // Middle bomber is a miniboss
        if (i === 1) {
          bomber.isMiniBoss = true;
          bomber.width *= 1.25;
          bomber.height *= 1.25;
          bomber.radius *= 1.2;
        }
        this.game.enemies.push(bomber);
      }
      return;
    }

    // Standard events: Swarms
    const eventType = Math.random() > 0.5 ? 'bike_swarm' : 'infantry_ambush';

    if (eventType === 'bike_swarm' && time > 30) {
      // Fast charge! Spawn a line of bikes at the top
      for (let i = 0; i < numEnemies; i++) {
        const x = (canvas.width / (numEnemies + 1)) * (i + 1);
        const bike = new Enemy(x, -30, 'bike', this.difficultyMultiplier * 0.9);
        this.game.enemies.push(bike);
      }
    } else {
      // Ambush: spawn infantry in a circle cluster around the player coordinates (but further away)
      if (this.game.player) {
        const px = this.game.player.pos.x;
        const py = this.game.player.pos.y;
        
        for (let i = 0; i < numEnemies * 1.5; i++) {
          const angle = (i / (numEnemies * 1.5)) * Math.PI * 2;
          const spawnDist = 400 + Math.random() * 80;
          const sx = px + Math.cos(angle) * spawnDist;
          const sy = py + Math.sin(angle) * spawnDist;
          
          // Constrain within screen bounds and keep above height/bottom
          if (sy < canvas.height - 50 && sy > -50 && sx > 20 && sx < canvas.width - 20) {
            const inf = new Enemy(sx, sy, 'infantry', this.difficultyMultiplier);
            this.game.enemies.push(inf);
          }
        }
      }
    }
  }
}
