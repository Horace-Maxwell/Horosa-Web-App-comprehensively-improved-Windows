Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$InstallScript = Join-Path $ScriptRoot 'install_desktop_runtime.ps1'
$RunScript = Join-Path $ScriptRoot 'Run_Horosa_Desktop.vbs'
$VersionFile = Join-Path $ScriptRoot 'version.json'
$ProgressFile = Join-Path $env:LocalAppData 'HorosaDesktop\install-progress.json'
$StateFile = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps\install_state.json'
$AssetsRoot = Join-Path $ScriptRoot 'assets'
$InstallerIconFile = Join-Path $AssetsRoot 'horosa_setup.ico'
$InstallerBadgeFile = Join-Path $AssetsRoot 'horosa_setup_badge.png'
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
  $shortcutIcon = if (Test-Path $IconCandidate) { $IconCandidate } elseif (Test-Path $InstallerIconFile) { $InstallerIconFile } else { $null }
  New-HorosaShortcut -ShortcutPath $desktopShortcut -TargetPath $RunScript -WorkingDirectory $ScriptRoot -IconPath $shortcutIcon
  New-HorosaShortcut -ShortcutPath $startMenuShortcut -TargetPath $RunScript -WorkingDirectory $ScriptRoot -IconPath $shortcutIcon
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

function Resolve-FormIcon {
  foreach ($candidate in @($InstallerIconFile, $IconCandidate)) {
    if (-not $candidate -or -not (Test-Path $candidate)) {
      continue
    }

    try {
      if ([IO.Path]::GetExtension($candidate) -ieq '.ico') {
        return New-Object System.Drawing.Icon($candidate)
      }
      return [System.Drawing.Icon]::ExtractAssociatedIcon($candidate)
    } catch {
      continue
    }
  }

  return $null
}

function Open-InstallFolder {
  Start-Process -FilePath 'explorer.exe' -ArgumentList @($ScriptRoot) | Out-Null
}

function Set-StageVisual {
  param(
    [string]$Current
  )

  $inactiveBack = [System.Drawing.Color]::FromArgb(232, 236, 242)
  $inactiveFore = [System.Drawing.Color]::FromArgb(92, 102, 114)
  $activeBack = [System.Drawing.Color]::FromArgb(184, 155, 96)
  $activeFore = [System.Drawing.Color]::White
  $doneBack = [System.Drawing.Color]::FromArgb(37, 123, 81)
  $failBack = [System.Drawing.Color]::FromArgb(184, 70, 66)

  foreach ($label in @($stageWelcome, $stageInstall, $stageFinish)) {
    $label.BackColor = $inactiveBack
    $label.ForeColor = $inactiveFore
  }

  switch ($Current) {
    'welcome' {
      $stageWelcome.BackColor = $activeBack
      $stageWelcome.ForeColor = $activeFore
    }
    'install' {
      $stageWelcome.BackColor = $doneBack
      $stageWelcome.ForeColor = $activeFore
      $stageInstall.BackColor = $activeBack
      $stageInstall.ForeColor = $activeFore
    }
    'finish' {
      $stageWelcome.BackColor = $doneBack
      $stageWelcome.ForeColor = $activeFore
      $stageInstall.BackColor = $doneBack
      $stageInstall.ForeColor = $activeFore
      $stageFinish.BackColor = $activeBack
      $stageFinish.ForeColor = $activeFore
    }
    'failed' {
      $stageWelcome.BackColor = $doneBack
      $stageWelcome.ForeColor = $activeFore
      $stageInstall.BackColor = $failBack
      $stageInstall.ForeColor = $activeFore
    }
  }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Horosa Desktop Setup'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(820, 540)
$form.MinimumSize = $form.Size
$form.MaximumSize = $form.Size
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 249, 252)

$formIcon = Resolve-FormIcon
if ($formIcon) {
  $form.Icon = $formIcon
}

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = 'Fill'
$rightPanel.Padding = New-Object System.Windows.Forms.Padding(36, 30, 36, 28)
$form.Controls.Add($rightPanel)

