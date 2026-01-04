extends Node2D

class_name Tower

var type: Constants.TowerType
var stats: Dictionary
var level: int = 1
var cooldown_timer: float = 0.0
var range_area: Area2D
var allies_container: Node # To find targets
var projectiles_container: Node

# Visuals
@onready var visuals = $Visuals
@onready var base_sprite = $Visuals/BaseSprite
@onready var turret_sprite = $Visuals/TurretSprite

func setup(p_type: Constants.TowerType, p_projectiles_container: Node):
	type = p_type
	projectiles_container = p_projectiles_container
	_update_stats()
	
	_create_visuals()
	_create_range_sensor()

func _update_stats():
	var base_stats = Constants.TOWER_STATS[type]
	stats = base_stats.duplicate()
	
	# Level up logic from BALANCE.md
	# Damage = Base * (1 + (Level - 1) * 0.5)
	stats.damage = base_stats.damage * (1 + (level - 1) * 0.5)
	# Range doesn't scale in docs? Only Slow tower slow strength?
	# "Ice tower extra boost slow strength"
	
	stats.current_range = base_stats.range_tiles * Constants.CELL_SIZE

func get_upgrade_cost() -> int:
	var base_cost = Constants.TOWER_STATS[type].cost
	# Upgrade cost is 1.5x initial cost * level? Or fixed? 
	# Based on "Upgrade cost is 1.5x initial cost" and level logic
	# Let's assume linear increase or fixed multiplier. 
	# User code had: total_invest += cost * 1.5. 
	# This implies each upgrade costs 1.5x Base Cost.
	return int(base_cost * 1.5)

func get_sell_value() -> int:
	var base_cost = Constants.TOWER_STATS[type].cost
	var total_invest = base_cost
	for i in range(1, level):
		total_invest += int(base_cost * 1.5)
	
	return int(total_invest * 0.7)

func upgrade():
	level += 1
	_update_stats()
	# Update visual level indicator?
	if range_area:
		var shape = range_area.get_child(0).shape as CircleShape2D
		shape.radius = stats.current_range

func sell():
	GameManager.money += get_sell_value()
	queue_free()

func _create_visuals():
	# Load textures using AtlasUtils (Tilesheet)
	# IDs based on Kenney TD pack
	var tile_id = -1
	match type:
		Constants.TowerType.LASER:
			tile_id = 250
		Constants.TowerType.CANNON:
			tile_id = 206
		Constants.TowerType.SLOW:
			tile_id = 203
		Constants.TowerType.SNIPER:
			tile_id = 205
	
	if tile_id != -1:
		turret_sprite.texture = AtlasUtils.get_tile(tile_id)
	
	# Base sprite (Generic base)
	base_sprite.texture = AtlasUtils.get_tile(181) # 181 is a good base tile
	
	# Scale sprites to match CELL_SIZE based on AtlasUtils.TILE_SIZE
	# TILE_SIZE is 64, CELL_SIZE is 40.
	var scale_factor = float(Constants.CELL_SIZE) / float(AtlasUtils.TILE_SIZE)
	base_sprite.scale = Vector2(scale_factor, scale_factor)
	turret_sprite.scale = Vector2(scale_factor, scale_factor)


func _draw():
	pass # Visuals handled by Sprites now

func _process(delta):
	cooldown_timer -= delta
	if cooldown_timer <= 0:
		var target = _find_target()
		if target:
			# Rotate turret towards target
			# Add 90 degrees (PI/2) offset because Kenney's sprites face Up, but 0 radians is Right
			var target_angle = (target.global_position - global_position).angle() + PI / 2
			
			# Use lerp_angle for smooth rotation handling wraparounds
			turret_sprite.rotation = lerp_angle(turret_sprite.rotation, target_angle, delta * 10.0)
			
			# Fire if aiming roughly at target
			if abs(angle_difference(turret_sprite.rotation, target_angle)) < 0.15 or type == Constants.TowerType.SLOW:
				_fire(target)
				cooldown_timer = stats.cooldown_ms / 1000.0
func _create_range_sensor():
	range_area = Area2D.new()
	var shape = CollisionShape2D.new()
	var circle = CircleShape2D.new()
	circle.radius = stats.current_range
	shape.shape = circle
	range_area.add_child(shape)
	add_child(range_area)

func _find_target() -> Enemy:
	# Get overlapping bodies/areas
	# Assuming range_area monitors enemies
	# But Area2D doesn't detect raw Node2D unless they have PhysicsBody.
	# We added Area2D to Enemy? Not yet. BasicEnemy needs Area2D or CharacterBody2D.
	# Let's assume Enemy is an Area2D (since PathFollow2D doesn't impart physics).
	# Modification needed in Enemy.gd setup: Add Area2D.
	var targets = range_area.get_overlapping_areas()
	var best_target: Enemy = null
	var max_progress = -1.0
	
	for body in targets:
		var enemy = body.get_parent() as Enemy # Assuming Area represents Hitbox child of Enemy
		if enemy:
			if enemy.progress > max_progress:
				max_progress = enemy.progress
				best_target = enemy
	
	return best_target

func _fire(target: Enemy):
	# Type specific firing
	match type:
		Constants.TowerType.LASER, Constants.TowerType.SNIPER:
			# Instant hit / Beam
			_fire_laser(target)
		Constants.TowerType.CANNON:
			_fire_projectile(target)
		Constants.TowerType.SLOW:
			_fire_slow_pulse() # AOE around tower

func _fire_laser(target: Enemy):
	target.take_damage(stats.damage)
	# Draw beam? We need a temporary line node.
	var line = Line2D.new()
	line.add_point(Vector2.ZERO)
	line.add_point(to_local(target.global_position))
	line.width = 2
	line.default_color = stats.color
	add_child(line)
	
	# Tween to fade out
	var tween = create_tween()
	tween.tween_property(line, "modulate:a", 0.0, 0.1)
	tween.tween_callback(line.queue_free)
	
	# Spawn Impact logic (reusing ImpactEffect)
	_spawn_impact_at(target.global_position, stats.color)

func _fire_projectile(target: Enemy):
	var proj_scene = preload("res://scenes/Projectiles/Projectile.tscn")
	var proj = proj_scene.instantiate()
	
	projectiles_container.add_child(proj)
	proj.global_position = global_position
	# Increased speed from 300 to 600 to ensure hits on moving targets
	# Increased splash from 1.5 to 2.0 tiles to compensate for lack of homing
	proj.setup(target, stats.damage, 600.0, stats.color, 2.0, 0, 0)

func _fire_slow_pulse():
	# Apply slow to all in range
	var targets = range_area.get_overlapping_areas()
	for body in targets:
		var enemy = body.get_parent() as Enemy
		if enemy:
			enemy.apply_slow(0.6, 2.0) # 0.6 factor, 2s duration
	
	# Visual ring
	var nova = preload("res://scenes/Effects/NovaEffect.tscn").instantiate()
	nova.global_position = global_position
	nova.modulate = stats.color
	nova.z_index = 15
	get_tree().root.add_child(nova)

func _spawn_impact_at(pos: Vector2, color: Color):
	var impact_scene = preload("res://scenes/Effects/ImpactEffect.tscn")
	var impact = impact_scene.instantiate()
	impact.global_position = pos
	impact.modulate = color
	impact.z_index = 20
	get_tree().root.add_child(impact)
