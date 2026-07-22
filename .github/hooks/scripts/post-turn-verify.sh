#!/usr/bin/env bash

set -u

allow() {
  printf '{}\n'
  exit 0
}

input_json="$(cat)"
[ -n "$input_json" ] || allow

parse_json() {
  if command -v node >/dev/null 2>&1; then
    if printf '%s' "$input_json" | node -e 'let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(raw);
    process.stdout.write(`${data.cwd ?? ""}\n${data.transcriptPath ?? ""}\n`);
  } catch {
    process.exit(1);
  }
});'
    then
      return 0
    fi
  fi

  if command -v python3 >/dev/null 2>&1; then
    if printf '%s' "$input_json" | python3 -c 'import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
print(data.get("cwd", ""))
print(data.get("transcriptPath", ""))'
    then
      return 0
    fi
  fi

  if command -v python >/dev/null 2>&1; then
    if printf '%s' "$input_json" | python -c 'import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
print(data.get("cwd", ""))
print(data.get("transcriptPath", ""))'
    then
      return 0
    fi
  fi

  return 1
}

path_to_shell() {
  local raw_path="$1"

  if [ -z "$raw_path" ]; then
    return 0
  fi

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$raw_path" 2>/dev/null && return 0
  fi

  printf '%s\n' "$raw_path"
}

parsed_payload="$(parse_json)" || allow
cwd="$(printf '%s\n' "$parsed_payload" | sed -n '1p')"
transcript_path="$(printf '%s\n' "$parsed_payload" | sed -n '2p')"
[ -n "$cwd" ] || allow

cwd_path="$(path_to_shell "$cwd")"
transcript_shell_path="$(path_to_shell "$transcript_path")"

unstaged="$(git -C "$cwd_path" diff --name-only 2>/dev/null)" || allow
staged="$(git -C "$cwd_path" diff --name-only --cached 2>/dev/null)" || allow

modified_files="$(printf '%s\n%s\n' "$unstaged" "$staged" | sed '/^[[:space:]]*$/d' | sort -u)"
[ -n "$modified_files" ] || allow

frontend_changed=false

while IFS= read -r file_path; do
  [ -n "$file_path" ] || continue
  normalized_path="${file_path//\\//}"

  case "$normalized_path" in
    src/components/*|*.tsx)
      frontend_changed=true
      ;;
  esac
done <<< "$modified_files"

if [ "$frontend_changed" = false ]; then
  allow
fi

[ -n "$transcript_shell_path" ] || allow
[ -r "$transcript_shell_path" ] || allow

if grep -Eiq 'ux-review|ux_review' "$transcript_shell_path"; then
  allow
fi

printf '{"decision":"block","reason":"%s"}\n' "You modified React components but haven't run /ux-review. Please invoke the /ux-review skill on the modified components before stopping."
exit 0
