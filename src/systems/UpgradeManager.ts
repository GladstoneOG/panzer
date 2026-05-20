import { Game } from '../engine/Game';
import { Player, type Weapon } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Entity } from '../entities/Entity';
import { Enemy } from '../entities/Enemy';
import { Vector2D } from '../engine/Vector2D';
import { Particle } from '../entities/Particle';
import { soundManager } from '../engine/SoundManager';

export interface UpgradeChoice {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'weapon' | 'stat';
  apply: (game: Game) => void;
}

export class UpgradeManager {
  private game: Game;
  public choices: UpgradeChoice[] = [];
  
  // Track levels of all possible items
  public itemLevels: Map<string, number> = new Map();
  
  // Track if a weapon has been evolved
  public evolvedWeapons: Set<string> = new Set();

  constructor(game: Game) {
    this.game = game;
    this.reset();
  }

  public reset() {
    this.itemLevels.clear();
    this.evolvedWeapons.clear();
    
    // Weapons levels (0 means not owned yet)
    this.itemLevels.set('mg', 0);
    this.itemLevels.set('flame', 0);
    this.itemLevels.set('rocket', 0);
    this.itemLevels.set('minion', 0);
    
    // Passives levels (0 means not owned yet)
    this.itemLevels.set('firerate', 0);
    this.itemLevels.set('damage', 0);
    this.itemLevels.set('range', 0);
    this.itemLevels.set('maxhp', 0);
    this.itemLevels.set('speed', 0);
    this.itemLevels.set('magnet', 0);
    this.itemLevels.set('regen', 0);
  }

  // Returns currently occupied active weapons & passive slots
  public getOccupiedSlots() {
    const activeWeapons = ['mg', 'flame', 'rocket', 'minion'];
    const passivePerks = ['firerate', 'damage', 'range', 'maxhp', 'speed', 'magnet', 'regen'];

    let activeCount = 0;
    activeWeapons.forEach(w => {
      if ((this.itemLevels.get(w) || 0) > 0) activeCount++;
    });

    let passiveCount = 0;
    passivePerks.forEach(p => {
      if ((this.itemLevels.get(p) || 0) > 0) passiveCount++;
    });

    return {
      active: activeCount,
      passive: passiveCount
    };
  }

