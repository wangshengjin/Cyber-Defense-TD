import { Graphics, ParticleContainer, Sprite, Renderer, Texture, Container, BLEND_MODES } from 'pixi.js';
import { GameObject } from './GameObject';
import { CELL_SIZE } from '../../types';

// --- 粒子系统 (Particle System) ---

interface Particle {
    sprite: Sprite;
    vx: number;       // X轴速度
    vy: number;       // Y轴速度
    life: number;     // 当前生命值
    maxLife: number;  // 最大生命值
    scaleSpeed: number; // 缩放速度 (用于淡出变小)
    active: boolean;  // 是否激活
}

/**
 * 高性能粒子系统
 * 使用对象池 (Object Pooling) 和 Pixi 的 ParticleContainer 进行优化渲染
 */
export class ParticleSystem {
    public container: ParticleContainer;
    private particles: Particle[] = [];
    private pool: Particle[] = []; // 对象池：复用非活跃的粒子对象
    private texture: Texture | null = null;
    private initialized = false;

    constructor(capacity: number = 2000) {
        // 显式初始化数组，防止 undefined 错误
        this.particles = [];
        this.pool = [];

        // ParticleContainer 针对大量相同纹理的 Sprite 进行了优化
        // 我们开启 tint (染色) 和 alpha (透明度) 以支持多彩爆炸
        this.container = new ParticleContainer(capacity, {
            tint: true,
            alpha: true,
            scale: true,
            position: true,
            rotation: true,
            uvs: false // 我们只用简单的圆形纹理，不需要 UV 变换
        });
        
        // 使用叠加混合模式 (ADD) 制作发光效果
        // 修复：PixiJS v7 必须使用 BLEND_MODES.ADD (整数枚举)，不能使用字符串 'add'
        this.container.blendMode = BLEND_MODES.ADD;
    }

    public init(renderer: Renderer) {
        if (this.initialized) return;

        // 程序化生成一个柔和的圆形纹理
        const gfx = new Graphics();
        const r = 16;
        gfx.beginFill(0xFFFFFF);
        gfx.drawCircle(r, r, r); 
        gfx.endFill();
        
        // 将 Graphics 渲染为 Texture，供粒子复用
        this.texture = renderer.generateTexture(gfx);
        this.initialized = true;
    }

    /**
     * 发射粒子
     * @param config 粒子发射配置
     */
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
            
            // 如果对象池为空，创建新粒子
            if (!p) {
                const s = new Sprite(this.texture);
                s.anchor.set(0.5);
                this.container.addChild(s);
                p = { sprite: s, vx: 0, vy: 0, life: 0, maxLife: 0, scaleSpeed: 0, active: true };
            } else {
                p.active = true;
                p.sprite.visible = true;
            }

            // 重置粒子属性
            p.sprite.x = x;
            p.sprite.y = y;
            p.sprite.tint = color;
            p.sprite.alpha = 1;
            p.sprite.rotation = Math.random() * Math.PI * 2;
            
            // 随机物理属性
            const angle = Math.random() * spread;
            const spd = (Math.random() * 0.5 + 0.5) * 5 * speed; // 基础速度
            
            p.vx = Math.cos(angle) * spd;
            p.vy = Math.sin(angle) * spd;
            
            p.maxLife = life * (0.5 + Math.random() * 0.5); // 生命周期随机波动 50%
            p.life = p.maxLife;
            
            const startScale = Math.random() * 0.4 + 0.2;
            p.sprite.scale.set(startScale);
            p.scaleSpeed = -startScale / p.maxLife; // 生命周期结束时缩放到0

            this.particles.push(p);
        }
    }

    public update(dtScale: number) {
        // 安全检查
        if (!this.particles) return;

        // 倒序遍历以便安全移除数组元素
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life -= dtScale;
            
            if (p.life <= 0) {
                // 粒子死亡：回收到对象池
                p.active = false;
                p.sprite.visible = false;
                this.pool.push(p);
                this.particles.splice(i, 1);
                continue;
            }

            // 物理更新
            p.sprite.x += p.vx * dtScale;
            p.sprite.y += p.vy * dtScale;
            
            // 阻力 (Drag)
            p.vx *= 0.95;
            p.vy *= 0.95;

            // 视觉更新
            const progress = p.life / p.maxLife;
            p.sprite.alpha = progress;
            
            const currentScale = p.sprite.scale.x + (p.scaleSpeed * dtScale * 0.5); // 缓慢缩小
            p.sprite.scale.set(Math.max(0, currentScale));
        }
    }

    public clear() {
        if (!this.particles) return;
        // 清除所有粒子并回收到池中
        for (const p of this.particles) {
            p.active = false;
            p.sprite.visible = false;
            this.pool.push(p);
        }
        this.particles = [];
    }
}

// --- 光束特效 (GameBeam) ---
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
        // 修复：PixiJS v7 必须使用 BLEND_MODES.ADD
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
        
        // 绘制核心光束 (高亮)
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
        
        // 绘制外发光 (更宽，透明度更低)
        this.gfx.lineStyle(this.width * 2, this.color, alpha * 0.3);
        this.gfx.moveTo((this.startX + 0.5) * CELL_SIZE, (this.startY + 0.5) * CELL_SIZE);
        this.gfx.lineTo((this.endX + 0.5) * CELL_SIZE, (this.endY + 0.5) * CELL_SIZE);
    }
}