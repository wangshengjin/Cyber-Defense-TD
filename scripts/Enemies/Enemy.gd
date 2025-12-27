extends PathFollow2D

class_name Enemy

signal died(reward: int)
signal reached_end(damage: int)

var type: Constants.EnemyType
var stats: Dictionary
var hp: float
var max_hp: float
var speed: float
var base_speed: float
var damage: int
var frozen_factor: float = 1.0
var frozen_timer: float = 0.0

# Visuals
var sprite: ColorRect
var hp_bar_bg: ColorRect
var hp_bar_fill: ColorRect

func setup(enemy_type: Constants.EnemyType, wave_hp_multiplier: float):
	type = enemy_type
	stats = Constants.ENEMY_STATS[type]
	
	hp = stats.hp * wave_hp_multiplier
	max_hp = hp
	base_speed = stats.speed * Constants.SPEED_MULTIPLIER
	
	damage = stats.damage
	
	# Create visuals
	_create_visuals()
	
	# Random offset to avoid stacking perfectly? PathFollow2D handles this if we spawn with delays.
	loop = false
	rotates = false

func _create_visuals():
	# Visuals are handled in _draw
	queue_redraw()
	
	# Hitbox (Restored)
	var size = Constants.CELL_SIZE
	var area = Area2D.new()
	var shape = CollisionShape2D.new()
	var circle = CircleShape2D.new()
	circle.radius = size/4 # Radius
	shape.shape = circle
	area.add_child(shape)
	add_child(area)

func _draw():
	var size = Constants.CELL_SIZE
	var radius = size * 0.3
	
	# Draw glow/shadow (Neon effect)
	draw_circle(Vector2.ZERO, radius + 2, stats.color.darkened(0.5))
	
	# Draw main body
	draw_circle(Vector2.ZERO, radius, stats.color)
	
	# Draw inner detail based on type maybe? or just a white center for 'core'
	draw_circle(Vector2.ZERO, radius * 0.5, Color.WHITE)
	
	# Draw HP Bar manually so it follows position correctly
	var bar_width = size * 0.8
	var bar_height = 4.0
	var bar_pos = Vector2(-bar_width / 2, -radius - 10)
	
	# BG
	draw_rect(Rect2(bar_pos, Vector2(bar_width, bar_height)), Color.BLACK)
	
	# Fill
	var hp_pct = clamp(hp / float(stats.hp * 1.0), 0.0, 1.0) # Using base stats HP might be wrong if wave scaled it.
	# We should store max_hp setup.
	# But simplified:
	# Let's fix max_hp in setup()
	
	var fill_width = bar_width * hp_pct
	var fill_color = Color.GREEN
	if hp_pct < 0.5: fill_color = Color.YELLOW
	if hp_pct < 0.2: fill_color = Color.RED
	
	draw_rect(Rect2(bar_pos, Vector2(fill_width, bar_height)), fill_color)

func _process(delta):
	# Movement handled by WaveManager or self if we use _process for progress
	var final_speed = base_speed * frozen_factor
	progress += final_speed * delta
	queue_redraw() # Request redraw for HP bar and position updates if necessary (though typicaly node moves, _draw is local)
	# Wait, _draw is local coordinates. If Parent moves (PathFollow2D), we don't need to redraw shape, just HP bar if HP changes.
	# But we call queue_redraw in take_damage anyway.
	
	# Update Frozen
	if frozen_factor < 1.0:
		frozen_timer -= delta
		if frozen_timer <= 0:
			frozen_factor = 1.0
			# sprite.color = stats.color # Old logic
			queue_redraw()
	
	# Check end
	if progress_ratio >= 1.0:
		reached_end.emit(damage)
		queue_free()

func take_damage(amount: float):
	hp -= amount
	queue_redraw()
	
	if hp <= 0:
		died.emit(stats.reward)
		_spawn_death_particles()
		queue_free()

func apply_slow(factor: float, duration: float):
	if factor < frozen_factor: # Apply strongest slow
		frozen_factor = factor
		queue_redraw()
	frozen_timer = max(frozen_timer, duration)

func _spawn_death_particles():
	# Placeholder for particles
	pass
