[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Write-Allow {
  Write-Output '{}'
  exit 0
}

function Write-Block([string]$Reason) {
  @{ decision = 'block'; reason = $Reason } | ConvertTo-Json -Compress | Write-Output
  exit 0
}

try {
  $payloadText = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($payloadText)) {
    Write-Allow
  }

  $payload = $payloadText | ConvertFrom-Json -ErrorAction Stop
} catch {
  Write-Allow
}

$cwd = [string]$payload.cwd
$transcriptPath = [string]$payload.transcriptPath

if ([string]::IsNullOrWhiteSpace($cwd)) {
  Write-Allow
}

try {
  $previousErrorActionPreference = $ErrorActionPreference
  $previousNativeCommandPreference = $null
  $hasNativeCommandPreference = Test-Path variable:PSNativeCommandUseErrorActionPreference

  $ErrorActionPreference = 'Continue'

  if ($hasNativeCommandPreference) {
    $previousNativeCommandPreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  try {
    $unstaged = & git -C $cwd diff --name-only 2>$null
    $unstagedExitCode = $LASTEXITCODE

    $staged = & git -C $cwd diff --name-only --cached 2>$null
    $stagedExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference

    if ($hasNativeCommandPreference) {
      $PSNativeCommandUseErrorActionPreference = $previousNativeCommandPreference
    }
  }

  if ($unstagedExitCode -ne 0 -or $stagedExitCode -ne 0) {
    Write-Allow
  }
} catch {
  Write-Allow
}

$modifiedFiles = @(
  @($unstaged)
  @($staged)
) | ForEach-Object {
  if ($_ -is [string]) {
    $_.Trim()
  }
} | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique

if (@($modifiedFiles).Count -eq 0) {
  Write-Allow
}

$hasFrontendChanges = $false

foreach ($file in @($modifiedFiles)) {
  $normalized = $file -replace '\\', '/'

  if ($normalized -match '^src/components/' -or $normalized -match '\.tsx$') {
    $hasFrontendChanges = $true
  }
}

if (-not $hasFrontendChanges) {
  Write-Allow
}

if ([string]::IsNullOrWhiteSpace($transcriptPath) -or -not (Test-Path -LiteralPath $transcriptPath -PathType Leaf)) {
  Write-Allow
}

try {
  $hasUxReview = [bool](Select-String -LiteralPath $transcriptPath -Pattern 'ux-review|ux_review' -Quiet)
} catch {
  Write-Allow
}

if (-not $hasUxReview) {
  Write-Block "You modified React components but haven't run /ux-review. Please invoke the /ux-review skill on the modified components before stopping."
}

Write-Allow
