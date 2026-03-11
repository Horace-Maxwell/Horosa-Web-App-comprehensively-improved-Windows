$ErrorActionPreference = 'Continue'

$targets = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -in @('pythonw.exe', 'python.exe', 'java.exe', 'node.exe', 'HorosaDesktop.exe') -and (
    [string]$_.CommandLine -match 'Horosa-Web-App-comprehensively-improved-Windows-main' -or
    [string]$_.CommandLine -match 'horosa_desktop' -or
    [string]$_.CommandLine -match 'astrostudyboot' -or
    [string]$_.CommandLine -match '127\\.0\\.0\\.1:8000'
  )
}

$targets | ForEach-Object {
  try {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
  } catch {
  }
}

Write-Host ("Stopped {0} candidate processes." -f (($targets | Measure-Object).Count))
