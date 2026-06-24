extends Control

const RulesLoader := preload("res://scripts/rules_manifest_loader.gd")
const MockLoader := preload("res://scripts/mock_combat_state_loader.gd")
const UIState := preload("res://scripts/ui_interaction_state.gd")
const CardViewScript := preload("res://scripts/card_view.gd")
const CombatantCardViewScript := preload("res://scripts/combatant_card_view.gd")
const TargetLineViewScript := preload("res://scripts/target_line_view.gd")
const DrawerControllerScript := preload("res://scripts/drawer_controller.gd")

var manifest: Dictionary
var combat_state: Dictionary
var interaction: UIInteractionState
var drawer_controller: DrawerController
var placeholder_texture: Texture2D
var root_box: VBoxContainer
var drawer_layer: Control
var drawer_title: Label
var drawer_body: VBoxContainer
var selected_detail_box: VBoxContainer
var floating_layer: Control
var capture_path := ""

func _ready() -> void:
	manifest = RulesLoader.load_manifest()
	combat_state = MockLoader.load_state()
	interaction = UIState.new()
	drawer_controller = DrawerControllerScript.new()
	placeholder_texture = _make_placeholder_texture()
	custom_minimum_size = Vector2(_screen_value("base_width", 1920), _screen_value("base_height", 1080))
	_load_placeholder_theme()
	_apply_capture_state_from_environment()
	_rebuild()
	if capture_path != "":
		call_deferred("_capture_current")

func _apply_capture_state_from_environment() -> void:
	var capture_state := OS.get_environment("DALIANG_CAPTURE_PHASE3")
	if capture_state == "":
		if OS.get_environment("DALIANG_CAPTURE_PHASE2") == "1":
			capture_path = "res://docs/screenshots/phase2_main.png"
		return
	_select_first_available_card()
	match capture_state:
		"card_hover":
			interaction.hovered_card_name = interaction.selected_card_name
			interaction.selected_card_name = ""
			interaction.set_state(UIState.IDLE)
			capture_path = "res://docs/screenshots/phase3_card_hover.png"
		"card_selected":
			interaction.set_state(UIState.CARD_SELECTED)
			capture_path = "res://docs/screenshots/phase3_card_selected.png"
		"target_selected":
			_select_first_target()
			interaction.set_state(UIState.TARGET_SELECTED)
			capture_path = "res://docs/screenshots/phase3_target_selected.png"
		"declaration_preview":
			_select_first_target()
			interaction.set_state(UIState.DECLARATION_PREVIEW)
			capture_path = "res://docs/screenshots/phase3_declaration_preview.png"
		"response_open":
			_select_first_target()
			interaction.set_state(UIState.RESPONSE_OPEN)
			capture_path = "res://docs/screenshots/phase3_response_open.png"
		"resolution_preview":
			_select_first_target()
			interaction.set_state(UIState.RESOLUTION_PREVIEW)
			capture_path = "res://docs/screenshots/phase3_resolution_preview.png"
		"drawer_open":
			drawer_controller.open("背包")
			interaction.active_drawer = "背包"
			capture_path = "res://docs/screenshots/phase3_drawer_open.png"

func _select_first_available_card() -> void:
	for card in _state_array("cards"):
		if card is Dictionary and not bool(card.get("不可用", false)):
			interaction.selected_card_name = str(card.get("名称", _placeholder()))
			return

func _select_first_target() -> void:
	var enemies := _state_array("enemies")
	if enemies.size() > 0 and enemies[0] is Dictionary:
		interaction.selected_target_name = str(enemies[0].get("角色名", _placeholder()))

func _rebuild() -> void:
	for child in get_children():
		child.queue_free()
	root_box = VBoxContainer.new()
	root_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_box.add_theme_constant_override("separation", 10)
	root_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root_box.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(root_box)
	root_box.add_child(_top_bar())
	root_box.add_child(_main_stage())
	root_box.add_child(_card_operation_area())
	_build_floating_layer()
	_build_drawer_layer()

func _screen_value(key: String, fallback: int) -> int:
	var screen: Dictionary = manifest.get("screen", {})
	return int(screen.get(key, fallback))

func _load_placeholder_theme() -> void:
	var loaded_theme := load("res://themes/daliang_placeholder_theme.tres")
	if loaded_theme is Theme:
		theme = loaded_theme

