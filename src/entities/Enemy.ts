import { Entity } from './Entity';
import { Game } from '../engine/Game';
import { Vector2D } from '../engine/Vector2D';
import { Projectile } from './Projectile';
import { Particle } from './Particle';
import { Collectible } from './Collectible';
import { soundManager } from '../engine/SoundManager';

export type EnemyType = 'infantry' | 'bike' | 'jeep' | 'tank' | 'bomber';

export class Enemy extends Entity {
  public type: EnemyType;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public contactDamage: number = 10;
  public isMiniBoss: boolean = false;
  
  // Scoring / Drop
  public scoreValue: number;
  public xpValue: number;

  // Firing logic
  private fireCooldown: number = 0;
  private fireInterval: number = 2.0; // base reload

  // Visuals
  private hitFlashTimer: number = 0;
  private animTimer: number = 0;
  private isFlameDamaged: boolean = false;

  constructor(x: number, y: number, type: EnemyType, difficultyMultiplier: number = 1.0) {
    // Setup base sizes depending on type
    let w = 24, h = 24, rad = 12;
    let hp = 15;
    let speed = 60;
    let score = 10;
    let xp = 10;
    let localContactDamage = 10;
    let localFireInterval = 2.0;
    
    switch (type) {
      case 'infantry':
        w = 20; h = 20; rad = 10;
        hp = 15; speed = 55;
        score = 10; xp = 10;
        localContactDamage = 8;
        break;
      case 'bike':
        w = 22; h = 32; rad = 12;
        hp = 30; speed = 140;
        score = 25; xp = 20;
        localContactDamage = 15;
        break;
      case 'jeep':
        w = 32; h = 40; rad = 18;
        hp = 65; speed = 90;
        score = 50; xp = 40;
        localContactDamage = 20;
        localFireInterval = 2.2;
        break;
      case 'tank':
        w = 44; h = 50; rad = 25;
        hp = 180; speed = 40;
        score = 150; xp = 100;
        localContactDamage = 30;
        localFireInterval = 3.0;
        break;
      case 'bomber':
        w = 56; h = 48; rad = 28;
        hp = 120; speed = 160;
        score = 100; xp = 80;
        localContactDamage = 25;
        localFireInterval = 0.8; // drops bombs rapidly
        break;
    }

    // Scale stats with wave difficulty
    hp = Math.floor(hp * difficultyMultiplier);
    score = Math.floor(score * difficultyMultiplier);
    
    super(x, y, w, h, rad);
    this.type = type;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.scoreValue = score;
    this.xpValue = xp;
    this.contactDamage = localContactDamage;
    this.fireInterval = localFireInterval;

    // Randomize initial cooldown to stagger firing
    this.fireCooldown = Math.random() * this.fireInterval;
  }

