import { Application, Container, Graphics, Text, Ticker, FederatedPointerEvent } from 'pixi.js';
import { 
  TowerType, EnemyType, Enemy, Tower, Projectile, Particle, Beam, 
  MAP_WIDTH, MAP_HEIGHT, CELL_SIZE, SelectedTowerInfo, GameState 
} from '../types';
import { PATH_COORDINATES, TOWER_STATS, ENEMY_STATS, WAVES, COLORS } from '../constants';

// --- Singleton Helpers ---
// In PixiJS v7, HMR is much more stable. We can simply use a global key to store the instance.
const APP_KEY = '__CYBER_TD_PIXI_APP_V7__';

interface GameCallbacks {
    onStatsUpdate: (stats: Partial<GameState>) => void;
    onSelectionUpdate: (info: SelectedTowerInfo | null) => void;
    onTowerSelect: (id: string | null) => void;
    onTowerTypeReset: () => void;
}

export class GameEngine {
    public app: Application | null = null;
    private callbacks: GameCallbacks | null = null;
    public isInitialized = false;

    // Game State
    private money: number = 450;
    private lives: number = 20;
    private wave: number = 1;
    private isPlaying: boolean = false;
    private isGameOver: boolean = false;
    private gameSpeed: number = 1;

    // Selection State
    private placementModeType: TowerType | null = null;
    private selectedTowerId: string | null = null;

    // Entities
    private enemies: Enemy[] = [];
    private towers: Tower[] = [];
    private projectiles: Projectile[] = [];
    private particles: Particle[] = [];
    private beams: Beam[] = [];

    // Layers
    private layers: {
        grid: Container;
        path: Container;
        towers: Container;
        enemies: Container;
        projectiles: Container;
        ui: Container;
        fx: Container;
    } | null = null;

    // Caches
    private graphicsCache = {
        enemies: new Map<string, { container: Container, body: Graphics, hp: Graphics }>(),
        towers: new Map<string, Container>(),
        projectiles: new Map<string, Graphics>(),
    };

    private uiIndicators = {
        range: new Graphics(),
        hover: new Graphics(),
    };

    // Wave Management
    private waveState = {
        waveIndex: 0,
        enemiesSpawned: 0,
        lastSpawnTime: 0,
        waveActive: false,
    };

    // Input & Loop
    private hoverPos: { x: number, y: number } | null = null;
    private tickerFn: ((delta: number) => void) | null = null;

    constructor() {}

    /**
     * Initializes the Pixi Application (v7 style).
     */
    public initialize() {
        if (this.isInitialized && this.app) return;

        const w = window as any;
        
        // Check for existing instance (HMR)
        if (w[APP_KEY]) {
            this.app = w[APP_KEY];
            this.isInitialized = true;
            return;
        }

        // v7 Initialization is synchronous via constructor options
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

    public attach(container: HTMLElement, callbacks: GameCallbacks) {
        if (!this.app) this.initialize(); // Ensure init

        this.callbacks = callbacks;

        // Ensure canvas is attached
        if (this.app!.view && this.app!.view.parentElement !== container) {
            container.appendChild(this.app!.view as any);
        }

        this.resetScene();

        // Ticker management
        // v7 Ticker callback receives 'delta' (frame lag), not the Ticker object itself
        if (this.tickerFn) this.app!.ticker.remove(this.tickerFn);
        // Fix for v7 Ticker: The argument passed is usually 'delta' (scalar), but type defs might vary.
        // We use delta directly for game loop logic.
        this.tickerFn = (delta: number) => this.gameLoop(delta);
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

        // Clean up listeners
        this.app.stage.removeAllListeners();

        // Remove Canvas from DOM
        if (this.app.view && (this.app.view as any).parentElement) {
            (this.app.view as any).parentElement.removeChild(this.app.view);
        }

        this.callbacks = null;
    }

    private resetScene() {
        if (!this.app || !this.app.stage) return;
        
        this.app.stage.removeChildren();

        // Re-initialize Layers
        this.layers = {
            grid: new Container(),
            path: new Container(),
            towers: new Container(),
            enemies: new Container(),
            projectiles: new Container(),
            fx: new Container(),
            ui: new Container(),
        };

        Object.values(this.layers).forEach(l => this.app!.stage.addChild(l));

        this.drawGrid();
        this.drawPath();
        
        this.layers.ui.addChild(this.uiIndicators.range);
        this.layers.ui.addChild(this.uiIndicators.hover);

        this.graphicsCache.enemies.clear();
        this.graphicsCache.towers.clear();
        this.graphicsCache.projectiles.clear();
    }

    // --- External Control ---

    public setGameSpeed(speed: number) {
        this.gameSpeed = speed;
    }

    public setPlacementMode(type: TowerType | null) {
        this.placementModeType = type;
        this.selectedTowerId = null; 
        this.updateSelectionInfo();
    }

    public setSelectedTowerId(id: string | null) {
        this.selectedTowerId = id;
        if (id) this.placementModeType = null;
        this.updateSelectionInfo();
    }

    public startNextWave() {
        if (this.isGameOver) return;
        
        if (!this.waveState.waveActive) {
            this.waveState.waveIndex = 0;
            this.waveState.enemiesSpawned = 0;
            this.waveState.waveActive = true;
            this.isPlaying = true;
            this.syncStatsToReact();
        } else {
            this.isPlaying = !this.isPlaying;
            this.syncStatsToReact();
        }
    }

    public restartGame() {
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];
        this.beams = [];
        
        this.graphicsCache.enemies.forEach(g => g.container.destroy());
        this.graphicsCache.enemies.clear();
        this.graphicsCache.towers.forEach(g => g.destroy());
        this.graphicsCache.towers.clear();
        this.graphicsCache.projectiles.forEach(g => g.destroy());
        this.graphicsCache.projectiles.clear();

        this.waveState = {
            waveIndex: 0, enemiesSpawned: 0, lastSpawnTime: 0, waveActive: false
        };
        
        this.money = 450;
        this.lives = 20;
        this.wave = 1;
        this.isPlaying = false;
        this.isGameOver = false;

        this.syncStatsToReact();
        this.updateSelectionInfo();
    }

