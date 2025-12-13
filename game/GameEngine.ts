import { Application, Container, Graphics, Ticker, FederatedPointerEvent } from 'pixi.js';
import { 
  TowerType, EnemyType, SelectedTowerInfo, GameState, MAP_WIDTH, MAP_HEIGHT, CELL_SIZE 
} from '../types';
import { PATH_COORDINATES, TOWER_STATS, WAVES, COLORS, ENEMY_STATS } from '../constants';

// Import from new structure
import { GameEnemy } from './entities/GameEnemy';
import { GameProjectile } from './entities/GameProjectile';
import { GameParticle, GameBeam } from './entities/GameEffects';
import { BaseTower } from './towers/BaseTower';
import { TowerFactory } from './towers/TowerFactory';

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
    private enemies: GameEnemy[] = [];
    private towers: BaseTower[] = [];
    private projectiles: GameProjectile[] = [];
    private particles: GameParticle[] = [];
    private beams: GameBeam[] = [];

    // Layers
    private layers: {
        grid: Container;
        path: Container;
        ground: Container;
        towers: Container;
        enemies: Container;
        projectiles: Container;
        fx: Container;
        ui: Container;
    } | null = null;

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

    private hoverPos: { x: number, y: number } | null = null;
    private tickerFn: ((ticker: Ticker) => void) | null = null;

    constructor() {}

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

    public attach(container: HTMLElement, callbacks: GameCallbacks) {
        if (!this.app) this.initialize();

        this.callbacks = callbacks;

        if (this.app!.view && this.app!.view.parentElement !== container) {
            container.appendChild(this.app!.view as any);
        }

        this.resetScene();

        if (this.tickerFn) this.app!.ticker.remove(this.tickerFn);
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

        this.app.stage.addChild(this.layers.grid);
        this.app.stage.addChild(this.layers.path);
        this.app.stage.addChild(this.layers.ground);
        this.app.stage.addChild(this.layers.towers);
        this.app.stage.addChild(this.layers.enemies);
        this.app.stage.addChild(this.layers.projectiles);
        this.app.stage.addChild(this.layers.fx);
        this.app.stage.addChild(this.layers.ui);

        this.drawGrid();
        this.drawPath();
        
        this.layers.ui.addChild(this.uiIndicators.range);
        this.layers.ui.addChild(this.uiIndicators.hover);
    }

    // --- External Control ---

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
        this.enemies.forEach(e => e.destroy());
        this.towers.forEach(t => t.destroy());
        this.projectiles.forEach(p => p.destroy());
        this.particles.forEach(p => p.destroy());
        this.beams.forEach(b => b.destroy());

        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];
        this.beams = [];

        this.waveState = { waveIndex: 0, enemiesSpawned: 0, lastSpawnTime: 0, waveActive: false };
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
            tower.upgrade();
            this.money -= cost;
            this.createExplosion(tower.x + 0.5, tower.y + 0.5, 0xfbbf24, 15, 1.5);
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

        t.destroy();
        this.towers.splice(idx, 1);
        this.money += refund;
        this.createExplosion(t.x + 0.5, t.y + 0.5, 0xffffff, 10, 1);
        
        if(this.callbacks) this.callbacks.onTowerSelect(null);
        this.selectedTowerId = null;
        this.syncStatsToReact();
        this.updateSelectionInfo();
    }

    // --- Internal Logic ---

    private setupInput() {
        if (!this.app) return;
        this.app.stage.eventMode = 'static'; 
        this.app.stage.hitArea = this.app.screen;

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

        // Check tower click
        const existingTower = this.towers.find(t => t.x === x && t.y === y);
        if (existingTower) {
            this.callbacks.onTowerSelect(existingTower.id);
            this.selectedTowerId = existingTower.id;
            this.updateSelectionInfo();
            this.renderUI();
            return;
        }

        if (this.isPath(x, y)) return;

        if (this.placementModeType) {
            const stats = TOWER_STATS[this.placementModeType];
            if (this.money >= stats.cost) {
                // USE FACTORY HERE
                const newTower = TowerFactory.createTower(
                    this.placementModeType,
                    Math.random().toString(), 
                    x, y
                );
                
                this.towers.push(newTower);
                this.layers!.towers.addChild(newTower.container);
                
                this.money -= stats.cost;
                this.createExplosion(x + 0.5, y + 0.5, 0xffffff, 12, 1);
                
                this.callbacks.onTowerTypeReset();
                this.placementModeType = null;
                this.syncStatsToReact();
            }
        } else {
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

    private updateLogic(dt: number) {
        if (!this.isPlaying || this.isGameOver) return;
        const now = Date.now();

        // 1. Wave Spawning
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
                    
                    this.projectiles.forEach(p => p.destroy());
                    this.beams.forEach(b => b.destroy());
                    this.particles.forEach(p => p.destroy());
                    this.projectiles = [];
                    this.beams = [];
                    this.particles = [];
                    
                    this.syncStatsToReact();
                }
            }
        }

        // 2. Towers Fire (Polymorphic call)
        this.towers.forEach(tower => {
            const shot = tower.checkFire(now, this.enemies);
            if (shot) {
                if (shot.type === 'PROJECTILE' && shot.target) {
                    const p = new GameProjectile(
                        Math.random().toString(), 
                        tower.x + 0.5, tower.y + 0.5, 
                        shot.target, 
                        shot.data.damage
                    );
                    this.projectiles.push(p);
                    this.layers!.projectiles.addChild(p.container);
                } 
                else if (shot.type === 'BEAM' && shot.target) {
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
                    shot.target.takeDamage(shot.data.damage);
                    // Hit effect for beams
                    this.createExplosion(shot.target.x, shot.target.y, shot.data.color, 5, 0.6);
                } 
                else if (shot.type === 'AREA') {
                    // Area Pulse Effect
                    this.createExplosion(tower.x + 0.5, tower.y + 0.5, shot.data.color, 8, 1.2);
                }
            }
        });

        // 3. Projectiles Update
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.markedForDeletion) {
                // Splash Damage Logic
                this.enemies.forEach(e => {
                     const px = p.x; 
                     const py = p.y;
                     if (Math.hypot(e.x - px, e.y - py) <= p.splashRadius) {
                         e.takeDamage(p.damage);
                     }
                });
                
                // Explosion FX
                this.createExplosion(p.x, p.y, 0xf97316, 15, 1.0);
                
                p.destroy();
                this.projectiles.splice(i, 1);
            }
        }

        // 4. Enemies Update
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt);

            if (e.markedForDeletion) {
                this.money += e.reward;
                // Death Explosion
                this.createExplosion(e.x, e.y, ENEMY_STATS[e.type].hexColor, 20, 1.2);
                e.destroy();
                this.enemies.splice(i, 1);
                this.syncStatsToReact();
            } 
            else if (e.pathIndex >= PATH_COORDINATES.length - 1) {
                this.lives = Math.max(0, this.lives - e.damage);
                e.destroy();
                this.enemies.splice(i, 1);
                this.syncStatsToReact();
            }
        }

        // 5. FX Update
        for (let i = this.beams.length - 1; i >= 0; i--) {
            this.beams[i].update(dt);
            if (this.beams[i].markedForDeletion) {
                this.beams[i].destroy();
                this.beams.splice(i, 1);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].markedForDeletion) {
                this.particles[i].destroy();
                this.particles.splice(i, 1);
            }
        }

        if (this.lives <= 0 && !this.isGameOver) {
            this.isGameOver = true;
            this.isPlaying = false;
            this.syncStatsToReact();
        }
    }

    private renderUI() {
        if (!this.layers) return;

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

    private spawnEnemy(type: EnemyType, hpMult: number) {
        const enemy = new GameEnemy(Math.random().toString(), type, hpMult);
        this.enemies.push(enemy);
        this.layers!.enemies.addChild(enemy.container);
    }

    // NEW: Spawns multiple particles for an explosion effect
    private createExplosion(x: number, y: number, color: number, count: number = 8, scale: number = 1) {
        for(let i=0; i<count; i++) {
            const p = new GameParticle(
                Math.random().toString(), 
                x, y, 
                color, 
                { 
                    speed: 0.2 * scale, 
                    size: (2 + Math.random() * 4) * scale, 
                    duration: 30 + Math.random() * 20 
                }
            );
            this.particles.push(p);
            this.layers!.fx.addChild(p.container);
        }
        
        // Optional: Flash center
        const flash = new GameParticle(
             Math.random().toString(),
             x, y,
             0xFFFFFF,
             { speed: 0, size: 10 * scale, duration: 6 }
        );
        this.particles.push(flash);
        this.layers!.fx.addChild(flash.container);
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
