# Native Windows reference

New Eric development moved to the sibling `robot-790-docker` repository on
2026-10-09. Its `work/` tree is the authoritative application source.

Keep this installation as the native Windows reference and rollback. Only make
changes here when explicitly requested for this installation. Do not export over
the Docker source or automatically backport its changes. The old STS exporter
rejects a destination marked authoritative.

Personality, B2, tool manuals/descriptions and body instructions require exact
before/after text and intended effect shown to the user before editing.

Never create branches unless the user explicitly asks. When asked to publish,
commit and push the current branch directly; do not open a PR by default.
