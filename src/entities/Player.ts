import { Entity } from './Entity';
import { Game } from '../engine/Game';
import { Vector2D } from '../engine/Vector2D';
import { Projectile } from './Projectile';
import { Particle } from './Particle';
import { Enemy } from './Enemy';
import { soundManager } from '../engine/SoundManager';

export interface Weapon {
  name: string;
  level: number;
  cooldown: number;
  cooldownMax: number;
  fire: (game: Game, target: Entity | null) => void;
}

export class Player extends Entity {
  public maxHp: number = 100;
  public hp: number = 100;
  
  // Stats modified by upgrades
  public speed: number = 220; // px/sec
  public fireRateModifier: number = 1.0; // decreases cooldowns (e.g. 0.8 is 20% faster)
  public damageModifier: number = 1.0;
  public magnetRadius: number = 120;
  public hpRegen: number = 0; // health regen per second
  public range: number = 280; // lock-on targeting range
  
  // Plasma Shield (Sci-Fi Evolved upgrade)
  public maxShieldHp: number = 0;
  public shieldHp: number = 0;
  public shieldRechargeTimer: number = 0;

  // Weapons
  public weapons: Weapon[] = [];
  public minions: Minion[] = [];

  // Visuals & Aiming
  public turretAngle: number = -Math.PI / 2;
  private treadHistory: Array<{ pos: Vector2D; angle: number }> = [];
  private currentMovementAngle: number = -Math.PI / 2;

  // Invulnerability frames on taking damage
  private iFrames: number = 0;

  constructor(x: number, y: number, _game: Game) {
    // Tank dimensions
    super(x, y, 40, 48, 22);
  }

  public addWeapon(w: Weapon) {
    this.weapons.push(w);
  }

  public update(dt: number, game: Game): void {
    // Invulnerability frames
    if (this.iFrames > 0) {
      this.iFrames -= dt;
    }

    // Shield recharge
    if (this.maxShieldHp > 0 && this.shieldHp < this.maxShieldHp) {
      this.shieldRechargeTimer += dt;
      if (this.shieldRechargeTimer >= 3.0) { // 3s without hits to start recharging
        this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + 15 * dt);
      }
    }

    // Health Regeneration
    if (this.hp < this.maxHp && this.hpRegen > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    }

    // Movement
    const moveDir = game.input.getMovementVector();
    if (moveDir.magSq() > 0) {
      this.pos.x += moveDir.x * this.speed * dt;
      this.pos.y += moveDir.y * this.speed * dt;
      
      this.currentMovementAngle = moveDir.heading();

      // Record tread marks
      if (Math.random() < 0.2) {
        this.treadHistory.push({
          pos: this.pos.copy(),
          angle: this.currentMovementAngle,
        });
        if (this.treadHistory.length > 25) {
          this.treadHistory.shift();
        }
      }
    }

    // Constrain player to canvas viewport
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    this.pos.x = Math.max(halfW, Math.min(game.canvas.width - halfW, this.pos.x));
    this.pos.y = Math.max(halfH, Math.min(game.canvas.height - halfH, this.pos.y));

    // Find nearest enemy for turret auto-aim (respecting Range bounds)
    const nearestEnemy = this.findNearestEnemy(game);
    if (nearestEnemy) {
      const targetAngle = nearestEnemy.pos.sub(this.pos).heading();
      // Smoothly rotate turret towards target
      const angleDiff = targetAngle - this.turretAngle;
      // Normalize angle diff to [-PI, PI]
      const smoothDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.turretAngle += smoothDiff * Math.min(1.0, dt * 10);
    } else {
      // Default aim forward (upwards)
      const targetAngle = -Math.PI / 2;
      const angleDiff = targetAngle - this.turretAngle;
      const smoothDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.turretAngle += smoothDiff * Math.min(1.0, dt * 5);
    }

    // Update weapons cooldown & fire
    for (const weapon of this.weapons) {
      weapon.cooldown -= dt;
      if (weapon.cooldown <= 0) {
        weapon.fire(game, nearestEnemy);
        // Apply fire rate upgrades
        weapon.cooldown = weapon.cooldownMax * this.fireRateModifier;
      }
    }

