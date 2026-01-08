extends Node2D

@export var ghost_tower_scene: PackedScene

@onready var map_manager = $MapManager
@onready var wave_manager = $WaveManager
@onready var towers_container = $Towers
@onready var projectiles_container = $Projectiles
@onready var hud = $CanvasLayer/HUD

# 建造模式状态标志
var building_mode = false
# 当前选中的塔类型（用于建造）
var selected_tower_type = null
# 幽灵塔实例（建造预览）
var ghost_tower: Node2D
# 当前选中的已建造的塔（用于升级/出售）
var selected_tower: Node2D = null

func _ready():
	wave_manager.path_2d = $Path2D
	map_manager.path_2d = $Path2D
	map_manager._sync_from_tilemap()
	GameManager.game_over.connect(_on_game_over)

func _process(delta):
	# 如果处于建造模式，更新幽灵塔位置
	if building_mode:
		_update_ghost_tower()

func _unhandled_input(event):
	# 处理建造模式下的输入
	if building_mode and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_try_place_tower() # 左键放置
	elif building_mode and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		_cancel_build() # 右键取消
	# 处理非建造模式下的输入（选择塔）
	elif not building_mode and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_selection()

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
		_create_ghost_tower() # 创建预览塔
	else:
		print("Not enough money!")

func _create_ghost_tower():
	if ghost_tower_scene:
		ghost_tower = ghost_tower_scene.instantiate()
		add_child(ghost_tower)
		ghost_tower.update_type(selected_tower_type)
	else:
		print("Ghost Tower Scene not assigned!")

# 更新幽灵塔位置和有效性状态
func _update_ghost_tower():
	var mouse_pos = get_global_mouse_position()
	var cell = map_manager.world_to_map(mouse_pos)
	ghost_tower.position = map_manager.map_to_world(cell)
	
	if map_manager.is_valid_build_pos(cell):
		ghost_tower.set_valid(true)
	else:
		ghost_tower.set_valid(false)

func _try_place_tower():
	var mouse_pos = get_global_mouse_position()
	var cell = map_manager.world_to_map(mouse_pos)
	
	# 尝试在特定位置放置塔
	if map_manager.place_tower(cell, _create_real_tower()):
		GameManager.money -= Constants.TOWER_STATS[selected_tower_type].cost
		_cancel_build()

# 实例化真实的塔对象
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

func _handle_selection():
	var mouse_pos = get_global_mouse_position()
	var cell = map_manager.world_to_map(mouse_pos)
	
	if map_manager.towers.has(cell):
		var tower = map_manager.towers[cell]
		_select_tower(tower)
	else:
		_deselect_tower()

func _select_tower(tower):
	if selected_tower and selected_tower != tower:
		selected_tower.set_show_range(false)
		
	selected_tower = tower
	selected_tower.set_show_range(true)
	hud.show_tower_controls(tower)

func _deselect_tower():
	if selected_tower:
		selected_tower.set_show_range(false)
	selected_tower = null
	hud.hide_tower_controls()

func _on_upgrade_tower():
	if selected_tower:
		var cost = selected_tower.get_upgrade_cost()
		if GameManager.money >= cost:
			GameManager.money -= cost
			selected_tower.upgrade()
			hud.show_tower_controls(selected_tower) # Refresh info
		else:
			print("Not enough money to upgrade")

func _on_sell_tower():
	if selected_tower:
		var cell = map_manager.world_to_map(selected_tower.global_position)
		map_manager.remove_tower(cell)
		selected_tower.sell()
		_deselect_tower()
