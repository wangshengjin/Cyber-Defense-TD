import { Graphics } from 'pixi.js';
import { BaseTower, ShootResult } from './BaseTower';
import { GameEnemy } from '../entities/GameEnemy';
import { TowerType, CELL_SIZE } from '../../types';
import { TOWER_STATS } from '../../constants';

// --- Laser Tower ---
export class LaserTower extends BaseTower {
    constructor(id: string, x: number, y: number) {
        super(id, TowerType.LASER, x, y);
    }

    protected drawIcon(gfx: Graphics): void {
        gfx.beginFill(0xffffff, 0.3);
        gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 5);
        gfx.endFill();
    }

    public checkFire(now: number, enemies: GameEnemy[]): ShootResult | null {
        const stats = TOWER_STATS[this.type];
        if (now - this.lastFired < stats.cooldown) return null;

        const target = this.findTarget(enemies, stats.range);
        if (target) {
            this.lastFired = now;
            const damageMult = 1 + (this.level - 1) * 0.5;
            return {
                type: 'BEAM',
                target,
                data: { damage: stats.damage * damageMult, color: stats.hexColor }
            };
        }
        return null;
    }
}

// --- Cannon Tower ---
export class CannonTower extends BaseTower {
    constructor(id: string, x: number, y: number) {
        super(id, TowerType.CANNON, x, y);
    }

    protected drawIcon(gfx: Graphics): void {
        gfx.beginFill(0xffffff, 0.3);
        gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 8);
        gfx.endFill();
    }

    public checkFire(now: number, enemies: GameEnemy[]): ShootResult | null {
        const stats = TOWER_STATS[this.type];
        if (now - this.lastFired < stats.cooldown) return null;

        const target = this.findTarget(enemies, stats.range);
        if (target) {
            this.lastFired = now;
            const damageMult = 1 + (this.level - 1) * 0.5;
            return {
                type: 'PROJECTILE',
                target,
                data: { damage: stats.damage * damageMult, color: 0xf97316 }
            };
        }
        return null;
    }
}

// --- Sniper Tower ---
export class SniperTower extends BaseTower {
    constructor(id: string, x: number, y: number) {
        super(id, TowerType.SNIPER, x, y);
    }

    protected drawIcon(gfx: Graphics): void {
        gfx.beginFill(0xffffff, 0.3);
        gfx.drawRect(CELL_SIZE/2 - 2, 5, 4, CELL_SIZE - 10);
        gfx.endFill();
    }

    public checkFire(now: number, enemies: GameEnemy[]): ShootResult | null {
        const stats = TOWER_STATS[this.type];
        if (now - this.lastFired < stats.cooldown) return null;

        const target = this.findTarget(enemies, stats.range);
        if (target) {
            this.lastFired = now;
            const damageMult = 1 + (this.level - 1) * 0.5;
            return {
                type: 'BEAM',
                target,
                data: { damage: stats.damage * damageMult, color: stats.hexColor }
            };
        }
        return null;
    }
}

// --- Slow (Ice) Tower ---
export class SlowTower extends BaseTower {
    constructor(id: string, x: number, y: number) {
        super(id, TowerType.SLOW, x, y);
    }

    protected drawIcon(gfx: Graphics): void {
        gfx.beginFill(0xffffff, 0.3);
        // Snowflake-ish 3 circles
        gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2 - 5, 3);
        gfx.drawCircle(CELL_SIZE/2 - 4, CELL_SIZE/2 + 3, 3);
        gfx.drawCircle(CELL_SIZE/2 + 4, CELL_SIZE/2 + 3, 3);
        gfx.endFill();
    }

    public checkFire(now: number, enemies: GameEnemy[]): ShootResult | null {
        const stats = TOWER_STATS[this.type];
        if (now - this.lastFired < stats.cooldown) return null;

        // Slow affects all in range immediately (AOE Pulse)
        let hitAny = false;
        const slowFactor = Math.max(0.2, 0.6 - (this.level - 1) * 0.05);

        enemies.forEach(e => {
            const dist = Math.hypot(this.x - e.x, this.y - e.y);
            if (dist <= stats.range) {
                e.frozenFactor = slowFactor;
                hitAny = true;
            }
        });

        if (hitAny) {
            this.lastFired = now;
            return {
                type: 'AREA',
                data: { color: stats.hexColor, range: stats.range }
            };
        }
        return null;
    }
}
