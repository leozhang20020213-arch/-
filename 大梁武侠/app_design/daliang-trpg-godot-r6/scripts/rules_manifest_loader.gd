extends RefCounted
class_name RulesManifestLoader

const DEFAULT_PATH := "res://data/rules_ui_manifest.json"

static func load_manifest(path: String = DEFAULT_PATH) -> Dictionary:
	return _read_json(path)

static func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("Missing rules UI manifest: " + path)
		return {}
	var text := FileAccess.get_file_as_string(path)
	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Rules UI manifest is not a JSON object: " + path)
		return {}
	return parsed
