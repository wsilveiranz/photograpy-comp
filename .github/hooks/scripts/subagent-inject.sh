#!/usr/bin/env bash

set -u

input_json="$(cat)"
trimmed="${input_json//$'\r'/}"
trimmed="${trimmed//$'\n'/}"
trimmed="${trimmed//$'\t'/}"
trimmed="${trimmed// /}"

if [[ -z "$trimmed" ]]; then
  printf '{}\n'
  exit 0
fi

additional_context='### Commit Conventions (injected by hook)
- Every commit MUST reference a GitHub issue: use "Fixes #N" or "Closes #N"
- Include trailer: Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
- If COPILOT_ISSUE_NUMBER is set in your environment, use that issue number

### Project Conventions (injected by hook)
- Components call the backend only through src/services/* (never fetch/storage SDK directly)
- Azure Functions delegate storage/business logic to api/src/shared/*
- Enforce the 5-photos-per-competition limit server-side, not just in the UI
- Frontend env vars require the VITE_ prefix; type-check with npx tsc -b
- After changing any React component, invoke the /ux-review skill; run /frontend-test'

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

printf '{"additionalContext":"%s"}\n' "$(json_escape "$additional_context")"
exit 0
