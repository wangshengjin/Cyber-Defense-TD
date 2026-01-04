extends Node2D

@onready var map_manager = $MapManager
@onready var wave_manager = $WaveManager
@onready var towers_container = $Towers
@onready var projectiles_container = $Projectiles
@onready var hud = $CanvasLayer/HUD

var building_mode = false
var selected_tower_type = null
var ghost_tower: Node2D

func _ready():
	hud.build_tower_requested.connect(_on_build_requested)
	wave_manager.path_2d = $Path2D
	GameManager.game_over.connect(_on_game_over)

func _process(delta):
	if building_mode:
		_update_ghost_tower()
		if Input.is_action_just_pressed("mouse_left"): # Default action? Godot usually 'ui_accept' or we need to add inputs. Assuming mouse click.
			# Or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
			if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
				_try_place_tower()

func _input(event):
	if building_mode and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_try_place_tower()
	elif building_mode and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		_cancel_build()

func _on_build_requested(type):
	if building_mode:
		if selected_tower_type == type:
			_cancel_build()
			return
		_cancel_build()
	
	selected_tower_type = type
	var cost = Constants.TOWER_STATS[type].cost
	if GameManager.money >= cost:
		building_mode = true
		_create_ghost_tower()
	else:
		print("Not enough money!")

func _create_ghost_tower():
	ghost_tower = Node2D.new()
	var size = Constants.CELL_SIZE
	
	# Scale calculation
	var scale_factor = float(Constants.CELL_SIZE) / float(AtlasUtils.TILE_SIZE)

	# Base Sprite
	var base_sprite = Sprite2D.new()
	base_sprite.texture = AtlasUtils.get_tile(181)
	base_sprite.scale = Vector2(scale_factor, scale_factor)
	ghost_tower.add_child(base_sprite)
	
	# Turret Sprite
	var tile_id = -1
	match selected_tower_type:
		Constants.TowerType.LASER: tile_id = 250
		Constants.TowerType.CANNON: tile_id = 206
		Constants.TowerType.SLOW: tile_id = 203
		Constants.TowerType.SNIPER: tile_id = 205
	
	if tile_id != -1:
		var turret_sprite = Sprite2D.new()
		turret_sprite.texture = AtlasUtils.get_tile(tile_id)
		turret_sprite.scale = Vector2(scale_factor, scale_factor)
		ghost_tower.add_child(turret_sprite)

	ghost_tower.modulate = Color(1, 1, 1, 0.5) # Initial transparency
	add_child(ghost_tower)

func _update_ghost_tower():
	var mouse_pos = get_global_mouse_position()
	var cell = map_manager.world_to_map(mouse_pos)
	ghost_tower.position = map_manager.map_to_world(cell)
	
	if map_manager.is_valid_build_pos(cell):
		ghost_tower.modulate = Constants.COLORS.HOVER_VALID
	else:
		ghost_tower.modulate = Constants.COLORS.HOVER_INVALID

func _try_place_tower():
	var mouse_pos = get_global_mouse_position()
	var cell = map_manager.world_to_map(mouse_pos)
	
	if map_manager.place_tower(cell, _create_real_tower()):
		GameManager.money -= Constants.TOWER_STATS[selected_tower_type].cost
		_cancel_build()

func _create_real_tower() -> Node2D:
	var tower_scene = preload("res://scenes/Towers/BaseTower.tscn")
	var tower = tower_scene.instantiate()
	# Using script directly and adding as child
	# Need to set unique Name or just add child
	towers_container.add_child(tower)
	tower.setup(selected_tower_type, projectiles_container)
	return tower

func _cancel_build():
	building_mode = false
	selected_tower_type = null
	if ghost_tower:
		ghost_tower.queue_free()
		ghost_tower = null

func _on_game_over():
	var game_over_screen = preload("res://scenes/UI/GameOverScreen.tscn").instantiate()
	$CanvasLayer.add_child(game_over_screen)
	Engine.time_scale = 0