    // Update minion drone tanks
    const minionLvl = game.upgradeManager.itemLevels.get('minion') || 0;
    if (minionLvl > 0) {
      let targetMinions = 1;
      if (minionLvl >= 5) {
        targetMinions = 4;
      } else if (minionLvl >= 3) {
        targetMinions = 2;
      }

      while (this.minions.length < targetMinions) {
        const id = this.minions.length;
        let ox = -35;
        let oy = -35;
        if (id === 1) { ox = 35; oy = -35; }
        else if (id === 2) { ox = -45; oy = 0; }
        else if (id === 3) { ox = 45; oy = 0; }
        this.minions.push(new Minion(this.pos.x + ox, this.pos.y + oy, ox, oy));
      }

      // Remove excess minions if level downgraded for some reason
      while (this.minions.length > targetMinions) {
        this.minions.pop();
      }

      for (const minion of this.minions) {
        minion.update(dt, this, game, minionLvl, this.damageModifier, this.range);
      }
    } else {
      this.minions = [];
    }
  }

  private findNearestEnemy(game: Game): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = this.range * this.range; // cap search range squared

    for (const e of game.enemies) {
      if (!e.active) continue;
      const d = this.pos.distSq(e.pos);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  public takeDamage(amount: number) {
    if (this.iFrames > 0) return;

    soundManager.playPlayerHit();
    this.iFrames = 0.3; // 300ms i-frames

    // Shield absorbs damage first
    if (this.shieldHp > 0) {
      this.shieldRechargeTimer = 0; // reset recharge delay
      this.shieldHp -= amount;
      if (this.shieldHp < 0) {
        // Carry over remaining damage to hp
        this.hp += this.shieldHp;
        this.shieldHp = 0;
      }
    } else {
      this.hp -= amount;
    }

    // Trigger UI update
    this.iFrames = 0.3;

    // Visual red hit particles
    const game = (window as any).gameInstance as Game;
    if (game) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        game.spawnParticle(
          new Particle(this.pos.x, this.pos.y, vx, vy, {
            color: '#ff3333',
            size: Math.random() * 4 + 3,
            decay: 0.05,
            type: 'spark',
          })
        );
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.triggerDeathExplosion();
    }
  }

  private triggerDeathExplosion() {
    // Huge explosion of smoke and fire
    const game = (window as any).gameInstance as Game;
    if (game) {
      game.triggerScreenshake(0.8, 25);
      // Spawn massive particles
      for (let i = 0; i < 40; i++) {
        const vx = (Math.random() - 0.5) * 12;
        const vy = (Math.random() - 0.5) * 12;
        const size = Math.random() * 30 + 10;
        game.spawnParticle(
          new Particle(this.pos.x, this.pos.y, vx, vy, {
            color: Math.random() > 0.4 ? '#ff5500' : '#444444',
            size: size,
            decay: 0.02 + Math.random() * 0.02,
            type: Math.random() > 0.5 ? 'smoke' : 'debris',
          })
        );
      }
      game.triggerGameOver();
    }
  }

  public drawTreads(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 6;
    
    // Draw tread paths
    for (const t of this.treadHistory) {
      ctx.save();
      ctx.translate(t.pos.x, t.pos.y);
      ctx.rotate(t.angle);
      
      // Parallel treads left and right
      ctx.beginPath();
      // Left tread path
      ctx.moveTo(-16, -10);
      ctx.lineTo(-16, 10);
      // Right tread path
      ctx.moveTo(16, -10);
      ctx.lineTo(16, 10);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  public drawMinions(ctx: CanvasRenderingContext2D): void {
    for (const minion of this.minions) {
      minion.draw(ctx);
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Invulnerability blinking
    if (this.iFrames > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    // Center and rotate chassis to match movement direction
    ctx.translate(this.pos.x, this.pos.y);
    ctx.save();
    ctx.rotate(this.currentMovementAngle);

    // 1. Draw treads
    ctx.fillStyle = '#1c1c1c'; // Dark gray/black treads
    // Left tread
    ctx.fillRect(-22, -this.height / 2, 8, this.height);
    // Right tread
    ctx.fillRect(14, -this.height / 2, 8, this.height);

    // Draw tread details (ridges)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    for (let yOffset = -this.height / 2 + 4; yOffset < this.height / 2; yOffset += 8) {
      ctx.beginPath();
      ctx.moveTo(-22, yOffset);
      ctx.lineTo(-14, yOffset);
      ctx.moveTo(14, yOffset);
      ctx.lineTo(22, yOffset);
      ctx.stroke();
    }

    // 2. Draw tank chassis (Green armored body with camouflage patches)
    ctx.fillStyle = '#445a3c'; // Army green
    ctx.fillRect(-14, -this.height / 2 + 4, 28, this.height - 8);

    // Camo details
    ctx.fillStyle = '#2e3a28'; // Darker green blotches
    ctx.beginPath();
    ctx.arc(-6, -10, 6, 0, Math.PI * 2);
    ctx.arc(8, 10, 7, 0, Math.PI * 2);
    ctx.arc(-4, 12, 5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw armor side panels / skirts
    ctx.fillStyle = '#3a4e32';
    ctx.fillRect(-16, -this.height / 2 + 8, 3, this.height - 16);
    ctx.fillRect(13, -this.height / 2 + 8, 3, this.height - 16);

    ctx.restore(); // Exit chassis-rotation context

    // 4. Draw turret and gun (rotates independently towards targets!)
    ctx.save();
    ctx.rotate(this.turretAngle);

    // Turret main barrel shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(32, 2);
    ctx.stroke();

    // Turret gun barrel
    ctx.strokeStyle = '#2f3d2a'; // Metal gun barrel green
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();

    // Muzzle brake at the end of barrel
    ctx.fillStyle = '#1c2219';
    ctx.fillRect(28, -4, 4, 8);

    // Turret cupola (rotating center pod)
    ctx.fillStyle = '#4d6645'; // Army green
    ctx.strokeStyle = '#2d3d27';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Turret hatch / details
    ctx.fillStyle = '#1c2219';
    ctx.beginPath();
    ctx.arc(-4, -2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#445a3c';
    ctx.beginPath();
    ctx.arc(-4, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw small green status light on turret
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(4, 4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Exit turret rotation context

    // 5. Draw Plasma Shield (If active, draw orbiting neon rings)
    if (this.maxShieldHp > 0 && this.shieldHp > 0) {
      const shieldPulse = Math.sin(Date.now() / 150) * 4;
      const currentRadius = this.radius * 1.5 + shieldPulse;

      ctx.save();
      ctx.strokeStyle = '#00bbff';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00d5ff';
      ctx.lineWidth = 3;
      
      // Draw outer glowing bubble
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Faint neon fill inside bubble
      ctx.fillStyle = 'rgba(0, 187, 255, 0.08)';
      ctx.fill();

      // Draw active lightning spark arcs on shield border
      ctx.strokeStyle = '#e0f7ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const startAng = Math.random() * Math.PI * 2;
        const arcLength = Math.random() * 0.4 + 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, startAng, startAng + arcLength);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore(); // Exit full player draw context
  }
}

export class Minion {
  public pos: Vector2D;
  public vel: Vector2D = new Vector2D(0, 0);
  public turretAngle: number = 0;
  public cooldown: number = 0;
  public cooldownMax: number = 0.5; // shoots fast
  public offset: Vector2D;
  public radius: number = 14;

  constructor(x: number, y: number, offsetX: number, offsetY: number) {
    this.pos = new Vector2D(x, y);
    this.offset = new Vector2D(offsetX, offsetY);
  }

  public update(dt: number, player: Player, game: Game, level: number, damageMod: number, range: number) {
    // Target position trails behind player at a rotated offset based on turret/movement
    const rotatedOffset = this.offset.rotate(player.turretAngle + Math.PI);
    const targetPos = player.pos.add(rotatedOffset);

    // Smooth follow target position
    const toTarget = targetPos.sub(this.pos);
    const dist = toTarget.mag();
    if (dist > 1) {
      this.pos.x += toTarget.x * Math.min(1.0, dt * 5);
      this.pos.y += toTarget.y * Math.min(1.0, dt * 5);
    }

    // Weapons shooting: find nearest enemy within player's range limit
    let nearest: Enemy | null = null;
    let minDist = range * range; // respect range stat

    for (const e of game.enemies) {
      if (!e.active) continue;
      const d = this.pos.distSq(e.pos);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    // Cooldown modifiers: Level 2 increases fire rate
    const fireRateMod = level >= 2 ? 0.75 : 1.0;
    this.cooldownMax = 0.5 * fireRateMod;

    if (nearest) {
      const targetAngle = nearest.pos.sub(this.pos).heading();
      // Smooth turret rotation
      const angleDiff = targetAngle - this.turretAngle;
      const smoothDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.turretAngle += smoothDiff * Math.min(1.0, dt * 10);

      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.fire(game, level, damageMod);
        this.cooldown = this.cooldownMax;
      }
    } else {
      // Align turret angle to player's aiming
      const targetAngle = player.turretAngle;
      const angleDiff = targetAngle - this.turretAngle;
      const smoothDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.turretAngle += smoothDiff * Math.min(1.0, dt * 5);
    }
  }

  private fire(game: Game, level: number, damageMod: number) {
    soundManager.playShoot();

    // Minion fires small tracer bullet
    const angle = this.turretAngle;
    const speed = 650;
    // Level 4 increases damage
    const dmg = (level >= 4 ? 12 : 8) * damageMod;
    const vel = Vector2D.fromAngle(angle).mult(speed);

    // Tip offset
    const tipOffset = Vector2D.fromAngle(angle).mult(15);
    const bulletPos = this.pos.add(tipOffset);

    // Draw tracer
    game.projectiles.push(
      new Projectile(bulletPos.x, bulletPos.y, vel.x, vel.y, dmg, false, {
        color: '#ffbb44', // yellow tracer
        size: 3.5,
        glow: true,
        trailColor: 'rgba(255, 187, 68, 0.25)',
      })
    );

    // Spark particle
    game.spawnParticle(
      new Particle(bulletPos.x, bulletPos.y, vel.x * 0.1, vel.y * 0.1, {
        color: '#ffcc55',
        size: 4,
        decay: 0.2,
        type: 'spark',
      })
    );
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Draw tiny treads
    ctx.save();
    // Rotate body slightly towards movement heading, or just let it orient to turret
    ctx.rotate(this.turretAngle);
    
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(-10, -9, 20, 4);
    ctx.fillRect(-10, 5, 20, 4);

    // Draw mini chassis (military grey-green)
    ctx.fillStyle = '#556855';
    ctx.strokeStyle = '#384838';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-9, -6, 18, 12);
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Draw mini turret rotating independently
    ctx.save();
    ctx.rotate(this.turretAngle);

    // Small metal gun barrel
    ctx.strokeStyle = '#2d3b2d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

    // Muzzle brake
    ctx.fillStyle = '#111';
    ctx.fillRect(13, -2, 2, 4);

    // Cupola
    ctx.fillStyle = '#657e65';
    ctx.strokeStyle = '#283828';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }
}
