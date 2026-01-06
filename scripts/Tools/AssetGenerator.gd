@tool
extends SceneTree

func _init():
	print("Starting Asset Generation...")
	
	# 1. Setup TileSet
	var tile_set = TileSet.new()
	var atlas_tile_size = 64
	tile_set.tile_size = Vector2i(atlas_tile_size, atlas_tile_size)
	
	var source = TileSetAtlasSource.new()
	var texture = load("res://assets/kenney_td/Tilesheet/towerDefense_tilesheet.png")
	if not texture:
		print("Error: Could not load texture")
		quit()
		return
		
	source.texture = texture
	source.texture_region_size = Vector2i(atlas_tile_size, atlas_tile_size)
	
	var tex_size = texture.get_size()
	var cols = int(tex_size.x / atlas_tile_size)
	var rows = int(tex_size.y / atlas_tile_size)
	
	# Create tiles for every grid position in the atlas
	for y in range(rows):
		for x in range(cols):
			source.create_tile(Vector2i(x, y))
	
	tile_set.add_source(source, 0)
	
	# Save TileSet Resource
	var err = ResourceSaver.save(tile_set, "res://resources/GameTileSet.tres")
	if err != OK:
		print("Error saving TileSet: ", err)
		quit()
		return
	print("Saved res://resources/GameTileSet.tres")
	
	# 2. Setup TileMapLayer Scene
	var map_layer = TileMapLayer.new()
	map_layer.name = "GameMap"
	map_layer.tile_set = tile_set
	
	# Apply Scale (40 / 64 = 0.625)
	# We hardcode this match Constants.CELL_SIZE (40) / TILE_SIZE (64)
	map_layer.scale = Vector2(0.625, 0.625)
	
	var scene = PackedScene.new()
	scene.pack(map_layer)
	
	err = ResourceSaver.save(scene, "res://scenes/GameMap.tscn")
	if err != OK:
		print("Error saving GameMap scene: ", err)
	else:
		print("Saved res://scenes/GameMap.tscn")
	
	quit()