$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Dock = 'Left'
$leftPanel.Width = 264
$leftPanel.BackColor = [System.Drawing.Color]::FromArgb(14, 24, 40)
$form.Controls.Add($leftPanel)

$brandBadgeFrame = New-Object System.Windows.Forms.Panel
$brandBadgeFrame.Location = New-Object System.Drawing.Point(28, 28)
$brandBadgeFrame.Size = New-Object System.Drawing.Size(104, 104)
$brandBadgeFrame.BackColor = [System.Drawing.Color]::FromArgb(34, 45, 66)
$brandBadgeFrame.BorderStyle = 'FixedSingle'
$leftPanel.Controls.Add($brandBadgeFrame)

$brandBadge = New-Object System.Windows.Forms.PictureBox
$brandBadge.Location = New-Object System.Drawing.Point(9, 9)
$brandBadge.Size = New-Object System.Drawing.Size(84, 84)
$brandBadge.SizeMode = 'Zoom'
$brandBadge.BackColor = [System.Drawing.Color]::Transparent
if (Test-Path $InstallerBadgeFile) {
  $brandBadge.Image = [System.Drawing.Image]::FromFile($InstallerBadgeFile)
}
$brandBadgeFrame.Controls.Add($brandBadge)

$brandTitle = New-Object System.Windows.Forms.Label
$brandTitle.Text = 'Horosa Desktop'
$brandTitle.ForeColor = [System.Drawing.Color]::White
$brandTitle.Font = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
$brandTitle.Location = New-Object System.Drawing.Point(28, 150)
$brandTitle.AutoSize = $true
$leftPanel.Controls.Add($brandTitle)

$brandSubtitle = New-Object System.Windows.Forms.Label
$brandSubtitle.Text = 'SETUP WIZARD'
$brandSubtitle.ForeColor = [System.Drawing.Color]::FromArgb(214, 223, 235)
$brandSubtitle.Font = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$brandSubtitle.Location = New-Object System.Drawing.Point(30, 186)
$brandSubtitle.Size = New-Object System.Drawing.Size(180, 20)
$leftPanel.Controls.Add($brandSubtitle)

$featureLabel = New-Object System.Windows.Forms.Label
$featureLabel.Text = "What setup prepares:`r`n`r`n- Native desktop shell`r`n- Hidden local services`r`n- Desktop and Start Menu shortcuts`r`n- Reliable GitHub update support"
$featureLabel.ForeColor = [System.Drawing.Color]::FromArgb(225, 231, 240)
$featureLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$featureLabel.Location = New-Object System.Drawing.Point(30, 234)
$featureLabel.Size = New-Object System.Drawing.Size(196, 168)
$leftPanel.Controls.Add($featureLabel)

$railNote = New-Object System.Windows.Forms.Label
$railNote.Text = 'Your user data stays in LocalAppData so future updates can replace the app files without wiping your desktop state.'
$railNote.ForeColor = [System.Drawing.Color]::FromArgb(203, 214, 229)
$railNote.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$railNote.Location = New-Object System.Drawing.Point(30, 420)
$railNote.Size = New-Object System.Drawing.Size(196, 52)
$leftPanel.Controls.Add($railNote)

$versionLabel = New-Object System.Windows.Forms.Label
$versionLabel.Text = "Version " + $VersionInfo.version
$versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(157, 177, 204)
$versionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$versionLabel.Location = New-Object System.Drawing.Point(30, 496)
$versionLabel.AutoSize = $true
$leftPanel.Controls.Add($versionLabel)

$headline = New-Object System.Windows.Forms.Label
$headline.Text = 'Welcome to Horosa Desktop Setup'
$headline.Font = New-Object System.Drawing.Font('Segoe UI', 20, [System.Drawing.FontStyle]::Bold)
$headline.ForeColor = [System.Drawing.Color]::FromArgb(28, 33, 40)
$headline.AutoSize = $true
$headline.Location = New-Object System.Drawing.Point(0, 0)
$rightPanel.Controls.Add($headline)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'This setup installs the desktop runtime, adds standard Windows shortcuts, and keeps your data outside the app folder so future updates stay clean.'
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$subtitle.Location = New-Object System.Drawing.Point(0, 46)
$subtitle.Size = New-Object System.Drawing.Size(460, 42)
$rightPanel.Controls.Add($subtitle)

