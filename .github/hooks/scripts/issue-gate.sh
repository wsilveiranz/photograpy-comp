#!/usr/bin/env bash

input="$(cat)"

if [[ -z "${input//[[:space:]]/}" ]]; then
  printf '{}\n'
  exit 0
fi

extract_with_jq() {
  local query="$1"
  printf '%s' "$input" | jq -r "$query" 2>/dev/null
}

extract_with_sed() {
  local key="$1"
  local compact
  compact="$(printf '%s' "$input" | tr -d '\r\n')"
  printf '%s' "$compact" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -n 1
}

json_unescape() {
  local value="$1"
  value="${value//\\\\/\\}"
  value="${value//\\\//\/}"
  value="${value//\\\"/\"}"
  value="${value//\\n/ }"
  value="${value//\\r/ }"
  printf '%s' "$value"
}

if command -v jq >/dev/null 2>&1; then
  tool_path="$(extract_with_jq '.toolArgs.path // empty')"
  cwd_path="$(extract_with_jq '.cwd // empty')"
else
  tool_path="$(json_unescape "$(extract_with_sed 'path')")"
  cwd_path="$(json_unescape "$(extract_with_sed 'cwd')")"
fi

normalize_slashes() {
  printf '%s' "$1" | sed 's#\\#/#g; s#/\{2,\}#/#g'
}

normalize_repo_path() {
  local candidate="$1"
  local base="$2"
  local normalized_candidate normalized_base

  normalized_candidate="$(normalize_slashes "$candidate")"
  normalized_base="$(normalize_slashes "$base")"

  while [[ "$normalized_candidate" == ./* ]]; do
    normalized_candidate="${normalized_candidate#./}"
  done

  if [[ -n "$normalized_base" ]]; then
    local lower_candidate="${normalized_candidate,,}"
    local lower_base="${normalized_base,,}"
    if [[ "$lower_candidate" == "$lower_base/"* ]]; then
      normalized_candidate="${normalized_candidate:$(( ${#normalized_base} + 1 ))}"
    fi
  fi

  printf '%s' "$normalized_candidate"
}

match_path="$(normalize_repo_path "$tool_path" "$cwd_path")"
lower_path="${match_path,,}"

# Check file-based marker (persists across tool calls unlike env vars)
issue_from_file=""
if [[ -n "$cwd_path" && -f "${cwd_path}/.copilot-issue" ]]; then
  issue_from_file="$(cat "${cwd_path}/.copilot-issue" 2>/dev/null | tr -d '\r\n')"
fi

if [[ "$lower_path" =~ (^|/).github/ ]] || \
   [[ "$lower_path" =~ (^|/)apps/docs/ ]] || \
   [[ "$lower_path" =~ (^|/)docs/ ]] || \
   [[ "$lower_path" == *.md ]] || \
   [[ "$lower_path" == *".copilot/session-state"* ]] || \
   [[ -n "${COPILOT_ISSUE_NUMBER:-}" ]] || \
   [[ -n "$issue_from_file" ]]; then
  printf '{}\n'
  exit 0
fi

printf '%s\n' '{"permissionDecision":"deny","permissionDecisionReason":"Issue-first gate: No GitHub issue is being tracked. Write the issue number to .copilot-issue (e.g. echo 246 > .copilot-issue) or set COPILOT_ISSUE_NUMBER before editing code files. Exempt paths: .github/, docs/, *.md"}'
exit 0
