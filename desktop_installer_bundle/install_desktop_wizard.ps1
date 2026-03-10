Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$InstallScript = Join-Path $ScriptRoot 'install_desktop_runtime.ps1'
$RunScript = Join-Path $ScriptRoot 'Run_Horosa_Desktop.vbs'
$VersionFile = Join-Path $ScriptRoot 'version.json'
$ProgressFile = Join-Path $env:LocalAppData 'HorosaDesktop\install-progress.json'
$StateFile = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps\install_state.json'
$IconCandidate = Join-Path $ScriptRoot 'dist\HorosaDesktop\HorosaDesktop.exe'
$VersionInfo = Get-Content -Raw $VersionFile | ConvertFrom-Json

function New-HorosaShortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$IconPath
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  if (Test-Path $IconPath) {
    $shortcut.IconLocation = $IconPath
  }
  $shortcut.WindowStyle = 1
  $shortcut.Description = 'Horosa Desktop'
  $shortcut.Save()
}

function Ensure-Shortcuts {
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Horosa Desktop.lnk'
  $startMenuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Horosa Desktop.lnk'
  New-HorosaShortcut -ShortcutPath $desktopShortcut -TargetPath $RunScript -WorkingDirectory $ScriptRoot -IconPath $IconCandidate
  New-HorosaShortcut -ShortcutPath $startMenuShortcut -TargetPath $RunScript -WorkingDirectory $ScriptRoot -IconPath $IconCandidate
}

function Read-ProgressState {
  if (-not (Test-Path $ProgressFile)) {
    return $null
  }

  try {
    return Get-Content -Raw $ProgressFile | ConvertFrom-Json
  } catch {
    return $null
  }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Install Horosa Desktop'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(760, 470)
$form.MinimumSize = $form.Size
$form.MaximumSize = $form.Size
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 249, 252)

$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Dock = 'Left'
$leftPanel.Width = 240
$leftPanel.BackColor = [System.Drawing.Color]::FromArgb(18, 34, 61)
$form.Controls.Add($leftPanel)

$brandTitle = New-Object System.Windows.Forms.Label
$brandTitle.Text = 'Horosa Desktop'
$brandTitle.ForeColor = [System.Drawing.Color]::White
$brandTitle.Font = New-Object System.Drawing.Font('Segoe UI', 23, [System.Drawing.FontStyle]::Bold)
$brandTitle.Location = New-Object System.Drawing.Point(28, 34)
$brandTitle.AutoSize = $true
$leftPanel.Controls.Add($brandTitle)

$brandSubtitle = New-Object System.Windows.Forms.Label
$brandSubtitle.Text = 'Local astrology workspace, packaged like a Windows app.'
$brandSubtitle.ForeColor = [System.Drawing.Color]::FromArgb(214, 223, 235)
$brandSubtitle.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$brandSubtitle.Location = New-Object System.Drawing.Point(30, 88)
$brandSubtitle.Size = New-Object System.Drawing.Size(180, 58)
$leftPanel.Controls.Add($brandSubtitle)

$featureLabel = New-Object System.Windows.Forms.Label
$featureLabel.Text = "Included in this install:`r`n`r`n- Embedded desktop window`r`n- Hidden local services`r`n- Offline runtime packages`r`n- GitHub update support"
$featureLabel.ForeColor = [System.Drawing.Color]::FromArgb(225, 231, 240)
$featureLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$featureLabel.Location = New-Object System.Drawing.Point(30, 174)
$featureLabel.Size = New-Object System.Drawing.Size(180, 150)
$leftPanel.Controls.Add($featureLabel)

$versionLabel = New-Object System.Windows.Forms.Label
$versionLabel.Text = "Version " + $VersionInfo.version
$versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(157, 177, 204)
$versionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$versionLabel.Location = New-Object System.Drawing.Point(30, 394)
$versionLabel.AutoSize = $true
$leftPanel.Controls.Add($versionLabel)

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = 'Fill'
$rightPanel.Padding = New-Object System.Windows.Forms.Padding(34, 28, 34, 24)
$form.Controls.Add($rightPanel)

