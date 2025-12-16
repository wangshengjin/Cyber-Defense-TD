import { Graphics, Text } from 'pixi.js';
import { GameObject } from '../entities/GameObject';
import { GameEnemy } from '../entities/GameEnemy';
import { TowerType, CELL_SIZE } from '../../types';
import { TOWER_STATS } from '../../constants';

export interface ShootResult {
    type: 'PROJECTILE' | 'BEAM' | 'AREA'; // 攻击类型：实体子弹、光束、范围伤害
    target?: GameEnemy;
    data?: any;
}

/**
 * 防御塔基类
 * 定义了所有防御塔共有的属性和行为接口
 */
export abstract class BaseTower extends GameObject {
    public type: TowerType;
    public x: number;
    public y: number;
    public level: number = 1;
    public lastFired: number = 0; // 上次开火时间戳
    
    protected textLevel: Text;

    constructor(id: string, type: TowerType, x: number, y: number) {
        super(id);
        this.type = type;
        this.x = x;
        this.y = y;
        
        this.container.x = x * CELL_SIZE;
        this.container.y = y * CELL_SIZE;

        this.draw();
        
        // 等级文本标签
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

    private draw() {
        const gfx = new Graphics();
        const stats = TOWER_STATS[this.type];
        
        // 绘制底座背景
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.beginFill(stats.hexColor);
        gfx.drawRoundedRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
        gfx.endFill();
        
        // 绘制特定图标 (由子类实现)
        this.drawIcon(gfx);
        
        this.container.addChildAt(gfx, 0);
    }

    // 抽象方法：子类必须实现自己的图标绘制
    protected abstract drawIcon(gfx: Graphics): void;

    // 抽象方法：子类必须实现自己的开火逻辑检查
    public abstract checkFire(now: number, enemies: GameEnemy[]): ShootResult | null;

    public upgrade() {
        this.level++;
        this.textLevel.text = 'Lv.' + this.level;
    }

    public update(dt: number): void {
        // 塔通常是静态的，但可以在这里添加动画 (如旋转)
    }

    /**
     * 辅助方法：寻找范围内最近的敌人
     */
    protected findTarget(enemies: GameEnemy[], range: number): GameEnemy | null {
        let target: GameEnemy | null = null;
        let minDist = Infinity;

        for (const e of enemies) {
            const d = Math.hypot(this.x - e.x, this.y - e.y);
            if (d <= range && d < minDist) {
                minDist = d;
                target = e;
            }
        }
        return target;
    }
}