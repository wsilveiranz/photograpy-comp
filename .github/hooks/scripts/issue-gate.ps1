$rawInput = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($rawInput)) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

try {
  $payload = $rawInput | ConvertFrom-Json -ErrorAction Stop
} catch {
  [Console]::Out.WriteLine('{"permissionDecision":"deny","permissionDecisionReason":"Issue-first gate: Unable to parse hook input JSON."}')
  exit 0
}

function Normalize-RepoPath {
  param(
    [string]$PathValue,
    [string]$BasePath
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return ''
  }

  $targetPath = $PathValue
  $normalizedBase = ''

  if (-not [string]::IsNullOrWhiteSpace($BasePath)) {
    try {
      $normalizedBase = ([System.IO.Path]::GetFullPath($BasePath) -replace '\\', '/').TrimEnd('/')
    } catch {
      $normalizedBase = ($BasePath -replace '\\', '/').TrimEnd('/')
    }
  }

  try {
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
      $targetPath = [System.IO.Path]::GetFullPath($PathValue)
    } elseif ($BasePath) {
      $targetPath = [System.IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $PathValue))
    }
  } catch {
    $targetPath = $PathValue
  }

  $normalizedTarget = ($targetPath -replace '\\', '/')

  while ($normalizedTarget.StartsWith('./', [System.StringComparison]::Ordinal)) {
    $normalizedTarget = $normalizedTarget.Substring(2)
  }

  if ($normalizedBase -and $normalizedTarget.StartsWith($normalizedBase + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $normalizedTarget.Substring($normalizedBase.Length + 1)
  }

  return $normalizedTarget
}

$toolPath = ''
if ($null -ne $payload.toolArgs) {
  $toolPath = [string]$payload.toolArgs.path
}

$normalizedPath = Normalize-RepoPath -PathValue $toolPath -BasePath ([string]$payload.cwd)
$matchPath = $normalizedPath.ToLowerInvariant()

$isExempt =
  $matchPath -match '(^|/)\.github/' -or
  $matchPath -match '(^|/)apps/docs/' -or
  $matchPath -match '(^|/)docs/' -or
  $matchPath.EndsWith('.md') -or
  $matchPath.Contains('.copilot/session-state')

# Check file-based marker (persists across tool calls unlike env vars)
$issueFromFile = ''
$cwd = [string]$payload.cwd
if (-not [string]::IsNullOrWhiteSpace($cwd)) {
  $markerPath = Join-Path $cwd '.copilot-issue'
  if (Test-Path $markerPath) {
    $issueFromFile = (Get-Content $markerPath -Raw).Trim()
  }
}

$hasIssue = -not [string]::IsNullOrWhiteSpace($env:COPILOT_ISSUE_NUMBER) -or -not [string]::IsNullOrWhiteSpace($issueFromFile)

if ($isExempt -or $hasIssue) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

[Console]::Out.WriteLine('{"permissionDecision":"deny","permissionDecisionReason":"Issue-first gate: No GitHub issue is being tracked. Write the issue number to .copilot-issue (e.g. echo 246 > .copilot-issue) or set COPILOT_ISSUE_NUMBER env var before editing code files. Exempt paths: .github/, docs/, *.md"}')
exit 0