$headline = New-Object System.Windows.Forms.Label
$headline.Text = 'Install Horosa Desktop'
$headline.Font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$headline.ForeColor = [System.Drawing.Color]::FromArgb(28, 33, 40)
$headline.AutoSize = $true
$headline.Location = New-Object System.Drawing.Point(0, 0)
$rightPanel.Controls.Add($headline)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'This installer prepares the desktop runtime, adds shortcuts, and keeps your app data separate so future updates do not wipe it.'
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$subtitle.Location = New-Object System.Drawing.Point(0, 46)
$subtitle.Size = New-Object System.Drawing.Size(430, 42)
$rightPanel.Controls.Add($subtitle)

$stepTitle = New-Object System.Windows.Forms.Label
$stepTitle.Text = 'Ready to install'
$stepTitle.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$stepTitle.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$stepTitle.Location = New-Object System.Drawing.Point(0, 112)
$stepTitle.AutoSize = $true
$rightPanel.Controls.Add($stepTitle)

$stepDetail = New-Object System.Windows.Forms.Label
$stepDetail.Text = 'Click Install to prepare the desktop runtime. The first run may take a few minutes.'
$stepDetail.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$stepDetail.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stepDetail.Location = New-Object System.Drawing.Point(0, 144)
$stepDetail.Size = New-Object System.Drawing.Size(430, 42)
$rightPanel.Controls.Add($stepDetail)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(0, 202)
$progressBar.Size = New-Object System.Drawing.Size(440, 18)
$progressBar.Style = 'Continuous'
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$rightPanel.Controls.Add($progressBar)

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point(0, 242)
$statusCard.Size = New-Object System.Drawing.Size(440, 98)
$statusCard.BackColor = [System.Drawing.Color]::White
$statusCard.BorderStyle = 'FixedSingle'
$rightPanel.Controls.Add($statusCard)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Installer status'
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$statusLabel.Location = New-Object System.Drawing.Point(16, 14)
$statusLabel.AutoSize = $true
$statusCard.Controls.Add($statusLabel)

$statusDetail = New-Object System.Windows.Forms.Label
$statusDetail.Text = 'Nothing has been changed yet.'
$statusDetail.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$statusDetail.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$statusDetail.Location = New-Object System.Drawing.Point(16, 42)
$statusDetail.Size = New-Object System.Drawing.Size(404, 40)
$statusCard.Controls.Add($statusDetail)

$launchCheck = New-Object System.Windows.Forms.CheckBox
$launchCheck.Text = 'Launch Horosa Desktop when setup is finished'
$launchCheck.Checked = $true
$launchCheck.Location = New-Object System.Drawing.Point(0, 358)
$launchCheck.AutoSize = $true
$launchCheck.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$rightPanel.Controls.Add($launchCheck)

$primaryButton = New-Object System.Windows.Forms.Button
$primaryButton.Text = 'Install'
$primaryButton.Size = New-Object System.Drawing.Size(132, 38)
$primaryButton.Location = New-Object System.Drawing.Point(308, 390)
$primaryButton.BackColor = [System.Drawing.Color]::FromArgb(24, 119, 242)
$primaryButton.ForeColor = [System.Drawing.Color]::White
$primaryButton.FlatStyle = 'Flat'
$primaryButton.FlatAppearance.BorderSize = 0
$primaryButton.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$rightPanel.Controls.Add($primaryButton)

$secondaryButton = New-Object System.Windows.Forms.Button
$secondaryButton.Text = 'Cancel'
$secondaryButton.Size = New-Object System.Drawing.Size(100, 38)
$secondaryButton.Location = New-Object System.Drawing.Point(198, 390)
$secondaryButton.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$rightPanel.Controls.Add($secondaryButton)

$script:installProcess = $null
$script:installCompleted = $false
$script:installSucceeded = $false
$script:launchOnClose = $false

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 400

