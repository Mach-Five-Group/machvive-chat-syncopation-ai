#!/bin/sh
# Blocks agent tool calls that would add a runtime dependency to this
# dependency-free package (AGENTS.md, test/package.test.js assert it).
# Input: hook JSON on stdin. Output: permissionDecision JSON on stdout.
input=$(cat)

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

# File edits introducing a "dependencies" block into package.json
# (match literal and JSON-escaped quotes — tool payloads arrive escaped)
case "$input" in
  *package.json*'"dependencies"'*|*package.json*'\"dependencies\"'*)
    deny 'This package is dependency-free by construction. Do not add a runtime dependencies block to package.json (an external npmi script keeps re-adding machvive-webmcp-ai — remove it instead). Dev-only tooling goes in devDependencies. See AGENTS.md.'
    ;;
esac

# Shell commands installing runtime deps: npm install/i <pkg> without --save-dev
case "$input" in
  *'npm install '*|*'npm i '*)
    case "$input" in
      *--save-dev*|*' -D'*|*'npm install -g'*|*'npm i -g'*)
        : # dev tooling and global installs are fine
        ;;
      *)
        deny 'Runtime npm install is blocked: this repo ships zero dependencies (test/package.test.js fails otherwise). Use --save-dev for tooling, or state why a runtime dep is truly required.'
        ;;
    esac
    ;;
esac

exit 0
