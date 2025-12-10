import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { 
  TowerType, EnemyType, Enemy, Tower, Projectile, Particle, Beam, 
  MAP_WIDTH, MAP_HEIGHT, CELL_SIZE, SelectedTowerInfo 
} from '../types';
import { PATH_COORDINATES, TOWER_STATS, ENEMY_STATS, WAVES, COLORS } from '../constants';

// --- Types needed for props ---
interface GameStats {
  money: number;
  lives: number;
  wave: number;
  isGameOver: boolean;
  isPlaying: boolean;
}

interface PixiGameProps {
  // Sync state up to React
  onStatsUpdate: (stats: Partial<GameStats>) => void;
  onSelectionUpdate: (info: SelectedTowerInfo | null) => void; // Sync tower info to UI
  // React controlling Game
  gameSpeed: number;
  gameState: GameStats; 
  // User Actions
  selectedTowerType: TowerType | null;
  onSetSelectedTowerType: (type: TowerType | null) => void;
  onSelectTowerId: (id: string | null) => void;
  selectedTowerId: string | null;
  
  // Triggers (using refs to avoid useEffect dependency loops for functions)
  commandRef: React.MutableRefObject<{
      startNextWave: () => void;
      restartGame: () => void;
      upgradeTower: () => void;
      sellTower: () => void;
  }>;
}