    public upgradeTower() {
        if (!this.selectedTowerId) return;
        const tower = this.towers.find(t => t.id === this.selectedTowerId);
        if (!tower) return;

        const cost = Math.floor(TOWER_STATS[tower.type].cost * 1.5);
        if (this.money >= cost) {
            tower.level++;
            this.money -= cost;
            this.createParticle(tower.x + 0.5, tower.y + 0.5, 0xfbbf24, 10);
            
            const container = this.graphicsCache.towers.get(tower.id);
            if (container) { container.destroy(); this.graphicsCache.towers.delete(tower.id); }

            this.syncStatsToReact();
            this.updateSelectionInfo();
        }
    }

    public sellTower() {
        if (!this.selectedTowerId) return;
        const idx = this.towers.findIndex(t => t.id === this.selectedTowerId);
        if (idx === -1) return;
        
        const t = this.towers[idx];
        const baseCost = TOWER_STATS[t.type].cost;
        const upgradeCost = Math.floor(baseCost * 1.5);
        const totalInvested = baseCost + (t.level - 1) * upgradeCost;
        const refund = Math.floor(totalInvested * 0.7);

        this.towers.splice(idx, 1);
        this.money += refund;
        this.createParticle(t.x + 0.5, t.y + 0.5, 0xffffff, 15);
        
        if(this.callbacks) this.callbacks.onTowerSelect(null);
        this.selectedTowerId = null;
        this.syncStatsToReact();
        this.updateSelectionInfo();
    }

    // --- Internal Logic ---

    private setupInput() {
        if (!this.app) return;

        // Pixi v7 interactive mode
        this.app.stage.eventMode = 'static'; 
        this.app.stage.hitArea = this.app.screen;

        const onPointerMove = (e: FederatedPointerEvent) => {
            const x = Math.floor(e.global.x / CELL_SIZE);
            const y = Math.floor(e.global.y / CELL_SIZE);
            if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                this.hoverPos = { x, y };
            } else {
                this.hoverPos = null;
            }
        };

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

        const existingTower = this.towers.find(t => t.x === x && t.y === y);
        if (existingTower) {
            this.callbacks.onTowerSelect(existingTower.id);
            this.selectedTowerId = existingTower.id;
            this.updateSelectionInfo();
            return;
        }

        if (this.isPath(x, y)) return;