  public generateChoices() {
    this.choices = [];
    const player = this.game.player;
    if (!player) return;

    const slots = this.getOccupiedSlots();
    const pool: UpgradeChoice[] = [];

    // --- 1. ACTIVE WEAPONS POOL ---
    const activeWeapons = [
      {
        id: 'mg',
        name: 'Heavy MG',
        icon: '🔫',
        descriptions: [
          'Equips a rapid fire frontal machine gun.',
          'Adds Dual Barrels firing side-by-side.',
          'Fire rate increased by 25%.',
          'Increases bullet damage by 35%.',
          'Reaches maximum conventional capacity.'
        ]
      },
      {
        id: 'flame',
        name: 'Flame Thrower',
        icon: '🔥',
        descriptions: [
          'Spews short-range fire to torch groups of enemies.',
          'Increases flame distance and damage.',
          'Widens the flame spread cone.',
          'Fires flame cones forward AND backward.',
          'Reaches maximum conventional capacity.'
        ]
      },
      {
        id: 'rocket',
        name: 'Heavy Rocket Launcher',
        icon: '🚀',
        descriptions: [
          'Fires heavy explosive rockets dealing AoE splash damage.',
          'Reduces rocket reload time by 25%.',
          'Fires 2 rockets at split angles.',
          'Increases explosion blast radius.',
          'Reaches maximum conventional capacity.'
        ]
      },
      {
        id: 'minion',
        name: 'Minion Support Vehicle',
        icon: '🤖',
        descriptions: [
          'Deploys an automated mini-tank trailing you that fires at targets.',
          'Increases minion fire rate by 25%.',
          'Deploys a second support minion tank.',
          'Increases minion bullet damage by 50%.',
          'Reaches maximum conventional capacity.'
        ]
      }
    ];

    activeWeapons.forEach(w => {
      const lvl = this.itemLevels.get(w.id) || 0;
      // Normal weapons can be upgraded up to Level 5.
      // Evolving to Sci-Fi state is handled exclusively via Treasure Chests!
      if (lvl < 5) {
        const isOwned = lvl > 0;
        
        // If slots are full and we don't own this weapon yet, skip adding it
        if (!isOwned && slots.active >= 3) {
          return;
        }

        pool.push({
          id: w.id,
          name: isOwned ? `${w.name} (Lvl ${lvl + 1})` : `NEW: ${w.name}`,
          description: w.descriptions[lvl],
          icon: w.icon,
          type: 'weapon',
          apply: (g) => this.upgradeWeapon(g, w.id)
        });
      }
    });

    // --- 2. PASSIVE PERKS POOL ---
    const passives = [
      {
        id: 'firerate',
        name: 'Weapon Supercharger',
        icon: '🔌',
        desc: 'Increases weapons fire rate by 12% per level.',
        applyStat: (g: Game) => { g.player!.fireRateModifier -= 0.12; }
      },
      {
        id: 'damage',
        name: 'High-Velocity Powder',
        icon: '💥',
        desc: 'Increases damage of all weapons by 15% per level.',
        applyStat: (g: Game) => { g.player!.damageModifier += 0.15; }
      },
      {
        id: 'range',
        name: 'Targeting Array',
        icon: '🎯',
        desc: 'Increases lock-on targeting and weapon range by 25% per level.',
        applyStat: (g: Game) => { g.player!.range += 70; }
      },
      {
        id: 'maxhp',
        name: 'Heavy Armored Plates',
        icon: '🧱',
        desc: 'Increases Max Health by 25 and heals (Level {lvl}/5).',
        applyStat: (g: Game) => {
          g.player!.maxHp += 25;
          g.player!.hp = Math.min(g.player!.maxHp, g.player!.hp + 25);
        }
      },
      {
        id: 'speed',
        name: 'Engine Overhaul',
        icon: '⚙️',
        desc: 'Increases tank movement speed by 15% per level.',
        applyStat: (g: Game) => { g.player!.speed += 33; }
      },
      {
        id: 'magnet',
        name: 'Attraction Magnet',
        icon: '🧲',
        desc: 'Increases magnet pick-up radius by 35% per level.',
        applyStat: (g: Game) => { g.player!.magnetRadius += 45; }
      },
      {
        id: 'regen',
        name: 'Emergency Repair Kit',
        icon: '🔧',
        desc: 'Regenerates 1.5 Health per second per level.',
        applyStat: (g: Game) => { g.player!.hpRegen += 1.5; }
      }
    ];

    passives.forEach(p => {
      const lvl = this.itemLevels.get(p.id) || 0;
      if (lvl < 5) {
        const isOwned = lvl > 0;

        // If slots are full and we don't own this passive perk yet, skip adding it
        if (!isOwned && slots.passive >= 3) {
          return;
        }

        pool.push({
          id: p.id,
          name: isOwned ? `${p.name} (Lvl ${lvl + 1})` : `NEW: ${p.name}`,
          description: p.desc.replace('{lvl}', (lvl + 1).toString()),
          icon: p.icon,
          type: 'stat',
          apply: (g) => {
            const current = this.itemLevels.get(p.id) || 0;
            this.itemLevels.set(p.id, current + 1);
            p.applyStat(g);
          }
        });
      }
    });

    // Emergency Heal (Always available fallback choice if player is hurt)
    if (player.hp < player.maxHp) {
      pool.push({
        id: 'heal',
        name: 'Field Rations (Emergency Heals)',
        description: 'Instantly restores 50% of your max Health.',
        icon: '❤️',
        type: 'stat',
        apply: (g) => {
          g.player!.hp = Math.min(g.player!.maxHp, g.player!.hp + g.player!.maxHp * 0.5);
        }
      });
    }

    // Randomly select 3 unique choices from the pool
    const shuffled = pool.sort(() => 0.5 - Math.random());
    this.choices = shuffled.slice(0, 3);

    // Safety fallback: if pool is empty (all slots maxed out), give score boost
    if (this.choices.length === 0) {
      this.choices.push({
        id: 'score',
        name: 'War Bonds (Score Boost)',
        description: 'Adds 5,000 points to your final score.',
        icon: '💵',
        type: 'stat',
        apply: (g) => {
          g.score += 5000;
        }
      });
    }
  }

  public applyUpgrade(index: number) {
    if (index >= 0 && index < this.choices.length) {
      this.choices[index].apply(this.game);
      this.game.syncHud();
    }
  }

