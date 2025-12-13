import { Graphics } from 'pixi.js';
import { GameObject } from './GameObject';
import { GameEnemy } from './GameEnemy';
import { CELL_SIZE } from '../../types';

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
        this.targetX = target.x;
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