func _top_bar() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	var title := _label("交锋页", 26, true)
	title.custom_minimum_size = Vector2(84, 36)
	row.add_child(title)
	var round_label := _label("第%s轮" % _state_text("round"))
	round_label.custom_minimum_size = Vector2(170, 32)
	row.add_child(round_label)
	for phase in _manifest_array("combat_phases"):
		row.add_child(_pill(str(phase), str(phase) == _state_text("phase")))
	row.add_child(_spacer())
	row.add_child(_label("状态：%s" % interaction.state, 16, true))
	return _frame(row, Vector2(0, 64), "top_bar", false)

func _main_stage() -> Control:
	var split := HBoxContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_theme_constant_override("separation", 10)
	split.add_child(_side_column("玩家方", _state_array("players"), false))
	split.add_child(_center_column())
	split.add_child(_side_column("敌方", _state_array("enemies"), true))
	return split

func _side_column(title: String, actors: Array, targetable: bool) -> Control:
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	list.add_child(_label(title, 22, true))
	for actor in actors:
		if actor is Dictionary:
			list.add_child(_combatant_card(actor, targetable))
	return _frame(list, Vector2(350, 0), "side_column", true)

func _combatant_card(actor: Dictionary, targetable: bool) -> Control:
	var button: CombatantCardView = CombatantCardViewScript.new()
	var actor_name := str(actor.get("角色名", _placeholder()))
	button.setup(actor, _manifest_array("combat_card_summary_fields"), "角色小卡")
	if targetable and interaction.state in [UIState.CARD_SELECTED, UIState.TARGET_SELECTED, UIState.DECLARATION_PREVIEW, UIState.RESPONSE_OPEN, UIState.RESOLUTION_PREVIEW]:
		button.set_target_highlight(true)
	if actor_name == interaction.selected_target_name:
		button.set_selected_target(true)
	button.pressed.connect(func() -> void:
		if targetable and interaction.selected_card_name != "":
			interaction.selected_target_name = actor_name
			interaction.set_state(UIState.TARGET_SELECTED)
			_rebuild()
	)
	return button

func _center_column() -> Control:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_label("交锋裁决区", 24, true))
	column.add_child(_current_flow_panel())
	column.add_child(_target_lines_panel())
	column.add_child(_preview_panel())
	column.add_child(_response_panel())
	column.add_child(_demo_buttons())
	return _frame(column, Vector2(0, 0), "center_column", true)

func _current_flow_panel() -> Control:
	var lines := VBoxContainer.new()
	lines.add_child(_label("当前行动者：%s" % _state_text("actor")))
	lines.add_child(_label("当前目标：%s" % _current_target_text()))
	lines.add_child(_label("当前卡：%s" % _current_card_text()))
	lines.add_child(_label("当前阶段：%s" % interaction.state))
	if interaction.state == UIState.CARD_SELECTED:
		lines.add_child(_label("请选择目标", 16, true))
	return _frame(lines, Vector2(0, 126), "current_flow", false)

func _target_lines_panel() -> Control:
	var box := VBoxContainer.new()
	box.add_child(_label("目标线 / 纠缠线 / 响应线 / 第三方护人线", 20, true))
	var labels: Array[String] = [
		"目标线：[行动者] --【占位：距离】--> [目标]",
		"纠缠线：[行动者] ==【占位：纠缠】== [目标]",
		"响应线：[响应者] - -【占位：截击/应招】- -> [卡]",
		"第三方护人线：[第三方] ~【占位：第三方护人】~> [被护]"
	]
	var line_view: TargetLineView = TargetLineViewScript.new()
	line_view.setup(labels, interaction.state in [UIState.TARGET_SELECTED, UIState.DECLARATION_PREVIEW, UIState.RESPONSE_OPEN, UIState.RESOLUTION_PREVIEW])
	box.add_child(line_view)
	return _frame(box, Vector2(0, 178), "target_lines", false)

func _preview_panel() -> Control:
	var detail := _selected_card_detail()
	var lines := VBoxContainer.new()
	lines.add_child(_label("宣言/锁气预览", 20, true))
	for field in ["当前卡名", "阴阳结构", "投入", "势要求", "距离", "效阶"]:
		lines.add_child(_label("%s：%s" % [field, str(detail.get(field, _placeholder()))]))
	lines.add_child(_group_plan_controls())
	return _frame(lines, Vector2(0, 176), "declare_preview", false)

