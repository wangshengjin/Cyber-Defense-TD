import { Application, Container, Graphics, Ticker, FederatedPointerEvent, Renderer } from 'pixi.js';
import { 
  TowerType, EnemyType, SelectedTowerInfo, GameState, MAP_WIDTH, MAP_HEIGHT, CELL_SIZE 
} from '../types';
import { PATH_COORDINATES, TOWER_STATS, WAVES, COLORS, ENEMY_STATS } from '../constants';

// Import from new structure
import { GameEnemy } from './entities/GameEnemy';
import { GameProjectile } from './entities/GameProjectile';
import { GameBeam, ParticleSystem } from './entities/GameEffects';
import { BaseTower } from './towers/BaseTower';
import { TowerFactory } from './towers/TowerFactory';

const APP_KEY = '__CYBER_TD_PIXI_APP_V7__';

interface GameCallbacks {
    onStatsUpdate: (stats: Partial<GameState>) => void;
    onSelectionUpdate: (info: SelectedTowerInfo | null) => void;
    onTowerSelect: (id: string | null) => void;
    onTowerTypeReset: () => void;
}

/**
 * 游戏核心引擎类
 * 负责管理 PixiJS 应用实例、游戏循环、实体管理以及由于 React 交互的状态同步
 */
export class GameEngine {
    public app: Application | null = null;
    private callbacks: GameCallbacks | null = null;
    public isInitialized = false;

    // --- 游戏状态数据 ---
    private money: number = 450;
    private lives: number = 20;
    private wave: number = 1;
    private isPlaying: boolean = false;
    private isGameOver: boolean = false;
    private gameSpeed: number = 1;

    // --- 选中状态 ---
    private placementModeType: TowerType | null = null; // 当前准备放置的塔类型
    private selectedTowerId: string | null = null;      // 当前选中的已建造塔ID

    // --- 实体集合 ---
    private enemies: GameEnemy[] = [];
    private towers: BaseTower[] = [];
    private projectiles: GameProjectile[] = [];
    
    // --- 特效系统 ---
    private particleSystem: ParticleSystem;
    private beams: GameBeam[] = [];

    // --- 图层管理 (用于控制渲染顺序) ---
    private layers: {
        grid: Container;        // 网格层 (底层)
        path: Container;        // 路径层
        ground: Container;      // 地面装饰
        towers: Container;      // 防御塔层
        enemies: Container;     // 敌人生
        projectiles: Container; // 投射物
        fx: Container;          // 特效层 (光束等)
        ui: Container;          // UI 指示器 (范围圈等)
    } | null = null;

    private uiIndicators = {
        range: new Graphics(),
        hover: new Graphics(),
    };

    // --- 波次管理状态 ---
    private waveState = {
        waveIndex: 0,       // 当前波次内的子波段索引
        enemiesSpawned: 0,  // 当前子波段已生成的敌人数量
        lastSpawnTime: 0,   // 上一次生成的时间戳
        waveActive: false,  // 波次是否正在进行中
    };

    private hoverPos: { x: number, y: number } | null = null;
    // Pixi ticker callback now receives Ticker object in recent definitions
    private tickerFn: ((ticker: Ticker) => void) | null = null;

    constructor() {
        // 初始化粒子系统，预分配3000个粒子容量
        this.particleSystem = new ParticleSystem(3000);
    }

