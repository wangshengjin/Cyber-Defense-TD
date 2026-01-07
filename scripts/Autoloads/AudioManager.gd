extends Node

## 音频管理器
## 负责全局背景音乐和音效的播放

# 背景音乐播放器
var music_player: AudioStreamPlayer
# 音效播放器池，用于同时播放多个音效
var sfx_players: Array[AudioStreamPlayer] = []
var max_sfx_players: int = 12

# 缓存音频资源
var audio_resources: Dictionary = {
	"bgm_main": preload("res://assets/audio/music/cyberpunk_city.mp3"),
	"sfx_laser": preload("res://assets/audio/sfx/laser_shoot.mp3"),
	"sfx_explosion": preload("res://assets/audio/sfx/explosion.mp3"),
	"sfx_click": preload("res://assets/audio/sfx/ui_click.mp3")
}

func _ready() -> void:
	# 初始化背景音乐播放器
	music_player = AudioStreamPlayer.new()
	music_player.bus = "Master" # 默认使用 Master，如果以后有 Bus 再调整
	add_child(music_player)
	
	# 初始化音效播放器池
	for i in range(max_sfx_players):
		var p = AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		sfx_players.append(p)
	
	# 默认开始播放背景音乐
	play_music("bgm_main")

## 播放背景音乐
func play_music(music_id: String) -> void:
	if audio_resources.has(music_id):
		var stream = audio_resources[music_id]
		if music_player.stream == stream and music_player.playing:
			return
		music_player.stream = stream
		music_player.play()

## 停止背景音乐
func stop_music() -> void:
	music_player.stop()

## 播放音效
func play_sfx(sfx_id: String) -> void:
	if audio_resources.has(sfx_id):
		var stream = audio_resources[sfx_id]
		# 寻找一个当前没有在播放的播放器
		for p in sfx_players:
			if not p.playing:
				p.stream = stream
				p.play()
				return
		# 如果都忙，就用第一个强行播放（或者可以动态增加）
		sfx_players[0].stream = stream
		sfx_players[0].play()