const PixiGame: React.FC<PixiGameProps> = ({ 
  onStatsUpdate,
  onSelectionUpdate,
  gameSpeed, 
  gameState,
  selectedTowerType,
  onSetSelectedTowerType,
  onSelectTowerId,
  selectedTowerId,
  commandRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pixi Application Refs
  const appRef = useRef<PIXI.Application | null>(null);
  
  // Game Entities Refs (We keep these out of React State for performance)
  const enemiesRef = useRef<Enemy[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  
  // Wave Management Refs
  const waveStateRef = useRef({
    waveIndex: 0,
    enemiesSpawned: 0,
    lastSpawnTime: 0,
    waveActive: false,
    currentWaveConfig: [] as any[] // Helper to cache current config
  });

  // Visual Cache Maps (ID -> PIXI.Graphics)
  const enemyGraphicsMap = useRef<Map<string, { container: PIXI.Container, body: PIXI.Graphics, hp: PIXI.Graphics }>>(new Map());
  const towerGraphicsMap = useRef<Map<string, PIXI.Container>>(new Map());
  const projectileGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
  const particleGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
  
  // Layers
  const layersRef = useRef<{
      grid: PIXI.Container;
      path: PIXI.Container;
      towers: PIXI.Container;
      enemies: PIXI.Container;
      projectiles: PIXI.Container;
      ui: PIXI.Container;
      fx: PIXI.Container; // Beams/Particles
  } | null>(null);

  // Interaction State
  const hoverRef = useRef<{x: number, y: number} | null>(null);
  const rangeIndicatorRef = useRef<PIXI.Graphics | null>(null);
  const hoverIndicatorRef = useRef<PIXI.Graphics | null>(null);

  // --- Helper Functions ---
  const distance = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);
  
  const createParticle = (x: number, y: number, color: number, count: number = 5) => {
    for(let i=0; i<count; i++) {
        particlesRef.current.push({
            id: Math.random().toString(),
            x, y,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            life: 1.0,
            color: color.toString(16),
            size: Math.random() * 6 + 2
        });
    }
  };

  // Helper to calculate and broadcast selected tower info
  const broadcastSelectionInfo = (towerId: string | null) => {
    if (!towerId) {
        onSelectionUpdate(null);
        return;
    }
    const t = towersRef.current.find(t => t.id === towerId);
    if (t) {
        const baseCost = TOWER_STATS[t.type].cost;
        // Consistent pricing logic
        const upgradeCost = Math.floor(baseCost * 1.5);
        const totalInvested = baseCost + (t.level - 1) * upgradeCost;
        const sellPrice = Math.floor(totalInvested * 0.7);

        onSelectionUpdate({
            type: t.type,
            level: t.level,
            upgradeCost,
            sellPrice
        });
    } else {
        onSelectionUpdate(null);
    }
  };

  // --- Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Pixi
    const app = new PIXI.Application({
      width: MAP_WIDTH * CELL_SIZE,
      height: MAP_HEIGHT * CELL_SIZE,
      backgroundColor: 0x111827,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // 2. Setup Layers
    const gridLayer = new PIXI.Container();
    const pathLayer = new PIXI.Container();
    const towerLayer = new PIXI.Container();
    const enemyLayer = new PIXI.Container();
    const projectileLayer = new PIXI.Container();
    const fxLayer = new PIXI.Container();
    const uiLayer = new PIXI.Container();

    app.stage.addChild(gridLayer);
    app.stage.addChild(pathLayer);
    app.stage.addChild(towerLayer);
    app.stage.addChild(enemyLayer);
    app.stage.addChild(projectileLayer);
    app.stage.addChild(fxLayer);
    app.stage.addChild(uiLayer);

    layersRef.current = {
        grid: gridLayer,
        path: pathLayer,
        towers: towerLayer,
        enemies: enemyLayer,
        projectiles: projectileLayer,
        ui: uiLayer,
        fx: fxLayer
    };

    // 3. Draw Static Grid & Path
    const gridGfx = new PIXI.Graphics();
    gridLayer.addChild(gridGfx);
    
    // Draw Grid
    gridGfx.lineStyle(1, COLORS.GRID_BORDER, 0.2);
    for (let x = 0; x <= MAP_WIDTH; x++) {
        gridGfx.moveTo(x * CELL_SIZE, 0).lineTo(x * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
        gridGfx.moveTo(0, y * CELL_SIZE).lineTo(MAP_WIDTH * CELL_SIZE, y * CELL_SIZE);
    }

    // Draw Path
    const pathGfx = new PIXI.Graphics();
    pathLayer.addChild(pathGfx);
    
    // Draw logic check for grid cells that are path
    const isPath = (x: number, y: number) => {
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
    };

    for(let y=0; y<MAP_HEIGHT; y++) {
        for(let x=0; x<MAP_WIDTH; x++) {
            if (isPath(x, y)) {
                pathGfx.beginFill(COLORS.PATH, 0.5);
                pathGfx.drawRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                pathGfx.endFill();
                // Little path dots
                pathGfx.beginFill(COLORS.PATH_DOT, 0.1);
                pathGfx.drawCircle((x + 0.5) * CELL_SIZE, (y + 0.5) * CELL_SIZE, 4);
                pathGfx.endFill();
            }
        }
    }

    // 4. Setup UI Indicators
    const rangeGfx = new PIXI.Graphics();
    uiLayer.addChild(rangeGfx);
    rangeIndicatorRef.current = rangeGfx;

    const hoverGfx = new PIXI.Graphics();
    uiLayer.addChild(hoverGfx);
    hoverIndicatorRef.current = hoverGfx;

    // 5. Interaction (Mouse Move/Click)
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    
    app.stage.on('pointermove', (e) => {
        const x = Math.floor(e.global.x / CELL_SIZE);
        const y = Math.floor(e.global.y / CELL_SIZE);
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            hoverRef.current = { x, y };
        } else {
            hoverRef.current = null;
        }
    });

    app.stage.on('pointerdown', (e) => {
        const x = Math.floor(e.global.x / CELL_SIZE);
        const y = Math.floor(e.global.y / CELL_SIZE);
        handleTileClick(x, y);
    });

    // 6. Game Loop
    app.ticker.add((delta) => {
        const dtMs = app.ticker.elapsedMS * gameSpeed;
        updateGameLogic(dtMs);
        renderEntities();
        renderUI();
    });

    return () => {
      app.destroy(true, { children: true });
    };
  }, []); // Run once on mount

  // --- Sync Game Speed in Ticker handled by accessing prop ref? No, using closure.
  // We need mutable ref for gameSpeed to be seen by Ticker
  const speedRef = useRef(gameSpeed);
  useEffect(() => { speedRef.current = gameSpeed; }, [gameSpeed]);

  // Sync GameState needed for logic
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Sync Selections
  const selectionRef = useRef({ type: selectedTowerType, id: selectedTowerId });
  useEffect(() => { 
      selectionRef.current = { type: selectedTowerType, id: selectedTowerId };
      // When selection ID changes, update parent
      broadcastSelectionInfo(selectedTowerId);
  }, [selectedTowerType, selectedTowerId]);

  // --- Logic Implementation (Migrated from App.tsx) ---

  const handleTileClick = (x: number, y: number) => {
      if (gameStateRef.current.isGameOver) return;
      
      // Check Path
      const isPath = PATH_COORDINATES.some((p1, i) => {
          if (i === PATH_COORDINATES.length - 1) return false;
          const p2 = PATH_COORDINATES[i+1];
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);
          return x >= minX && x <= maxX && y >= minY && y <= maxY;
      });

      if (isPath) return;

      const existingTower = towersRef.current.find(t => t.x === x && t.y === y);
      
      if (existingTower) {
          onSelectTowerId(existingTower.id);
          return;
      }

      // Build
      if (selectionRef.current.type) {
          const type = selectionRef.current.type;
          const stats = TOWER_STATS[type];
          if (gameStateRef.current.money >= stats.cost) {
              const newTower: Tower = {
                  id: Math.random().toString(),
                  type, x, y, level: 1, lastFired: 0, angle: 0
              };
              towersRef.current.push(newTower);
              onStatsUpdate({ money: gameStateRef.current.money - stats.cost });
              createParticle(x + 0.5, y + 0.5, 0xffffff, 10);
              // Deselect after build (Single Placement)
              onSetSelectedTowerType(null);
          }
      } else {
          onSelectTowerId(null);
      }
  };

  const spawnEnemy = (type: EnemyType, hpMult: number) => {
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
    enemiesRef.current.push(newEnemy);
  };

  const updateGameLogic = (dt: number) => {
      if (!gameStateRef.current.isPlaying || gameStateRef.current.isGameOver) return;
      
      const now = Date.now();
      const gs = gameStateRef.current;
      const speed = speedRef.current;

      // 1. Wave Logic
      if (waveStateRef.current.waveActive) {
          const waveIdx = gs.wave - 1;
          const config = waveIdx < WAVES.length ? WAVES[waveIdx] : [
             { enemyType: EnemyType.TANK, count: 10 + waveIdx, interval: 1000, hpMultiplier: 1 + waveIdx * 0.2 }
          ];
          const subWave = config[Math.min(waveStateRef.current.waveIndex, config.length - 1)];

          if (waveStateRef.current.enemiesSpawned < subWave.count) {
              if (now - waveStateRef.current.lastSpawnTime > subWave.interval / speed) {
                  spawnEnemy(subWave.enemyType, subWave.hpMultiplier);
                  waveStateRef.current.enemiesSpawned++;
                  waveStateRef.current.lastSpawnTime = now;
              }
          } else {
             if (waveStateRef.current.waveIndex < config.length - 1) {
                  waveStateRef.current.waveIndex++;
                  waveStateRef.current.enemiesSpawned = 0;
             } else if (enemiesRef.current.length === 0) {
                 waveStateRef.current.waveActive = false;
                 onStatsUpdate({ isPlaying: false, wave: gs.wave + 1 });
             }
          }
      }

      // 2. Towers
      towersRef.current.forEach(tower => {
         const stats = TOWER_STATS[tower.type];
         if (now - tower.lastFired < stats.cooldown / speed) return;

         let target = null;
         let minDist = Infinity;
         
         for(const e of enemiesRef.current) {
             const d = distance(tower.x, tower.y, e.x, e.y);
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
                 beamsRef.current.push({
                     id: Math.random().toString(),
                     startX: tower.x, startY: tower.y,
                     endX: target.x, endY: target.y,
                     color: stats.hexColor.toString(16).replace('0x', '#'),
                     width: tower.type === TowerType.SNIPER ? 3 : 1.5,
                     life: tower.type === TowerType.SNIPER ? 200 : 150,
                     maxLife: tower.type === TowerType.SNIPER ? 200 : 150
                 });
                 createParticle(target.x, target.y, stats.hexColor, 3);
             } else if (tower.type === TowerType.CANNON) {
                 projectilesRef.current.push({
                     id: Math.random().toString(),
                     x: tower.x, y: tower.y,
                     targetX: target.x, targetY: target.y,
                     speed: 8, damage: dmg, splashRadius: 1.5,
                     color: '#f97316', hit: false
                 });
             } else if (tower.type === TowerType.SLOW) {
                 enemiesRef.current.forEach(e => {
                     if (distance(tower.x, tower.y, e.x, e.y) <= stats.range) {
                         e.frozenFactor = Math.max(0.2, 0.6 - (tower.level - 1) * 0.05);
                     }
                 });
                 // Visual Pulse
                 const circle = new PIXI.Graphics();
                 circle.lineStyle(2, stats.hexColor, 0.5);
                 circle.drawCircle((tower.x + 0.5) * CELL_SIZE, (tower.y + 0.5) * CELL_SIZE, stats.range * CELL_SIZE);
                 layersRef.current?.fx.addChild(circle);
                 createParticle(tower.x, tower.y, stats.hexColor, 2);
             }
         }
      });

      // 3. Projectiles
      for(let i = projectilesRef.current.length - 1; i >= 0; i--) {
          const p = projectilesRef.current[i];
          const angle = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          const move = p.speed * (dt / 1000);
          p.x += Math.cos(angle) * move;
          p.y += Math.sin(angle) * move;

          if (distance(p.x, p.y, p.targetX, p.targetY) < 0.2) {
              enemiesRef.current.forEach(e => {
                  if (distance(p.x, p.y, e.x, e.y) <= p.splashRadius) {
                      e.hp -= p.damage;
                  }
              });
              createParticle(p.x, p.y, 0xf97316, 8);
              projectilesRef.current.splice(i, 1);
          }
      }

      // 4. Enemies
      for(let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const e = enemiesRef.current[i];
          e.frozenFactor = Math.min(e.frozenFactor + 0.01, 1);
          
          const targetNode = PATH_COORDINATES[Math.min(e.pathIndex + 1, PATH_COORDINATES.length - 1)];
          const prevNode = PATH_COORDINATES[e.pathIndex];
          const d = distance(prevNode.x, prevNode.y, targetNode.x, targetNode.y);
          const move = e.speed * e.frozenFactor * (dt / 1000);
          
          e.progress += move / d;
          if (e.progress >= 1) {
              e.pathIndex++;
              e.progress = 0;
              if (e.pathIndex >= PATH_COORDINATES.length - 1) {
                  onStatsUpdate({ lives: Math.max(0, gs.lives - e.damage) });
                  enemiesRef.current.splice(i, 1);
                  continue;
              }
          }
          
          const p1 = PATH_COORDINATES[e.pathIndex];
          const p2 = PATH_COORDINATES[e.pathIndex + 1] || p1;
          e.x = p1.x + (p2.x - p1.x) * e.progress;
          e.y = p1.y + (p2.y - p1.y) * e.progress;

          if (e.hp <= 0) {
              onStatsUpdate({ money: gs.money + e.reward });
              createParticle(e.x, e.y, ENEMY_STATS[e.type].hexColor, 5);
              enemiesRef.current.splice(i, 1);
          }
      }

      // 5. Beams
      for(let i = beamsRef.current.length - 1; i >= 0; i--) {
          beamsRef.current[i].life -= dt;
          if (beamsRef.current[i].life <= 0) beamsRef.current.splice(i, 1);
      }
      
      // 6. Particles
      for(let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
          if (p.life <= 0) particlesRef.current.splice(i, 1);
      }
      
      if (gs.lives <= 0 && !gs.isGameOver) {
          onStatsUpdate({ isGameOver: true, isPlaying: false });
      }
  };

  // --- Rendering (Sync Pixi objects to Ref data) ---
  const renderEntities = () => {
      // 1. Enemies
      const seenEnemies = new Set<string>();
      
      enemiesRef.current.forEach(e => {
          seenEnemies.add(e.id);
          let gfx = enemyGraphicsMap.current.get(e.id);
          if (!gfx) {
              const container = new PIXI.Container();
              const body = new PIXI.Graphics();
              const hp = new PIXI.Graphics();
              container.addChild(body);
              container.addChild(hp);
              layersRef.current?.enemies.addChild(container);
              gfx = { container, body, hp };
              enemyGraphicsMap.current.set(e.id, gfx);
          }
          
          gfx.container.x = e.x * CELL_SIZE;
          gfx.container.y = e.y * CELL_SIZE;
          
          gfx.body.clear();
          const stats = ENEMY_STATS[e.type];
          const color = e.frozenFactor < 1 ? 0x60a5fa : stats.hexColor;
          const radius = e.type === EnemyType.BOSS ? 18 : e.type === EnemyType.TANK ? 14 : 10;
          
          gfx.body.beginFill(color);
          gfx.body.lineStyle(2, 0xffffff);
          gfx.body.drawCircle(0, 0, radius);
          gfx.body.endFill();

          gfx.hp.clear();
          const hpPct = e.hp / e.maxHp;
          gfx.hp.beginFill(0x374151);
          gfx.hp.drawRect(-15, -radius - 8, 30, 4);
          gfx.hp.endFill();
          gfx.hp.beginFill(e.frozenFactor < 1 ? 0x60a5fa : 0x22c55e);
          gfx.hp.drawRect(-15, -radius - 8, 30 * hpPct, 4);
          gfx.hp.endFill();
      });

      for (const [id, gfx] of enemyGraphicsMap.current.entries()) {
          if (!seenEnemies.has(id)) {
              gfx.container.destroy();
              enemyGraphicsMap.current.delete(id);
          }
      }

      // 2. Towers
      towersRef.current.forEach(t => {
          if (!towerGraphicsMap.current.has(t.id)) {
              const container = new PIXI.Container();
              const gfx = new PIXI.Graphics();
              container.addChild(gfx);
              
              const stats = TOWER_STATS[t.type];
              gfx.beginFill(stats.hexColor);
              gfx.lineStyle(2, 0xffffff, 0.5);
              gfx.drawRoundedRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 8);
              gfx.endFill();
              
              gfx.beginFill(0xffffff, 0.3);
              if (t.type === TowerType.LASER) gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 5);
              else if (t.type === TowerType.SNIPER) gfx.drawRect(CELL_SIZE/2 - 2, 5, 4, CELL_SIZE - 10);
              else gfx.drawCircle(CELL_SIZE/2, CELL_SIZE/2, 8);
              gfx.endFill();

              // CORRECT PIXI V7 SYNTAX FOR TEXT (reverted from v8 attempt)
              const text = new PIXI.Text('Lv.' + t.level, new PIXI.TextStyle({
                fontFamily: 'Arial', 
                fontSize: 10, 
                fill: '#ffffff', 
                fontWeight: 'bold',
                stroke: '#000000', 
                strokeThickness: 2
              }));
              text.x = CELL_SIZE - 15;
              text.y = -5;
              container.addChild(text);

              container.x = t.x * CELL_SIZE;
              container.y = t.y * CELL_SIZE;

              layersRef.current?.towers.addChild(container);
              towerGraphicsMap.current.set(t.id, container);
          }
      });
      const currentTowerIds = new Set(towersRef.current.map(t => t.id));
      for(const [id, container] of towerGraphicsMap.current.entries()) {
          if (!currentTowerIds.has(id)) {
              container.destroy();
              towerGraphicsMap.current.delete(id);
          }
      }

      // 3. Projectiles
      const seenProj = new Set<string>();
      projectilesRef.current.forEach(p => {
          seenProj.add(p.id);
          let gfx = projectileGraphicsMap.current.get(p.id);
          if (!gfx) {
              gfx = new PIXI.Graphics();
              layersRef.current?.projectiles.addChild(gfx);
              projectileGraphicsMap.current.set(p.id, gfx);
          }
          gfx.clear();
          gfx.beginFill(0xf97316); 
          gfx.drawCircle(0, 0, 4);
          gfx.endFill();
          gfx.x = p.x * CELL_SIZE;
          gfx.y = p.y * CELL_SIZE;
      });
      for(const [id, gfx] of projectileGraphicsMap.current.entries()) {
          if (!seenProj.has(id)) {
              gfx.destroy();
              projectileGraphicsMap.current.delete(id);
          }
      }

      // 4. FX Layer
      const fx = layersRef.current?.fx;
      if (fx) {
          fx.removeChildren(); 
          const g = new PIXI.Graphics();
          fx.addChild(g);
          
          beamsRef.current.forEach(b => {
             const color = parseInt(b.color.replace('#', ''), 16);
             const alpha = b.life / b.maxLife;
             g.lineStyle(b.width, color, alpha);
             g.moveTo((b.startX + 0.5) * CELL_SIZE, (b.startY + 0.5) * CELL_SIZE);
             g.lineTo((b.endX + 0.5) * CELL_SIZE, (b.endY + 0.5) * CELL_SIZE);
          });

          particlesRef.current.forEach(p => {
              let color = 0xffffff;
              try { color = parseInt(p.color.replace('#', ''), 16); } catch(e){}
              g.beginFill(color, p.life);
              g.drawCircle((p.x * CELL_SIZE), (p.y * CELL_SIZE), p.size * p.life);
              g.endFill();
          });
      }
  };

  const renderUI = () => {
      // 1. Hover Indicator
      if (hoverIndicatorRef.current) {
          hoverIndicatorRef.current.clear();
          if (hoverRef.current) {
              const {x, y} = hoverRef.current;
              const isValid = !PATH_COORDINATES.some(p => Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5); 
              const color = selectionRef.current.type && isValid ? COLORS.HOVER_VALID : COLORS.GRID_BORDER;
              
              hoverIndicatorRef.current.beginFill(color, 0.2);
              hoverIndicatorRef.current.lineStyle(2, color, 0.5);
              hoverIndicatorRef.current.drawRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
              hoverIndicatorRef.current.endFill();
          }
      }

      // 2. Range Indicator
      if (rangeIndicatorRef.current) {
          rangeIndicatorRef.current.clear();
          let range = 0;
          let cx = 0, cy = 0;
          let show = false;

          if (selectionRef.current.id) {
              const t = towersRef.current.find(t => t.id === selectionRef.current.id);
              if (t) {
                  range = TOWER_STATS[t.type].range;
                  cx = (t.x + 0.5) * CELL_SIZE;
                  cy = (t.y + 0.5) * CELL_SIZE;
                  show = true;
              }
          } 
          else if (selectionRef.current.type && hoverRef.current) {
              range = TOWER_STATS[selectionRef.current.type].range;
              cx = (hoverRef.current.x + 0.5) * CELL_SIZE;
              cy = (hoverRef.current.y + 0.5) * CELL_SIZE;
              show = true;
          }

          if (show) {
              rangeIndicatorRef.current.lineStyle(2, COLORS.RANGE_CIRCLE, 0.5);
              rangeIndicatorRef.current.beginFill(COLORS.RANGE_CIRCLE, 0.1);
              rangeIndicatorRef.current.drawCircle(cx, cy, range * CELL_SIZE);
              rangeIndicatorRef.current.endFill();
          }
      }
  };

  // --- External Command Handling ---
  useEffect(() => {
      commandRef.current = {
          startNextWave: () => {
             if (gameStateRef.current.isGameOver) return;
             if (!waveStateRef.current.waveActive) {
                 waveStateRef.current.waveIndex = 0;
                 waveStateRef.current.enemiesSpawned = 0;
                 waveStateRef.current.waveActive = true;
                 onStatsUpdate({ isPlaying: true });
             } else {
                 onStatsUpdate({ isPlaying: !gameStateRef.current.isPlaying });
             }
          },
          restartGame: () => {
             enemiesRef.current = [];
             towersRef.current = [];
             projectilesRef.current = [];
             particlesRef.current = [];
             beamsRef.current = [];
             
             enemyGraphicsMap.current.forEach(g => g.container.destroy());
             enemyGraphicsMap.current.clear();
             towerGraphicsMap.current.forEach(g => g.destroy());
             towerGraphicsMap.current.clear();
             
             waveStateRef.current = {
                 waveIndex: 0, enemiesSpawned: 0, lastSpawnTime: 0, waveActive: false, currentWaveConfig: []
             };
             
             onStatsUpdate({
                 money: 450, lives: 20, wave: 1, isPlaying: false, isGameOver: false
             });
          },
          upgradeTower: () => {
              const id = selectionRef.current.id;
              if (!id) return;
              const idx = towersRef.current.findIndex(t => t.id === id);
              if (idx === -1) return;
              const t = towersRef.current[idx];
              const cost = Math.floor(TOWER_STATS[t.type].cost * 1.5);
              if (gameStateRef.current.money >= cost) {
                  t.level++;
                  onStatsUpdate({ money: gameStateRef.current.money - cost });
                  createParticle(t.x + 0.5, t.y + 0.5, 0xfbbf24, 10);
                  // Force redraw text by removing logic cache
                  const container = towerGraphicsMap.current.get(t.id);
                  if (container) { container.destroy(); towerGraphicsMap.current.delete(t.id); }
                  
                  // Update UI with new costs
                  broadcastSelectionInfo(t.id);
              }
          },
          sellTower: () => {
              const id = selectionRef.current.id;
              if (!id) return;
              const idx = towersRef.current.findIndex(t => t.id === id);
              if (idx === -1) return;
              const t = towersRef.current[idx];
              
              const baseCost = TOWER_STATS[t.type].cost;
              const upgradeCost = Math.floor(baseCost * 1.5);
              const totalInvested = baseCost + (t.level - 1) * upgradeCost;
              const refund = Math.floor(totalInvested * 0.7);

              towersRef.current.splice(idx, 1);
              onStatsUpdate({ money: gameStateRef.current.money + refund });
              onSelectTowerId(null);
              createParticle(t.x + 0.5, t.y + 0.5, 0xffffff, 15);
              
              // Clear Selection UI
              broadcastSelectionInfo(null);
          }
      };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default PixiGame;