  public update(dt: number, game: Game): void {
    if (!game.player) return;

    this.animTimer += dt;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    // --- MOVEMENT BEHAVIOR ---
    switch (this.type) {
      case 'infantry':
        // Slow direct tracking towards player
        const toPlayer = game.player.pos.sub(this.pos).normalize();
        this.vel.set(toPlayer.x * this.speed, toPlayer.y * this.speed);
        break;

      case 'bike':
        // Fast straight charge diagonally downwards
        if (this.vel.magSq() === 0) {
          // pick a down-diagonal direction
          const dx = Math.random() > 0.5 ? 1 : -1;
          this.vel.set(dx * this.speed * 0.7, this.speed * 0.75);
        }
        break;

      case 'jeep':
        // Flank movement: head down, drift left/right periodically
        const drift = Math.sin(this.animTimer * 2) * 50;
        this.vel.set(drift, this.speed);
        break;

      case 'tank':
        // Slowly advance downwards, adjusting toward player horizontally
        const dxToPlayer = game.player.pos.x - this.pos.x;
        const tankXSpeed = Math.abs(dxToPlayer) > 10 ? Math.sign(dxToPlayer) * this.speed * 0.5 : 0;
        this.vel.set(tankXSpeed, this.speed * 0.8);
        break;

      case 'bomber':
        // Flying bomber plane, goes straight down the screen super fast
        this.vel.set(0, this.speed);
        break;
    }

    // Apply movement
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // Remove if left bottom of screen
    if (this.pos.y > game.canvas.height + 80) {
      this.active = false;
      return;
    }
    // Bounce bikes/jeeps off side walls
    if (this.pos.x < this.radius || this.pos.x > game.canvas.width - this.radius) {
      this.vel.x = -this.vel.x;
    }

    // --- FIRING BEHAVIOR ---
    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0) {
      this.fire(game);
      this.fireCooldown = this.fireInterval + Math.random() * 0.5; // randomize reload slightly
    }
  }

  private fire(game: Game) {
    if (!game.player || !game.player.active) return;

    const angleToPlayer = game.player.pos.sub(this.pos).heading();

    switch (this.type) {
      case 'infantry':
        // Occasional light rifle fire
        if (Math.random() < 0.3) {
          this.spawnBullet(game, angleToPlayer, 300, 8, '#ff6666', 3);
        }
        break;
      case 'jeep':
        // LMG bursts: spawn 2 quick bullets
        this.spawnBullet(game, angleToPlayer, 400, 12, '#ff4444', 3.5);
        setTimeout(() => {
          if (this.active && game.state === 'playing') {
            this.spawnBullet(game, angleToPlayer, 400, 12, '#ff4444', 3.5);
          }
        }, 150);
        break;
      case 'tank':
        // Heavy shell targeting player
        soundManager.playShoot(); // lower thud
        this.spawnBullet(game, angleToPlayer, 320, 22, '#ff2222', 6, true);
        break;
      case 'bomber':
        // Bomber drops bomb templates (mines) on the ground
        const bombX = this.pos.x;
        const bombY = this.pos.y;
        
        // Spawn an exploding bomb danger zone
        game.projectiles.push(
          new Projectile(bombX, bombY, 0, 0, 25, true, {
            color: '#ff3300',
            size: 15,
            isBomb: true,
            bombTimer: 1.2, // explodes in 1.2 seconds
          })
        );
        break;
    }
  }

  private spawnBullet(
    game: Game,
    angle: number,
    speed: number,
    damage: number,
    color: string,
    size: number,
    heavyTrace: boolean = false
  ) {
    const vel = Vector2D.fromAngle(angle).mult(speed);
    game.projectiles.push(
      new Projectile(this.pos.x, this.pos.y, vel.x, vel.y, damage, true, {
        color: color,
        size: size,
        glow: heavyTrace,
        trailColor: heavyTrace ? 'rgba(255, 34, 34, 0.2)' : undefined,
      })
    );
  }

  public takeDamage(damage: number, isFlame: boolean = false) {
    this.hp -= damage;
    this.hitFlashTimer = 0.08; // Flash white for 80ms
    this.isFlameDamaged = isFlame;

    const game = (window as any).gameInstance as Game;

    // Spawn floating damage numbers
    if (game) {
      const floatX = this.pos.x + (Math.random() - 0.5) * 15;
      const floatY = this.pos.y - 10;
      const displayDamage = Math.round(damage);
      game.spawnParticle(
        new Particle(floatX, floatY, 0, -1.5, {
          color: isFlame ? '#ffaa00' : '#ffffff',
          size: damage > 50 ? 16 : 11,
          decay: 0.03,
          type: 'text',
          text: displayDamage.toString(),
        })
      );
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.die();
    }
  }

  private die() {
    const game = (window as any).gameInstance as Game;
    if (!game) return;

    game.kills++;
    game.score += this.scoreValue;

    // Play explosion sound (bomber and tank get louder explosions)
    if (this.type === 'tank' || this.type === 'bomber') {
      soundManager.playExplosion();
      game.triggerScreenshake(0.3, 10);
    } else {
      // light explosion
      soundManager.playExplosion(); // standard
    }

    // Spawn explosion particles
    const particleCount = this.type === 'tank' ? 18 : this.type === 'bomber' ? 22 : 6;
    for (let i = 0; i < particleCount; i++) {
      const vx = (Math.random() - 0.5) * 6;
      const vy = (Math.random() - 0.5) * 6;
      const size = Math.random() * (this.width / 2) + 5;
      game.spawnParticle(
        new Particle(this.pos.x, this.pos.y, vx, vy, {
          color: Math.random() > 0.4 ? (this.isFlameDamaged ? '#ffcc00' : '#ff4400') : '#555555',
          size: size,
          decay: 0.03 + Math.random() * 0.02,
          type: Math.random() > 0.6 ? 'debris' : 'smoke',
        })
      );
    }

    // Spawn a shockwave for big enemies
    if (this.type === 'tank' || this.type === 'bomber') {
      game.spawnParticle(
        new Particle(this.pos.x, this.pos.y, 0, 0, {
          color: 'rgba(255, 100, 0, 0.4)',
          size: this.radius,
          decay: 0.04,
          type: 'shockwave',
        })
      );
    }

    if (this.isMiniBoss) {
      game.collectibles.push(new Collectible(this.pos.x, this.pos.y, 'chest', 0));
    } else {
      // Drop XP Gem Collectibles
      // Larger enemies drop larger gems
      let gemTier: 'green' | 'blue' | 'gold' = 'green';
      if (this.xpValue >= 80) gemTier = 'gold';
      else if (this.xpValue >= 40) gemTier = 'blue';

      // Drop chance for repair crate if player is hurt
      let dropRepair = false;
      if (game.player && game.player.hp < game.player.maxHp * 0.7 && Math.random() < 0.06) {
        dropRepair = true;
      }

      if (dropRepair) {
        game.collectibles.push(new Collectible(this.pos.x, this.pos.y, 'repair', 0));
      } else {
        game.collectibles.push(new Collectible(this.pos.x, this.pos.y, 'xp', this.xpValue, gemTier));
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Draw Shadow for Plane (since planes are flying high)
    if (this.type === 'bomber') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      // Draw shadow shifted downwards-right
      ctx.ellipse(this.pos.x + 30, this.pos.y + 50, this.width * 0.7, this.height * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Apply hit flash (draws enemy solid white on hit)
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Render based on Enemy Type
    ctx.translate(this.pos.x, this.pos.y);

    switch (this.type) {
      case 'infantry':
        // Draw a small soldier/infantry layout (grey/green helmet + torso)
        ctx.fillStyle = '#5c5043'; // Brown coat / uniform
        // Torso
        ctx.fillRect(-6, 2, 12, 8);
        // Helmet
        ctx.fillStyle = '#42493a'; // German helmet grey-green
        ctx.beginPath();
        ctx.arc(0, -4, 6, Math.PI, 0); // half sphere dome
        ctx.fill();
        // Helmet rim
        ctx.fillRect(-7, -4, 14, 1.5);
        // Gun barrel
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(3, -2);
        ctx.lineTo(8, 6);
        ctx.stroke();
        break;

      case 'bike':
        // Fast motorbike with sidecar
        ctx.save();
        ctx.rotate(this.vel.heading());
        // Wheels
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-14, -8, 8, 4); // front wheel
        ctx.fillRect(8, -8, 8, 4);  // back wheel
        ctx.fillRect(0, 8, 8, 4);   // sidecar wheel
        // Frame
        ctx.fillStyle = '#515949'; // Panzer grey-green
        ctx.fillRect(-10, -7, 18, 3); // motorcycle body
        ctx.fillRect(-4, -4, 12, 11); // connecting frame and sidecar body
        // Headlight
        ctx.fillStyle = '#ffdd66';
        ctx.fillRect(10, -7, 2, 3);
        ctx.restore();
        break;

      case 'jeep':
        // Military reconnaissance jeep
        ctx.save();
        ctx.rotate(Math.PI / 2); // default face down
        // Tires
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-15, -12, 8, 4); // front-left
        ctx.fillRect(7, -12, 8, 4);  // back-left
        ctx.fillRect(-15, 8, 8, 4);  // front-right
        ctx.fillRect(7, 8, 8, 4);   // back-right
        // Body
        ctx.fillStyle = '#5b6951'; // WW2 Green jeep color
        ctx.fillRect(-12, -9, 24, 18);
        ctx.fillStyle = '#3f4738'; // windshield / inside
        ctx.fillRect(-5, -7, 2, 14); // grill dash
        // Grill bumper
        ctx.fillStyle = '#222';
        ctx.fillRect(-14, -10, 2, 20);
        // Mounted machine gun on back
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(16, 0); // points forward
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(4, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;

      case 'tank':
        // Heavy Panzer/Tiger tank
        ctx.save();
        // Point body along velocity or straight down
        ctx.rotate(Math.PI / 2);
        // Treads
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-22, -20, 44, 6);
        ctx.fillRect(-22, 14, 44, 6);
        // Body
        ctx.fillStyle = '#67717f'; // Panzer grey
        ctx.fillRect(-20, -15, 40, 30);
        // Camo panels
        ctx.fillStyle = '#4c535d';
        ctx.fillRect(-10, -15, 12, 5);
        ctx.fillRect(2, 8, 14, 7);
        // Turret (rotates slightly towards player)
        ctx.restore(); // restore relative translate
        
        ctx.save();
        // Draw turret looking at player
        const game = (window as any).gameInstance as Game;
        let turretAngle = Math.PI / 2; // face down by default
        if (game && game.player && game.player.active) {
          turretAngle = game.player.pos.sub(this.pos).heading();
        }
        ctx.rotate(turretAngle);
        
        // Barrel
        ctx.strokeStyle = '#4e555f';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(26, 0);
        ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.fillRect(24, -3, 3, 6);

        // Cupola
        ctx.fillStyle = '#67717f';
        ctx.strokeStyle = '#414750';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;

      case 'bomber':
        // Big WW2 Twin-prop bomber plane flying overhead
        ctx.save();
        ctx.rotate(Math.PI / 2); // faces down
        // Wings
        ctx.fillStyle = '#4b5745'; // Dark slate military green
        ctx.beginPath();
        ctx.moveTo(-10, -28); // tip of left wing
        ctx.lineTo(0, -6);
        ctx.lineTo(10, -28);
        ctx.fill();
        // Wing rectangle
        ctx.fillRect(-6, -26, 12, 52); // wingspan
        
        // Fuselage (Body)
        ctx.fillStyle = '#5c6955';
        ctx.fillRect(-22, -8, 44, 16);
        // Nose cone
        ctx.beginPath();
        ctx.arc(22, 0, 8, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        // Tail wings
        ctx.fillRect(-22, -14, 4, 28);
        
        // Yellow wing tips
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-6, -28, 12, 2);
        ctx.fillRect(-6, 26, 12, 2);
        
        // Engines / Propellers
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -15, 6, 4); // Left Engine
        ctx.fillRect(0, 11, 6, 4);  // Right Engine
        
        // Spin propeller visualization (drawing translucent lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        const propSpin = this.animTimer * 20;
        ctx.beginPath();
        // left prop
        ctx.moveTo(6, -13 + Math.sin(propSpin) * 8);
        ctx.lineTo(6, -13 - Math.sin(propSpin) * 8);
        // right prop
        ctx.moveTo(6, 13 + Math.cos(propSpin) * 8);
        ctx.lineTo(6, 13 - Math.cos(propSpin) * 8);
        ctx.stroke();
        
        ctx.restore();
        break;
    }

    ctx.restore(); // Restore translate

    // 2. Draw Enemy Health Bar (if damaged)
    if (this.hp < this.maxHp && this.hp > 0) {
      const barWidth = this.width * 1.1;
      const barHeight = 4;
      const barX = this.pos.x - barWidth / 2;
      const barY = this.pos.y - this.radius - 8;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const hpPct = this.hp / this.maxHp;
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(barX, barY, barWidth * hpPct, barHeight);
    }
  }
}
