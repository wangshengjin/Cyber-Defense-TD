extends Node2D

@onready var base_sprite = $BaseSprite
@onready var turret_sprite = $TurretSprite
@onready var range_indicator = $RangeIndicator

func update_type(tower_type: int):
	var scale_factor = float(Constants.CELL_SIZE) / float(AtlasUtils.TILE_SIZE)
	var scale_vec = Vector2(scale_factor, scale_factor)
	
	# 基座 Sprite
	base_sprite.texture = AtlasUtils.get_tile(181)
	base_sprite.scale = scale_vec
	
	# 炮塔 Sprite
	var tile_id = -1
	match tower_type:
		Constants.TowerType.LASER: tile_id = 250
		Constants.TowerType.CANNON: tile_id = 206
		Constants.TowerType.SLOW: tile_id = 203
		Constants.TowerType.SNIPER: tile_id = 205
	
	if tile_id != -1:
		turret_sprite.texture = AtlasUtils.get_tile(tile_id)
		turret_sprite.scale = scale_vec
		turret_sprite.visible = true
	else:
		turret_sprite.visible = false

	# 攻击范围指示器
	if range_indicator:
		range_indicator.radius = Constants.TOWER_STATS[tower_type].range_tiles * Constants.CELL_SIZE
		range_indicator.color = Constants.TOWER_STATS[tower_type].color

func set_valid(is_valid: bool):
	if is_valid:
		var col = Constants.COLORS.HOVER_VALID
		col.a = 0.5
		modulate = col
	else:
		var col = Constants.COLORS.HOVER_INVALID
		col.a = 0.5
		modulate = col
