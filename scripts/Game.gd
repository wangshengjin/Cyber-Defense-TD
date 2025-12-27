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
	var rect = ColorRect.new()
	rect.size = Vector2(size, size)
	rect.position = Vector2(-size / 2, -size / 2)
	rect.color = Color(1, 1, 1, 0.5) # Semi-transparent
	ghost_tower.add_child(rect)
	
	# Range circle
	var stats = Constants.TOWER_STATS[selected_tower_type]
	var range_circle = Line2D.new() # Or draw in _draw?
	# Simple drawing in script is harder for generic Node2D. 
	# Let's just use ghost_tower position in MapManager to valid.
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
	var tower = preload("res://scripts/Towers/Tower.gd").new() # Should use scene...
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
