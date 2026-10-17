$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Dieser Installationscheck ist nur für den Windows-Build bestimmt.' }
$installer = (Resolve-Path 'release/Neon-Trinity-Studio-Setup.exe').Path
function Install-Studio {
  $process = Start-Process -FilePath $installer -ArgumentList '/S' -PassThru
  if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'Die Installation hat zu lange gedauert.' }
  if ($process.ExitCode -ne 0) { throw "Installer fehlgeschlagen: $($process.ExitCode)" }
}
Install-Studio
$apps = @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Programs') -Recurse -File -Filter 'Neon Trinity Studio.exe')
if ($apps.Count -ne 1) { throw 'Das installierte Studio wurde nicht eindeutig gefunden.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
if ($apps[0].VersionInfo.ProductVersion -notlike "$version*") { throw 'Die installierte Programmversion stimmt nicht.' }
$feed = Join-Path $apps[0].DirectoryName 'resources/app-update.yml'
if (-not (Test-Path $feed)) { throw 'Der installierten App fehlt der Update-Kanal.' }
$config = Get-Content $feed -Raw
if ($config -notmatch 'mikejaeson1-wq' -or $config -notmatch 'neon-trinity') { throw 'Die App verwendet einen falschen Update-Kanal.' }
$dataDirectory = Join-Path $env:APPDATA 'Neon Trinity Studio'
New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$sentinel = Join-Path $dataDirectory 'installer-preservation-test.txt'
Set-Content $sentinel 'keep-local-data'
Install-Studio
if ((Get-Content $sentinel -Raw).Trim() -ne 'keep-local-data') { throw 'Die erneute Installation hat lokale Daten verändert.' }
Remove-Item $sentinel
Write-Output 'Windows-Installation, Programmversion, Update-Konfiguration und Erhalt der App-Daten bestätigt.'
