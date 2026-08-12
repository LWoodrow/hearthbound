[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = "C:\Program Files\nodejs\node.exe"
$ollamaPath = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
$healthUrl = "http://127.0.0.1:4173/api/health"
$campaignUrl = "http://127.0.0.1:4173"
$ollamaUrl = "http://127.0.0.1:11434/api/tags"

function Test-LocalService([string]$url) {
  try {
    $null = Invoke-RestMethod -Uri $url -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Wait-ForService([string]$url, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-LocalService $url) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

try {
  if (-not (Test-Path -LiteralPath $nodePath)) {
    throw "Node.js was not found at $nodePath."
  }
  if (-not (Test-Path -LiteralPath $ollamaPath)) {
    throw "Ollama was not found at $ollamaPath."
  }

  if (-not (Test-LocalService $ollamaUrl)) {
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
    if (-not (Wait-ForService $ollamaUrl 20)) {
      throw "The local AI did not become ready within 20 seconds."
    }
  }

  if (-not (Test-LocalService $healthUrl)) {
    Start-Process -FilePath $nodePath -ArgumentList "--env-file-if-exists=.env", "server/index.mjs" `
      -WorkingDirectory $projectDirectory -WindowStyle Hidden
    if (-not (Wait-ForService $healthUrl 30)) {
      throw "Hearthbound did not become ready within 30 seconds."
    }
  }

  if (-not $NoBrowser) {
    Start-Process $campaignUrl
  }
} catch {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "$($_.Exception.Message)`n`nThe campaign files are in:`n$projectDirectory",
    "Hearthbound could not start",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}
