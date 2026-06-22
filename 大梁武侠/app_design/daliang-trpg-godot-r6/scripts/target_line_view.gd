extends Control
class_name TargetLineView

var active := false
var line_labels: Array[String] = []

func setup(labels: Array[String], is_active: bool) -> void:
	line_labels = labels
	active = is_active
	custom_minimum_size = Vector2(0, 160)
	queue_redraw()

func _draw() -> void:
	if not active:
		return
	var colors := [
		Color("#8b3f25"),
		Color("#5c4a2c"),
		Color("#2f5c7a"),
		Color("#7a4d80")
	]
	var y := 22.0
	for index in range(line_labels.size()):
		var color: Color = colors[index % colors.size()]
		draw_line(Vector2(24, y), Vector2(size.x - 24, y), color, 3.0)
		draw_circle(Vector2(24, y), 5.0, color)
		draw_circle(Vector2(size.x - 24, y), 5.0, color)
		draw_string(ThemeDB.fallback_font, Vector2(34, y - 7), line_labels[index], HORIZONTAL_ALIGNMENT_LEFT, size.x - 68, 13, color)
		y += 34.0
