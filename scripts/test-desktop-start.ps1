$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Dieser Startcheck ist nur für den Windows-Build bestimmt.' }
$desktopApps = @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs') -Recurse -File -Filter 'Neon Trinity Studio.exe')
if ($desktopApps.Count -ne 1) { throw 'Die installierte App wurde nicht eindeutig gefunden.' }
$desktopProcess = $null
$desktopOldLogging = $env:ELECTRON_ENABLE_LOGGING
try {
  Get-Process -Name 'Neon Trinity Studio' -ErrorAction SilentlyContinue | Stop-Process -Force
  $env:ELECTRON_ENABLE_LOGGING = '1'
  $desktopProcess = Start-Process -FilePath $desktopApps[0].FullName -PassThru -RedirectStandardError (Join-Path $env:RUNNER_TEMP 'neon-studio-start.log')
  $desktopReady = $false
  for ($desktopAttempt = 0; $desktopAttempt -lt 60; $desktopAttempt++) {
    Start-Sleep -Milliseconds 200
    $desktopProcess.Refresh()
    if ($desktopProcess.HasExited) { throw 'Die installierte App wurde beim Start unerwartet beendet.' }
    if ($desktopProcess.MainWindowTitle -match '(Übersicht|Team & Discord) · Neon Trinity Studio') { $desktopReady = $true; break }
  }
  if (-not $desktopReady) { throw "Die Studio-Oberfläche wurde nicht geladen. Fenstertitel: $($desktopProcess.MainWindowTitle)" }
  Write-Output 'Installierte Windows-App startet und lädt die vollständige Studio-Oberfläche.'
} finally {
  if ($desktopProcess -and -not $desktopProcess.HasExited) { $desktopProcess.CloseMainWindow() | Out-Null; if (-not $desktopProcess.WaitForExit(5000)) { $desktopProcess.Kill() } }
  $env:ELECTRON_ENABLE_LOGGING = $desktopOldLogging
}
