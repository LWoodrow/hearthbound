[CmdletBinding()]
param([switch]$NoBrowser, [switch]$SkipModelWarmup)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDirectory = Join-Path $projectDirectory "data\logs"

function Read-Setting([string]$name, [string]$fallback) {
  $envFile = Join-Path $projectDirectory ".env"
  if (-not (Test-Path -LiteralPath $envFile)) { return $fallback }
  $escaped = [regex]::Escape($name)
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*$escaped\s*=" } | Select-Object -Last 1
  if (-not $line) { return $fallback }
  return (($line -split "=", 2)[1].Trim().Trim('"').Trim("'"))
}
function Test-Service([string]$url) {
  try { $null = Invoke-RestMethod -Uri $url -TimeoutSec 2; return $true } catch { return $false }
}
try {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { throw "Install Node.js 22 or newer, then run this launcher again." }
  if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory "dist\index.html"))) { throw "Build the app first: npm install, then npm run build." }
  $port = Read-Setting "PORT" "4173"
  $secure = (Read-Setting "HTTPS_KEY" "") -and (Read-Setting "HTTPS_CERT" "")
  $scheme = if ($secure) { "https" } else { "http" }
  $campaignUrl = "${scheme}://127.0.0.1:${port}"
  # Web readiness is independent of whether the AI server is reachable.
  $healthUrl = "$campaignUrl/api/lobby"

  # Keep an existing Ollama installation usable during the transition.
  $configuredSettingsFile = Read-Setting "AI_SETTINGS_FILE" "data\ai-settings.json"
  $settingsFile = if ([System.IO.Path]::IsPathRooted($configuredSettingsFile)) { $configuredSettingsFile } else { Join-Path $projectDirectory $configuredSettingsFile }
  if (Test-Path -LiteralPath $settingsFile) { $provider = (Get-Content -Raw -LiteralPath $settingsFile | ConvertFrom-Json).provider }
  else { $provider = Read-Setting "AI_PROVIDER" ""; if (-not $provider -and ((Read-Setting "OLLAMA_URL" "") -or (Read-Setting "DND_MODEL" ""))) { $provider = "ollama" } }
  if ($provider -eq "ollama") {
    $aiUrl = Read-Setting "OLLAMA_URL" "http://127.0.0.1:11434"
    if (Test-Path -LiteralPath $settingsFile) { $aiUrl = (Get-Content -Raw -LiteralPath $settingsFile | ConvertFrom-Json).baseUrl }
    $aiHost = ([uri]$aiUrl).Host
    if ($aiHost -in @("localhost", "127.0.0.1") -and -not (Test-Service "$aiUrl/api/tags")) {
      $ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
      if ($ollama) { Start-Process -FilePath $ollama.Source -ArgumentList "serve" -WindowStyle Hidden }
    }
  }

  if (Test-Service $healthUrl) {
    $null = Invoke-RestMethod -Uri "$campaignUrl/api/system/restart" -Method Post -TimeoutSec 5
    Start-Sleep -Milliseconds 750
  } else {
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    Start-Process -FilePath $node.Source -ArgumentList "--env-file-if-exists=.env", "server/index.mjs" -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "server-output.log") -RedirectStandardError (Join-Path $logDirectory "server-error.log")
  }
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline -and -not (Test-Service $healthUrl)) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Service $healthUrl)) { throw "Hearthbound did not become ready. Check data\logs\server-error.log." }
  Write-Host "Hearthbound is ready: $campaignUrl" -ForegroundColor Green
  Write-Host "Choose AI connection in the game library to set up llama.cpp or a remote server."
  Write-Host "Server logs: $logDirectory"
  if (-not $NoBrowser) { Start-Process $campaignUrl }
} catch {
  Write-Error $_
  exit 1
}
