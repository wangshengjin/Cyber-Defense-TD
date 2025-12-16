import { Graphics } from 'pixi.js';
import { GameObject } from './GameObject';
import { EnemyType, CELL_SIZE } from '../../types';
import { ENEMY_STATS, PATH_COORDINATES } from '../../constants';

/**
 * 敌人类
 * 负责敌人的属性、渲染和沿路径移动逻辑
 */
export class GameEnemy extends GameObject {
    public type: EnemyType;
    public hp: number;
    public maxHp: number;
    public speed: number;
    public reward: number;
    public damage: number;
    
    // --- 路径跟踪属性 ---
    public pathIndex: number = 0; // 当前目标路径节点的索引
    public progress: number = 0;  // 在当前节点和下一个节点之间的进度 (0.0 到 1.0)
    public x: number; // 当前逻辑坐标 X (网格单位)
    public y: number; // 当前逻辑坐标 Y (网格单位)
    
    public frozenFactor: number = 1; // 冰冻减速因子 (1 = 正常速度, <1 = 减速)

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

        // 安全检查：防止路径未定义
        if (PATH_COORDINATES && PATH_COORDINATES.length > 0) {
            this.x = PATH_COORDINATES[0].x;
            this.y = PATH_COORDINATES[0].y;
        } else {
            this.x = 0;
            this.y = 0;
        }
        this.updatePosition();

        this.body = new Graphics();
        this.hpBar = new Graphics();
        this.container.addChild(this.body);
        this.container.addChild(this.hpBar);
        
        this.drawBody();
    }

    private updatePosition() {
        // 修正：增加 0.5 的偏移量，使敌人位于格子的中心，而不是左上角
        this.container.x = (this.x + 0.5) * CELL_SIZE;
        this.container.y = (this.y + 0.5) * CELL_SIZE;
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

    /**
     * 更新敌人状态 (每一帧调用)
     * 计算移动和减速恢复
     */
    public update(dt: number): void {
        // 缓慢恢复减速效果 (每帧恢复 0.005)
        this.frozenFactor = Math.min(this.frozenFactor + 0.005, 1);

        // 防御性编程：检查 PATH_COORDINATES 是否存在
        if (!PATH_COORDINATES || this.pathIndex >= PATH_COORDINATES.length - 1) return;

        const currentPos = PATH_COORDINATES[this.pathIndex];
        const nextPos = PATH_COORDINATES[this.pathIndex + 1];
        
        // 计算移动距离
        const dist = Math.hypot(nextPos.x - currentPos.x, nextPos.y - currentPos.y);
        const move = this.speed * this.frozenFactor * (dt / 1000);

        // 更新进度
        this.progress += move / dist;

        // 到达下一个节点
        if (this.progress >= 1) {
            this.progress = 0;
            this.pathIndex++;
        }

        // 线性插值计算当前坐标
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
        // 血条背景 (灰色)
        this.hpBar.beginFill(0x374151);
        this.hpBar.drawRect(-15, -radius - 8, 30, 4);
        this.hpBar.endFill();
        
        // 血条前景 (绿色或冰冻时的蓝色)
        const color = this.frozenFactor < 0.9 ? 0x60a5fa : 0x22c55e;
        this.hpBar.beginFill(color);
        this.hpBar.drawRect(-15, -radius - 8, 30 * hpPct, 4);
        this.hpBar.endFill();
        
        // 视觉上表现冰冻状态 (变色半透明)
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