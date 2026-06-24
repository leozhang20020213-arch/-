# OpenHands Workspace Rules

## Main Workspace

- The main project workspace is `/workspace/project`.
- Host path: `D:\trpg\大梁武侠`.
- This folder contains the TRPG rulebooks, databases, logs, reports, simulator files, and future app work.

## Important Paths

- Rulebooks: `/workspace/project/rulebooks`
- Databases and spreadsheets: `/workspace/project/*.xlsx`
- Reports: `/workspace/project/reports`
- Work logs: `/workspace/project/work_logs`
- Agents: `/workspace/project/agents`
- App design/prototype work: `/workspace/project/app_design`
- Project state files: `/workspace/project/progress_state.json`, `/workspace/project/decision_log.md`, `/workspace/project/iteration_log.md`

## Permissions

OpenHands may:

- read the whole project under `/workspace/project`
- create and modify files under `/workspace/project`
- run project-level scripts and checks
- create reports under `/workspace/project/reports`
- create future app prototype files under `/workspace/project/app_design`

OpenHands must not directly:

- modify `C:\`
- modify Windows environment variables
- modify registry or system services
- install global dependencies
- modify Docker Desktop global settings
- read or modify token, cookie, key, SSH, or Codex files
- delete, move, or rename many files at once
- overwrite large rulebook sections without a scoped task and review report

For high-risk or system-level operations, create an admin request in:

```text
/admin_requests/REQ-YYYYMMDD-HHMMSS.md
```

## Current Working Rule

When asked to inspect the TRPG project, inspect `/workspace/project`, not `/workspace` and not `/workspace/project/.git` only.

If `/workspace/project` appears empty or only contains `.git`, stop and report a workspace mount failure instead of concluding the project files are missing.
