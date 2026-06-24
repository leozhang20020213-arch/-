# OpenHands TRPG Root Rules

## Workspace Entry

- OpenHands workspace root may be `/workspace/project`.
- Host path may be `D:\trpg`.
- The real TRPG project is:

```text
/workspace/project/大梁武侠
```

If `/workspace/project` contains a folder named `大梁武侠`, enter that folder before inspecting or editing the rulebook project.

## Do Not Misdiagnose

If `/workspace/project` only appears to contain `.git`, report a workspace mount failure.

If `/workspace/project/大梁武侠` exists, that is the main project and must be inspected first.

## Permission

OpenHands may read, create, and modify files under:

```text
/workspace/project/大梁武侠
```

High-risk destructive operations still require an admin request.
