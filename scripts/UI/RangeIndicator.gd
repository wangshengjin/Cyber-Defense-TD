extends Node2D

var radius: float = 0.0:
	set(value):
		radius = value
		queue_redraw()

var color: Color = Color(0, 0, 0):
	set(value):
		color = value
		queue_redraw()

func _draw():
	if radius > 0:
		var fill_col = color
		fill_col.a = 0.1
		draw_circle(Vector2.ZERO, radius, fill_col)
		
		var line_col = color
		line_col.a = 0.5
		draw_arc(Vector2.ZERO, radius, 0, TAU, 64, line_col, 2.0)
