extends Control

@onready var background_rect = $Background

@export var game_scene: PackedScene

func _ready():
	print("StartMenu _ready called")
	# 暂时保持背景可见以调试“黑屏”问题
	if background_rect:
		background_rect.visible = true
	# queue_redraw() # Disable custom drawing

# func _draw():
# 	print("StartMenu _draw called")
# 	var bg_texture = AtlasUtils.get_tile(24)
# 	if bg_texture == null:
# 		print("Error: bg_texture is null")
# 		return
# 	if bg_texture.atlas == null:
# 		print("Error: bg_texture.atlas is null")
# 		
# 	var size = Constants.CELL_SIZE
# 	var viewport_size = get_viewport_rect().size
# 	
# 	var cols = ceil(viewport_size.x / size)
# 	var rows = ceil(viewport_size.y / size)
# 	
# 	for x in range(cols):
# 		for y in range(rows):
# 			draw_texture_rect(bg_texture, Rect2(x * size, y * size, size, size), false)
# 	
# 	# Draw a semi-transparent overlay
# 	draw_rect(get_viewport_rect(), Color(0, 0, 0, 0.5))

func _on_start_button_pressed():
	# 开始前重置游戏状态
	GameManager.reset_game()
	# 切换到主游戏场景
	if game_scene:
		get_tree().change_scene_to_packed(game_scene)
	else:
		print("Game scene not assigned in StartMenu")

func _on_quit_button_pressed():
	get_tree().quit()
