$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$inputJson = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputJson)) {
  [Console]::Out.WriteLine('{}')
  exit 0
}

try {
  $payload = $inputJson | ConvertFrom-Json -ErrorAction Stop
} catch {
  [Console]::Out.WriteLine('{}')
  exit 0
}

$lines = @(
  '### Commit Conventions (injected by hook)',
  '- Every commit MUST reference a GitHub issue: use "Fixes #N" or "Closes #N"',
  '- Include trailer: Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>',
  '- If COPILOT_ISSUE_NUMBER is set in your environment, use that issue number',
  '',
  '### Project Conventions (injected by hook)',
  '- Components call the backend only through src/services/* (never fetch/storage SDK directly)',
  '- Azure Functions delegate storage/business logic to api/src/shared/*',
  '- Enforce the 5-photos-per-competition limit server-side, not just in the UI',
  '- Frontend env vars require the VITE_ prefix; type-check with npx tsc -b',
  '- After changing any React component, invoke the /ux-review skill; run /frontend-test'
)

$result = @{
  additionalContext = ($lines -join "`n")
} | ConvertTo-Json -Compress

[Console]::Out.WriteLine($result)
exit 0
