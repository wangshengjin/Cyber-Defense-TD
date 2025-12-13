import { Container, Graphics, Text } from 'pixi.js';
import { EnemyType, TowerType, Coordinate, CELL_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../types';
import { ENEMY_STATS, TOWER_STATS, PATH_COORDINATES } from '../constants';

// --- Base Entity ---
export abstract class GameObject {
    public id: string;
    public container: Container;
    public markedForDeletion: boolean = false;

    constructor(id: string) {
        this.id = id;
        this.container = new Container();
    }

    abstract update(dt: number): void;
    
    destroy() {
        this.container.destroy({ children: true });
    }
}

// --- Enemy Class ---
export class GameEnemy extends GameObject {
    public type: EnemyType;
    public hp: number;
    public maxHp: number;
    public speed: number;
    public reward: number;
    public damage: number;
    
    public pathIndex: number = 0;
    public progress: number = 0; // 0 to 1 between nodes
    public x: number;
    public y: number;
    
    public frozenFactor: number = 1; // 1 = full speed

    private body: Graphics;
    private hpBar: Graphics;

    constructor(id: string, type: EnemyType, hpMultiplier: number) {
        super(id);
        this.type = type;
        
        const stats = ENEMY_STATS[type];
        this.maxHp = stats.hp * hpMultiplier;
        this.hp = this.maxHp;
        this.speed = stats.speed;
        this.reward = stats.reward;
        this.damage = stats.damage;

        this.x = PATH_COORDINATES[0].x;
        this.y = PATH_COORDINATES[0].y;
        this.updatePosition();

        // Init Graphics
        this.body = new Graphics();
        this.hpBar = new Graphics();
        this.container.addChild(this.body);
        this.container.addChild(this.hpBar);
        
        this.drawBody(); // Static drawing
    }

    private updatePosition() {
        this.container.x = this.x * CELL_SIZE;
        this.container.y = this.y * CELL_SIZE;
    }

    private drawBody() {
        const stats = ENEMY_STATS[this.type];
        const radius = this.type === EnemyType.BOSS ? 18 : this.type === EnemyType.TANK ? 14 : 10;
        
        this.body.clear();
        this.body.lineStyle(2, 0xffffff);
        this.body.beginFill(stats.hexColor);
        this.body.drawCircle(0, 0, radius);
        this.body.endFill();
    }

    public update(dt: number): void {
        // Recovery from freeze
        this.frozenFactor = Math.min(this.frozenFactor + 0.005, 1);

        // Movement
        if (this.pathIndex >= PATH_COORDINATES.length - 1) return;

        const currentPos = PATH_COORDINATES[this.pathIndex];
        const nextPos = PATH_COORDINATES[this.pathIndex + 1];
        
        const dist = Math.hypot(nextPos.x - currentPos.x, nextPos.y - currentPos.y);
        const move = this.speed * this.frozenFactor * (dt / 1000);

        this.progress += move / dist;

        if (this.progress >= 1) {
            this.progress = 0;
            this.pathIndex++;
        }

        // Interpolate
        const p1 = PATH_COORDINATES[this.pathIndex];
        const p2 = PATH_COORDINATES[this.pathIndex + 1] || p1; // Safety check
        this.x = p1.x + (p2.x - p1.x) * this.progress;
        this.y = p1.y + (p2.y - p1.y) * this.progress;

        this.updatePosition();
        this.drawHpBar();
    }

    private drawHpBar() {
        const radius = this.type === EnemyType.BOSS ? 18 : this.type === EnemyType.TANK ? 14 : 10;
        const hpPct = Math.max(0, this.hp / this.maxHp);
        
        this.hpBar.clear();
        // Background
        this.hpBar.beginFill(0x374151);
        this.hpBar.drawRect(-15, -radius - 8, 30, 4);
        this.hpBar.endFill();
        
        // Health
        const color = this.frozenFactor < 0.9 ? 0x60a5fa : 0x22c55e;
        this.hpBar.beginFill(color);
        this.hpBar.drawRect(-15, -radius - 8, 30 * hpPct, 4);
        this.hpBar.endFill();
        
        // Ice effect overlay on body
        if (this.frozenFactor < 0.9) {
            this.body.alpha = 0.7;
            this.body.tint = 0xAAAAFF;
        } else {
            this.body.alpha = 1;
            this.body.tint = 0xFFFFFF;
        }
    }

    public takeDamage(amount: number) {
        this.hp -= amount;
        if (this.hp <= 0) this.markedForDeletion = true;
    }
}

// --- Tower Class ---
export interface ShootResult {
    type: 'PROJECTILE' | 'BEAM' | 'AREA';
    target?: GameEnemy;
    data?: any;
}

export class GameTower extends GameObject {
    public type: TowerType;
    public x: number;
    public y: number;
    public level: number = 1;
    public lastFired: number = 0;
    
    private textLevel: Text;

    constructor(id: string, type: TowerType, x: number, y: number) {
        super(id);
        this.type = type;
        this.x = x;
        this.y = y;
        
        this.container.x = x * CELL_SIZE;
        this.container.y = y * CELL_SIZE;

        this.drawBase();
        
        // Text label
        this.textLevel = new Text('Lv.1', {
            fontFamily: 'Arial', 
            fontSize: 10, 
            fill: '#ffffff',
            fontWeight: 'bold', 
            stroke: '#000000', 
            strokeThickness: 2
        } as any);
        this.textLevel.x = CELL_SIZE - 25;
        this.textLevel.y = -5;
        this.container.addChild(this.textLevel);
    }

    private drawBase() {
        const gfx = new Graphics();
        const stats = TOWER_STATS[this.type];
        
        // Base
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.beginFill(stats.hexColor);
        gfx.drawRoundedRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
        gfx.endFill();
        
        // Icon shape
        gfx.beginFill(0xffffff, 0.3);
        if (this.type === TowerType.LASER) gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 5);
        else if (this.type === TowerType.SNIPER) gfx.drawRect(CELL_SIZE/2 - 2, 5, 4, CELL_SIZE - 10);
        else gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 8);
        gfx.endFill();
        
        this.container.addChildAt(gfx, 0);
    }

    public upgrade() {
        this.level++;
        this.textLevel.text = 'Lv.' + this.level;
    }

    // Logic to find target and fire
    public update(dt: number): void {
        // Tower doesn't animate much per frame usually
    }

    // New method: Try to fire at enemies
    public checkFire(now: number, enemies: GameEnemy[]): ShootResult | null {
        const stats = TOWER_STATS[this.type];
        if (now - this.lastFired < stats.cooldown) return null;

        // Find Target
        let target: GameEnemy | null = null;
        let minDist = Infinity;

        // Simple optimization: only check dist if necessary
        for (const e of enemies) {
            const d = Math.hypot(this.x - e.x, this.y - e.y);
            if (d <= stats.range && d < minDist) {
                minDist = d;
                target = e;
            }
        }

        if (target || this.type === TowerType.SLOW) {
            this.lastFired = now;
            const damageMult = 1 + (this.level - 1) * 0.5;
            const damage = stats.damage * damageMult;

            // Logic per tower type
            if (this.type === TowerType.LASER || this.type === TowerType.SNIPER) {
                return { type: 'BEAM', target, data: { damage, color: stats.hexColor } };
            } 
            else if (this.type === TowerType.CANNON) {
                return { type: 'PROJECTILE', target, data: { damage, color: 0xf97316 } };
            }
            else if (this.type === TowerType.SLOW) {
                // Slow affects all in range immediately
                const affected = enemies.filter(e => Math.hypot(this.x - e.x, this.y - e.y) <= stats.range);
                const slowFactor = Math.max(0.2, 0.6 - (this.level - 1) * 0.05);
                affected.forEach(e => e.frozenFactor = slowFactor);
                return { type: 'AREA', data: { color: stats.hexColor, range: stats.range } };
            }
        }
        return null;
    }
}

