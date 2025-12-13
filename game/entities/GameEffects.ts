import { Graphics } from 'pixi.js';
import { GameObject } from './GameObject';
import { CELL_SIZE } from '../../types';

export class GameParticle extends GameObject {
    public vx: number;
    public vy: number;
    public life: number = 1.0;
    public decay: number;
    public color: number;
    public size: number;
    
    private gfx: Graphics;
    public x: number;
    public y: number;

    constructor(id: string, x: number, y: number, color: number, config: { speed?: number, size?: number, duration?: number } = {}) {
        super(id);
        this.x = x;
        this.y = y;
        this.color = color;
        
        // Configuration with defaults
        const baseSpeed = config.speed ?? 0.2;
        this.size = config.size ?? (Math.random() * 4 + 2);
        const duration = config.duration ?? 40; // Frames approx
        
        this.decay = 1.0 / duration;

        // Random burst direction
        const angle = Math.random() * Math.PI * 2;
        const speed = baseSpeed * (0.2 + Math.random() * 1.5); // Vary speed significantly
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.gfx = new Graphics();
        // Additive blending makes particles glow when they overlap
        this.gfx.blendMode = 1; // BLEND_MODES.ADD
        
        this.gfx.beginFill(this.color);
        this.gfx.drawCircle(0, 0, this.size);
        this.gfx.endFill();
        
        this.container.addChild(this.gfx);
        this.updatePosition();
    }

    private updatePosition() {
        this.container.x = this.x * CELL_SIZE;
        this.container.y = this.y * CELL_SIZE;
    }

    public update(dt: number): void {
        // dt is ms. normalize to approx 60fps frame (16ms)
        const frameScale = dt / 16.66;

        this.x += this.vx * frameScale;
        this.y += this.vy * frameScale;
        
        // Friction (slow down over time)
        this.vx *= 0.92;
        this.vy *= 0.92;

        // Decay life
        this.life -= this.decay * frameScale;
        
        // Visual updates
        this.container.alpha = this.life;
        // Shrink as it fades
        this.container.scale.set(0.3 + 0.7 * this.life); 

        if (this.life <= 0) {
            this.markedForDeletion = true;
        } else {
            this.updatePosition();
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
        this.gfx.blendMode = 1; // BLEND_MODES.ADD - Make beams glow too
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