$stageWelcome = New-Object System.Windows.Forms.Label
$stageWelcome.Text = '1  Welcome'
$stageWelcome.TextAlign = 'MiddleCenter'
$stageWelcome.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$stageWelcome.ForeColor = [System.Drawing.Color]::White
$stageWelcome.BackColor = [System.Drawing.Color]::FromArgb(184, 155, 96)
$stageWelcome.Location = New-Object System.Drawing.Point(0, 96)
$stageWelcome.Size = New-Object System.Drawing.Size(118, 28)
$rightPanel.Controls.Add($stageWelcome)

$stageInstall = New-Object System.Windows.Forms.Label
$stageInstall.Text = '2  Install'
$stageInstall.TextAlign = 'MiddleCenter'
$stageInstall.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$stageInstall.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stageInstall.BackColor = [System.Drawing.Color]::FromArgb(232, 236, 242)
$stageInstall.Location = New-Object System.Drawing.Point(130, 96)
$stageInstall.Size = New-Object System.Drawing.Size(110, 28)
$rightPanel.Controls.Add($stageInstall)

$stageFinish = New-Object System.Windows.Forms.Label
$stageFinish.Text = '3  Finish'
$stageFinish.TextAlign = 'MiddleCenter'
$stageFinish.Font = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$stageFinish.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stageFinish.BackColor = [System.Drawing.Color]::FromArgb(232, 236, 242)
$stageFinish.Location = New-Object System.Drawing.Point(252, 96)
$stageFinish.Size = New-Object System.Drawing.Size(110, 28)
$rightPanel.Controls.Add($stageFinish)

$stepTitle = New-Object System.Windows.Forms.Label
$stepTitle.Text = 'Ready to install'
$stepTitle.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$stepTitle.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$stepTitle.Location = New-Object System.Drawing.Point(0, 146)
$stepTitle.AutoSize = $true
$rightPanel.Controls.Add($stepTitle)

$stepDetail = New-Object System.Windows.Forms.Label
$stepDetail.Text = 'Click Next to prepare the desktop runtime. The first setup run may take a few minutes.'
$stepDetail.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$stepDetail.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stepDetail.Location = New-Object System.Drawing.Point(0, 178)
$stepDetail.Size = New-Object System.Drawing.Size(460, 42)
$rightPanel.Controls.Add($stepDetail)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(0, 236)
$progressBar.Size = New-Object System.Drawing.Size(482, 18)
$progressBar.Style = 'Continuous'
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$rightPanel.Controls.Add($progressBar)

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point(0, 278)
$statusCard.Size = New-Object System.Drawing.Size(482, 112)
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
$statusDetail.Size = New-Object System.Drawing.Size(442, 52)
$statusCard.Controls.Add($statusDetail)

$launchCheck = New-Object System.Windows.Forms.CheckBox
$launchCheck.Text = 'Launch Horosa Desktop when I click Finish'
$launchCheck.Checked = $true
$launchCheck.Location = New-Object System.Drawing.Point(0, 414)
$launchCheck.AutoSize = $true
$launchCheck.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$rightPanel.Controls.Add($launchCheck)

$primaryButton = New-Object System.Windows.Forms.Button
$primaryButton.Text = 'Next >'
$primaryButton.Size = New-Object System.Drawing.Size(132, 38)
$primaryButton.Location = New-Object System.Drawing.Point(350, 448)
$primaryButton.BackColor = [System.Drawing.Color]::FromArgb(24, 119, 242)
$primaryButton.ForeColor = [System.Drawing.Color]::White
$primaryButton.FlatStyle = 'Flat'
$primaryButton.FlatAppearance.BorderSize = 0
$primaryButton.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$rightPanel.Controls.Add($primaryButton)

$secondaryButton = New-Object System.Windows.Forms.Button
$secondaryButton.Text = 'Cancel'
$secondaryButton.Size = New-Object System.Drawing.Size(112, 38)
$secondaryButton.Location = New-Object System.Drawing.Point(228, 448)
$secondaryButton.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$rightPanel.Controls.Add($secondaryButton)

