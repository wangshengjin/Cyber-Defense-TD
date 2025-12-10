export enum TowerType {
  LASER = 'LASER',   // Single target, high damage, fast
  CANNON = 'CANNON', // AOE, medium damage, slow
  SLOW = 'SLOW',     // No damage, slows enemies in range
  SNIPER = 'SNIPER'  // Infinite range (mostly), very high damage, very slow
}

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS'
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  pathIndex: number; // Current target node index
  progress: number; // 0.0 to 1.0 between current and next node
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  frozenFactor: number; // 1.0 = normal, 0.5 = half speed
  reward: number;
  damage: number; // Damage to player base
}

export interface Tower {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  level: number;
  lastFired: number; // Timestamp
  targetId?: string; // For laser/sniper drawing
  angle: number; // For rotation visualization
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  splashRadius: number; // 0 for single target
  color: string;
  hit: boolean;
}

export interface Beam {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  width: number;
  life: number; // Current life in ms
  maxLife: number; // Total duration in ms
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0.0 to 1.0
  color: string;
  size: number;
}

export interface WaveConfig {
  enemyType: EnemyType;
  count: number;
  interval: number; // ms between spawns
  hpMultiplier: number;
}

export interface GameState {
  money: number;
  lives: number;
  wave: number;
  isPlaying: boolean;
  isGameOver: boolean;
  gameSpeed: number;
}

export interface SelectedTowerInfo {
  type: TowerType;
  level: number;
  upgradeCost: number;
  sellPrice: number;
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 12;
export const CELL_SIZE = 40; // Pixels (reference for rendering logic)