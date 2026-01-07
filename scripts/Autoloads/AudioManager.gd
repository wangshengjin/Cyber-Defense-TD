extends Node

## 音频管理器
## 负责全局背景音乐和音效的播放

@onready var music_player: AudioStreamPlayer = $MusicPlayer
# 音效播放器池，从场景节点中获取
var sfx_players: Array[AudioStreamPlayer] = []

# 缓存音频资源
var audio_resources: Dictionary = {
	"bgm_main": preload("res://assets/audio/music/cyberpunk_city.mp3"),
	"sfx_laser": preload("res://assets/audio/sfx/laser_shoot.mp3"),
	"sfx_explosion": preload("res://assets/audio/sfx/explosion.mp3"),
	"sfx_click": preload("res://assets/audio/sfx/ui_click.mp3")
}

func _ready() -> void:
	# 从 SFXPool 环境中初始化音效播放器
	for child in $SFXPool.get_children():
		if child is AudioStreamPlayer:
			sfx_players.append(child)
	
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
