import { Entity } from './Entity';
import { Game } from '../engine/Game';

export class Particle extends Entity {
  public color: string;
  public alpha: number = 1.0;
  public decay: number;
  public type: 'smoke' | 'spark' | 'debris' | 'shockwave' | 'text';
  public glow: boolean = false;
  public text?: string;
  public maxLife: number;
  public life: number;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    options: {
      color: string;
      size: number;
      decay: number;
      type?: 'smoke' | 'spark' | 'debris' | 'shockwave' | 'text';
      glow?: boolean;
      text?: string;
    }
  ) {
    super(x, y, options.size, options.size, options.size / 2);
    this.vel.set(vx, vy);
    this.color = options.color;
    this.decay = options.decay;
    this.type = options.type || 'spark';
    this.glow = options.glow || false;
    this.text = options.text;
    this.maxLife = 1.0;
    this.life = 1.0;
  }

  public update(dt: number, _game: Game): void {
    // Apply velocity
    this.pos.x += this.vel.x * dt * 60;
    this.pos.y += this.vel.y * dt * 60;

    // Apply friction to sparks/smoke
    if (this.type === 'smoke' || this.type === 'spark') {
      this.vel.x *= Math.pow(0.95, dt * 60);
      this.vel.y *= Math.pow(0.95, dt * 60);
    }

    // Decrease life
    this.life -= this.decay * dt * 60;
    this.alpha = Math.max(0, this.life);

    if (this.life <= 0) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    if (this.glow) {
      ctx.shadowBlur = this.radius * 2;
      ctx.shadowColor = this.color;
    }

    if (this.type === 'text' && this.text) {
      ctx.font = `bold ${Math.max(10, this.width)}px 'Outfit', 'Inter', sans-serif`;
      ctx.fillStyle = this.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.text, this.pos.x, this.pos.y);
    } else if (this.type === 'shockwave') {
      // Expanding circle ring
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3 * this.alpha;
      ctx.beginPath();
      // Radius grows as life decreases
      const currentRadius = this.radius * (2 - this.life);
      ctx.arc(this.pos.x, this.pos.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'smoke') {
      // Soft fading circle
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius * (1.5 - this.life * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'debris') {
      // Rotating rectangle
      ctx.fillStyle = this.color;
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.life * Math.PI * 4); // spin
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // Default: small sparks (fading rects)
      ctx.fillStyle = this.color;
      ctx.fillRect(this.pos.x - this.width / 2, this.pos.y - this.height / 2, this.width, this.height);
    }

    ctx.restore();
  }
}
