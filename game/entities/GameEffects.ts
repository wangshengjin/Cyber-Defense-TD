import { Graphics, ParticleContainer, Sprite, Renderer, Texture, Container, BLEND_MODES } from 'pixi.js';
import { GameObject } from './GameObject';
import { CELL_SIZE } from '../../types';

// --- Particle System ---

interface Particle {
    sprite: Sprite;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    scaleSpeed: number;
    active: boolean;
}

export class ParticleSystem {
    public container: ParticleContainer;
    private particles: Particle[] = [];
    private pool: Particle[] = [];
    private texture: Texture | null = null;
    private initialized = false;

    constructor(capacity: number = 2000) {
        // ParticleContainer is optimized for many sprites with same texture
        // Casting to any to bypass strict type check for constructor arguments in some Pixi versions
        this.container = new (ParticleContainer as any)(capacity, {
            scale: true,
            position: true,
            rotation: true,
            uvs: false, // We don't change texture UVs
            alpha: true,
            tint: true
        });
        
        // Use Additive blending for "glowing" light effects
        this.container.blendMode = BLEND_MODES.ADD;
    }

    public init(renderer: Renderer) {
        if (this.initialized) return;

        // Generate a soft circle texture programmatically
        const gfx = new Graphics();
        const r = 16;
        gfx.beginFill(0xFFFFFF);
        gfx.drawCircle(r, r, r); 
        gfx.endFill();
        
        // Render it to a texture
        this.texture = renderer.generateTexture(gfx);
        this.initialized = true;
    }

    public emit(config: {
        x: number; 
        y: number; 
        color: number; 
        count: number; 
        speed?: number; 
        life?: number; 
        spread?: number;
    }) {
        if (!this.texture) return;

        const { x, y, color, count, speed = 1, life = 40, spread = Math.PI * 2 } = config;

        for (let i = 0; i < count; i++) {
            let p = this.pool.pop();
            
            // Create new if pool empty
            if (!p) {
                const s = new Sprite(this.texture);
                s.anchor.set(0.5);
                this.container.addChild(s);
                p = { sprite: s, vx: 0, vy: 0, life: 0, maxLife: 0, scaleSpeed: 0, active: true };
            } else {
                p.active = true;
                p.sprite.visible = true;
            }

            // Reset Properties
            p.sprite.x = x;
            p.sprite.y = y;
            p.sprite.tint = color;
            p.sprite.alpha = 1;
            p.sprite.rotation = Math.random() * Math.PI * 2;
            
            // Randomize physics
            const angle = Math.random() * spread;
            const spd = (Math.random() * 0.5 + 0.5) * 5 * speed; // Base speed multiplier
            
            p.vx = Math.cos(angle) * spd;
            p.vy = Math.sin(angle) * spd;
            
            p.maxLife = life * (0.5 + Math.random() * 0.5); // vary life by 50%
            p.life = p.maxLife;
            
            const startScale = Math.random() * 0.4 + 0.2;
            p.sprite.scale.set(startScale);
            p.scaleSpeed = -startScale / p.maxLife; // Shrink to 0 over life

            this.particles.push(p);
        }
    }

    public update(dtScale: number) {
        // iterate backwards to allow splicing
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life -= dtScale;
            
            if (p.life <= 0) {
                p.active = false;
                p.sprite.visible = false;
                this.pool.push(p);
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.sprite.x += p.vx * dtScale;
            p.sprite.y += p.vy * dtScale;
            
            // Drag
            p.vx *= 0.95;
            p.vy *= 0.95;

            // Visuals
            const progress = p.life / p.maxLife;
            p.sprite.alpha = progress;
            // p.sprite.rotation += 0.1 * dtScale;
            
            const currentScale = p.sprite.scale.x + (p.scaleSpeed * dtScale * 0.5); // shrink slower
            p.sprite.scale.set(Math.max(0, currentScale));
        }
    }

    public clear() {
        // Return all to pool
        for (const p of this.particles) {
            p.active = false;
            p.sprite.visible = false;
            this.pool.push(p);
        }
        this.particles = [];
    }
}

// --- Beam Effect (Visual only) ---
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
        this.gfx.blendMode = BLEND_MODES.ADD;
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
        
        // Add a "core" line that is white/bright for beam effect
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
        
        // Glow
        this.gfx.lineStyle(this.width * 2, this.color, alpha * 0.3);
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
    }
}