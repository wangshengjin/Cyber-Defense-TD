import { Graphics } from 'pixi.js';
import { GameObject } from './GameObject';
import { EnemyType, CELL_SIZE } from '../../types';
import { ENEMY_STATS, PATH_COORDINATES } from '../../constants';

export class GameEnemy extends GameObject {
    public type: EnemyType;
    public hp: number;
    public maxHp: number;
    public speed: number;
    public reward: number;
    public damage: number;
    
    public pathIndex: number = 0;
    public progress: number = 0; 
    public x: number;
    public y: number;
    
    public frozenFactor: number = 1;

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

        this.body = new Graphics();
        this.hpBar = new Graphics();
        this.container.addChild(this.body);
        this.container.addChild(this.hpBar);
        
        this.drawBody();
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
        this.frozenFactor = Math.min(this.frozenFactor + 0.005, 1);

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

        const p1 = PATH_COORDINATES[this.pathIndex];
        const p2 = PATH_COORDINATES[this.pathIndex + 1] || p1;
        this.x = p1.x + (p2.x - p1.x) * this.progress;
        this.y = p1.y + (p2.y - p1.y) * this.progress;

        this.updatePosition();
        this.drawHpBar();
    }

    private drawHpBar() {
        const radius = this.type === EnemyType.BOSS ? 18 : this.type === EnemyType.TANK ? 14 : 10;
        const hpPct = Math.max(0, this.hp / this.maxHp);
        
        this.hpBar.clear();
        this.hpBar.beginFill(0x374151);
        this.hpBar.drawRect(-15, -radius - 8, 30, 4);
        this.hpBar.endFill();
        
        const color = this.frozenFactor < 0.9 ? 0x60a5fa : 0x22c55e;
        this.hpBar.beginFill(color);
        this.hpBar.drawRect(-15, -radius - 8, 30 * hpPct, 4);
        this.hpBar.endFill();
        
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
