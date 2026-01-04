extends Node

class_name WaveManager

signal wave_started(wave_idx: int)
signal wave_completed

@export var path_2d: Path2D # Reference to the Path2D in the scene

var current_wave_idx: int = 0
var enemies_remaining_to_spawn: int = 0
var spawn_timer: float = 0.0
var current_wave_config: Dictionary
var spawning_active: bool = false
var enemies_alive: int = 0

func start_next_wave():
	if spawning_active or enemies_alive > 0:
		return
		
	current_wave_idx += 1
	GameManager.wave = current_wave_idx
	
	_setup_wave_config()
	spawning_active = true
	spawn_timer = 0.0
	wave_started.emit(current_wave_idx)

func _setup_wave_config():
	# Use WAVES logic from Constants
	if current_wave_idx <= Constants.WAVES.size():
		current_wave_config = Constants.WAVES[current_wave_idx - 1]
	else:
		# Infinite scaling
		var base_wave_idx = (current_wave_idx - 1) % Constants.WAVES.size()
		var loop_count = (current_wave_idx - 1) / Constants.WAVES.size()
		var base_config = Constants.WAVES[base_wave_idx]
		
		# Clone and modify
		current_wave_config = base_config.duplicate()
		# Exponential scaling: 1.18^(Wave - 10) roughly
		var scaling_factor = pow(1.18, current_wave_idx - 10)
		current_wave_config.hpMultiplier = current_wave_config.hpMultiplier * scaling_factor

	enemies_remaining_to_spawn = current_wave_config.count

func _process(delta):
	if spawning_active:
		spawn_timer -= delta
		if spawn_timer <= 0:
			_spawn_enemy()
			spawn_timer = current_wave_config.interval / 1000.0 # Convert ms to s (Wait, constant says 1000ms, so 1.0s)

func _spawn_enemy():
	if enemies_remaining_to_spawn <= 0:
		spawning_active = false
		return
	
	var enemy_scene = preload("res://scenes/Enemies/BaseEnemy.tscn")
	var enemy = enemy_scene.instantiate()
	path_2d.add_child(enemy)
	enemy.setup(current_wave_config.enemyType, current_wave_config.hpMultiplier)
	
	enemy.died.connect(_on_enemy_died)
	enemy.reached_end.connect(_on_enemy_reached_end)
	
	enemies_alive += 1
	enemies_remaining_to_spawn -= 1

func _on_enemy_died(reward: int):
	GameManager.money += reward
	enemies_alive -= 1
	_check_wave_end()

func _on_enemy_reached_end(damage: int):
	GameManager.lives -= damage
	enemies_alive -= 1
	_check_wave_end()

func _check_wave_end():
	if !spawning_active and enemies_alive == 0:
		wave_completed.emit()
