extends Button
class_name CombatantCardView

var actor_data: Dictionary = {}

func setup(actor: Dictionary, summary_fields: Array, title: String) -> void:
	actor_data = actor
	var lines: Array[String] = [title]
	for field in summary_fields:
		var field_name := str(field)
		lines.append("%s：%s" % [field_name, str(actor.get(field_name, "【占位：字段名】"))])
	text = "\n".join(lines)
	custom_minimum_size = Vector2(0, 204)
	alignment = HORIZONTAL_ALIGNMENT_LEFT
	focus_mode = Control.FOCUS_NONE

func set_target_highlight(value: bool) -> void:
	modulate = Color(1.0, 0.92, 0.62, 1.0) if value else Color.WHITE

func set_selected_target(value: bool) -> void:
	modulate = Color(0.96, 0.78, 0.42, 1.0) if value else Color.WHITE