    /**
     * 初始化 PixiJS Application
     * 使用单例模式防止 React 重复渲染导致创建多个 Canvas
     */
    public initialize() {
        if (this.isInitialized && this.app) return;
        const w = window as any;
        if (w[APP_KEY]) {
            this.app = w[APP_KEY];
            this.isInitialized = true;
            return;
        }

        this.app = new Application({
            width: MAP_WIDTH * CELL_SIZE,
            height: MAP_HEIGHT * CELL_SIZE,
            backgroundColor: 0x111827,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        w[APP_KEY] = this.app;
        this.isInitialized = true;
    }

    /**
     * 将 Canvas 挂载到 DOM 并启动游戏循环
     */
    public attach(container: HTMLElement, callbacks: GameCallbacks) {
        if (!this.app) this.initialize();

        this.callbacks = callbacks;

        if (this.app!.view && this.app!.view.parentElement !== container) {
            container.appendChild(this.app!.view as any);
        }

        // 初始化粒子纹理
        this.particleSystem.init(this.app!.renderer as Renderer);

        this.resetScene();

        // 绑定游戏主循环 (Ticker)
        if (this.tickerFn) this.app!.ticker.remove(this.tickerFn);
        // Ticker passes the Ticker instance, from which we can get deltaTime
        this.tickerFn = (ticker: Ticker) => this.gameLoop(ticker.deltaTime);
        this.app!.ticker.add(this.tickerFn);

        this.setupInput();
        this.syncStatsToReact();
    }

    public detach() {
        if (!this.app) return;
        if (this.tickerFn) {
            this.app.ticker.remove(this.tickerFn);
            this.tickerFn = null;
        }
        this.app.stage.removeAllListeners();
        if (this.app.view && (this.app.view as any).parentElement) {
            (this.app.view as any).parentElement.removeChild(this.app.view);
        }
        this.callbacks = null;
    }

    // 重置场景图层结构
    private resetScene() {
        if (!this.app || !this.app.stage) return;
        
        this.app.stage.removeChildren();

        this.layers = {
            grid: new Container(),
            path: new Container(),
            ground: new Container(),
            towers: new Container(),
            enemies: new Container(),
            projectiles: new Container(),
            fx: new Container(), 
            ui: new Container(),
        };

        // 按顺序添加图层，确保遮挡关系正确
        this.app.stage.addChild(this.layers.grid);
        this.app.stage.addChild(this.layers.path);
        this.app.stage.addChild(this.layers.ground);
        this.app.stage.addChild(this.layers.towers);
        this.app.stage.addChild(this.layers.enemies);
        this.app.stage.addChild(this.layers.projectiles);
        
        // 粒子系统通常放在较上层，并使用独立的容器
        this.app.stage.addChild(this.particleSystem.container);
        this.app.stage.addChild(this.layers.fx);
        
        this.app.stage.addChild(this.layers.ui);

        this.drawGrid();
        this.drawPath();
        
        this.layers.ui.addChild(this.uiIndicators.range);
        this.layers.ui.addChild(this.uiIndicators.hover);
    }

    // --- 外部控制接口 (React -> Engine) ---

    public setGameSpeed(speed: number) {
        this.gameSpeed = speed;
    }

    public setPlacementMode(type: TowerType | null) {
        this.placementModeType = type;
        this.selectedTowerId = null; 
        this.updateSelectionInfo();
        this.renderUI(); 
    }

    public setSelectedTowerId(id: string | null) {
        this.selectedTowerId = id;
        if (id) this.placementModeType = null;
        this.updateSelectionInfo();
        this.renderUI();
    }

    // 开启下一波或暂停
    public startNextWave() {
        if (this.isGameOver) return;
        
        if (!this.waveState.waveActive) {
            // 开始新的一波
            this.waveState.waveIndex = 0;
            this.waveState.enemiesSpawned = 0;
            this.waveState.waveActive = true;
            this.isPlaying = true;
            this.syncStatsToReact();
        } else {
            // 切换暂停/继续状态
            this.isPlaying = !this.isPlaying;
            this.syncStatsToReact();
        }
    }

    public restartGame() {
        // 销毁所有现有实体
        this.enemies.forEach(e => e.destroy());
        this.towers.forEach(t => t.destroy());
        this.projectiles.forEach(p => p.destroy());
        this.beams.forEach(b => b.destroy());

        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.beams = [];
        this.particleSystem.clear();

        // 重置状态
        this.waveState = { waveIndex: 0, enemiesSpawned: 0, lastSpawnTime: 0, waveActive: false };
        this.money = 450;
        this.lives = 20;
        this.wave = 1;
        this.isPlaying = false;
        this.isGameOver = false;

        this.syncStatsToReact();
        this.updateSelectionInfo();
    }

    // 升级塔逻辑
    public upgradeTower() {
        if (!this.selectedTowerId) return;
        const tower = this.towers.find(t => t.id === this.selectedTowerId);
        if (!tower) return;

        const cost = Math.floor(TOWER_STATS[tower.type].cost * 1.5);
        if (this.money >= cost) {
            tower.upgrade();
            this.money -= cost;
            // 升级只更新数据，不再播放粒子
            this.syncStatsToReact();
            this.updateSelectionInfo();
        }
    }

    // 出售塔逻辑
    public sellTower() {
        if (!this.selectedTowerId) return;
        const idx = this.towers.findIndex(t => t.id === this.selectedTowerId);
        if (idx === -1) return;
        
        const t = this.towers[idx];
        const baseCost = TOWER_STATS[t.type].cost;
        const upgradeCost = Math.floor(baseCost * 1.5);
        const totalInvested = baseCost + (t.level - 1) * upgradeCost;
        const refund = Math.floor(totalInvested * 0.7);

        t.destroy();
        this.towers.splice(idx, 1);
        this.money += refund;
        // 出售只移除塔，不再播放粒子
        
        if(this.callbacks) this.callbacks.onTowerSelect(null);
        this.selectedTowerId = null;
        this.syncStatsToReact();
        this.updateSelectionInfo();
    }

    // --- 内部游戏逻辑 ---

    private setupInput() {
        if (!this.app) return;
        this.app.stage.eventMode = 'static'; 
        this.app.stage.hitArea = this.app.screen;

        // 鼠标移动处理：显示悬停框
        const onPointerMove = (e: FederatedPointerEvent) => {
            const x = Math.floor(e.global.x / CELL_SIZE);
            const y = Math.floor(e.global.y / CELL_SIZE);
            if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                this.hoverPos = { x, y };
                this.renderUI();
            } else {
                this.hoverPos = null;
                this.uiIndicators.hover.clear();
            }
        };

        // 鼠标点击处理：放置塔或选中塔
        const onPointerDown = (e: FederatedPointerEvent) => {
            const x = Math.floor(e.global.x / CELL_SIZE);
            const y = Math.floor(e.global.y / CELL_SIZE);
            this.handleTileClick(x, y);
        };

        this.app.stage.on('pointermove', onPointerMove);
        this.app.stage.on('pointerdown', onPointerDown);
    }

    private handleTileClick(x: number, y: number) {
        if (this.isGameOver || !this.callbacks) return;

        // 1. 检查是否点击了现有的塔 (选中)
        const existingTower = this.towers.find(t => t.x === x && t.y === y);
        if (existingTower) {
            this.callbacks.onTowerSelect(existingTower.id);
            this.selectedTowerId = existingTower.id;
            this.updateSelectionInfo();
            this.renderUI();
            return;
        }

        if (this.isPath(x, y)) return;

        // 2. 检查是否处于建造模式 (放置新塔)
        if (this.placementModeType) {
            const stats = TOWER_STATS[this.placementModeType];
            if (this.money >= stats.cost) {
                const newTower = TowerFactory.createTower(
                    this.placementModeType,
                    Math.random().toString(), 
                    x, y
                );
                this.towers.push(newTower);
                this.layers!.towers.addChild(newTower.container);
                
                this.money -= stats.cost;
                
                // 移除建造特效，只保留核心逻辑
                
                this.callbacks.onTowerTypeReset();
                this.placementModeType = null;
                this.syncStatsToReact();
            }
        } else {
            // 点击空白处取消选中
            this.callbacks.onTowerSelect(null);
            this.selectedTowerId = null;
            this.updateSelectionInfo();
            this.renderUI();
        }
    }

    private gameLoop(delta: number) {
        const dtMs = this.app!.ticker.elapsedMS * this.gameSpeed;
        this.updateLogic(dtMs);
    }

    /**
     * 游戏逻辑核心更新函数 (每一帧调用)
     * @param dt 距离上一帧的时间增量 (毫秒)
     */
    private updateLogic(dt: number) {
        // 0. 更新粒子系统 (始终运行，即使游戏暂停，确保爆炸效果能播放完)
        this.particleSystem.update(dt / 16.66);
        if (!this.isPlaying || this.isGameOver) return;
        const now = Date.now();
        
        // 1. 波次生成逻辑 (Wave Spawning)
        if (this.waveState.waveActive) {
            if (!WAVES) return; // Defensive check for WAVES
            const waveIdx = this.wave - 1;
            // 获取当前波次配置，如果没有配置则生成默认无限波次
            const config = waveIdx < WAVES.length ? WAVES[waveIdx] : [
                { enemyType: EnemyType.TANK, count: 10 + waveIdx, interval: 1000, hpMultiplier: 1 + waveIdx * 0.2 }
            ];
            const subWave = config[Math.min(this.waveState.waveIndex, config.length - 1)];
            
            // 生成敌人
            if (this.waveState.enemiesSpawned < subWave.count) {
                if (now - this.waveState.lastSpawnTime > subWave.interval / this.gameSpeed) {
                    this.spawnEnemy(subWave.enemyType, subWave.hpMultiplier);
                    this.waveState.enemiesSpawned++;
                    this.waveState.lastSpawnTime = now;
                }
            } else {
                // 当前子波段结束，进入下一个子波段或结束本波
                if (this.waveState.waveIndex < config.length - 1) {
                    this.waveState.waveIndex++;
                    this.waveState.enemiesSpawned = 0;
                } else if (this.enemies.length === 0) {
                    // 本波所有敌人被消灭，波次结束
                    this.waveState.waveActive = false;
                    this.isPlaying = false;
                    this.wave++;
                    
                    // 清理残留投射物和光束
                    this.projectiles.forEach(p => p.destroy());
                    this.beams.forEach(b => b.destroy());
                    this.projectiles = [];
                    this.beams = [];
                    
                    this.syncStatsToReact();
                }
            }
        }

        // 2. 防御塔攻击逻辑 (Towers Fire)
        this.towers.forEach(tower => {
            const shot = tower.checkFire(now, this.enemies);
            if (shot) {
                if (shot.type === 'PROJECTILE' && shot.target) {
                    // 发射实体投射物 (如加农炮)
                    const p = new GameProjectile(
                        Math.random().toString(), 
                        tower.x + 0.5, tower.y + 0.5, 
                        shot.target, 
                        shot.data.damage
                    );
                    this.projectiles.push(p);
                    this.layers!.projectiles.addChild(p.container);
                    // 移除开火火花 (Muzzle Flash)，只在爆炸时播放
                } 
                else if (shot.type === 'BEAM' && shot.target) {
                    // 瞬时光束攻击 (如激光、狙击)
                    const beam = new GameBeam(
                        Math.random().toString(),
                        tower.x, tower.y,
                        shot.target.x, shot.target.y,
                        shot.data.color,
                        tower.type === TowerType.SNIPER ? 3 : 1.5,
                        tower.type === TowerType.SNIPER ? 200 : 150
                    );
                    this.beams.push(beam);
                    this.layers!.fx.addChild(beam.container);
                    shot.target.takeDamage(shot.data.damage); // 立即造成伤害
                    // 击中特效 (Beam Hit) - 保留，这是命中反馈
                    this.createExplosion(
                        shot.target.x * CELL_SIZE, 
                        shot.target.y * CELL_SIZE, 
                        shot.data.color, 
                        10, 0.8
                    );
                } 
                else if (shot.type === 'AREA') {
                    // 范围光环效果 (如减速塔) - 保留，这是技能释放视觉
                    this.createExplosion(
                        (tower.x + 0.5) * CELL_SIZE, 
                        (tower.y + 0.5) * CELL_SIZE, 
                        shot.data.color, 
                        20, 1.5
                    );
                }
            }
        });
        
        // 3. 投射物更新与碰撞检测 (Projectiles Update)
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.markedForDeletion) {
                // 造成溅射伤害
                this.enemies.forEach(e => {
                     const px = p.x; 
                     const py = p.y;
                     // 简单的圆形碰撞检测
                     if (Math.hypot(e.x - px, e.y - py) <= p.splashRadius) {
                         e.takeDamage(p.damage);
                     }
                });
                
                // 子弹爆炸特效 (Impact) - 保留
                this.createExplosion(
                    p.x * CELL_SIZE, 
                    p.y * CELL_SIZE, 
                    0xf97316, 
                    15, 1.2
                );
                
                p.destroy();
                this.projectiles.splice(i, 1);
            }
        }