        if (this.placementModeType) {
            const stats = TOWER_STATS[this.placementModeType];
            if (this.money >= stats.cost) {
                const newTower: Tower = {
                    id: Math.random().toString(),
                    type: this.placementModeType,
                    x, y, level: 1, lastFired: 0, angle: 0
                };
                this.towers.push(newTower);
                this.money -= stats.cost;
                this.createParticle(x + 0.5, y + 0.5, 0xffffff, 10);
                
                this.callbacks.onTowerTypeReset();
                this.placementModeType = null;
                this.syncStatsToReact();
            }
        } else {
            this.callbacks.onTowerSelect(null);
            this.selectedTowerId = null;
            this.updateSelectionInfo();
        }
    }

    private gameLoop(delta: number) {
        // v7: ticker.elapsedMS is available on the app.ticker instance
        const dtMs = this.app!.ticker.elapsedMS * this.gameSpeed;
        this.updateLogic(dtMs);
        this.render();
    }

    private updateLogic(dt: number) {
        if (!this.isPlaying || this.isGameOver) return;
        const now = Date.now();

        if (this.waveState.waveActive) {
            const waveIdx = this.wave - 1;
            const config = waveIdx < WAVES.length ? WAVES[waveIdx] : [
                { enemyType: EnemyType.TANK, count: 10 + waveIdx, interval: 1000, hpMultiplier: 1 + waveIdx * 0.2 }
            ];
            const subWave = config[Math.min(this.waveState.waveIndex, config.length - 1)];

            if (this.waveState.enemiesSpawned < subWave.count) {
                if (now - this.waveState.lastSpawnTime > subWave.interval / this.gameSpeed) {
                    this.spawnEnemy(subWave.enemyType, subWave.hpMultiplier);
                    this.waveState.enemiesSpawned++;
                    this.waveState.lastSpawnTime = now;
                }
            } else {
                if (this.waveState.waveIndex < config.length - 1) {
                    this.waveState.waveIndex++;
                    this.waveState.enemiesSpawned = 0;
                } else if (this.enemies.length === 0) {
                    this.waveState.waveActive = false;
                    this.isPlaying = false;
                    this.wave++;
                    this.projectiles = [];
                    this.beams = [];
                    this.particles = []; // Clear particles so they don't freeze on screen
                    this.syncStatsToReact();
                }
            }
        }

        this.towers.forEach(tower => {
            const stats = TOWER_STATS[tower.type];
            if (now - tower.lastFired < stats.cooldown / this.gameSpeed) return;

            let target = null;
            let minDist = Infinity;

            for (const e of this.enemies) {
                const d = this.distance(tower.x, tower.y, e.x, e.y);
                if (d <= stats.range && d < minDist) {
                    minDist = d;
                    target = e;
                }
            }

            if (target) {
                tower.lastFired = now;
                const damageMult = 1 + (tower.level - 1) * 0.5;
                const dmg = stats.damage * damageMult;

                if (tower.type === TowerType.LASER || tower.type === TowerType.SNIPER) {
                    target.hp -= dmg;
                    this.beams.push({
                        id: Math.random().toString(),
                        startX: tower.x, startY: tower.y,
                        endX: target.x, endY: target.y,
                        color: '#' + stats.hexColor.toString(16).padStart(6, '0'),
                        width: tower.type === TowerType.SNIPER ? 3 : 1.5,
                        life: tower.type === TowerType.SNIPER ? 200 : 150,
                        maxLife: tower.type === TowerType.SNIPER ? 200 : 150
                    });
                    this.createParticle(target.x, target.y, stats.hexColor, 3);
                } else if (tower.type === TowerType.CANNON) {
                    this.projectiles.push({
                        id: Math.random().toString(),
                        x: tower.x, y: tower.y,
                        targetX: target.x, targetY: target.y,
                        speed: 8, damage: dmg, splashRadius: 1.5,
                        color: '#f97316', hit: false
                    });
                } else if (tower.type === TowerType.SLOW) {
                    this.enemies.forEach(e => {
                        if (this.distance(tower.x, tower.y, e.x, e.y) <= stats.range) {
                            e.frozenFactor = Math.max(0.2, 0.6 - (tower.level - 1) * 0.05);
                        }
                    });
                    const circle = new Graphics();
                    circle.lineStyle(2, stats.hexColor, 0.5);
                    circle.drawCircle((tower.x + 0.5) * CELL_SIZE, (tower.y + 0.5) * CELL_SIZE, stats.range * CELL_SIZE);
                    this.layers?.fx.addChild(circle);
                    this.createParticle(tower.x, tower.y, stats.hexColor, 2);
                }
            }
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
            const move = p.speed * (dt / 1000);
            p.x += Math.cos(angle) * move;
            p.y += Math.sin(angle) * move;

            if (this.distance(p.x, p.y, p.targetX, p.targetY) < 0.2) {
                this.enemies.forEach(e => {
                    if (this.distance(p.x, p.y, e.x, e.y) <= p.splashRadius) {
                        e.hp -= p.damage;
                    }
                });
                this.createParticle(p.x, p.y, 0xf97316, 8);
                this.projectiles.splice(i, 1);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.frozenFactor = Math.min(e.frozenFactor + 0.01, 1);

            const targetNode = PATH_COORDINATES[Math.min(e.pathIndex + 1, PATH_COORDINATES.length - 1)];
            const prevNode = PATH_COORDINATES[e.pathIndex];
            const d = this.distance(prevNode.x, prevNode.y, targetNode.x, targetNode.y);
            const move = e.speed * e.frozenFactor * (dt / 1000);

            e.progress += move / d;
            if (e.progress >= 1) {
                e.pathIndex++;
                e.progress = 0;
                if (e.pathIndex >= PATH_COORDINATES.length - 1) {
                    this.lives = Math.max(0, this.lives - e.damage);
                    this.syncStatsToReact();
                    this.enemies.splice(i, 1);
                    continue;
                }
            }

            const p1 = PATH_COORDINATES[e.pathIndex];
            const p2 = PATH_COORDINATES[e.pathIndex + 1] || p1;
            e.x = p1.x + (p2.x - p1.x) * e.progress;
            e.y = p1.y + (p2.y - p1.y) * e.progress;

            if (e.hp <= 0) {
                this.money += e.reward;
                this.syncStatsToReact();
                this.createParticle(e.x, e.y, ENEMY_STATS[e.type].hexColor, 5);
                this.enemies.splice(i, 1);
            }
        }

        for (let i = this.beams.length - 1; i >= 0; i--) {
            this.beams[i].life -= dt;
            if (this.beams[i].life <= 0) this.beams.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.lives <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            this.isPlaying = false;
            this.syncStatsToReact();
        }
    }

    private render() {
        if (!this.layers) return;

        // Render Enemies
        const seenEnemies = new Set<string>();
        this.enemies.forEach(e => {
            seenEnemies.add(e.id);
            let gfx = this.graphicsCache.enemies.get(e.id);
            if (!gfx) {
                const container = new Container();
                const body = new Graphics();
                const hp = new Graphics();
                container.addChild(body);
                container.addChild(hp);
                this.layers!.enemies.addChild(container);
                gfx = { container, body, hp };
                this.graphicsCache.enemies.set(e.id, gfx);
            }

            gfx.container.x = e.x * CELL_SIZE;
            gfx.container.y = e.y * CELL_SIZE;

            // v7 API: clear(), lineStyle(), beginFill(), draw(), endFill()
            gfx.body.clear();
            const stats = ENEMY_STATS[e.type];
            const color = e.frozenFactor < 1 ? 0x60a5fa : stats.hexColor;
            const radius = e.type === EnemyType.BOSS ? 18 : e.type === EnemyType.TANK ? 14 : 10;
            
            gfx.body.lineStyle(2, 0xffffff);
            gfx.body.beginFill(color);
            gfx.body.drawCircle(0, 0, radius);
            gfx.body.endFill();

            gfx.hp.clear();
            const hpPct = Math.max(0, e.hp / e.maxHp);
            gfx.hp.beginFill(0x374151);
            gfx.hp.drawRect(-15, -radius - 8, 30, 4);
            gfx.hp.endFill();
            
            gfx.hp.beginFill(e.frozenFactor < 1 ? 0x60a5fa : 0x22c55e);
            gfx.hp.drawRect(-15, -radius - 8, 30 * hpPct, 4);
            gfx.hp.endFill();
        });

        for (const [id, gfx] of this.graphicsCache.enemies.entries()) {
            if (!seenEnemies.has(id)) {
                gfx.container.destroy();
                this.graphicsCache.enemies.delete(id);
            }
        }

        // Render Towers
        this.towers.forEach(t => {
            if (!this.graphicsCache.towers.has(t.id)) {
                const container = new Container();
                const gfx = new Graphics();
                container.addChild(gfx);
                
                const stats = TOWER_STATS[t.type];
                
                // Base
                gfx.lineStyle(2, 0xffffff, 0.5);
                gfx.beginFill(stats.hexColor);
                gfx.drawRoundedRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
                gfx.endFill();
                
                // Icon
                gfx.beginFill(0xffffff, 0.3);
                if (t.type === TowerType.LASER) gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 5);
                else if (t.type === TowerType.SNIPER) gfx.drawRect(CELL_SIZE/2 - 2, 5, 4, CELL_SIZE - 10);
                else gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 8);
                gfx.endFill();

                // Text v7 style (Corrected)
                const text = new Text('Lv.' + t.level, {
                    fontFamily: 'Arial', 
                    fontSize: 10, 
                    fill: '#ffffff',
                    fontWeight: 'bold', 
                    stroke: '#000000', 
                    strokeThickness: 2
                } as any);
                text.x = CELL_SIZE - 25;
                text.y = -5;
                container.addChild(text);

                container.x = t.x * CELL_SIZE;
                container.y = t.y * CELL_SIZE;

                this.layers!.towers.addChild(container);
                this.graphicsCache.towers.set(t.id, container);
            }
        });
        
        const currentTowerIds = new Set(this.towers.map(t => t.id));
        for(const [id, container] of this.graphicsCache.towers.entries()) {
            if (!currentTowerIds.has(id)) {
                container.destroy();
                this.graphicsCache.towers.delete(id);
            }
        }

        // Render Projectiles
        const seenProj = new Set<string>();
        this.projectiles.forEach(p => {
            seenProj.add(p.id);
            let gfx = this.graphicsCache.projectiles.get(p.id);
            if (!gfx) {
                gfx = new Graphics();
                this.layers!.projectiles.addChild(gfx);
                this.graphicsCache.projectiles.set(p.id, gfx);
            }
            gfx.clear();
            gfx.beginFill(0xf97316);
            gfx.drawCircle(0, 0, 4);
            gfx.endFill();
            gfx.x = p.x * CELL_SIZE;
            gfx.y = p.y * CELL_SIZE;
        });
        for(const [id, gfx] of this.graphicsCache.projectiles.entries()) {
            if (!seenProj.has(id)) {
                gfx.destroy();
                this.graphicsCache.projectiles.delete(id);
            }
        }

        // Render FX (Beams & Particles)
        this.layers.fx.removeChildren();
        const fxGfx = new Graphics();
        this.layers.fx.addChild(fxGfx);

        this.beams.forEach(b => {
             const colorStr = b.color.replace('#', '');
             const color = parseInt(colorStr, 16);
             const alpha = b.life / b.maxLife;
             fxGfx.lineStyle(b.width, color, alpha);
             fxGfx.moveTo((b.startX + 0.5) * CELL_SIZE, (b.startY + 0.5) * CELL_SIZE);
             fxGfx.lineTo((b.endX + 0.5) * CELL_SIZE, (b.endY + 0.5) * CELL_SIZE);
        });

        this.particles.forEach(p => {
            let color = 0xffffff;
            try { color = parseInt(p.color.replace('#', ''), 16); } catch(e){}
            fxGfx.lineStyle(0);
            fxGfx.beginFill(color, p.life);
            fxGfx.drawCircle((p.x * CELL_SIZE), (p.y * CELL_SIZE), p.size * p.life);
            fxGfx.endFill();
        });

        this.renderUI();
    }

    private renderUI() {
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
        const dotGfx = new Graphics();
        for(let y=0; y<MAP_HEIGHT; y++) {
            for(let x=0; x<MAP_WIDTH; x++) {
                if (this.isPath(x, y)) {
                    gfx.beginFill(COLORS.PATH, 0.5);
                    gfx.drawRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    gfx.endFill();
                    
                    dotGfx.beginFill(COLORS.PATH_DOT, 0.1);
                    dotGfx.drawCircle((x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE, 4);
                    dotGfx.endFill();
                }
            }
        }
        this.layers!.path.addChild(gfx);
        this.layers!.path.addChild(dotGfx);
    }

    private isPath(x: number, y: number): boolean {
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

    private spawnEnemy(type: EnemyType, hpMult: number) {
        const stats = ENEMY_STATS[type];
        const newEnemy: Enemy = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            pathIndex: 0,
            progress: 0,
            x: PATH_COORDINATES[0].x,
            y: PATH_COORDINATES[0].y,
            hp: stats.hp * hpMult,
            maxHp: stats.hp * hpMult,
            speed: stats.speed,
            frozenFactor: 1,
            reward: stats.reward,
            damage: stats.damage
        };
        this.enemies.push(newEnemy);
    }

    private createParticle(x: number, y: number, color: number, count: number = 5) {
        for(let i=0; i<count; i++) {
            this.particles.push({
                id: Math.random().toString(),
                x, y,
                vx: (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                life: 1.0,
                color: color.toString(16),
                size: Math.random() * 6 + 2
            });
        }
    }

    private distance(x1: number, y1: number, x2: number, y2: number) {
        return Math.hypot(x2 - x1, y2 - y1);
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

// Export the singleton instance
export const gameEngine = new GameEngine();