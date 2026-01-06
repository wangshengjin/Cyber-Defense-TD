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

func _ready():
	tile_map_layer = $GameMap
	if not tile_map_layer:
		push_error("GameMap node not found in MapManager!")
		return
		
	# Ensure Source ID is set correctly (assuming 0 from our generator)
	tile_set_source_id = 0
	
	_init_grid()
	# Initialize path set for fast lookup
	_init_path_set()
	queue_redraw()

# Removed _init_tile_map_layer as it's now a scene instance

func _set_tile_cell(pos: Vector2i, tile_id: int):
	var cols = AtlasUtils.COLUMNS
	var atlas_coords = Vector2i(tile_id % cols, int(tile_id / cols))
	tile_map_layer.set_cell(pos, tile_set_source_id, atlas_coords)


func _init_grid():
	# Initialize randomized background tiles
	# Using likely grass variants from Kenney pack: 
	# 24: Standard Grass
	var variants = [24, 24, 24, 24, 24, 25] # mostly 24, occassional variant
	
	for x in range(Constants.MAP_WIDTH):
		for y in range(Constants.MAP_HEIGHT):
			var tile_id = variants.pick_random()
			background_tiles[Vector2i(x, y)] = tile_id
			_set_tile_cell(Vector2i(x, y), tile_id)

func _init_path_set():
	var coords = Constants.PATH_COORDINATES
	if coords.size() < 2: return
	
	# Fill path cells. This is a simplification. 
	# In the React app it draws lines between points.
	# We need to know which CELLS are occupied by the path to prevent building.
	# Simple bresenham or just iterating segments.
	# Since path is rectilinear (Manhattan), it's easy.
	
	for i in range(coords.size() - 1):
		var start = coords[i]
		var end = coords[i + 1]
		
		var current = start
		path_set[start] = true
		_set_tile_cell(start, 50)
		
		while current != end:
			if current.x < end.x: current.x += 1
			elif current.x > end.x: current.x -= 1
			elif current.y < end.y: current.y += 1
			elif current.y > end.y: current.y -= 1
			path_set[current] = true
			_set_tile_cell(current, 50)
	
	# Add the very last point too if not covered (it is covered by loop usually)
	path_set[coords[coords.size() - 1]] = true
	_set_tile_cell(coords[coords.size() - 1], 50)

func _draw():
	# Draw Randomized Background Tiles and Path Tiles are now handled by TileMapLayer
	# Draw Grid
	for x in range(Constants.MAP_WIDTH + 1):
		draw_line(Vector2(x * Constants.CELL_SIZE, 0), Vector2(x * Constants.CELL_SIZE, Constants.MAP_HEIGHT * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)
	
	for y in range(Constants.MAP_HEIGHT + 1):
		draw_line(Vector2(0, y * Constants.CELL_SIZE), Vector2(Constants.MAP_WIDTH * Constants.CELL_SIZE, y * Constants.CELL_SIZE), Constants.COLORS.GRID_BORDER, 1.0)

func map_to_world(grid_pos: Vector2i) -> Vector2:
	return Vector2(grid_pos.x * Constants.CELL_SIZE + Constants.CELL_SIZE / 2.0, grid_pos.y * Constants.CELL_SIZE + Constants.CELL_SIZE / 2.0)

func world_to_map(world_pos: Vector2) -> Vector2i:
	return Vector2i(world_pos.x / Constants.CELL_SIZE, world_pos.y / Constants.CELL_SIZE)

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
		# Add as child in Main Game scene, not here necessarily, but passed in for tracking
		return true
	return false

func remove_tower(cell: Vector2i):
	if towers.has(cell):
		towers.erase(cell)
