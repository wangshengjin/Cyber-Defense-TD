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

func _ready() -> void:
	tile_map_layer = $GameMap
	if not tile_map_layer:
		push_error("GameMap node not found in MapManager!")
		return
	
	# 同步编辑器中的设置
	_sync_from_tilemap()
	queue_redraw()

## 从 TileMapLayer 同步编辑器手画的内容到逻辑数据中
func _sync_from_tilemap() -> void:
	path_set.clear()
	# 获取所有已画图块的坐标
	var used_cells = tile_map_layer.get_used_cells()
	
	for cell in used_cells:
		var atlas_coords = tile_map_layer.get_cell_atlas_coords(cell)
		
		# 判断是否为路径图块
		# 在当前素材包中，路径通常是坐标 (4, 2) 及其周边的变体
		# 我们也可以通过 TileData 的自定义数据层来判断，但目前先用坐标匹配
		if _is_path_tile(atlas_coords):
			path_set[cell] = true

## 判断坐标是否为路径图块
func _is_path_tile(coords: Vector2i) -> bool:
	# 沙子/路径图块在 Atlas 中的坐标通常是 (4, 2)
	# 包含: 直线、弯道、起点终点等。
	# 在 Kenney 素材包中，ID 46-52 (约 2:0 到 6:2 区域) 主要是路径相关
	# 简单判断：只要是 y 轴在 1 到 4 之间的特定区域基本都是路径相关的装饰或主体
	# 安全起见，我们匹配常用的路径坐标 (4, 2)
	return coords == Vector2i(4, 2) or (coords.y >= 1 and coords.y <= 3 and coords.x >= 2 and coords.x <= 8)

func _draw():
	# Draw Randomized Background Tiles and Path Tiles are now handled by TileMapLayer
	# Draw Grid
	for x in range(Constants.MAP_WIDTH + 1):
		draw_line(Vector2(x * Constants.CELL_SIZE, 0), Vector2(x * Constants.CELL_SIZE, Constants.MAP_HEIGHT * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)
	
	for y in range(Constants.MAP_HEIGHT + 1):
		draw_line(Vector2(0, y * Constants.CELL_SIZE), Vector2(Constants.MAP_WIDTH * Constants.CELL_SIZE, y * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)

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
