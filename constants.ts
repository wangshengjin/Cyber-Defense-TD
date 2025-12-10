import { Coordinate, EnemyType, TowerType, WaveConfig } from './types';

// Simple winding path
export const PATH_COORDINATES: Coordinate[] = [
  { x: 0, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 8 },
  { x: 9, y: 8 },
  { x: 9, y: 3 },
  { x: 14, y: 3 },
  { x: 14, y: 9 },
  { x: 18, y: 9 },
  { x: 18, y: 5 },
  { x: 20, y: 5 }, // End point (off screen)
];

// Hex colors for Pixi
export const COLORS = {
  GRID: 0x1f2937,
  GRID_BORDER: 0x374151,
  PATH: 0x1e293b,
  PATH_BORDER: 0x334155,
  PATH_DOT: 0x22d3ee,
  HOVER_VALID: 0x22c55e,
  HOVER_INVALID: 0xef4444,
  RANGE_CIRCLE: 0xffffff,
};

export const TOWER_STATS: Record<TowerType, { name: string; cost: number; range: number; damage: number; cooldown: number; color: string; hexColor: number; description: string }> = {
  [TowerType.LASER]: {
    name: '激光塔',
    cost: 100,
    range: 3.5,
    damage: 25,
    cooldown: 600,
    color: 'bg-cyan-500',
    hexColor: 0x06b6d4, // cyan-500
    description: '单体攻击，射速快'
  },
  [TowerType.CANNON]: {
    name: '重炮塔',
    cost: 250,
    range: 3,
    damage: 60,
    cooldown: 1500,
    color: 'bg-orange-500',
    hexColor: 0xf97316, // orange-500
    description: '范围伤害，攻速慢'
  },
  [TowerType.SLOW]: {
    name: '冰霜塔',
    cost: 150,
    range: 2.5,
    damage: 0,
    cooldown: 200,
    color: 'bg-blue-400',
    hexColor: 0x60a5fa, // blue-400
    description: '无伤害，减缓敌人'
  },
  [TowerType.SNIPER]: {
    name: '狙击塔',
    cost: 400,
    range: 8,
    damage: 200,
    cooldown: 3000,
    color: 'bg-fuchsia-600',
    hexColor: 0xc026d3, // fuchsia-600
    description: '超远距离，极高伤害'
  }
};

export const ENEMY_STATS: Record<EnemyType, { hp: number; speed: number; reward: number; color: string; hexColor: number; damage: number }> = {
  [EnemyType.BASIC]: { hp: 50, speed: 2.5, reward: 10, color: '#ef4444', hexColor: 0xef4444, damage: 1 },
  [EnemyType.FAST]: { hp: 30, speed: 4.5, reward: 15, color: '#fbbf24', hexColor: 0xfbbf24, damage: 1 },
  [EnemyType.TANK]: { hp: 200, speed: 1.5, reward: 25, color: '#10b981', hexColor: 0x10b981, damage: 2 },
  [EnemyType.BOSS]: { hp: 1000, speed: 1.0, reward: 100, color: '#8b5cf6', hexColor: 0x8b5cf6, damage: 10 }
};

export const WAVES: WaveConfig[][] = [
  [{ enemyType: EnemyType.BASIC, count: 5, interval: 1200, hpMultiplier: 1 }],
  [{ enemyType: EnemyType.BASIC, count: 10, interval: 1000, hpMultiplier: 1.2 }],
  [{ enemyType: EnemyType.FAST, count: 8, interval: 800, hpMultiplier: 1 }],
  [{ enemyType: EnemyType.TANK, count: 4, interval: 2000, hpMultiplier: 1 }, { enemyType: EnemyType.BASIC, count: 10, interval: 1000, hpMultiplier: 1.5 }],
  [{ enemyType: EnemyType.FAST, count: 15, interval: 500, hpMultiplier: 1.5 }],
  [{ enemyType: EnemyType.TANK, count: 8, interval: 1800, hpMultiplier: 2 }],
  [{ enemyType: EnemyType.BOSS, count: 1, interval: 5000, hpMultiplier: 1 }, { enemyType: EnemyType.BASIC, count: 20, interval: 800, hpMultiplier: 2 }],
];