func _response_panel() -> Control:
	var resolution: Dictionary = combat_state.get("resolution", {})
	var lines := VBoxContainer.new()
	lines.add_child(_label("响应/结算", 20, true))
	for field in ["截击", "应招", "效阶", "落果", "势变化"]:
		lines.add_child(_label("%s：%s" % [field, str(resolution.get(field, _placeholder()))]))
	if interaction.state == UIState.RESOLUTION_PREVIEW:
		lines.add_child(_label("气骰去向：【占位：气骰去向】", 16, true))
	return _frame(lines, Vector2(0, 152), "response_resolution", false)

func _demo_buttons() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for item in [
		["宣言预览", UIState.DECLARATION_PREVIEW],
		["模拟响应", UIState.RESPONSE_OPEN],
		["结算预览", UIState.RESOLUTION_PREVIEW],
		["清空", UIState.IDLE]
	]:
		var button := Button.new()
		button.text = item[0]
		button.custom_minimum_size = Vector2(104, 34)
		button.pressed.connect(func() -> void:
			if item[1] == UIState.IDLE:
				interaction.reset()
				drawer_controller.close()
			else:
				if interaction.selected_card_name == "":
					_select_first_available_card()
				if interaction.selected_target_name == "":
					_select_first_target()
				interaction.set_state(item[1])
			_rebuild()
		)
		row.add_child(button)
	return row

func _card_operation_area() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.add_child(_selected_card_panel())
	row.add_child(_hand_panel())
	return _frame(row, Vector2(0, 300), "card_operation", false)

func _selected_card_panel() -> Control:
	selected_detail_box = VBoxContainer.new()
	selected_detail_box.add_theme_constant_override("separation", 6)
	selected_detail_box.add_child(_label("选中卡详情", 22, true))
	var detail := _selected_card_detail()
	for field in ["当前卡名", "阴阳结构", "投入", "势要求", "距离", "效阶"]:
		selected_detail_box.add_child(_label("%s：%s" % [field, str(detail.get(field, _placeholder()))]))
	return _frame(selected_detail_box, Vector2(560, 0), "selected_card", true)

func _hand_panel() -> Control:
	var lines := VBoxContainer.new()
	lines.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lines.add_theme_constant_override("separation", 8)
	lines.add_child(_label("卡牌手牌区", 22, true))
	var cards_row := HBoxContainer.new()
	cards_row.add_theme_constant_override("separation", 8)
	for card in _state_array("cards"):
		if card is Dictionary:
			cards_row.add_child(_action_card(card))
	lines.add_child(cards_row)
	lines.add_child(_qi_summary_line())
	lines.add_child(_drawer_buttons())
	return _frame(lines, Vector2(0, 0), "hand_panel", true)

func _action_card(card: Dictionary) -> Control:
	var card_view: CardView = CardViewScript.new()
	card_view.setup(card)
	var card_name := str(card.get("名称", _placeholder()))
	card_view.set_hovered(card_name == interaction.hovered_card_name)
	card_view.set_selected(card_name == interaction.selected_card_name)
	card_view.mouse_entered.connect(func() -> void:
		interaction.hovered_card_name = card_name
		_update_selected_detail(card)
		card_view.set_hovered(true)
	)
	card_view.mouse_exited.connect(func() -> void:
		if interaction.hovered_card_name == card_name:
			interaction.hovered_card_name = ""
		card_view.set_hovered(false)
	)
	card_view.pressed.connect(func() -> void:
		if bool(card.get("不可用", false)):
			return
		interaction.selected_card_name = card_name
		interaction.set_state(UIState.CARD_SELECTED)
		_rebuild()
	)
	return card_view

func _update_selected_detail(card: Dictionary) -> void:
	if selected_detail_box == null:
		return
	for child in selected_detail_box.get_children():
		child.queue_free()
	selected_detail_box.add_child(_label("选中卡详情", 22, true))
	selected_detail_box.add_child(_label("当前卡名：%s" % str(card.get("名称", _placeholder()))))
	for field in ["阴阳结构", "投入", "势要求", "距离", "效阶"]:
		selected_detail_box.add_child(_label("%s：%s" % [field, str(card.get(field, _placeholder()))]))

func _group_plan_controls() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for index in range(3):
		var button := Button.new()
		button.text = "整组投入方案%s" % str(index + 1)
		button.custom_minimum_size = Vector2(138, 30)
		if interaction.selected_group_plan == index:
			button.modulate = Color(1.0, 0.9, 0.62, 1.0)
		button.pressed.connect(func() -> void:
			interaction.selected_group_plan = index
			_rebuild()
		)
		row.add_child(button)
	return row