        // 4. 敌人更新 (Enemies Update)
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt);

            if (e.markedForDeletion) {
                // 敌人死亡
                this.money += e.reward;
                // 死亡大爆炸特效 (Death) - 保留
                this.createExplosion(
                    e.x * CELL_SIZE, 
                    e.y * CELL_SIZE, 
                    ENEMY_STATS[e.type].hexColor, 
                    25, 1.5
                );
                e.destroy();
                this.enemies.splice(i, 1);
                this.syncStatsToReact();
            } 
            else if (PATH_COORDINATES && e.pathIndex >= PATH_COORDINATES.length - 1) { // Added defensive check for PATH_COORDINATES
                // 敌人到达终点，扣血
                this.lives = Math.max(0, this.lives - e.damage);
                e.destroy();
                this.enemies.splice(i, 1);
                this.syncStatsToReact();
            }
        }

        // 5. 特效更新 (Beam FX Update)
        for (let i = this.beams.length - 1; i >= 0; i--) {
            this.beams[i].update(dt);
            if (this.beams[i].markedForDeletion) {
                this.beams[i].destroy();
                this.beams.splice(i, 1);
            }
        }
        
        // 游戏结束判定
        if (this.lives <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            this.isPlaying = false;
            this.syncStatsToReact();
        }
    }

    // --- UI 渲染辅助 ---

    private renderUI() {
        if (!this.layers) return;

        // 绘制悬停格子的框 (绿色有效，红色无效/暂未实现)
        this.uiIndicators.hover.clear();
        if (this.hoverPos) {
            const { x, y } = this.hoverPos;
            const isValid = !this.isPath(x, y);
            const color = this.placementModeType && isValid ? COLORS.HOVER_VALID : COLORS.GRID_BORDER;
            
            this.uiIndicators.hover.lineStyle(2, color, 0.5);
            this.uiIndicators.hover.beginFill(color, 0.2);
            this.uiIndicators.hover.drawRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            this.uiIndicators.hover.endFill();
        }

        // 绘制攻击范围圈
        this.uiIndicators.range.clear();
        let range = 0;
        let cx = 0, cy = 0;
        let show = false;

        if (this.selectedTowerId) {
            const t = this.towers.find(t => t.id === this.selectedTowerId);
            if (t) {
                range = TOWER_STATS[t.type].range;
                cx = (t.x + 0.5) * CELL_SIZE;
                cy = (t.y + 0.5) * CELL_SIZE;
                show = true;
            }
        } else if (this.placementModeType && this.hoverPos) {
            range = TOWER_STATS[this.placementModeType].range;
            cx = (this.hoverPos.x + 0.5) * CELL_SIZE;
            cy = (this.hoverPos.y + 0.5) * CELL_SIZE;
            show = true;
        }

        if (show) {
            this.uiIndicators.range.lineStyle(2, COLORS.RANGE_CIRCLE, 0.5);
            this.uiIndicators.range.beginFill(COLORS.RANGE_CIRCLE, 0.1);
            this.uiIndicators.range.drawCircle(cx, cy, range * CELL_SIZE);
            this.uiIndicators.range.endFill();
        }
    }

    private spawnEnemy(type: EnemyType, hpMult: number) {
        const enemy = new GameEnemy(Math.random().toString(), type, hpMult);
        this.enemies.push(enemy);
        this.layers!.enemies.addChild(enemy.container);
    }

    /**
     * 创建爆炸特效
     * 调用粒子系统发射粒子
     */
    private createExplosion(worldX: number, worldY: number, color: number, count: number = 10, scale: number = 1) {
        this.particleSystem.emit({
            x: worldX,
            y: worldY,
            color: color,
            count: count,
            speed: scale,
            life: 45 * scale
        });
        
        // 额外的白色核心，增加打击感
        this.particleSystem.emit({
            x: worldX,
            y: worldY,
            color: 0xFFFFFF,
            count: Math.floor(count / 2),
            speed: scale * 1.5,
            life: 20
        });
    }

    private drawGrid() {
        const gfx = new Graphics();
        gfx.lineStyle(1, COLORS.GRID_BORDER, 0.2);
        for (let x = 0; x <= MAP_WIDTH; x++) {
            gfx.moveTo(x * CELL_SIZE, 0);
            gfx.lineTo(x * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
        }
        for (let y = 0; y <= MAP_HEIGHT; y++) {
            gfx.moveTo(0, y * CELL_SIZE);
            gfx.lineTo(MAP_WIDTH * CELL_SIZE, y * CELL_SIZE);
        }
        this.layers!.grid.addChild(gfx);
    }

    private drawPath() {
        const gfx = new Graphics();
        for(let y=0; y<MAP_HEIGHT; y++) {
            for(let x=0; x<MAP_WIDTH; x++) {
                if (this.isPath(x, y)) {
                    gfx.beginFill(COLORS.PATH, 0.5);
                    gfx.drawRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    gfx.endFill();
                    
                    gfx.beginFill(COLORS.PATH_DOT, 0.1);
                    gfx.drawCircle((x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE, 4);
                    gfx.endFill();
                }
            }
        }
        this.layers!.path.addChild(gfx);
    }

    private isPath(x: number, y: number): boolean {
        // Defensive check
        if (!PATH_COORDINATES || PATH_COORDINATES.length === 0) return false;

        for (let i = 0; i < PATH_COORDINATES.length - 1; i++) {
            const p1 = PATH_COORDINATES[i];
            const p2 = PATH_COORDINATES[i+1];
            const minX = Math.min(p1.x, p2.x);
            const maxX = Math.max(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
        }
        return false;
    }

    private syncStatsToReact() {
        if (!this.callbacks) return;
        this.callbacks.onStatsUpdate({
            money: this.money,
            lives: this.lives,
            wave: this.wave,
            isPlaying: this.isPlaying,
            isGameOver: this.isGameOver
        });
    }

    private updateSelectionInfo() {
        if (!this.callbacks) return;
        if (!this.selectedTowerId) {
            this.callbacks.onSelectionUpdate(null);
            return;
        }
        const t = this.towers.find(t => t.id === this.selectedTowerId);
        if (t) {
            const baseCost = TOWER_STATS[t.type].cost;
            const upgradeCost = Math.floor(baseCost * 1.5);
            const totalInvested = baseCost + (t.level - 1) * upgradeCost;
            const sellPrice = Math.floor(totalInvested * 0.7);

            this.callbacks.onSelectionUpdate({
                type: t.type,
                level: t.level,
                upgradeCost,
                sellPrice
            });
        } else {
            this.callbacks.onSelectionUpdate(null);
        }
    }
}

export const gameEngine = new GameEngine();