  public renderOptions(container: HTMLElement) {
    container.innerHTML = '';
    
    this.choices.forEach((choice, idx) => {
      const isNew = choice.name.startsWith('NEW');
      
      const card = document.createElement('div');
      card.className = `upgrade-card ${isNew ? 'new-card' : ''}`;
      card.innerHTML = `
        <div class="upgrade-icon">${choice.icon}</div>
        <div class="upgrade-title">${choice.name}</div>
        <div class="upgrade-desc">${choice.description}</div>
      `;
      
      card.addEventListener('click', () => {
        this.game.selectUpgrade(idx);
      });
      
      container.appendChild(card);
    });
  }

  // Direct upgrade method for active weapons
  public upgradeWeapon(game: Game, id: string) {
    const player = game.player;
    if (!player) return;

    const currentLvl = this.itemLevels.get(id) || 0;
    const newLvl = currentLvl + 1;
    this.itemLevels.set(id, newLvl);

    // Look for existing weapon instance
    const existing = player.weapons.find(w => 
      (id === 'mg' && (w.name === 'Heavy MG' || w.name === 'Continuous Laser')) ||
      (id === 'flame' && (w.name === 'Flame Thrower' || w.name === 'Plasma Orb Cannon')) ||
      (id === 'rocket' && (w.name === 'Heavy Rocket' || w.name === 'ICBM Homing Missile')) ||
      (id === 'minion' && (w.name === 'Minion Support' || w.name === 'Minion Swarm'))
    );

    if (existing) {
      existing.level = newLvl;
      // Update conventional stats per level if not evolved yet
      if (newLvl < 5) {
        if (id === 'mg') {
          existing.cooldownMax = 0.4 - newLvl * 0.05; // faster MG rate
        } else if (id === 'rocket') {
          existing.cooldownMax = 1.6 - newLvl * 0.15; // faster reload
        }
      }
    } else {
      // Create new weapon pattern
      let newW: Weapon;

      if (id === 'mg') {
        newW = {
          name: 'Heavy MG',
          level: 1,
          cooldown: 0,
          cooldownMax: 0.4,
          fire: (g, target) => this.fireMachineGun(g, player, target)
        };
      } else if (id === 'flame') {
        newW = {
          name: 'Flame Thrower',
          level: 1,
          cooldown: 0,
          cooldownMax: 0.1,
          fire: this.fireFlameCone
        };
      } else if (id === 'rocket') {
        newW = {
          name: 'Heavy Rocket',
          level: 1,
          cooldown: 0.5,
          cooldownMax: 1.6,
          fire: this.fireRocket
        };
      } else { // minion
        newW = {
          name: 'Minion Support',
          level: 1,
          cooldown: 0,
          cooldownMax: 9999, // Minion tank fires in its own update method, weapon tick handles initial spawn setup
          fire: () => {}
        };
      }

      player.addWeapon(newW);
    }
  }