func _qi_summary_line() -> Label:
	var qi: Dictionary = combat_state.get("qi_summary", {})
	var parts: Array[String] = []
	for zone in _manifest_array("qi_zones"):
		var zone_name := str(zone)
		parts.append("%s%s" % [zone_name, str(qi.get(zone_name, _placeholder()))])
	return _label("气骰摘要：" + "  ".join(parts), 16, false)

func _drawer_buttons() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	for drawer_name in _manifest_array("main_drawer_buttons"):
		var button := Button.new()
		button.text = str(drawer_name)
		button.custom_minimum_size = Vector2(70, 38)
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(func() -> void:
			_open_drawer(str(drawer_name))
		)
		row.add_child(button)
	return row

func _build_floating_layer() -> void:
	floating_layer = Control.new()
	floating_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	floating_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	floating_layer.z_index = 12
	add_child(floating_layer)
	if interaction.state == UIState.DECLARATION_PREVIEW:
		floating_layer.add_child(_floating_panel("宣言/锁气预览浮起", [
			"当前卡：%s" % _current_card_text(),
			"阴阳结构：【占位：阴阳结构】",
			"投入：【占位：投入】",
			"势要求：【占位：势要求】",
			"目标：%s" % _current_target_text(),
			"气骰摘要：气池 / 气海 / 锁气 / 息库 / 临气区"
		], Vector2(740, 430)))
	if interaction.state == UIState.RESPONSE_OPEN:
		floating_layer.add_child(_floating_panel("响应窗口浮起", [
			"截击：【占位：截击】",
			"应招：【占位：应招】",
			"响应卡区高亮"
		], Vector2(760, 430)))
	if interaction.state == UIState.RESOLUTION_PREVIEW:
		floating_layer.add_child(_floating_panel("结算预览", [
			"效阶：【占位：效阶】",
			"落果：【占位：落果】",
			"势变化：【占位：势变化】",
			"气骰去向：【占位：气骰去向】"
		], Vector2(790, 430)))

func _floating_panel(title: String, lines: Array[String], pos: Vector2) -> Control:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.add_child(_label(title, 24, true))
	for line in lines:
		box.add_child(_label(line))
	var panel := _frame(box, Vector2(460, 0), "floating", false)
	panel.position = pos
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return panel

func _build_drawer_layer() -> void:
	drawer_layer = Control.new()
	drawer_layer.visible = drawer_controller.active_drawer != ""
	drawer_layer.position = Vector2(1360, 110)
	drawer_layer.z_index = 20
	drawer_layer.custom_minimum_size = Vector2(520, 780)
	add_child(drawer_layer)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_FULL_RECT)
	box.add_theme_constant_override("separation", 10)
	drawer_layer.add_child(_nine_patch_background("drawer"))
	drawer_layer.add_child(box)
	var header := HBoxContainer.new()
	drawer_title = _label("%s抽屉" % drawer_controller.active_drawer, 24, true)
	header.add_child(drawer_title)
	header.add_child(_spacer())
	var close := Button.new()
	close.text = "关闭"
	close.pressed.connect(func() -> void:
		drawer_controller.close()
		interaction.active_drawer = ""
		_rebuild()
	)
	header.add_child(close)
	box.add_child(header)
	drawer_body = VBoxContainer.new()
	drawer_body.add_theme_constant_override("separation", 8)
	box.add_child(drawer_body)
	_fill_drawer(drawer_controller.active_drawer)

func _open_drawer(drawer_name: String) -> void:
	if drawer_controller.active_drawer == drawer_name:
		drawer_controller.close()
		interaction.active_drawer = ""
	else:
		drawer_controller.open(drawer_name)
		interaction.active_drawer = drawer_name
	_rebuild()

func _fill_drawer(drawer_name: String) -> void:
	if drawer_name == "":
		return
	drawer_body.add_child(_label("%s抽屉占位" % drawer_name, 22, true))
	match drawer_name:
		"人物":
			drawer_body.add_child(_label("表属性摘要：角色名 / 势 / 状态 / 气骰摘要 / 距离 / 纠缠 / 当前宣言/响应"))
			drawer_body.add_child(_label("进入人物页：【占位：入口】"))
		"背包":
			drawer_body.add_child(_label("物品格占位：【占位：物品格】"))
			drawer_body.add_child(_label("使用 / 装备 / 取物：【占位：操作】"))
		"装备":
			drawer_body.add_child(_label("装备槽占位：【占位：装备槽】"))
		"内功":
			for inner_name in _manifest_array("inner_attributes"):
				drawer_body.add_child(_label("%s：%s" % [str(inner_name), _placeholder()]))
		"外功", "法门":
			drawer_body.add_child(_label("条目占位：【占位：条目】"))
		"规则":
			drawer_body.add_child(_label("规则速查占位：【占位：规则正文】"))
		"日志":
			drawer_body.add_child(_label("日志占位：【占位：日志】"))
		"DM":
			drawer_body.add_child(_label("DM控制占位：【占位：DM】"))

