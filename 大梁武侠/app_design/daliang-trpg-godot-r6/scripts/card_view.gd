extends Button
class_name CardView

var card_data: Dictionary = {}
var unavailable := false
var unavailable_reason := "【占位：不可用原因】"

func setup(data: Dictionary) -> void:
	card_data = data
	unavailable = bool(data.get("不可用", false))
	unavailable_reason = str(data.get("不可用原因", "【占位：不可用原因】"))
	text = "%s\n%s" % [str(data.get("类型", "【占位：字段名】")), str(data.get("名称", "【占位：字段名】"))]
	if unavailable:
		text += "\n%s" % unavailable_reason
	custom_minimum_size = Vector2(124, 110)
	focus_mode = Control.FOCUS_NONE
	tooltip_text = unavailable_reason if unavailable else "选择卡牌后选择目标，气骰只显示资源状态和锁气结果摘要。"
	_refresh()

func set_hovered(value: bool) -> void:
	position.y = -12 if value else 0
	if value and not unavailable:
		modulate = Color(1.0, 0.96, 0.84, 1.0)
	elif not unavailable:
		modulate = Color.WHITE

func set_selected(value: bool) -> void:
	if unavailable:
		return
	modulate = Color(1.0, 0.88, 0.58, 1.0) if value else Color.WHITE

func _refresh() -> void:
	if unavailable:
		disabled = false
		modulate = Color(0.55, 0.55, 0.55, 0.78)
