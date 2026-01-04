extends Control

@onready var score_label = $CenterContainer/VBoxContainer/ScoreLabel

func _ready():
	var waves_survived = GameManager.wave - 1
	if waves_survived < 0:
		waves_survived = 0
	score_label.text = "Waves Survived: %d" % waves_survived

func _on_retry_button_pressed():
	GameManager.reset_game()
	# Reload current scene (Game)
	get_tree().reload_current_scene()

func _on_menu_button_pressed():
	# Reset time scale so menu animations work if any
	Engine.time_scale = 1.0
	# Go back to start menu
	get_tree().change_scene_to_file("res://scenes/UI/StartMenu.tscn")
