import { Vector2D } from '../engine/Vector2D';
import { Game } from '../engine/Game';

export abstract class Entity {
  public pos: Vector2D;
  public vel: Vector2D;
  public width: number;
  public height: number;
  public radius: number; // For circular collision bounds
  public active: boolean = true;

  constructor(x: number, y: number, width: number, height: number, radius?: number) {
    this.pos = new Vector2D(x, y);
    this.vel = new Vector2D(0, 0);
    this.width = width;
    this.height = height;
    this.radius = radius !== undefined ? radius : Math.max(width, height) / 2;
  }

  public abstract update(dt: number, game: Game): void;
  public abstract draw(ctx: CanvasRenderingContext2D): void;

  /** Circular collision detection */
  public isCollidingWith(other: Entity): boolean {
    const distSq = this.pos.distSq(other.pos);
    const minDist = this.radius + other.radius;
    return distSq < minDist * minDist;
  }

  /** Rectangular collision detection (if needed) */
  public getBounds() {
    return {
      left: this.pos.x - this.width / 2,
      right: this.pos.x + this.width / 2,
      top: this.pos.y - this.height / 2,
      bottom: this.pos.y + this.height / 2,
    };
  }

  public isRectCollidingWith(other: Entity): boolean {
    const r1 = this.getBounds();
    const r2 = other.getBounds();
    return !(
      r1.right < r2.left ||
      r1.left > r2.right ||
      r1.bottom < r2.top ||
      r1.top > r2.bottom
    );
  }
}
