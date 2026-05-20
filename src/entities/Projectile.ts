import { Entity } from './Entity';
import { Game } from '../engine/Game';
import { Vector2D } from '../engine/Vector2D';
import { Particle } from './Particle';
import { soundManager } from '../engine/SoundManager';

export interface ProjectileOptions {
  color: string;
  size: number;
  glow?: boolean;
  trailColor?: string;
  isFlame?: boolean;
  isRocket?: boolean;
  isMine?: boolean;
  isBomb?: boolean;
  bombTimer?: number;
  penetration?: number;
  explosionRadius?: number;
  isLightningChain?: boolean;
}

export class Projectile extends Entity {
  public damage: number;
  public isEnemyOwned: boolean;
  
  // Custom projectile flags
  public color: string;
  public glow: boolean = false;
  public trailColor: string | null = null;
  public isFlame: boolean = false;
  public isRocket: boolean = false;
  public isMine: boolean = false;
  public isBomb: boolean = false;
  public bombTimer: number = 0;
  private maxBombTimer: number = 0;
  
  public penetration: number = 1;
  public explosionRadius: number = 0;
  public isLightningChain: boolean = false;

  private trailHistory: Vector2D[] = [];
  private lifeTimer: number = 0;
  private maxLife: number = 8; // Max seconds before self-deactivating

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    isEnemyOwned: boolean,
    options: ProjectileOptions
  ) {
    super(
      x,
      y,
      options.size,
      options.size,
      options.isBomb || options.isMine ? options.size : options.size / 2
    );
    this.vel.set(vx, vy);
    this.damage = damage;
    this.isEnemyOwned = isEnemyOwned;

    // Load options
    this.color = options.color;
    this.glow = options.glow || false;
    this.trailColor = options.trailColor || null;
    this.isFlame = options.isFlame || false;
    this.isRocket = options.isRocket || false;
    this.isMine = options.isMine || false;
    this.isBomb = options.isBomb || false;
    this.bombTimer = options.bombTimer || 0;
    this.maxBombTimer = options.bombTimer || 0;
    this.penetration = options.penetration !== undefined ? options.penetration : 1;
    this.explosionRadius = options.explosionRadius || 0;
    this.isLightningChain = options.isLightningChain || false;

    if (this.isFlame) {
      this.maxLife = 0.45; // Flames fade quickly
    } else if (this.isMine) {
      this.maxLife = 15; // Mines last 15s on ground
    } else if (this.isBomb) {
      this.maxLife = options.bombTimer || 1.2;
    }
  }

  public update(dt: number, game: Game): void {
    this.lifeTimer += dt;
    if (this.lifeTimer >= this.maxLife) {
      if (this.isBomb) {
        this.triggerBombExplosion(game);
      } else {
        this.active = false;
      }
      return;
    }

    // --- SPECIAL BEHAVIOR ---
    if (this.isFlame) {
      // Slow down flame particles as they expand
      this.vel.x *= Math.pow(0.9, dt * 60);
      this.vel.y *= Math.pow(0.9, dt * 60);
      this.width += 40 * dt; // expand width
      this.height += 40 * dt;
      this.radius = this.width / 2;
    }

    if (this.isBomb) {
      // Bombs are stationary warnings dropped on the ground
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.triggerBombExplosion(game);
      }
      return;
    }

    if (this.isMine) {
      // Mines sit stationary on the ground
      // Slow down to 0 if launched with initial nudge
      this.vel.x *= Math.pow(0.85, dt * 60);
      this.vel.y *= Math.pow(0.85, dt * 60);
    }

    // Standard movement
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Record trail positions for tracers/lasers
    if (this.trailColor && !this.isBomb && !this.isMine) {
      this.trailHistory.push(this.pos.copy());
      if (this.trailHistory.length > 5) {
        this.trailHistory.shift();
      }
    }

    // Deactivate if way out of bounds
    if (
      this.pos.x < -100 ||
      this.pos.x > game.canvas.width + 100 ||
      this.pos.y < -100 ||
      this.pos.y > game.canvas.height + 100
    ) {
      this.active = false;
    }
  }

  public hit() {
    if (this.isMine || this.isBomb) return; // handled separately on trigger/contact

    this.penetration--;
    if (this.penetration <= 0) {
      this.active = false;
      
      const game = (window as any).gameInstance as Game;
      if (game) {
        if (this.isRocket && this.explosionRadius > 0) {
          this.triggerRocketExplosion(game);
        } else if (this.isLightningChain) {
          // Lightning arcs don't explode but trigger visual sparks
          for (let i = 0; i < 4; i++) {
            game.spawnParticle(
              new Particle(this.pos.x, this.pos.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, {
                color: this.color,
                size: 2,
                decay: 0.1,
                glow: true,
              })
            );
          }
        }
      }
    }
  }

  // --- EXPLOSIONS ---

  /** Conventional Rocket shell splash damage */
  private triggerRocketExplosion(game: Game) {
    soundManager.playExplosion();
    game.triggerScreenshake(0.2, 8);

    // Shockwave particle
    game.spawnParticle(
      new Particle(this.pos.x, this.pos.y, 0, 0, {
        color: 'rgba(255, 120, 0, 0.35)',
        size: this.explosionRadius * 0.7,
        decay: 0.05,
        type: 'shockwave',
      })
    );

    // Fire/Smoke particles
    for (let i = 0; i < 15; i++) {
      const vx = (Math.random() - 0.5) * 7;
      const vy = (Math.random() - 0.5) * 7;
      const size = Math.random() * 20 + 8;
      game.spawnParticle(
        new Particle(this.pos.x, this.pos.y, vx, vy, {
          color: Math.random() > 0.45 ? '#ffaa00' : '#444444',
          size: size,
          decay: 0.03 + Math.random() * 0.02,
          type: Math.random() > 0.5 ? 'smoke' : 'spark',
        })
      );
    }

    // Check AoE damage to all active enemies in range
    const radSq = this.explosionRadius * this.explosionRadius;
    for (const e of game.enemies) {
      if (!e.active) continue;
      const dSq = this.pos.distSq(e.pos);
      if (dSq <= radSq) {
        // Deal full or falloff damage
        e.takeDamage(this.damage * 0.85); // Splash deal slightly less than direct
        
        // Apply radial knockback
        const pushDir = e.pos.sub(this.pos);
        const dist = pushDir.mag();
        const dir = dist > 0 ? pushDir.normalize() : Vector2D.fromAngle(Math.random() * Math.PI * 2);
        
        const proximity = 1 - Math.min(1.0, dist / this.explosionRadius);
        const force = 350 + proximity * 150; // Heavy push (350-500)
        e.applyKnockback(dir, force);
      }
    }
  }

  /** Enemy Bomber Plane Bomb template explosion */
  private triggerBombExplosion(game: Game) {
    this.active = false;
    soundManager.playExplosion();
    game.triggerScreenshake(0.4, 15);

    // Red expanding shockwave
    game.spawnParticle(
      new Particle(this.pos.x, this.pos.y, 0, 0, {
        color: '#ff2200',
        size: this.radius * 2,
        decay: 0.03,
        type: 'shockwave',
      })
    );

    // High count of fire particles
    for (let i = 0; i < 20; i++) {
      const vx = (Math.random() - 0.5) * 9;
      const vy = (Math.random() - 0.5) * 9;
      game.spawnParticle(
        new Particle(this.pos.x, this.pos.y, vx, vy, {
          color: Math.random() > 0.3 ? '#ff3300' : '#222222',
          size: Math.random() * 25 + 10,
          decay: 0.02 + Math.random() * 0.03,
          type: Math.random() > 0.6 ? 'smoke' : 'spark',
        })
      );
    }

    // Check hit on player (since bomber is an enemy)
    if (game.player && game.player.active) {
      const dist = this.pos.dist(game.player.pos);
      const splashRange = this.radius * 2; // explosion covers warning range
      if (dist <= splashRange + game.player.radius) {
        // Deal bomb damage
        game.player.takeDamage(this.damage);
      }
    }
  }

  /** Landmine trigger explosion */
  public triggerMineExplosion(game: Game) {
    this.active = false;
    this.triggerRocketExplosion(game); // landmines share same AoE damage & visual logic
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.glow) {
      ctx.shadowBlur = this.radius * 3.5;
      ctx.shadowColor = this.color;
    }

    // 1. Draw glowing path trail (if tracer/laser)
    if (this.trailColor && this.trailHistory.length > 1) {
      ctx.strokeStyle = this.trailColor;
      ctx.lineWidth = this.width * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trailHistory[0].x, this.trailHistory[0].y);
      for (let i = 1; i < this.trailHistory.length; i++) {
        ctx.lineTo(this.trailHistory[i].x, this.trailHistory[i].y);
      }
      ctx.stroke();
    }

    // 2. Draw specialized projectile bodies
    if (this.isFlame) {
      // Draw fire clouds (expanding colored gradient circles)
      const grad = ctx.createRadialGradient(
        this.pos.x,
        this.pos.y,
        1,
        this.pos.x,
        this.pos.y,
        this.radius
      );
      
      // Calculate interpolation color based on life
      const lifePct = this.lifeTimer / this.maxLife;
      if (lifePct < 0.3) {
        grad.addColorStop(0, '#ffffff'); // super hot white core
        grad.addColorStop(0.3, '#ffbb00');
        grad.addColorStop(1, 'rgba(255, 68, 0, 0)');
      } else if (lifePct < 0.7) {
        grad.addColorStop(0, '#ffaa00');
        grad.addColorStop(0.6, '#ff4400');
        grad.addColorStop(1, 'rgba(220, 40, 0, 0)');
      } else {
        // mostly dark red smoke/ash
        grad.addColorStop(0, '#662200');
        grad.addColorStop(0.5, '#333333');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.isMine) {
      // Draw conventional round black landmine with flashing red LED
      ctx.translate(this.pos.x, this.pos.y);
      
      // Mine metal body
      ctx.fillStyle = '#2d2f2b'; // dark green olive steel
      ctx.strokeStyle = '#1b1c1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner details
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
      ctx.stroke();

      // Flashing LED sensor (blinks red)
      const flash = Math.sin(Date.now() / 100) > 0;
      ctx.fillStyle = flash ? '#ff0000' : '#440000';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.isBomb) {
      // Draw flashing target warning circles on the floor (from bombers)
      const pulsePct = this.bombTimer / this.maxBombTimer;
      const flashFast = Math.sin(Date.now() / (50 + pulsePct * 150)) > 0;

      // Outer Danger Circle
      ctx.strokeStyle = flashFast ? 'rgba(255, 34, 0, 0.7)' : 'rgba(255, 34, 0, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Filled shaded radius that grows as explosion gets closer
      ctx.fillStyle = 'rgba(255, 34, 0, 0.08)';
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius * 2 * (1 - pulsePct), 0, Math.PI * 2);
      ctx.fill();

      // Inner danger cross/exclamation point
      ctx.fillStyle = flashFast ? 'rgba(255, 0, 0, 0.7)' : 'rgba(150, 0, 0, 0.4)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', this.pos.x, this.pos.y);

    } else {
      // Default: solid bullet shape (oval tracer)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      
      const angle = this.vel.heading();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(angle);
      
      // Draw bullet pill shape pointing forward
      const w = this.width * 2.2;
      const h = this.height * 0.95;
      ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
