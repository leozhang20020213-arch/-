extends RefCounted
class_name DrawerController

var active_drawer := ""

func open(drawer_name: String) -> void:
	active_drawer = drawer_name

func close() -> void:
	active_drawer = ""

func is_open(drawer_name: String) -> bool:
	return active_drawer == drawer_name
