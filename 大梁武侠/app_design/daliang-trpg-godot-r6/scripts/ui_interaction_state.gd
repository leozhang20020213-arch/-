extends RefCounted
class_name UIInteractionState

const IDLE := "IDLE"
const CARD_SELECTED := "CARD_SELECTED"
const TARGET_SELECTED := "TARGET_SELECTED"
const DECLARATION_PREVIEW := "DECLARATION_PREVIEW"
const RESPONSE_OPEN := "RESPONSE_OPEN"
const RESOLUTION_PREVIEW := "RESOLUTION_PREVIEW"

const ALL_STATES := [
	IDLE,
	CARD_SELECTED,
	TARGET_SELECTED,
	DECLARATION_PREVIEW,
	RESPONSE_OPEN,
	RESOLUTION_PREVIEW
]

var state := IDLE
var hovered_card_name := ""
var selected_card_name := ""
var selected_target_name := ""
var active_drawer := ""
var selected_group_plan := 0

func set_state(next_state: String) -> void:
	if next_state in ALL_STATES:
		state = next_state

func reset() -> void:
	state = IDLE
	hovered_card_name = ""
	selected_card_name = ""
	selected_target_name = ""
	active_drawer = ""
	selected_group_plan = 0
