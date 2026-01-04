extends Control

@onready var money_label = $TopPanel/HBox/MoneyLabel
@onready var lives_label = $TopPanel/HBox/LivesLabel
@onready var wave_label = $TopPanel/HBox/WaveLabel
@onready var next_wave_btn = $BottomPanel/NextWaveBtn
@onready var speed_btn = $BottomPanel/SpeedBtn

@onready var build_laser_btn = $BottomPanel/HBox/BuildLaser
@onready var build_cannon_btn = $BottomPanel/HBox/BuildCannon
@onready var build_slow_btn = $BottomPanel/HBox/BuildSlow
@onready var build_sniper_btn = $BottomPanel/HBox/BuildSniper

signal build_tower_requested(type)

func _ready():
	GameManager.money_changed.connect(_on_money_changed)
	GameManager.lives_changed.connect(_on_lives_changed)
	GameManager.wave_changed.connect(_on_wave_changed)
	
	_on_money_changed(GameManager.money)
	_on_lives_changed(GameManager.lives)
	_on_wave_changed(GameManager.wave)
	
	_setup_icons()

func _setup_icons():
	# Tower Icons (using Turret tiles)
	build_laser_btn.icon = AtlasUtils.get_tile(250)
	build_cannon_btn.icon = AtlasUtils.get_tile(206)
	build_slow_btn.icon = AtlasUtils.get_tile(203)
	build_sniper_btn.icon = AtlasUtils.get_tile(205)

func _on_money_changed(new_amount):
	money_label.text = "Money: $%d" % new_amount

func _on_lives_changed(new_amount):
	lives_label.text = "Lives: %d" % new_amount

func _on_wave_changed(new_wave):
	wave_label.text = "Wave: %d" % new_wave

func _on_next_wave_pressed():
	# Signal to Main or WaveManager
	get_node("/root/Game/WaveManager").start_next_wave()
	# Disable button temporarily?
	
func _on_speed_toggle():
	if GameManager.game_speed == 1.0:
		GameManager.game_speed = 2.0
		speed_btn.text = "2x Speed"
	else:
		GameManager.game_speed = 1.0
		speed_btn.text = "1x Speed"

func _on_build_laser_pressed():
	build_tower_requested.emit(Constants.TowerType.LASER)

func _on_build_cannon_pressed():
	build_tower_requested.emit(Constants.TowerType.CANNON)

func _on_build_slow_pressed():
	build_tower_requested.emit(Constants.TowerType.SLOW)

func _on_build_sniper_pressed():
	build_tower_requested.emit(Constants.TowerType.SNIPER)
