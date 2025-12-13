import { Graphics, Text } from 'pixi.js';
import { GameObject } from '../entities/GameObject';
import { GameEnemy } from '../entities/GameEnemy';
import { TowerType, CELL_SIZE } from '../../types';
import { TOWER_STATS } from '../../constants';

export interface ShootResult {
    type: 'PROJECTILE' | 'BEAM' | 'AREA';
    target?: GameEnemy;
    data?: any;
}

export abstract class BaseTower extends GameObject {
    public type: TowerType;
    public x: number;
    public y: number;
    public level: number = 1;
    public lastFired: number = 0;
    
    protected textLevel: Text;

    constructor(id: string, type: TowerType, x: number, y: number) {
        super(id);
        this.type = type;
        this.x = x;
        this.y = y;
        
        this.container.x = x * CELL_SIZE;
        this.container.y = y * CELL_SIZE;

        this.draw();
        
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
        
        // Base background
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.beginFill(stats.hexColor);
        gfx.drawRoundedRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
        gfx.endFill();
        
        // Specific Icon
        this.drawIcon(gfx);
        
        this.container.addChildAt(gfx, 0);
    }

    // Abstract method for subclasses to draw their specific symbol
    protected abstract drawIcon(gfx: Graphics): void;

    // Abstract method to calculate firing logic
    public abstract checkFire(now: number, enemies: GameEnemy[]): ShootResult | null;

    public upgrade() {
        this.level++;
        this.textLevel.text = 'Lv.' + this.level;
    }

    public update(dt: number): void {
        // Towers are static usually, but can animate here
    }

    // Helper: Find nearest enemy in range
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
