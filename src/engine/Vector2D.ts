export class Vector2D {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): Vector2D {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(v: Vector2D): Vector2D {
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2D): Vector2D {
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  mult(n: number): Vector2D {
    return new Vector2D(this.x * n, this.y * n);
  }

  div(n: number): Vector2D {
    if (n === 0) return new Vector2D(0, 0);
    return new Vector2D(this.x / n, this.y / n);
  }

  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  mag(): number {
    return Math.sqrt(this.magSq());
  }

  normalize(): Vector2D {
    const m = this.mag();
    if (m !== 0) {
      return this.div(m);
    }
    return new Vector2D(0, 0);
  }

  limit(max: number): Vector2D {
    const mSq = this.magSq();
    if (mSq > max * max) {
      return this.normalize().mult(max);
    }
    return this.copy();
  }

  distSq(v: Vector2D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  dist(v: Vector2D): number {
    return Math.sqrt(this.distSq(v));
  }

  heading(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  static fromAngle(angle: number): Vector2D {
    return new Vector2D(Math.cos(angle), Math.sin(angle));
  }
}
