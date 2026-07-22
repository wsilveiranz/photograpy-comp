#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'

function Write-EmptyResponse {
  [Console]::Out.WriteLine('{}')
  exit 0
}

function Get-ToolCommandText {
  param($ToolArgs)

  if ($null -eq $ToolArgs) {
    return ''
  }

  if ($ToolArgs -is [string]) {
    return $ToolArgs
  }

  $commandProperty = $ToolArgs.PSObject.Properties['command']
  if ($null -ne $commandProperty) {
    return [string]$commandProperty.Value
  }

  return ''
}

function Test-IsGitCommitCommand {
  param([string]$CommandText)

  if ([string]::IsNullOrWhiteSpace($CommandText)) {
    return $false
  }

  return $CommandText -match '(?is)\bgit\b[^\r\n]*\bcommit\b'
}

function Test-CommitSucceeded {
  param([string]$ResultText)

  if ([string]::IsNullOrWhiteSpace($ResultText)) {
    return $false
  }

  return $ResultText -match '(?im)^\[[^\]\r\n]*\b[0-9a-f]{7,40}\]'
}

function Test-IsExemptPath {
  param([string]$PathText)

  if ([string]::IsNullOrWhiteSpace($PathText)) {
    return $true
  }

  $normalizedPath = $PathText -replace '\\', '/'
  $leafName = [System.IO.Path]::GetFileName($normalizedPath)

  return $normalizedPath.StartsWith('.github/') -or
    $normalizedPath.StartsWith('docs/') -or
    $normalizedPath.StartsWith('apps/docs/') -or
    $normalizedPath -match '(?i)\.md$' -or
    $leafName -ieq 'package-lock.json'
}

try {
  $rawInput = [Console]::In.ReadToEnd()
} catch {
  Write-EmptyResponse
}

if ([string]::IsNullOrWhiteSpace($rawInput)) {
  Write-EmptyResponse
}

try {
  $payload = $rawInput | ConvertFrom-Json -Depth 10
} catch {
  Write-EmptyResponse
}

$commandText = Get-ToolCommandText -ToolArgs $payload.toolArgs
if (-not (Test-IsGitCommitCommand -CommandText $commandText)) {
  Write-EmptyResponse
}

$resultText = ''
if ($null -ne $payload.toolResult) {
  $resultProperty = $payload.toolResult.PSObject.Properties['textResultForLlm']
  if ($null -ne $resultProperty) {
    $resultText = [string]$resultProperty.Value
  }
}

if (-not (Test-CommitSucceeded -ResultText $resultText)) {
  Write-EmptyResponse
}

$cwd = [string]$payload.cwd
if ([string]::IsNullOrWhiteSpace($cwd)) {
  Write-EmptyResponse
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-EmptyResponse
}

$null = & git -C $cwd rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-EmptyResponse
}

$commitMessage = (& git -C $cwd log -1 --pretty=%B 2>$null | Out-String).TrimEnd()
if ($LASTEXITCODE -ne 0) {
  Write-EmptyResponse
}

if ($commitMessage -match '(?im)\b(?:Fixes|Closes)\s+#\d+\b') {
  Write-EmptyResponse
}

$changedFiles = @(& git -C $cwd diff-tree --no-commit-id --name-only -r HEAD 2>$null)
if ($LASTEXITCODE -ne 0) {
  Write-EmptyResponse
}

if ($changedFiles.Count -eq 0) {
  Write-EmptyResponse
}

$nonExemptFiles = @($changedFiles | Where-Object { -not (Test-IsExemptPath -PathText $_) })
if ($nonExemptFiles.Count -eq 0) {
  Write-EmptyResponse
}

$warning = '⚠️ Commit lint: Your last commit does not reference a GitHub issue (Fixes #N or Closes #N). This violates the issue-first workflow. Please amend the commit with: git commit --amend -m "<message>\n\nFixes #N\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"'
@{ additionalContext = $warning } | ConvertTo-Json -Compress
exit 0
