[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$SkipModelWarmup
)

$ErrorActionPreference = "Stop"
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDirectory = Join-Path $projectDirectory "data\logs"
$healthUrl = "http://127.0.0.1:4173/api/health"
$campaignUrl = "http://127.0.0.1:4173"
$ollamaUrl = "http://127.0.0.1:11434/api/tags"

function Find-Program([string]$name, [string[]]$fallbacks) {
  $command = Get-Command $name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in $fallbacks) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

function Read-EnvSetting([string]$name, [string]$defaultValue) {
  $envFile = Join-Path $projectDirectory ".env"
  if (-not (Test-Path -LiteralPath $envFile)) { return $defaultValue }
  $escapedName = [regex]::Escape($name)
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*$escapedName\s*=" } | Select-Object -Last 1
  if (-not $line) { return $defaultValue }
  return (($line -split "=", 2)[1].Trim().Trim('"').Trim("'"))
}

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
  $nodePath = Find-Program "node.exe" @("C:\Program Files\nodejs\node.exe")
  $ollamaPath = Find-Program "ollama.exe" @((Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"))
  if (-not $nodePath) { throw "Node.js was not found. Install Node.js 22 or newer and try again." }
  if (-not $ollamaPath) { throw "Ollama was not found. Install Ollama and try again." }
  $model = Read-EnvSetting "DND_MODEL" "qwen3:14b-q4_K_M"

  if (-not (Test-LocalService $ollamaUrl)) {
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
    if (-not (Wait-ForService $ollamaUrl 20)) {
      throw "The local AI did not become ready within 20 seconds."
    }
  }

  $installedModels = @((Invoke-RestMethod -Uri $ollamaUrl -TimeoutSec 5).models | ForEach-Object { $_.name })
  if ($model -notin $installedModels) {
    throw "The configured Ollama model '$model' is not installed. Run: ollama pull $model"
  }

  if (-not $SkipModelWarmup) {
    $warmupBody = @{ model = $model; prompt = ""; stream = $false; keep_alive = "30m"; options = @{ num_predict = 1 } } | ConvertTo-Json -Depth 4
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/generate" -Method Post -ContentType "application/json" -Body $warmupBody -TimeoutSec 180
  }

  if (-not (Test-LocalService $healthUrl)) {
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    Start-Process -FilePath $nodePath -ArgumentList "--env-file-if-exists=.env", "server/index.mjs" `
      -WorkingDirectory $projectDirectory -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $logDirectory "server-output.log") `
      -RedirectStandardError (Join-Path $logDirectory "server-error.log")
    if (-not (Wait-ForService $healthUrl 30)) {
      throw "Hearthbound did not become ready within 30 seconds."
    }
  }

  Write-Host "Hearthbound is ready: $campaignUrl" -ForegroundColor Green
  Write-Host "Ollama model: $model"
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    ForEach-Object { Write-Host "Other devices: http://$($_.IPAddress):4173" }
  Write-Host "Server logs: $logDirectory"

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
  Write-Error $_
  exit 1
}
