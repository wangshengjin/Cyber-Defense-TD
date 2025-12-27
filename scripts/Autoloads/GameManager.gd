extends Node

signal money_changed(new_amount)
signal lives_changed(new_amount)
signal wave_changed(new_wave)
signal game_over
signal game_speed_changed(new_speed)

var money: int = Constants.INITIAL_MONEY:
	set(value):
		money = value
		money_changed.emit(money)

var lives: int = Constants.INITIAL_LIVES:
	set(value):
		lives = value
		lives_changed.emit(lives)
		if lives <= 0:
			game_over.emit()

var wave: int = 1:
	set(value):
		wave = value
		wave_changed.emit(wave)

var game_speed: float = 1.0:
	set(value):
		game_speed = value
		Engine.time_scale = game_speed
		game_speed_changed.emit(game_speed)

var is_game_over: bool = false

func reset_game():
	money = Constants.INITIAL_MONEY
	lives = Constants.INITIAL_LIVES
	wave = 1
	game_speed = 1.0
	is_game_over = false
	Engine.time_scale = 1.0

func _ready():
	process_mode = Node.PROCESS_MODE_ALWAYS # Keep running even if game paused (though we use time_scale)