  // --- CHEST REWARD SPIN SYSTEM ---
  // Returns the upgrades reward card if eligible
  public getRandomChestUpgrade(): { name: string, icon: string, desc: string, apply: () => void, isEvolved: boolean } {
    const player = this.game.player;
    if (!player) {
      return { name: 'Score Bonus', icon: '💵', desc: 'Adds 5,000 score points.', apply: () => { this.game.score += 5000; }, isEvolved: false };
    }

    // 1. Check for possible evolutions!
    // Requires level 5 active weapon + matching level 5 passive.
    const evolutions: Array<{ id: string; name: string; passiveId: string; evolvedName: string; icon: string; desc: string; apply: () => void }> = [
      {
        id: 'mg',
        name: 'Heavy MG',
        passiveId: 'firerate',
        evolvedName: 'Continuous Laser',
        icon: '⚡',
        desc: 'Evolves Machine Gun into a sweeping continuous laser beam!',
        apply: () => {
          this.evolvedWeapons.add('mg');
          const w = player.weapons.find(wp => wp.name === 'Heavy MG');
          if (w) {
            w.name = 'Continuous Laser';
            w.cooldownMax = 0.05; // fast damage ticks
            w.fire = this.fireContinuousLaser;
          }
        }
      },
      {
        id: 'flame',
        name: 'Flame Thrower',
        passiveId: 'damage',
        evolvedName: 'Plasma Orb Cannon',
        icon: '🔵',
        desc: 'Evolves Flame Thrower to launch heavy exploding plasma spheres!',
        apply: () => {
          this.evolvedWeapons.add('flame');
          const w = player.weapons.find(wp => wp.name === 'Flame Thrower');
          if (w) {
            w.name = 'Plasma Orb Cannon';
            w.cooldownMax = 1.2;
            w.fire = this.firePlasmaOrbCannon;
          }
        }
      },
      {
        id: 'rocket',
        name: 'Heavy Rocket',
        passiveId: 'range',
        evolvedName: 'ICBM Homing Missile',
        icon: '☄️',
        desc: 'Evolves Rockets into self-homing high-damage tactical missiles!',
        apply: () => {
          this.evolvedWeapons.add('rocket');
          const w = player.weapons.find(wp => wp.name === 'Heavy Rocket');
          if (w) {
            w.name = 'ICBM Homing Missile';
            w.cooldownMax = 2.0;
            w.fire = this.fireICBMHomingMissile;
          }
        }
      },
      {
        id: 'minion',
        name: 'Minion Support',
        passiveId: 'maxhp',
        evolvedName: 'Minion Swarm',
        icon: '🛸',
        desc: 'Evolves Minions into a rapid-fire army of 4 laser drones!',
        apply: () => {
          this.evolvedWeapons.add('minion');
          const w = player.weapons.find(wp => wp.name === 'Minion Support');
          if (w) {
            w.name = 'Minion Swarm';
            w.cooldownMax = 9999;
            w.fire = () => {};
          }
        }
      }
    ];

    // Check which evolutions are eligible
    const eligibleEvals = evolutions.filter(evo => {
      const activeLvl = this.itemLevels.get(evo.id) || 0;
      const passiveLvl = this.itemLevels.get(evo.passiveId) || 0;
      const isAlreadyEvolved = this.evolvedWeapons.has(evo.id);
      return activeLvl === 5 && passiveLvl === 5 && !isAlreadyEvolved;
    });

    if (eligibleEvals.length > 0) {
      // Pick random evolution!
      const chosen = eligibleEvals[Math.floor(Math.random() * eligibleEvals.length)];
      return {
        name: `EVOLUTION: ${chosen.evolvedName}`,
        icon: chosen.icon,
        desc: chosen.desc,
        apply: chosen.apply,
        isEvolved: true
      };
    }

    // 2. If no evolutions, look for current owned weapons/passives that are not max level
    const upgradesPool: Array<{ id: string; name: string; type: 'weapon' | 'passive'; apply: () => void }> = [];

    // Check owned weapons
    const activeIds = ['mg', 'flame', 'rocket', 'minion'];
    const activeTitles = ['Heavy MG', 'Flame Thrower', 'Heavy Rocket', 'Minion Support'];
    activeIds.forEach((id, index) => {
      const lvl = this.itemLevels.get(id) || 0;
      if (lvl > 0 && lvl < 5) {
        upgradesPool.push({
          id: id,
          name: `${activeTitles[index]} (Lvl ${lvl + 1})`,
          type: 'weapon',
          apply: () => this.upgradeWeapon(this.game, id)
        });
      }
    });

    // Check owned passives
    const passiveDefs = [
      { id: 'firerate', name: 'Weapon Supercharger', applyStat: (g: Game) => { g.player!.fireRateModifier -= 0.12; } },
      { id: 'damage', name: 'High-Velocity Powder', applyStat: (g: Game) => { g.player!.damageModifier += 0.15; } },
      { id: 'range', name: 'Targeting Array', applyStat: (g: Game) => { g.player!.range += 70; } },
      { id: 'maxhp', name: 'Heavy Armored Plates', applyStat: (g: Game) => { g.player!.maxHp += 25; g.player!.hp = Math.min(g.player!.maxHp, g.player!.hp + 25); } },
      { id: 'speed', name: 'Engine Overhaul', applyStat: (g: Game) => { g.player!.speed += 33; } },
      { id: 'magnet', name: 'Attraction Magnet', applyStat: (g: Game) => { g.player!.magnetRadius += 45; } },
      { id: 'regen', name: 'Emergency Repair Kit', applyStat: (g: Game) => { g.player!.hpRegen += 1.5; } }
    ];

    passiveDefs.forEach(p => {
      const lvl = this.itemLevels.get(p.id) || 0;
      if (lvl > 0 && lvl < 5) {
        upgradesPool.push({
          id: p.id,
          name: `${p.name} (Lvl ${lvl + 1})`,
          type: 'passive',
          apply: () => {
            this.itemLevels.set(p.id, lvl + 1);
            p.applyStat(this.game);
          }
        });
      }
    });

    if (upgradesPool.length > 0) {
      const chosen = upgradesPool[Math.floor(Math.random() * upgradesPool.length)];
      return {
        name: chosen.name,
        icon: chosen.type === 'weapon' ? '🔫' : '⚙️',
        desc: `Chest drop reinforces current ${chosen.type} capacity.`,
        apply: chosen.apply,
        isEvolved: false
      };
    }

    // 3. Fallback: War Bonds Score Boost
    return {
      name: 'War Bonds (Score Boost)',
      icon: '💵',
      desc: 'Everything integrated is at maximum capacity. Grants 10,000 points.',
      apply: () => { this.game.score += 10000; },
      isEvolved: false
    };
  }