func _selected_card_detail() -> Dictionary:
	var card := _card_by_name(interaction.hovered_card_name)
	if interaction.selected_card_name != "":
		card = _card_by_name(interaction.selected_card_name)
	if card.is_empty():
		return combat_state.get("selected_card_detail", {})
	var detail: Dictionary = (combat_state.get("selected_card_detail", {}) as Dictionary).duplicate()
	detail["当前卡名"] = card.get("名称", _placeholder())
	for field in ["阴阳结构", "投入", "势要求", "距离", "效阶"]:
		if card.has(field):
			detail[field] = card[field]
	return detail

func _card_by_name(card_name: String) -> Dictionary:
	if card_name == "":
		return {}
	for card in _state_array("cards"):
		if card is Dictionary and str(card.get("名称", "")) == card_name:
			return card
	return {}

func _current_card_text() -> String:
	if interaction.selected_card_name != "":
		return interaction.selected_card_name
	if interaction.hovered_card_name != "":
		return interaction.hovered_card_name
	return _state_text("current_card")

func _current_target_text() -> String:
	if interaction.selected_target_name != "":
		return interaction.selected_target_name
	return _state_text("target")

func _frame(content: Control, min_size: Vector2, _slot_name: String, expand_vertical: bool) -> Control:
	var frame := Control.new()
	frame.custom_minimum_size = min_size
	frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if expand_vertical:
		frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var bg := _nine_patch_background(_slot_name)
	frame.add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 12)
	margin.add_child(content)
	frame.add_child(margin)
	return frame

func _nine_patch_background(_slot_name: String) -> NinePatchRect:
	var nine := NinePatchRect.new()
	nine.set_anchors_preset(Control.PRESET_FULL_RECT)
	nine.texture = placeholder_texture
	nine.patch_margin_left = 6
	nine.patch_margin_top = 6
	nine.patch_margin_right = 6
	nine.patch_margin_bottom = 6
	nine.draw_center = true
	return nine

func _make_placeholder_texture() -> Texture2D:
	var image := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.956, 0.918, 0.843, 1.0))
	for i in range(16):
		image.set_pixel(i, 0, Color(0.541, 0.408, 0.271, 1.0))
		image.set_pixel(i, 15, Color(0.541, 0.408, 0.271, 1.0))
		image.set_pixel(0, i, Color(0.541, 0.408, 0.271, 1.0))
		image.set_pixel(15, i, Color(0.541, 0.408, 0.271, 1.0))
	return ImageTexture.create_from_image(image)

func _manifest_array(key: String) -> Array:
	var value = manifest.get(key, [])
	if value is Array:
		return value
	return []

func _state_array(key: String) -> Array:
	var value = combat_state.get(key, [])
	if value is Array:
		return value
	return []

func _state_text(key: String) -> String:
	return str(combat_state.get(key, _placeholder()))

func _placeholder() -> String:
	return str(manifest.get("placeholder_format", "【占位：字段名】"))

func _pill(text_value: String, active: bool = false) -> Label:
	var label := _label(text_value, 18, true)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.custom_minimum_size = Vector2(92, 32)
	if active:
		label.add_theme_color_override("font_color", Color("#6b2f1c"))
	return label

func _label(text_value: String, size: int = 16, bold: bool = false) -> Label:
	var label := Label.new()
	label.text = text_value
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	label.clip_text = true
	label.add_theme_font_size_override("font_size", size)
	if bold:
		label.add_theme_color_override("font_color", Color("#3a2615"))
	return label

func _spacer() -> Control:
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return spacer

func _capture_current() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	RenderingServer.force_draw(false)
	var image := get_viewport().get_texture().get_image()
	var error := image.save_png(capture_path)
	if error != OK:
		push_error("Failed to save screenshot: " + capture_path)
	get_tree().quit(error)
