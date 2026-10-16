#!/bin/sh
# Blocks agent tool calls that would add a runtime dependency to this
# dependency-free package (AGENTS.md, test/package.test.js assert it).
# Input: hook JSON on stdin. Output: permissionDecision JSON on stdout.
#
# The guard is absolute by design — no whitelisted paths or commands. An escape
# hatch is where the invariant quietly dies. Work that legitimately needs npm in
# another repo or a scratch dir runs outside this hook's workspace, or with the
# hook temporarily disabled by the user — a deliberate act, not a baked-in bypass.
input=$(cat)

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

# The runtime-dependency manifest key, quoted both literally and JSON-escaped.
DEPS='"'"'dependencies'"'"'
DEPS_ESC='\"dependencies\"'

# File edits introducing a runtime-dependency block into package.json
case "$input" in
  *package.json*"$DEPS"*|*package.json*"$DEPS_ESC"*)
    deny 'This package is dependency-free by construction. Do not add a runtime dependency block to package.json (an external npmi script keeps re-adding machvive-webmcp-ai — remove it instead). Dev-only tooling goes in devDependencies. See AGENTS.md.'
    ;;
esac

# Shell commands installing a runtime dependency: npm install/i <pkg> with no
# --save-dev / -D / -g flag and not a bare lock-file restore.
case "$input" in
  *'npm install '*|*'npm i '*)
    case "$input" in
      *--save-dev*|*' -D'*|*'npm install -g'*|*'npm i -g'*|*"npm install'"|*"npm i'"*)
        : # dev tooling, global installs, and bare `npm install` (restores the lock file) are fine
        ;;
      *)
        deny 'Runtime npm install is blocked: this repo ships zero dependencies (test/package.test.js fails otherwise). Use --save-dev for tooling, or state why a runtime dep is truly required.'
        ;;
    esac
    ;;
esac

exit 0
