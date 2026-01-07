extends Area2D

class_name Projectile

var target: Enemy
var speed: float
var damage: float
var splash_radius: float = 0.0
var slow_factor: float = 0.0
var slow_duration: float = 0.0
var color: Color

var start_position: Vector2
var target_position: Vector2

@onready var sprite = $Sprite2D
@onready var trail = $TrailParticles
@onready var core = $CoreParticles

func setup(p_target: Enemy, p_damage: float, p_speed: float, p_color: Color, p_splash: float = 0.0, p_slow: float = 0.0, p_slow_dur: float = 0.0):
	target = p_target
	damage = p_damage
	speed = p_speed
	color = p_color
	splash_radius = p_splash
	slow_factor = p_slow
	slow_duration = p_slow_dur
	
	# Calculate target position (Linear shot)
	start_position = global_position
	# Predict/Lead or just aim at current pos? Original code aimed at current pos.
	if is_instance_valid(target):
		target_position = target.global_position
	else:
		queue_free()
		return
	
	modulate = color
	z_index = 10
	
	if trail: trail.emitting = false
	if core: core.emitting = false
	
	if sprite:
		# Use Rocket/Missile texture for Cannon
		# Tile ID 251 is "Missile small", 252 is "Missile Large"
		sprite.texture = AtlasUtils.get_tile(251)
		
		# Scale to match CELL_SIZE
		# TILE_SIZE is 64, CELL_SIZE is 40.
		# Rocket is tall, let's keep it visible.
		var scale_factor = float(Constants.CELL_SIZE) / float(AtlasUtils.TILE_SIZE)
		sprite.scale = Vector2(scale_factor, scale_factor) * 0.8
		sprite.visible = true
	
	# Initial rotation
	var direction = (target_position - global_position).normalized()
	rotation = direction.angle() + PI / 2

func _physics_process(delta):
	# Linear Movement: Move towards target_position
	var direction = (target_position - global_position).normalized()
	position += direction * speed * delta
	# Fixed rotation set in setup, linear movement doesn't curve
	
	# Check distance to DESTINATION, not target entity
	if global_position.distance_to(target_position) < 10.0:
		_on_hit()

func _on_hit():
	AudioManager.play_sfx("sfx_explosion")
	print("Projectile Hit!")
	if splash_radius > 0:
		_do_splash_damage()
	else:
		if is_instance_valid(target):
			target.take_damage(damage)
			if slow_factor > 0:
				target.apply_slow(slow_factor, slow_duration)
	
	_spawn_impact()
	queue_free()

func _do_splash_damage():
	# Splash damage should look for enemies in Path2D since they are PathFollow2D
	var enemies_container = null
	
	# Attempt to find Path2D
	if get_node_or_null("/root/Game/Path2D"):
		enemies_container = get_node("/root/Game/Path2D")
	else:
		# Fallback search
		enemies_container = get_tree().root.find_child("Path2D", true, false)
		
	if enemies_container:
		var count = 0
		var min_dist = 99999.0
		for child in enemies_container.get_children():
			if child is Enemy:
				var dist = child.global_position.distance_to(global_position)
				if dist < min_dist: min_dist = dist
				
				var radius_px = splash_radius * Constants.CELL_SIZE
				if dist <= radius_px:
					child.take_damage(damage)
					count += 1
		print("Splash Damage: Hit ", count, " enemies. Radius=", splash_radius * Constants.CELL_SIZE, " Nearest=", min_dist)
	else:
		print("Error: Could not find Path2D node for splash damage")

func _spawn_impact():
	var impact_scene = load("res://scenes/Effects/ImpactEffect.tscn")
	if impact_scene:
		var impact = impact_scene.instantiate()
		impact.global_position = global_position
		impact.modulate = color
		impact.z_index = 20 # High Z for explosions
		
		# Robustly add to scene root
		var root = get_tree().root.get_child(0) # Usually the main scene
		if root:
			root.call_deferred("add_child", impact)
		else:
			get_tree().root.call_deferred("add_child", impact)
		
		print("Spawned Impact at ", global_position)