  // --- WEAPONS FIRE LOGICS ---

  // 1a. Base Machine Gun (Fires tracer bullets)
  private fireMachineGun(game: Game, player: Player, target: Entity | null) {
    let angle = player.turretAngle;
    if (target) {
      angle = target.pos.sub(player.pos).heading();
    }
    
    soundManager.playShoot();

    const speed = 700;
    const damage = 15 * player.damageModifier;
    const lvl = this.itemLevels.get('mg') || 1;

    // Split barrels configuration
    const shootDirections = [angle];
    if (lvl >= 2) {
      shootDirections.push(angle); // double barrels
    }

    shootDirections.forEach((dir, idx) => {
      const vel = Vector2D.fromAngle(dir).mult(speed);
      
      // Offset barrels side-by-side
      let tipOffset = Vector2D.fromAngle(dir).mult(25);
      if (lvl >= 2) {
        const sideOffset = Vector2D.fromAngle(dir + Math.PI / 2).mult(idx === 0 ? -6 : 6);
        tipOffset = tipOffset.add(sideOffset);
      }
      const bulletPos = player.pos.add(tipOffset);

      game.projectiles.push(
        new Projectile(bulletPos.x, bulletPos.y, vel.x, vel.y, damage, false, {
          color: '#ffdd66',
          size: 4,
          glow: true,
          trailColor: 'rgba(255, 221, 102, 0.3)',
        })
      );

      // Barrel flash
      game.spawnParticle(
        new Particle(bulletPos.x, bulletPos.y, vel.x * 0.1, vel.y * 0.1, {
          color: '#ffaa00',
          size: 6,
          decay: 0.15,
          type: 'spark',
        })
      );
    });
  }

  // 1b. FLAME THROWER (Normal: Cone spray of short-range fire)
  private fireFlameCone = (game: Game, _target: Entity | null) => {
    const player = game.player;
    if (!player) return;

    const lvl = this.itemLevels.get('flame') || 1;
    soundManager.playFlame();

    // Determine flame cone directions (Level 4 fires backward too!)
    const angles = [player.turretAngle];
    if (lvl >= 4) {
      angles.push(player.turretAngle + Math.PI); // back spray
    }

    const spread = lvl >= 3 ? 0.35 : 0.22; // spread angle in radians
    const count = 2; // flame particles per tick

    for (const baseAngle of angles) {
      for (let i = 0; i < count; i++) {
        const offset = (Math.random() - 0.5) * spread;
        const finalAngle = baseAngle + offset;
        
        // Stats scaling with player's targeting range
        const maxFlameRange = player.range * 0.6; // short range modifier
        const speed = (maxFlameRange * 1.5) + Math.random() * 80;
        const size = lvl >= 2 ? 14 : 9;
        const damage = (lvl >= 2 ? 3.5 : 2.5) * player.damageModifier;

        const vel = Vector2D.fromAngle(finalAngle).mult(speed);

        // Spawn a flame projectile (with lifetime reflecting travel range)
        const life = maxFlameRange / speed;
        game.projectiles.push(
          new Projectile(player.pos.x, player.pos.y, vel.x, vel.y, damage, false, {
            color: '#ff6600',
            size: size,
            isFlame: true,
            penetration: 99, // passes through everything
            bombTimer: life // use bombTimer for flame lifespan
          })
        );
      }
    }
  };

