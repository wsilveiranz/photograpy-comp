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

function Normalize-RepoPath {
  param([string]$PathValue, [string]$BasePath)

  if ([string]::IsNullOrWhiteSpace($PathValue)) { return '' }

  $targetPath = $PathValue
  try {
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
      $targetPath = [System.IO.Path]::GetFullPath($PathValue)
    } elseif ($BasePath) {
      $targetPath = [System.IO.Path]::GetFullPath((Join-Path -Path $BasePath -ChildPath $PathValue))
    }
  } catch { $targetPath = $PathValue }

  $normalizedBase = ''
  if (-not [string]::IsNullOrWhiteSpace($BasePath)) {
    try { $normalizedBase = ([System.IO.Path]::GetFullPath($BasePath) -replace '\\', '/').TrimEnd('/') }
    catch { $normalizedBase = ($BasePath -replace '\\', '/').TrimEnd('/') }
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

$toolArgs = $payload.toolArgs
$toolPath = ''
if ($null -ne $toolArgs) { $toolPath = [string]$toolArgs.path }

$normalizedPath = Normalize-RepoPath -PathValue $toolPath -BasePath ([string]$payload.cwd)
$matchPath = $normalizedPath.ToLowerInvariant()

# Only guard source files; config/docs/emulator settings are out of scope here.
$inScope = ($matchPath -match '(^|/)src/' -or $matchPath -match '(^|/)api/src/')
$isExempt =
  $matchPath.EndsWith('.md') -or
  $matchPath -match '(^|/)\.github/' -or
  $matchPath -match '(^|/)docs/' -or
  $matchPath -match 'local\.settings\.json$' -or
  $matchPath -match '\.example($|\.)' -or
  $matchPath -match '(^|/)__(tests|fixtures|mocks)__/' -or
  $matchPath.Contains('.copilot/session-state')

if (-not $inScope -or $isExempt) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

# Content being written (create => file_text; edit => new_str).
$content = ''
if ($null -ne $toolArgs) {
  foreach ($field in @('file_text', 'new_str', 'content')) {
    $val = [string]$toolArgs.$field
    if (-not [string]::IsNullOrEmpty($val)) { $content += "`n" + $val }
  }
}
if ([string]::IsNullOrWhiteSpace($content)) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

# High-confidence secret patterns (label => regex).
$patterns = [ordered]@{
  'Azure Storage AccountKey' = 'AccountKey\s*=\s*[A-Za-z0-9+/]{30,}={0,2}'
  'Azure SAS signature'      = '[?&]sig=[A-Za-z0-9%]{20,}'
  'Private key block'        = '-----BEGIN(?:\s+[A-Z]+)*\s+PRIVATE KEY-----'
  'AWS access key id'        = 'AKIA[0-9A-Z]{16}'
  'GitHub token'             = 'gh[pousr]_[0-9A-Za-z]{20,}'
  'Google API key'           = 'AIza[0-9A-Za-z_\-]{35}'
  'Slack token'              = 'xox[baprs]-[0-9A-Za-z-]{10,}'
  'Secret assignment literal' = '(?i)(password|passwd|secret|api[_-]?key|access[_-]?key|client[_-]?secret|connection[_-]?string)\s*[:=]\s*["''][^"''${<][^"'']{7,}["'']'
}

$hits = @()
foreach ($label in $patterns.Keys) {
  if ([System.Text.RegularExpressions.Regex]::IsMatch($content, $patterns[$label])) {
    $hits += $label
  }
}

if ($hits.Count -eq 0) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

$reason = "Secure-by-default gate: possible hardcoded secret/credential in source ($($hits -join ', ')). " +
  "Move credentials and config to runtime configuration (app settings/env), read them via getStorageConnection()/process.env, and fail closed when missing. " +
  "If this is a false positive (e.g. a documented non-secret placeholder), place it in gitignored config or an exempt path, or invoke the /security-review skill to review."

$result = @{ permissionDecision = 'deny'; permissionDecisionReason = $reason } | ConvertTo-Json -Compress
[Console]::Out.WriteLine($result)
exit 0
