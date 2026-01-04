class_name AtlasUtils

const TILE_SIZE = 64
const SHEET_PATH = "res://assets/kenney_td/Tilesheet/towerDefense_tilesheet.png"
# Determined from 1472 width / 64 tile size = 23 columns
const COLUMNS = 23

static var _atlas_texture_cache = {}

static func get_tile(id: int) -> AtlasTexture:
	if _atlas_texture_cache.has(id):
		return _atlas_texture_cache[id]
	
	var atlas = AtlasTexture.new()
	atlas.atlas = load(SHEET_PATH)
	
	var x = (id % COLUMNS) * TILE_SIZE
	var y = int(id / COLUMNS) * TILE_SIZE
	
	atlas.region = Rect2(x, y, TILE_SIZE, TILE_SIZE)
	
	_atlas_texture_cache[id] = atlas
	return atlas