  // 2. HEAVY ROCKET (Normal: fires slow explosive shell in straight lines)
  private fireRocket = (game: Game, target: Entity | null) => {
    const player = game.player;
    if (!player) return;

    const lvl = this.itemLevels.get('rocket') || 1;
    soundManager.playRocketLaunch();

    // Directions
    const angles: number[] = [];
    let angle = player.turretAngle;
    if (target) {
      angle = target.pos.sub(player.pos).heading();
    }

    if (lvl >= 3) {
      // Dual rockets fired at slight angle splits
      angles.push(angle - 0.15);
      angles.push(angle + 0.15);
    } else {
      angles.push(angle);
    }

    for (const fireAngle of angles) {
      const vel = Vector2D.fromAngle(fireAngle).mult(420);
      const damage = (lvl >= 4 ? 65 : 45) * player.damageModifier;
      const blastRadius = lvl >= 4 ? 120 : 80;

      // slightly offset rocket muzzle
      const offset = Vector2D.fromAngle(fireAngle).mult(25);
      
      game.projectiles.push(
        new Projectile(player.pos.x + offset.x, player.pos.y + offset.y, vel.x, vel.y, damage, false, {
          color: '#ffaa00',
          size: 7,
          isRocket: true,
          explosionRadius: blastRadius,
          trailColor: 'rgba(255, 100, 0, 0.25)',
        })
      );
    }
  };

  // --- EVOLVED WEAPON FIRING TRIGGERS ---

  // A. Continuous Laser (MG + Attack Speed evolve)
  private fireContinuousLaser = (game: Game, _target: Entity | null) => {
    const player = game.player;
    if (!player) return;

    // Laser zaps zzz sound
    if (Math.random() < 0.15) {
      soundManager.playLaser();
    }

    const dmg = 8 * player.damageModifier; // ticks very fast
    const laserLength = player.range * 1.6; // extended beam length
    const laserWidth = 14;

    // Base turret angle sweeps back and forth slightly for wide coverage
    const sweepAngle = player.turretAngle + Math.sin(Date.now() / 80) * 0.22;
    const turretTip = player.pos.add(Vector2D.fromAngle(sweepAngle).mult(25));

    // Create a temporary laser beam line representation to damage enemies
    const lineEnd = turretTip.add(Vector2D.fromAngle(sweepAngle).mult(laserLength));

    // Damage checking along the beam line segment using point sampling
    const samplesCount = Math.floor(laserLength / 18);
    for (const e of game.enemies) {
      if (!e.active) continue;
      
      // Sample points along the laser line vector and test circles
      let hit = false;
      for (let s = 0; s <= samplesCount; s++) {
        const pct = s / samplesCount;
        const pt = turretTip.mult(1 - pct).add(lineEnd.mult(pct));
        if (pt.distSq(e.pos) < (e.radius + laserWidth / 2) * (e.radius + laserWidth / 2)) {
          hit = true;
          break;
        }
      }

      if (hit) {
        e.takeDamage(dmg, false);
      }
    }

    // Spawn decorative visual laser particles along the line
    if (Math.random() < 0.4) {
      const rPct = Math.random();
      const sparkPos = turretTip.mult(1 - rPct).add(lineEnd.mult(rPct));
      game.spawnParticle(
        new Particle(sparkPos.x, sparkPos.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, {
          color: '#ff2255',
          size: 4,
          decay: 0.1,
          glow: true,
        })
      );
    }

    // Spawn a temporary visual laser projectile to draw the glowing beam column
    const laserVisual = new Projectile(turretTip.x, turretTip.y, 0, 0, 0, false, {
      color: '#ff2255',
      size: laserWidth,
      isMine: true,
      bombTimer: 0.04, // disappears instantly next frame
      glow: true
    });

    laserVisual.draw = (ctx) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 34, 85, 0.2)';
      ctx.lineWidth = laserWidth + 8;
      ctx.beginPath();
      ctx.moveTo(turretTip.x, turretTip.y);
      ctx.lineTo(lineEnd.x, lineEnd.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff'; // white core
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff2255'; // neon red/pink glow
      ctx.lineWidth = laserWidth - 4;
      ctx.beginPath();
      ctx.moveTo(turretTip.x, turretTip.y);
      ctx.lineTo(lineEnd.x, lineEnd.y);
      ctx.stroke();
      ctx.restore();
    };