// --- Projectile Class ---
export class GameProjectile extends GameObject {
    public x: number;
    public y: number;
    public targetX: number;
    public targetY: number;
    public speed: number = 8;
    public damage: number;
    public splashRadius: number = 1.5;
    
    private gfx: Graphics;

    constructor(id: string, startX: number, startY: number, target: GameEnemy, damage: number) {
        super(id);
        this.x = startX;
        this.y = startY;
        this.targetX = target.x; // Snapshot target pos
        this.targetY = target.y;
        this.damage = damage;

        this.gfx = new Graphics();
        this.gfx.beginFill(0xf97316);
        this.gfx.drawCircle(0, 0, 4);
        this.gfx.endFill();
        this.container.addChild(this.gfx);
        this.updatePosition();
    }

    private updatePosition() {
        this.container.x = this.x * CELL_SIZE;
        this.container.y = this.y * CELL_SIZE;
    }

    public update(dt: number): void {
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        const move = this.speed * (dt / 1000);
        
        this.x += Math.cos(angle) * move;
        this.y += Math.sin(angle) * move;
        
        this.updatePosition();

        const distToEnd = Math.hypot(this.targetX - this.x, this.targetY - this.y);
        if (distToEnd < 0.2) {
            this.markedForDeletion = true;
        }
    }
}

// --- Particle Class ---
export class GameParticle extends GameObject {
    public vx: number;
    public vy: number;
    public life: number = 1.0;
    public color: number;
    public size: number;
    
    private gfx: Graphics;
    
    // Virtual coordinates
    public x: number;
    public y: number;

    constructor(id: string, x: number, y: number, color: number) {
        super(id);
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 6 + 2;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;

        this.gfx = new Graphics();
        this.container.addChild(this.gfx);
        this.draw();
        this.updatePosition();
    }

    private updatePosition() {
        this.container.x = this.x * CELL_SIZE;
        this.container.y = this.y * CELL_SIZE;
    }

    private draw() {
        this.gfx.clear();
        this.gfx.beginFill(this.color, this.life);
        this.gfx.drawCircle(0, 0, this.size * this.life);
        this.gfx.endFill();
    }

    public update(dt: number): void {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
        
        if (this.life <= 0) {
            this.markedForDeletion = true;
        } else {
            this.updatePosition();
            this.draw();
        }
    }
}

// --- Beam Class (Visual only) ---
export class GameBeam extends GameObject {
    public startX: number;
    public startY: number;
    public endX: number;
    public endY: number;
    public life: number;
    public maxLife: number;
    public color: number;
    public width: number;
    
    private gfx: Graphics;

    constructor(id: string, sx: number, sy: number, ex: number, ey: number, color: number, width: number, duration: number) {
        super(id);
        this.startX = sx;
        this.startY = sy;
        this.endX = ex;
        this.endY = ey;
        this.color = color;
        this.width = width;
        this.life = duration;
        this.maxLife = duration;
        
        this.gfx = new Graphics();
        this.container.addChild(this.gfx);
        this.draw();
    }

    public update(dt: number): void {
        this.life -= dt;
        if (this.life <= 0) {
            this.markedForDeletion = true;
        } else {
            this.draw();
        }
    }

    private draw() {
        this.gfx.clear();
        const alpha = this.life / this.maxLife;
        this.gfx.lineStyle(this.width, this.color, alpha);
        // Coordinates are relative to container, but container is at 0,0 usually for beams that span map
        // Or we can set container at Start and draw to End relative.
        // Let's keep container at 0,0 and draw absolute world coords * CELL_SIZE
        
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
    }
}