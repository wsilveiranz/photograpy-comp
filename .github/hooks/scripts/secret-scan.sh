#!/usr/bin/env bash

input="$(cat)"

if [[ -z "${input//[[:space:]]/}" ]]; then
  printf '{}\n'
  exit 0
fi

have_jq=0
command -v jq >/dev/null 2>&1 && have_jq=1

get_field() {
  local query="$1"
  if [[ "$have_jq" -eq 1 ]]; then
    printf '%s' "$input" | jq -r "$query // empty" 2>/dev/null
  fi
}

tool_path="$(get_field '.toolArgs.path')"
cwd_path="$(get_field '.cwd')"

normalize_slashes() { printf '%s' "$1" | sed 's#\\#/#g; s#/\{2,\}#/#g'; }

normalize_repo_path() {
  local candidate base normalized_candidate normalized_base
  candidate="$(normalize_slashes "$1")"
  base="$(normalize_slashes "$2")"
  while [[ "$candidate" == ./* ]]; do candidate="${candidate#./}"; done
  if [[ -n "$base" ]]; then
    local lc="${candidate,,}" lb="${base,,}"
    if [[ "$lc" == "$lb/"* ]]; then
      candidate="${candidate:$(( ${#base} + 1 ))}"
    fi
  fi
  printf '%s' "$candidate"
}

match_path="$(normalize_repo_path "$tool_path" "$cwd_path")"
lower_path="${match_path,,}"

# Only guard source; config/docs/emulator settings are out of scope.
in_scope=0
if [[ "$lower_path" =~ (^|/)src/ ]] || [[ "$lower_path" =~ (^|/)api/src/ ]]; then
  in_scope=1
fi

if [[ "$in_scope" -eq 0 ]] || \
   [[ "$lower_path" == *.md ]] || \
   [[ "$lower_path" =~ (^|/)\.github/ ]] || \
   [[ "$lower_path" =~ (^|/)docs/ ]] || \
   [[ "$lower_path" == *local.settings.json ]] || \
   [[ "$lower_path" == *.example* ]] || \
   [[ "$lower_path" =~ (^|/)__(tests|fixtures|mocks)__/ ]] || \
   [[ "$lower_path" == *".copilot/session-state"* ]]; then
  printf '{}\n'
  exit 0
fi

content=""
if [[ "$have_jq" -eq 1 ]]; then
  content="$(printf '%s' "$input" | jq -r '[.toolArgs.file_text, .toolArgs.new_str, .toolArgs.content] | map(select(. != null)) | join("\n")' 2>/dev/null)"
fi

if [[ -z "${content//[[:space:]]/}" ]]; then
  printf '{}\n'
  exit 0
fi

hits=()
grep -Eq 'AccountKey[[:space:]]*=[[:space:]]*[A-Za-z0-9+/]{30,}={0,2}' <<<"$content" && hits+=("Azure Storage AccountKey")
grep -Eq '[?&]sig=[A-Za-z0-9%]{20,}' <<<"$content" && hits+=("Azure SAS signature")
grep -Eq -- '-----BEGIN([[:space:]]+[A-Z]+)*[[:space:]]+PRIVATE KEY-----' <<<"$content" && hits+=("Private key block")
grep -Eq 'AKIA[0-9A-Z]{16}' <<<"$content" && hits+=("AWS access key id")
grep -Eq 'gh[pousr]_[0-9A-Za-z]{20,}' <<<"$content" && hits+=("GitHub token")
grep -Eq 'AIza[0-9A-Za-z_-]{35}' <<<"$content" && hits+=("Google API key")
grep -Eq 'xox[baprs]-[0-9A-Za-z-]{10,}' <<<"$content" && hits+=("Slack token")
grep -Eiq '(password|passwd|secret|api[_-]?key|access[_-]?key|client[_-]?secret|connection[_-]?string)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'${<][^"'"'"']{7,}["'"'"']' <<<"$content" && hits+=("Secret assignment literal")

if [[ "${#hits[@]}" -eq 0 ]]; then
  printf '{}\n'
  exit 0
fi

joined="$(IFS=', '; printf '%s' "${hits[*]}")"
reason="Secure-by-default gate: possible hardcoded secret/credential in source (${joined}). Move credentials and config to runtime configuration (app settings/env), read them via getStorageConnection()/process.env, and fail closed when missing. If this is a false positive (e.g. a documented non-secret placeholder), place it in gitignored config or an exempt path, or invoke the /security-review skill to review."

if [[ "$have_jq" -eq 1 ]]; then
  jq -cn --arg r "$reason" '{permissionDecision:"deny",permissionDecisionReason:$r}'
else
  printf '{"permissionDecision":"deny","permissionDecisionReason":"%s"}\n' "$reason"
fi
exit 0
