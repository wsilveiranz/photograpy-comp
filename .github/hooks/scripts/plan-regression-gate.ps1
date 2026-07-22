[CmdletBinding()]
param()

$rawInput = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($rawInput)) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

try {
  $payload = $rawInput | ConvertFrom-Json -ErrorAction Stop
} catch {
  [Console]::Out.WriteLine('{}')
  exit 0
}

# Extract summary text from known fields; fall back to stringifying toolArgs
$summaryText = ''
if ($null -ne $payload.toolArgs) {
  if (-not [string]::IsNullOrWhiteSpace([string]$payload.toolArgs.summary)) {
    $summaryText = [string]$payload.toolArgs.summary
  } elseif (-not [string]::IsNullOrWhiteSpace([string]$payload.toolArgs.plan)) {
    $summaryText = [string]$payload.toolArgs.plan
  } else {
    try {
      $summaryText = ($payload.toolArgs | ConvertTo-Json -Depth 5 -Compress)
    } catch {
      $summaryText = [string]$payload.toolArgs
    }
  }
}

# If no text found at all, allow (never wedge the agent)
if ([string]::IsNullOrWhiteSpace($summaryText)) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

# Check for regression risk marker (case-insensitive)
if ($summaryText -imatch 'regression risk') {
  [Console]::Out.WriteLine('{}')
  exit 0
}

[Console]::Out.WriteLine('{"permissionDecision":"deny","permissionDecisionReason":"Regression risk gate: the plan must state its regression risk. Add a ''Regression Risk: none \u2014 no cross-cutting surfaces touched'' line, OR a ''Regression Risk Analysis'' section (affected consumers + targeted tests + commitment to invoke /regression-analysis) when the change touches shared UI components, api/src/shared, or the Azure Table entity shapes. See the plan-mode and regression-analysis skills."}')
exit 0
