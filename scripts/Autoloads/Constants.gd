extends Node

# Port from types.ts
enum TowerType {
	LASER,
	CANNON,
	SLOW,
	SNIPER
}

enum EnemyType {
	BASIC,
	FAST,
	TANK,
	BOSS
}

# Port from constants.ts
const MAP_WIDTH = 20
const MAP_HEIGHT = 12
const CELL_SIZE = 40

const PATH_COORDINATES = [
	Vector2i(0, 1),
	Vector2i(4, 1),
	Vector2i(4, 8),
	Vector2i(9, 8),
	Vector2i(9, 3),
	Vector2i(14, 3),
	Vector2i(14, 9),
	Vector2i(18, 9),
	Vector2i(18, 5),
	Vector2i(20, 5), # End point
]

const COLORS = {
	"GRID": Color("1f2937"),
	"GRID_BORDER": Color("374151"),
	"PATH": Color("1e293b"),
	"PATH_BORDER": Color("334155"),
	"PATH_DOT": Color("22d3ee"),
	"HOVER_VALID": Color("22c55e"),
	"HOVER_INVALID": Color("ef4444"),
	"RANGE_CIRCLE": Color("ffffff"),
}

const TOWER_STATS = {
	TowerType.LASER: {
		"name": "激光塔",
		"cost": 100,
		"range_tiles": 3.5,
		"damage": 25,
		"cooldown_ms": 600,
		"color": Color("06b6d4"),
		"description": "单体攻击，射速快"
	},
	TowerType.CANNON: {
		"name": "重炮塔",
		"cost": 250,
		"range_tiles": 3.0,
		"damage": 60,
		"cooldown_ms": 1500,
		"color": Color("f97316"),
		"description": "范围伤害，攻速慢"
	},
	TowerType.SLOW: {
		"name": "冰霜塔",
		"cost": 150,
		"range_tiles": 2.5,
		"damage": 0,
		"cooldown_ms": 200,
		"color": Color("60a5fa"),
		"description": "无伤害，减缓敌人"
	},
	TowerType.SNIPER: {
		"name": "狙击塔",
		"cost": 400,
		"range_tiles": 8.0,
		"damage": 220,
		"cooldown_ms": 3000,
		"color": Color("c026d3"),
		"description": "超远距离，极高伤害"
	}
}

const ENEMY_STATS = {
	EnemyType.BASIC: {"hp": 50, "speed": 2.5, "reward": 10, "color": Color("ef4444"), "damage": 1},
	EnemyType.FAST: {"hp": 35, "speed": 4.5, "reward": 12, "color": Color("f59e0b"), "damage": 1},
	EnemyType.TANK: {"hp": 220, "speed": 1.5, "reward": 25, "color": Color("10b981"), "damage": 2},
	EnemyType.BOSS: {"hp": 1200, "speed": 1.0, "reward": 150, "color": Color("8b5cf6"), "damage": 10}
}

# Speed in Pixels/Sec = Stat Value * CELL_SIZE
# BASIC: 2.5 * 40 = 100 px/sec. Crosses 20-tile map in 8 seconds.
const SPEED_MULTIPLIER = 40.0

const INITIAL_MONEY = 450
const INITIAL_LIVES = 20

# WAVES config - Manual first 10 waves
const WAVES = [
	{"enemyType": EnemyType.BASIC, "count": 8, "interval": 1000, "hpMultiplier": 1.0},
	{"enemyType": EnemyType.BASIC, "count": 12, "interval": 900, "hpMultiplier": 1.1},
	{"enemyType": EnemyType.FAST, "count": 10, "interval": 600, "hpMultiplier": 1.0},
	{"enemyType": EnemyType.TANK, "count": 5, "interval": 2000, "hpMultiplier": 1.0},
	{"enemyType": EnemyType.FAST, "count": 15, "interval": 400, "hpMultiplier": 1.2},
	{"enemyType": EnemyType.BASIC, "count": 20, "interval": 800, "hpMultiplier": 1.5},
	{"enemyType": EnemyType.TANK, "count": 10, "interval": 1500, "hpMultiplier": 1.5},
	{"enemyType": EnemyType.FAST, "count": 25, "interval": 300, "hpMultiplier": 1.3},
	{"enemyType": EnemyType.BASIC, "count": 30, "interval": 600, "hpMultiplier": 2.0},
	{"enemyType": EnemyType.BOSS, "count": 1, "interval": 5000, "hpMultiplier": 1.5},
]
