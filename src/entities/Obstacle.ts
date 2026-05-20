import { Entity } from './Entity';
import { Game } from '../engine/Game';
import { Particle } from './Particle';
import { soundManager } from '../engine/SoundManager';

export type ObstacleType = 'tree' | 'mud_pit';

export class Obstacle extends Entity {
  public type: ObstacleType;
  public hp: number;
  public maxHp: number;
  private hitFlashTimer: number = 0;

  constructor(x: number, y: number, type: ObstacleType) {
    let radius = 25;
    let hp = 60;

    if (type === 'mud_pit') {
      radius = 50;
      hp = 999999; // Practically indestructible
    }

    super(x, y, radius * 2, radius * 2, radius);
    this.type = type;
    this.hp = hp;
    this.maxHp = hp;
  }

  public update(dt: number, game: Game): void {
    // Scroll down with background
    this.pos.y += game.bgSpeed * dt;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    // Deactivate if scrolls off screen bottom
    if (this.pos.y > game.canvas.height + 80) {
      this.active = false;
    }
  }

  public takeDamage(damage: number, game: Game): void {
    if (this.type === 'mud_pit') return; // Mud pits don't take damage

    this.hp -= damage;
    this.hitFlashTimer = 0.08;

    // Spawn green wood chips / leaves particles
    const floatX = this.pos.x + (Math.random() - 0.5) * 15;
    const floatY = this.pos.y - 5;
    game.spawnParticle(
      new Particle(floatX, floatY, (Math.random() - 0.5) * 2, -1, {
        color: Math.random() > 0.4 ? '#4a6b35' : '#5c4033',
        size: Math.random() * 4 + 3,
        decay: 0.05,
        type: 'debris',
      })
    );

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.die(game);
    }
  }

  private die(game: Game): void {
    soundManager.playExplosion(); // Play standard explosion/crack sound
    game.triggerScreenshake(0.15, 4);

    // Spawn thick leaves/bark explosion
    for (let i = 0; i < 12; i++) {
      const vx = (Math.random() - 0.5) * 4;
      const vy = (Math.random() - 0.5) * 4;
      const size = Math.random() * 8 + 6;
      game.spawnParticle(
        new Particle(this.pos.x, this.pos.y, vx, vy, {
          color: Math.random() > 0.3 ? '#2c4c1a' : '#8b5a2b', // green leaves / brown bark
          size: size,
          decay: 0.03 + Math.random() * 0.02,
          type: Math.random() > 0.5 ? 'debris' : 'smoke',
        })
      );
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.type === 'mud_pit') {
      // Draw muddy pool
      ctx.fillStyle = 'rgba(66, 51, 33, 0.7)'; // Muddy brown with slight alpha
      ctx.strokeStyle = '#2d2215';
      ctx.lineWidth = 3;

      ctx.beginPath();
      // Draw irregular blob using ellipses or arcs
      ctx.ellipse(this.pos.x, this.pos.y, this.radius, this.radius * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner ripples
      ctx.beginPath();
      ctx.ellipse(this.pos.x - 5, this.pos.y - 2, this.radius * 0.6, this.radius * 0.45, 0.1, 0, Math.PI * 2);
      ctx.strokeStyle = '#423321';
      ctx.stroke();
    } else {
      // Draw shadow shifted down-right
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(this.pos.x + 5, this.pos.y + 7, this.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Flash white when hit
      if (this.hitFlashTimer > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Draw wood trunk
      ctx.fillStyle = '#5c4033'; // dark brown
      ctx.fillRect(this.pos.x - 6, this.pos.y, 12, this.radius * 0.8);

      // Layered canopy foliage
      ctx.fillStyle = '#1b3312'; // bottom dark green
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y - 5, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2d521d'; // middle green
      ctx.beginPath();
      ctx.arc(this.pos.x - 3, this.pos.y - 9, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3c6b27'; // top highlight green
      ctx.beginPath();
      ctx.arc(this.pos.x - 5, this.pos.y - 12, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Destructible Health Bar (if damaged)
      if (this.hp < this.maxHp) {
        const barW = this.radius * 1.5;
        const barH = 4;
        const barX = this.pos.x - barW / 2;
        const barY = this.pos.y - this.radius - 10;

        ctx.fillStyle = '#ff2222';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#22ff22';
        ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
      }
    }

    ctx.restore();
  }
}
