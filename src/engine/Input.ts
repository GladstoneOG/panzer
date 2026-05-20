import { Vector2D } from './Vector2D';

export class Input {
  private keys: Map<string, boolean> = new Map();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys.set(e.key.toLowerCase(), true);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.set(e.key.toLowerCase(), false);
  };

  public isDown(key: string): boolean {
    return this.keys.get(key.toLowerCase()) === true;
  }

  public getMovementVector(): Vector2D {
    let dx = 0;
    let dy = 0;

    if (this.isDown('w') || this.isDown('arrowup')) {
      dy -= 1;
    }
    if (this.isDown('s') || this.isDown('arrowdown')) {
      dy += 1;
    }
    if (this.isDown('a') || this.isDown('arrowleft')) {
      dx -= 1;
    }
    if (this.isDown('d') || this.isDown('arrowright')) {
      dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      return new Vector2D(dx, dy).normalize();
    }
    return new Vector2D(0, 0);
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