    game.projectiles.push(laserVisual);
  };

  // B. Plasma Orb Cannon (Flame + Damage evolve)
  private firePlasmaOrbCannon = (game: Game, _target: Entity | null) => {
    const player = game.player;
    if (!player) return;

    soundManager.playSciFiExplosion();

    const angle = player.turretAngle;
    const speed = 320;
    const damage = 120 * player.damageModifier;
    const radius = 180; // massive blast radius

    const turretTip = player.pos.add(Vector2D.fromAngle(angle).mult(25));
    const vel = Vector2D.fromAngle(angle).mult(speed);

    const orb = new Projectile(turretTip.x, turretTip.y, vel.x, vel.y, damage, false, {
      color: '#00ffff', // cyan energy ball
      size: 16,
      isRocket: true,
      explosionRadius: radius,
      glow: true,
      trailColor: 'rgba(0, 255, 255, 0.25)'
    });

    // Override the explosion animation of the plasma ball to spawn neon blue shocks
    const originalHit = orb.hit;
    orb.hit = () => {
      originalHit.call(orb);
      // Spawn extra particles
      for (let i = 0; i < 20; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = Math.random() * 8 + 3;
        game.spawnParticle(
          new Particle(orb.pos.x, orb.pos.y, Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed, {
            color: Math.random() > 0.5 ? '#00ffff' : '#ffffff',
            size: Math.random() * 8 + 4,
            decay: 0.04,
            type: 'spark',
            glow: true
          })
        );
      }
    };

    game.projectiles.push(orb);
  };

  // C. ICBM Homing Missile (Rocket + Range evolve)
  private fireICBMHomingMissile = (game: Game, _target: Entity | null) => {
    const player = game.player;
    if (!player) return;

    soundManager.playRocketLaunch();
    


    const angle = player.turretAngle;
    const speed = 480;
    const damage = 150 * player.damageModifier;
    const blastRadius = 220;

    const turretTip = player.pos.add(Vector2D.fromAngle(angle).mult(25));
    const vel = Vector2D.fromAngle(angle).mult(speed);

    const icbm = new Projectile(turretTip.x, turretTip.y, vel.x, vel.y, damage, false, {
      color: '#ffcc00', // high-visibility radioactive yellow
      size: 14,
      isRocket: true,
      explosionRadius: blastRadius,
      glow: true,
      trailColor: 'rgba(255, 100, 0, 0.4)'
    });

    // Custom homing update override!
    const baseUpdate = icbm.update;
    icbm.update = (dt, g) => {
      // Find nearest enemy to lock onto dynamically
      let currentTarget: Enemy | null = null;
      let closestDist = Infinity;
      for (const e of g.enemies) {
        if (!e.active) continue;
        const d = icbm.pos.distSq(e.pos);
        if (d < closestDist) {
          closestDist = d;
          currentTarget = e;
        }
      }

      if (currentTarget) {
        // Steer velocity towards target
        const desiredVel = currentTarget.pos.sub(icbm.pos).normalize().mult(speed);
        const steer = desiredVel.sub(icbm.vel).normalize().mult(200 * dt);
        
        icbm.vel.x += steer.x;
        icbm.vel.y += steer.y;
        
        // Cap speed
        icbm.vel = icbm.vel.normalize().mult(speed);
      }

      // Run default movement mechanics
      baseUpdate.call(icbm, dt, g);

      // Heavy fire sparks trail
      if (Math.random() < 0.6) {
        g.spawnParticle(
          new Particle(icbm.pos.x, icbm.pos.y, -icbm.vel.x * 0.15 + (Math.random()-0.5)*2, -icbm.vel.y * 0.15 + (Math.random()-0.5)*2, {
            color: '#ff5500',
            size: 5,
            decay: 0.08,
            type: 'spark'
          })
        );
      }
    };

    // Draw custom ICBM shape (large nuclear hazard container rocket)
    icbm.draw = (ctx) => {
      ctx.save();
      ctx.translate(icbm.pos.x, icbm.pos.y);
      ctx.rotate(icbm.vel.heading());

      // Glowing body
      ctx.fillStyle = '#ffaa00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffcc00';

      ctx.beginPath();
      ctx.moveTo(-16, -5);
      ctx.lineTo(8, -5);
      ctx.lineTo(16, 0); // pointed nose cone
      ctx.lineTo(8, 5);
      ctx.lineTo(-16, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Threat stripes
      ctx.fillStyle = '#000';
      ctx.fillRect(-2, -5, 4, 10);

      // Tail wings
      ctx.fillStyle = '#d43f3f';
      ctx.fillRect(-16, -9, 4, 4);
      ctx.fillRect(-16, 5, 4, 4);

      ctx.restore();
    };

    game.projectiles.push(icbm);
  };
}