$timer.Add_Tick({
  $progress = Read-ProgressState
  if ($null -ne $progress) {
    $stepTitle.Text = [string]$progress.title
    $stepDetail.Text = [string]$progress.message
    $statusLabel.Text = 'Installer status'
    $statusDetail.Text = ("State: {0}`r`nUpdated: {1}" -f $progress.state, $progress.updatedAt)
    $progressBar.Style = 'Continuous'
    $value = [Math]::Max(0, [Math]::Min(100, [int]$progress.percent))
    $progressBar.Value = $value
  }

  if ($script:installProcess -and $script:installProcess.HasExited -and -not $script:installCompleted) {
    $script:installCompleted = $true
    $timer.Stop()
    if ($script:installProcess.ExitCode -eq 0) {
      Ensure-Shortcuts
      $script:installSucceeded = $true
      $stepTitle.Text = 'Installation complete'
      $stepDetail.Text = 'Horosa Desktop is installed. You can launch it now or close this installer.'
      $statusLabel.Text = 'Ready'
      $statusDetail.Text = 'Shortcuts were created on the Desktop and in the Start Menu.'
      $progressBar.Value = 100
      $primaryButton.Text = 'Launch Horosa'
      $primaryButton.Enabled = $true
      $secondaryButton.Text = 'Close'
      $script:launchOnClose = $launchCheck.Checked
    } else {
      $script:installSucceeded = $false
      $stepTitle.Text = 'Installation failed'
      $stepDetail.Text = 'The runtime setup did not complete. You can close this installer and try again.'
      $statusLabel.Text = 'Failed'
      $statusDetail.Text = 'The install script returned a non-zero exit code.'
      $progressBar.Value = 100
      $primaryButton.Text = 'Try Again'
      $primaryButton.Enabled = $true
      $secondaryButton.Text = 'Close'
    }
  }
})

$primaryButton.Add_Click({
  if ($script:installSucceeded) {
    Start-Process -FilePath 'wscript.exe' -ArgumentList @($RunScript) | Out-Null
    $form.Close()
    return
  }

  Remove-Item -Force $ProgressFile -ErrorAction SilentlyContinue
  $script:installCompleted = $false
  $script:installSucceeded = $false
  $primaryButton.Enabled = $false
  $secondaryButton.Text = 'Close'
  $stepTitle.Text = 'Installing Horosa Desktop'
  $stepDetail.Text = 'Preparing local runtime and bundled desktop packages.'
  $statusLabel.Text = 'Installer status'
  $statusDetail.Text = 'The installer is running in the background.'
  $progressBar.Style = 'Marquee'
  $script:installProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-WindowStyle',
    'Hidden',
    '-File',
    $InstallScript
  ) -PassThru -WindowStyle Hidden
  $timer.Start()
})

$secondaryButton.Add_Click({
  if ($script:installProcess -and -not $script:installProcess.HasExited -and -not $script:installCompleted) {
    try {
      Stop-Process -Id $script:installProcess.Id -Force -ErrorAction Stop
    } catch {}
  }
  $form.Close()
})

if (Test-Path $StateFile) {
  try {
    $state = Get-Content -Raw $StateFile | ConvertFrom-Json
    if ($state.version -eq $VersionInfo.version) {
      Ensure-Shortcuts
      $stepTitle.Text = 'Horosa Desktop is already installed'
      $stepDetail.Text = 'The current version is already prepared on this machine. You can launch it now or reinstall.'
      $statusLabel.Text = 'Ready'
      $statusDetail.Text = 'Desktop runtime and shortcuts are already present.'
      $progressBar.Value = 100
      $primaryButton.Text = 'Launch Horosa'
      $script:installSucceeded = $true
    }
  } catch {}
}

if ($env:HOROSA_DESKTOP_INSTALLER_SMOKE -eq '1') {
  $smokeFile = Join-Path $env:LocalAppData 'HorosaDesktop\installer-smoke.json'
  @{
    status = 'opened'
    version = $VersionInfo.version
    installed = $script:installSucceeded
    timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  } | ConvertTo-Json | Set-Content -Path $smokeFile -Encoding UTF8
  $smokeTimer = New-Object System.Windows.Forms.Timer
  $smokeTimer.Interval = 1800
  $smokeTimer.Add_Tick({
    $smokeTimer.Stop()
    $form.Close()
  })
  $smokeTimer.Start()
}

[void]$form.ShowDialog()
