#!/usr/bin/env sh

input="$(cat)"

# Empty or whitespace-only → allow
if [ -z "$(printf '%s' "$input" | tr -d '[:space:]')" ]; then
  printf '{}\n'
  exit 0
fi

# Extract summary text using jq if available, otherwise sed fallback
if command -v jq >/dev/null 2>&1; then
  summary_text="$(printf '%s' "$input" | jq -r '
    if .toolArgs.summary and (.toolArgs.summary | type) == "string" and (.toolArgs.summary | length) > 0
    then .toolArgs.summary
    elif .toolArgs.plan and (.toolArgs.plan | type) == "string" and (.toolArgs.plan | length) > 0
    then .toolArgs.plan
    else (.toolArgs | tostring)
    end
  ' 2>/dev/null)"
else
  # Fallback: extract "summary" or "plan" string value via sed, then use full input if both absent
  summary_text="$(printf '%s' "$input" | tr -d '\r\n' | \
    sed -n 's/.*"summary"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$summary_text" ]; then
    summary_text="$(printf '%s' "$input" | tr -d '\r\n' | \
      sed -n 's/.*"plan"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  fi
  if [ -z "$summary_text" ]; then
    summary_text="$input"
  fi
fi

# If no text found at all → allow (never wedge the agent)
if [ -z "$(printf '%s' "$summary_text" | tr -d '[:space:]')" ] || [ "$summary_text" = "null" ]; then
  printf '{}\n'
  exit 0
fi

# Check for regression risk marker (case-insensitive)
if printf '%s' "$summary_text" | grep -qi 'regression risk'; then
  printf '{}\n'
  exit 0
fi

printf '%s\n' '{"permissionDecision":"deny","permissionDecisionReason":"Regression risk gate: the plan must state its regression risk. Add a '\''Regression Risk: none \u2014 no cross-cutting surfaces touched'\'' line, OR a '\''Regression Risk Analysis'\'' section (affected consumers + targeted tests + commitment to invoke /regression-analysis) when the change touches shared UI components, api/src/shared, or the Azure Table entity shapes. See the plan-mode and regression-analysis skills."}'
exit 0
