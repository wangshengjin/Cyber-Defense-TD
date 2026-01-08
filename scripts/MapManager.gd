extends Node2D

class_name MapManager

# Reference to the TileMap or just drawing directly?
# For simplicity and exact pixel matching to the React version, we might just draw debug lines 
# or use a simple Grid container. But a Node2D with _draw is easiest for the grid.

signal tower_placed(cell_pos: Vector2i, type: Constants.TowerType)

var towers: Dictionary = {} # Vector2i -> Tower Node
var path_set: Dictionary = {} # Vector2i -> bool

var tile_map_layer: TileMapLayer
var tile_set_source_id = 0
var background_tiles: Dictionary = {}
var path_2d: Path2D # 关联的路径节点

func _ready() -> void:
	tile_map_layer = $GameMap
	if not tile_map_layer:
		push_error("GameMap node not found in MapManager!")
		return
	
	# 如果父节点有 Path2D 且未指定，尝试查找
	if not path_2d and get_parent().has_node("Path2D"):
		path_2d = get_parent().get_node("Path2D")
	
	# 同步编辑器中的设置
	_sync_from_tilemap()
	queue_redraw()

## 从 TileMapLayer 和 Path2D 同步逻辑数据中
func _sync_from_tilemap() -> void:
	path_set.clear()
	
	# 1. 从 Path2D 采样（作为核心真值）
	# 既然用户调整了 Path2D 路径，这里应该作为最主要的禁放依据
	if path_2d and path_2d.curve:
		var curve = path_2d.curve
		var length = curve.get_baked_length()
		# 步长设为格子的 1/4，采样更密集
		var step = Constants.CELL_SIZE / 4.0
		for d in range(0, int(length) + 1, int(step)):
			var local_pos = curve.sample_baked(d)
			var global_pos = path_2d.to_global(local_pos)
			var cell = world_to_map(global_pos)
			path_set[cell] = true
			
			# 扩展采样：标记路径周围的格子也被禁放（如果路径刚好在边线上）
			# 如果用户想要更严格的判定，可以给 local_pos 加一定的偏移量采样
	
	# 2. 从 TileMap 图块识别（作为辅助依据，如石头、水面等）
	var used_cells = tile_map_layer.get_used_cells()
	for cell in used_cells:
		if path_set.has(cell): continue # 已经采样过了
		
		var atlas_coords = tile_map_layer.get_cell_atlas_coords(cell)
		if _is_path_tile(atlas_coords):
			path_set[cell] = true
	
	queue_redraw()

## 判断坐标是否为路径图块
func _is_path_tile(coords: Vector2i) -> bool:
	# 简化识别，避免误杀背景
	# Kenney 素材中常用的路径坐标
	return coords == Vector2i(4, 2) or coords == Vector2i(0, 10) # 沙子路和水

func _draw():
	# 绘制网格
	for x in range(Constants.MAP_WIDTH + 1):
		draw_line(Vector2(x * Constants.CELL_SIZE, 0), Vector2(x * Constants.CELL_SIZE, Constants.MAP_HEIGHT * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)
	
	for y in range(Constants.MAP_HEIGHT + 1):
		draw_line(Vector2(0, y * Constants.CELL_SIZE), Vector2(Constants.MAP_WIDTH * Constants.CELL_SIZE, y * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)
	
	# 如果处于建造模式且在编辑器调试，或者根据需要，可以绘制禁放区
	# 这里默认绘制一层极淡的阴影来辅助用户观察禁放逻辑是否正确
	var debug_path_color = Color(1.0, 0.0, 0.0, 0.1)
	for cell in path_set:
		var rect = Rect2(Vector2(cell) * Constants.CELL_SIZE, Vector2(Constants.CELL_SIZE, Constants.CELL_SIZE))
		draw_rect(rect, debug_path_color)

func map_to_world(grid_pos: Vector2i) -> Vector2:
	# 使用 TileMapLayer 官方函数转换，它会自动考虑节点自身的 Position 和 Scale
	return tile_map_layer.to_global(tile_map_layer.map_to_local(grid_pos))

func world_to_map(world_pos: Vector2) -> Vector2i:
	# 先转到本地坐标，再转到网格坐标
	return tile_map_layer.local_to_map(tile_map_layer.to_local(world_pos))

func is_valid_build_pos(cell: Vector2i) -> bool:
	if cell.x < 0 or cell.x >= Constants.MAP_WIDTH or cell.y < 0 or cell.y >= Constants.MAP_HEIGHT:
		return false
	if path_set.has(cell):
		return false
	if towers.has(cell):
		return false
	return true

func place_tower(cell: Vector2i, tower_node: Node2D):
	if is_valid_build_pos(cell):
		towers[cell] = tower_node
		tower_node.position = map_to_world(cell)
		# 添加为子节点在主游戏场景中完成，不一定在这里，但传入以进行跟踪
		return true
	return false

func remove_tower(cell: Vector2i):
	if towers.has(cell):
		towers.erase(cell)
