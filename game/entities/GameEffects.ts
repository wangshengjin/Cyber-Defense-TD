import { Graphics } from 'pixi.js';
import { GameObject } from './GameObject';
import { CELL_SIZE } from '../../types';

export class GameParticle extends GameObject {
    public vx: number;
    public vy: number;
    public life: number = 1.0;
    public color: number;
    public size: number;
    
    private gfx: Graphics;
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
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
    }
}