$script:installProcess = $null
$script:installCompleted = $false
$script:installSucceeded = $false

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 400

Set-StageVisual -Current 'welcome'

$timer.Add_Tick({
  $progress = Read-ProgressState
  if ($null -ne $progress) {
    Set-StageVisual -Current 'install'
    $stepTitle.Text = [string]$progress.title
    $stepDetail.Text = [string]$progress.message
    $headline.Text = 'Installing Horosa Desktop'
    $subtitle.Text = 'Setup is preparing the local runtime in the background and will switch to a Finish page when everything is ready.'
    $statusLabel.Text = 'Setup status'
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
      Set-StageVisual -Current 'finish'
      $headline.Text = 'Horosa Desktop is ready'
      $subtitle.Text = 'Setup finished preparing this machine for Horosa Desktop.'
      $stepTitle.Text = 'Setup complete'
      $stepDetail.Text = 'Horosa Desktop is installed. Click Finish to leave setup, or open the install folder first.'
      $statusLabel.Text = 'Ready'
      $statusDetail.Text = 'Shortcuts were created on the Desktop and in the Start Menu.' + "`r`n" + 'Updates will preserve your LocalAppData state.'
      $progressBar.Value = 100
      $primaryButton.Text = 'Finish'
      $primaryButton.Enabled = $true
      $secondaryButton.Text = 'Open Folder'
    } else {
      $script:installSucceeded = $false
      Set-StageVisual -Current 'failed'
      $headline.Text = 'Horosa Desktop Setup'
      $subtitle.Text = 'Setup could not finish the runtime preparation step on this machine.'
      $stepTitle.Text = 'Installation failed'
      $stepDetail.Text = 'The runtime setup did not complete. You can try setup again or close this wizard.'
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
    if ($launchCheck.Checked) {
      Start-Process -FilePath 'wscript.exe' -ArgumentList @($RunScript) | Out-Null
    }
    $form.Close()
    return
  }

  Remove-Item -Force $ProgressFile -ErrorAction SilentlyContinue
  $script:installCompleted = $false
  $script:installSucceeded = $false
  $primaryButton.Enabled = $false
  Set-StageVisual -Current 'install'
  $headline.Text = 'Installing Horosa Desktop'
  $subtitle.Text = 'Setup is preparing the desktop runtime and shortcut entry points for this Windows account.'
  $secondaryButton.Text = 'Cancel'
  $stepTitle.Text = 'Installing Horosa Desktop'
  $stepDetail.Text = 'Preparing local runtime and bundled desktop packages.'
  $statusLabel.Text = 'Setup status'
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
  if ($script:installSucceeded) {
    Open-InstallFolder
    return
  }

  if ($script:installProcess -and -not $script:installProcess.HasExited -and -not $script:installCompleted) {
    try {
      Stop-Process -Id $script:installProcess.Id -Force -ErrorAction Stop
    } catch {}
  }
  $form.Close()
})

$form.Add_FormClosing({
  if ($script:installProcess -and -not $script:installProcess.HasExited -and -not $script:installCompleted) {
    try {
      Stop-Process -Id $script:installProcess.Id -Force -ErrorAction Stop
    } catch {}
  }
})

if (Test-Path $StateFile) {
  try {
    $state = Get-Content -Raw $StateFile | ConvertFrom-Json
    if ($state.version -eq $VersionInfo.version) {
      Ensure-Shortcuts
      Set-StageVisual -Current 'finish'
      $headline.Text = 'Horosa Desktop is already ready'
      $subtitle.Text = 'This version of Horosa Desktop is already prepared on this machine.'
      $stepTitle.Text = 'Horosa Desktop is already installed'
      $stepDetail.Text = 'Click Finish to leave setup, or open the install folder. You can still launch Horosa immediately.'
      $statusLabel.Text = 'Ready'
      $statusDetail.Text = 'Desktop runtime and shortcuts are already present.' + "`r`n" + 'No reinstall was needed for this version.'
      $progressBar.Value = 100
      $primaryButton.Text = 'Finish'
      $secondaryButton.Text = 'Open Folder'
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
