extends SceneTree

const OUTPUT_PATH := "res://docs/screenshots/phase2_main.png"

func _initialize() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(1920, 1080)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)

	var packed_scene := load("res://scenes/main.tscn") as PackedScene
	var scene := packed_scene.instantiate()
	scene.set_anchors_preset(Control.PRESET_FULL_RECT)
	viewport.add_child(scene)

	RenderingServer.force_draw(false)
	var image := viewport.get_texture().get_image()
	var error := image.save_png(OUTPUT_PATH)
	if error != OK:
		push_error("Failed to save screenshot: " + OUTPUT_PATH)
	quit(error)
