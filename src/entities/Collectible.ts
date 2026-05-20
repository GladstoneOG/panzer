import { Entity } from './Entity';
import { Game } from '../engine/Game';
import { Vector2D } from '../engine/Vector2D';
import { Particle } from './Particle';
import { soundManager } from '../engine/SoundManager';

export type CollectibleType = 'xp' | 'repair' | 'chest';
export type GemTier = 'green' | 'blue' | 'gold';

export class Collectible extends Entity {
  public type: CollectibleType;
  public xpValue: number;
  public gemTier: GemTier;

  private pulseTimer: number = 0;
  private isBeingPulled: boolean = false;
  private pullSpeed: number = 0;

  constructor(x: number, y: number, type: CollectibleType, xpValue: number = 10, gemTier: GemTier = 'green') {
    super(x, y, 14, 14, 8);
    this.type = type;
    this.xpValue = xpValue;
    this.gemTier = gemTier;
    
    // Stagger entry animation
    this.pulseTimer = Math.random() * Math.PI * 2;

    // A chest is slightly larger to be easily spotted
    if (type === 'chest') {
      this.width = 24;
      this.height = 20;
      this.radius = 12;
    }
  }

  public pullTowards(targetPos: Vector2D, speed: number) {
    // Chest is heavy and cannot be magnetically pulled (standard bullet heaven gameplay)
    if (this.type === 'chest') return;

    this.isBeingPulled = true;
    this.pullSpeed = Math.max(this.pullSpeed, speed);
    
    // Smoothly accelerate pull velocity
    const dir = targetPos.sub(this.pos).normalize();
    this.vel = dir.mult(this.pullSpeed);
  }

  public update(dt: number, game: Game): void {
    this.pulseTimer += dt * 5;

    if (this.isBeingPulled) {
      // Apply pull speed
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      
      // Accelerate pull speed as it gets closer
      this.pullSpeed += 650 * dt;
    } else {
      // Natural slow drift down representing ground scroll
      this.pos.y += game.bgSpeed * 0.7 * dt;
    }

    // Deactivate if far off bottom of screen
    if (this.pos.y > game.canvas.height + 40) {
      this.active = false;
    }
  }

  public collect(game: Game) {
    this.active = false;

    if (this.type === 'xp') {
      let pitch = 1.0;
      if (this.gemTier === 'blue') pitch = 1.3;
      if (this.gemTier === 'gold') pitch = 1.6;

      soundManager.playCollectXP(pitch);
      game.addXp(this.xpValue);

      // Spawn collection sparkles
      const gemColor = this.getGemColor();
      for (let i = 0; i < 4; i++) {
        const vx = (Math.random() - 0.5) * 4;
        const vy = (Math.random() - 0.5) * 4;
        game.spawnParticle(
          new Particle(this.pos.x, this.pos.y, vx, vy, {
            color: gemColor,
            size: 4,
            decay: 0.08,
            type: 'spark',
            glow: true,
          })
        );
      }
    } else if (this.type === 'repair' && game.player) {
      soundManager.playUpgradeSelected(); // pleasant sound
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 25);
      game.syncHud();

      // Floating text "+25"
      game.spawnParticle(
        new Particle(game.player.pos.x, game.player.pos.y - 25, 0, -2, {
          color: '#00ff66',
          size: 15,
          decay: 0.03,
          type: 'text',
          text: '+25 HP',
        })
      );

      // Green healing cross sparks
      for (let i = 0; i < 8; i++) {
        const vx = (Math.random() - 0.5) * 3;
        const vy = -Math.random() * 3 - 1;
        game.spawnParticle(
          new Particle(game.player.pos.x + (Math.random() - 0.5) * 20, game.player.pos.y + (Math.random() - 0.5) * 20, vx, vy, {
            color: '#00ff66',
            size: 6,
            decay: 0.04,
            type: 'spark',
          })
        );
      }
    } else if (this.type === 'chest') {
      // Trigger chest opening sequences in Game
      game.openChest();
    }
  }

  private getGemColor(): string {
    switch (this.gemTier) {
      case 'green': return '#55ff55'; // neon green fuel canisters
      case 'blue': return '#33aaff';  // super fuel blue
      case 'gold': return '#ffcc00';  // hyper nuclear fuel gold
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Add a pulsing visual bounce
    const scale = 1.0 + Math.sin(this.pulseTimer) * 0.12;
    ctx.translate(this.pos.x, this.pos.y);
    ctx.scale(scale, scale);

    if (this.type === 'xp') {
      const gemColor = this.getGemColor();
      
      // Draw neon glow underneath
      ctx.fillStyle = gemColor;
      ctx.shadowBlur = 8;
      ctx.shadowColor = gemColor;
      
      // Draw XP Canister (styled as a futuristic cylinder capsule)
      ctx.fillStyle = '#111';
      ctx.strokeStyle = gemColor;
      ctx.lineWidth = 1.5;
      
      // Capsule body
      ctx.beginPath();
      ctx.roundRect(-4, -7, 8, 14, 3);
      ctx.fill();
      ctx.stroke();

      // Glowing fuel band in the middle
      ctx.fillStyle = gemColor;
      ctx.fillRect(-3.5, -2, 7, 4);

      // Top cap metal lines
      ctx.fillStyle = '#888';
      ctx.fillRect(-4, -7, 8, 2.5);
      ctx.fillRect(-4, 4.5, 8, 2.5);
    } else if (this.type === 'repair') {
      // Draw wooden military repair crate
      ctx.fillStyle = '#7a5a3a'; // brown crate
      ctx.strokeStyle = '#4e3722';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-8, -8, 16, 16);
      ctx.fill();
      ctx.stroke();

      // Draw red medical box in the center
      ctx.fillStyle = '#d43f3f';
      ctx.fillRect(-5, -5, 10, 10);

      // Draw white medical cross
      ctx.fillStyle = '#ffffff';
      // Vertical bar
      ctx.fillRect(-1.5, -4, 3, 8);
      // Horizontal bar
      ctx.fillRect(-4, -1.5, 8, 3);
    } else if (this.type === 'chest') {
      // Draw procedural golden glowing chest/crate
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#ffcc00';

      // Chest bottom box
      ctx.fillStyle = '#5c4033'; // wood brown
      ctx.strokeStyle = '#ffcc00'; // gold bindings
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(-12, -2, 24, 12);
      ctx.fill();
      ctx.stroke();

      // Chest lid rounded top
      ctx.fillStyle = '#7c5443';
      ctx.beginPath();
      ctx.arc(0, -2, 12, Math.PI, 0, false);
      ctx.fill();
      ctx.stroke();

      // Gold vertical banding bars
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(-10, -10, 2, 20);
      ctx.fillRect(8, -10, 2, 20);

      // Gold lock in the middle
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(-3, -3, 6, 6);

      // Keyhole
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
