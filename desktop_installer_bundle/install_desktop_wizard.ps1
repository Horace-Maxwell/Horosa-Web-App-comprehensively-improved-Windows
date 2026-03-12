Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class HorosaDpi {
    [DllImport("shcore.dll")]
    public static extern int SetProcessDpiAwareness(int awareness);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
  try {
    [void][HorosaDpi]::SetProcessDpiAwareness(2)
  } catch {
    [void][HorosaDpi]::SetProcessDPIAware()
  }
} catch {}
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptRoot
$InstallScript = Join-Path $ScriptRoot 'install_desktop_runtime.ps1'
$RunScript = Join-Path $ScriptRoot 'Run_Horosa_Desktop.vbs'
$VersionFile = Join-Path $ScriptRoot 'version.json'
$ProgressFile = Join-Path $env:LocalAppData 'HorosaDesktop\install-progress.json'
$StateFile = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-pydeps\install_state.json'
$RuntimeLogDir = Join-Path $env:LocalAppData 'HorosaDesktop\runtime-logs'
$InstallStdoutLog = Join-Path $RuntimeLogDir 'install-wizard-stdout.log'
$InstallStderrLog = Join-Path $RuntimeLogDir 'install-wizard-stderr.log'
$InstallRuntimeLog = Join-Path $RuntimeLogDir 'install-runtime.log'
$AssetsRoot = Join-Path $ScriptRoot 'assets'
$InstallerIconFile = Join-Path $AssetsRoot 'horosa_setup.ico'
$InstallerBadgeFile = Join-Path $AssetsRoot 'horosa_setup_badge.png'
$IconCandidate = Join-Path $ScriptRoot 'dist\HorosaDesktop\HorosaDesktop.exe'
$DesktopExe = Join-Path $ScriptRoot 'dist\HorosaDesktop\HorosaDesktop.exe'
$DisplayName = '星阙'
$VersionInfo = Get-Content -Raw $VersionFile | ConvertFrom-Json

function Resolve-UiFontFamily {
  $preferredFamilies = @(
    'Microsoft YaHei UI',
    'Microsoft YaHei',
    'DengXian',
    'PingFang SC',
    'Noto Sans CJK SC',
    'Source Han Sans SC',
    'SimHei',
    'Segoe UI'
  )

  $installedFamilies = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $fontCollection = New-Object System.Drawing.Text.InstalledFontCollection
  foreach ($family in $fontCollection.Families) {
    [void]$installedFamilies.Add($family.Name)
  }

  foreach ($family in $preferredFamilies) {
    if ($installedFamilies.Contains($family)) {
      return $family
    }
  }

  return 'Microsoft Sans Serif'
}

function New-UiFont {
  param(
    [double]$Size,
    [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
  )

  return New-Object System.Drawing.Font($script:UiFontFamily, [single]$Size, $Style, [System.Drawing.GraphicsUnit]::Point)
}

function Enable-ClearTextRendering {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Forms.Control]$Control
  )

  if ($Control.PSObject.Properties.Match('UseCompatibleTextRendering').Count -gt 0) {
    try {
      $Control.UseCompatibleTextRendering = $true
    } catch {}
  }

  foreach ($child in $Control.Controls) {
    Enable-ClearTextRendering -Control $child
  }
}

function Enable-DoubleBuffer {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Forms.Control]$Control
  )

  try {
    $property = $Control.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'Instance, NonPublic')
    if ($property) {
      $property.SetValue($Control, $true, $null)
    }
  } catch {}

  foreach ($child in $Control.Controls) {
    Enable-DoubleBuffer -Control $child
  }
}

$script:UiFontFamily = Resolve-UiFontFamily

function New-HorosaShortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$IconPath,
    [string]$Arguments = ''
  )

  $shortcutDir = Split-Path -Parent $ShortcutPath
  if (-not (Test-Path $shortcutDir)) {
    New-Item -ItemType Directory -Force -Path $shortcutDir | Out-Null
  }

  $tempShortcutPath = Join-Path $shortcutDir ("Xingque-{0}.lnk" -f ([guid]::NewGuid().ToString('N')))
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($tempShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  if (-not [string]::IsNullOrWhiteSpace($Arguments)) {
    $shortcut.Arguments = $Arguments
  }
  if (Test-Path $IconPath) {
    $shortcut.IconLocation = $IconPath
  }
  $shortcut.WindowStyle = 1
  $shortcut.Description = $DisplayName
  $shortcut.Save()

  if (Test-Path $ShortcutPath) {
    Remove-Item -Force $ShortcutPath
  }
  Move-Item -Path $tempShortcutPath -Destination $ShortcutPath -Force
}

function Resolve-AppLaunchSpec {
  if (Test-Path $DesktopExe) {
    return @{
      TargetPath = $DesktopExe
      WorkingDirectory = Split-Path -Parent $DesktopExe
      Arguments = ''
    }
  }

  return @{
    TargetPath = $RunScript
    WorkingDirectory = $ScriptRoot
    Arguments = ''
  }
}

function Ensure-Shortcuts {
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) "$DisplayName.lnk"
  $startMenuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) "$DisplayName.lnk"
  $shortcutIcon = if (Test-Path $IconCandidate) { $IconCandidate } elseif (Test-Path $InstallerIconFile) { $InstallerIconFile } else { $null }
  $launchSpec = Resolve-AppLaunchSpec
  New-HorosaShortcut -ShortcutPath $desktopShortcut -TargetPath $launchSpec.TargetPath -WorkingDirectory $launchSpec.WorkingDirectory -IconPath $shortcutIcon -Arguments $launchSpec.Arguments
  New-HorosaShortcut -ShortcutPath $startMenuShortcut -TargetPath $launchSpec.TargetPath -WorkingDirectory $launchSpec.WorkingDirectory -IconPath $shortcutIcon -Arguments $launchSpec.Arguments
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

function Get-LogTailText {
  param(
    [string]$Path,
    [int]$LineCount = 10
  )

  if (-not (Test-Path $Path)) {
    return $null
  }

  try {
    $tail = (Get-Content -Path $Path -Tail $LineCount) -join "`r`n"
    if (-not [string]::IsNullOrWhiteSpace($tail)) {
      return $tail.Trim()
    }
  } catch {}

  return $null
}

function Get-InstallFailureSummary {
  $sections = New-Object System.Collections.Generic.List[string]
  $progress = Read-ProgressState

  if ($progress) {
    if (-not [string]::IsNullOrWhiteSpace([string]$progress.message)) {
      [void]$sections.Add(([string]$progress.message).Trim())
    }
  }

  $runtimeTail = Get-LogTailText -Path $InstallRuntimeLog -LineCount 8
  if ($runtimeTail) {
    [void]$sections.Add("运行时日志尾部：`r`n$runtimeTail")
  }

  $stderrTail = Get-LogTailText -Path $InstallStderrLog -LineCount 8
  if ($stderrTail) {
    [void]$sections.Add("安装器错误输出：`r`n$stderrTail")
  }

  $stdoutTail = Get-LogTailText -Path $InstallStdoutLog -LineCount 8
  if ($stdoutTail) {
    [void]$sections.Add("安装器输出尾部：`r`n$stdoutTail")
  }

  if ($sections.Count -eq 0) {
    return "安装脚本返回了非零退出码。`r`n日志位置：$RuntimeLogDir"
  }

  return (($sections | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`r`n`r`n")
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

function Start-InstalledApp {
  $launchSpec = Resolve-AppLaunchSpec
  Start-Process -FilePath $launchSpec.TargetPath -WorkingDirectory $launchSpec.WorkingDirectory -ArgumentList @($launchSpec.Arguments) | Out-Null
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
$form.Text = "$DisplayName 安装程序"
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(1024, 700)
$form.MinimumSize = $form.Size
$form.MaximumSize = $form.Size
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 249, 252)
$form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
$form.Font = New-UiFont 9.8

$formIcon = Resolve-FormIcon
if ($formIcon) {
  $form.Icon = $formIcon
}

$contentOffsetX = 34

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = 'Fill'
$rightPanel.Padding = New-Object System.Windows.Forms.Padding(54, 42, 48, 42)
$form.Controls.Add($rightPanel)

$leftPanel = New-Object System.Windows.Forms.Panel
$leftPanel.Dock = 'Left'
$leftPanel.Width = 320
$leftPanel.BackColor = [System.Drawing.Color]::FromArgb(14, 24, 40)
$form.Controls.Add($leftPanel)

$leftAccent = New-Object System.Windows.Forms.Panel
$leftAccent.Location = New-Object System.Drawing.Point(0, 0)
$leftAccent.Size = New-Object System.Drawing.Size(10, 700)
$leftAccent.BackColor = [System.Drawing.Color]::FromArgb(189, 160, 98)
$leftPanel.Controls.Add($leftAccent)

$leftGlow = New-Object System.Windows.Forms.Panel
$leftGlow.Location = New-Object System.Drawing.Point(26, 24)
$leftGlow.Size = New-Object System.Drawing.Size(226, 14)
$leftGlow.BackColor = [System.Drawing.Color]::FromArgb(36, 51, 79)
$leftPanel.Controls.Add($leftGlow)

$brandBadgeFrame = New-Object System.Windows.Forms.Panel
$brandBadgeFrame.Location = New-Object System.Drawing.Point(34, 44)
$brandBadgeFrame.Size = New-Object System.Drawing.Size(126, 126)
$brandBadgeFrame.BackColor = [System.Drawing.Color]::FromArgb(34, 49, 76)
$brandBadgeFrame.BorderStyle = 'None'
$leftPanel.Controls.Add($brandBadgeFrame)

$brandBadge = New-Object System.Windows.Forms.PictureBox
$brandBadge.Location = New-Object System.Drawing.Point(15, 15)
$brandBadge.Size = New-Object System.Drawing.Size(96, 96)
$brandBadge.SizeMode = 'Zoom'
$brandBadge.BackColor = [System.Drawing.Color]::Transparent
if (Test-Path $InstallerBadgeFile) {
  $brandBadge.Image = [System.Drawing.Image]::FromFile($InstallerBadgeFile)
}
$brandBadgeFrame.Controls.Add($brandBadge)

$brandPill = New-Object System.Windows.Forms.Label
$brandPill.Text = '桌面版'
$brandPill.TextAlign = 'MiddleCenter'
$brandPill.ForeColor = [System.Drawing.Color]::FromArgb(255, 246, 223)
$brandPill.BackColor = [System.Drawing.Color]::FromArgb(64, 77, 103)
$brandPill.Font = New-UiFont 9.6 ([System.Drawing.FontStyle]::Bold)
$brandPill.Location = New-Object System.Drawing.Point(176, 68)
$brandPill.Size = New-Object System.Drawing.Size(96, 30)
$leftPanel.Controls.Add($brandPill)

$brandInfoPanel = New-Object System.Windows.Forms.Panel
$brandInfoPanel.Location = New-Object System.Drawing.Point(30, 182)
$brandInfoPanel.Size = New-Object System.Drawing.Size(250, 150)
$brandInfoPanel.BackColor = [System.Drawing.Color]::FromArgb(14, 24, 40)
$leftPanel.Controls.Add($brandInfoPanel)

$brandTitlePlate = New-Object System.Windows.Forms.Panel
$brandTitlePlate.Location = New-Object System.Drawing.Point(8, 0)
$brandTitlePlate.Size = New-Object System.Drawing.Size(228, 58)
$brandTitlePlate.BackColor = [System.Drawing.Color]::FromArgb(14, 24, 40)
$brandInfoPanel.Controls.Add($brandTitlePlate)

$brandTitle = New-Object System.Windows.Forms.Label
$brandTitle.Text = $DisplayName
$brandTitle.ForeColor = [System.Drawing.Color]::White
$brandTitle.BackColor = $brandTitlePlate.BackColor
$brandTitle.Font = New-UiFont 21.2 ([System.Drawing.FontStyle]::Bold)
$brandTitle.Location = New-Object System.Drawing.Point(0, 2)
$brandTitle.Size = New-Object System.Drawing.Size(228, 50)
$brandTitle.TextAlign = 'MiddleLeft'
$brandTitlePlate.Controls.Add($brandTitle)

$brandSubtitle = New-Object System.Windows.Forms.Label
$brandSubtitle.Text = '中文安装向导'
$brandSubtitle.ForeColor = [System.Drawing.Color]::FromArgb(214, 223, 235)
$brandSubtitle.BackColor = $brandInfoPanel.BackColor
$brandSubtitle.Font = New-UiFont 10.8 ([System.Drawing.FontStyle]::Bold)
$brandSubtitle.Location = New-Object System.Drawing.Point(10, 62)
$brandSubtitle.Size = New-Object System.Drawing.Size(206, 25)
$brandInfoPanel.Controls.Add($brandSubtitle)

$brandDivider = New-Object System.Windows.Forms.Panel
$brandDivider.Location = New-Object System.Drawing.Point(10, 92)
$brandDivider.Size = New-Object System.Drawing.Size(196, 1)
$brandDivider.BackColor = [System.Drawing.Color]::FromArgb(58, 74, 103)
$brandInfoPanel.Controls.Add($brandDivider)

$brandSummary = New-Object System.Windows.Forms.Label
$brandSummary.Text = '为星阙提供更稳妥、更像正式商业软件的桌面安装体验。'
$brandSummary.ForeColor = [System.Drawing.Color]::FromArgb(214, 223, 235)
$brandSummary.BackColor = $brandInfoPanel.BackColor
$brandSummary.Font = New-UiFont 9.6
$brandSummary.Location = New-Object System.Drawing.Point(10, 100)
$brandSummary.Size = New-Object System.Drawing.Size(224, 44)
$brandInfoPanel.Controls.Add($brandSummary)

$featureCard = New-Object System.Windows.Forms.Panel
$featureCard.Location = New-Object System.Drawing.Point(34, 356)
$featureCard.Size = New-Object System.Drawing.Size(242, 146)
$featureCard.BackColor = [System.Drawing.Color]::FromArgb(28, 40, 61)
$featureCard.BorderStyle = 'None'
$leftPanel.Controls.Add($featureCard)

$featureTitle = New-Object System.Windows.Forms.Label
$featureTitle.Text = '本次安装包含'
$featureTitle.ForeColor = [System.Drawing.Color]::White
$featureTitle.Font = New-UiFont 10.8 ([System.Drawing.FontStyle]::Bold)
$featureTitle.Location = New-Object System.Drawing.Point(14, 12)
$featureTitle.AutoSize = $true
$featureCard.Controls.Add($featureTitle)

$featureList = New-Object System.Windows.Forms.Label
$featureList.Text = "• 原生桌面窗口外壳`r`n• 隐藏运行的本地服务`r`n• 桌面与开始菜单快捷方式`r`n• 稳定的 GitHub 更新支持"
$featureList.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 242)
$featureList.Font = New-UiFont 9.6
$featureList.Location = New-Object System.Drawing.Point(14, 38)
$featureList.Size = New-Object System.Drawing.Size(210, 92)
$featureCard.Controls.Add($featureList)

$dataCard = New-Object System.Windows.Forms.Panel
$dataCard.Location = New-Object System.Drawing.Point(34, 520)
$dataCard.Size = New-Object System.Drawing.Size(242, 112)
$dataCard.BackColor = [System.Drawing.Color]::FromArgb(24, 34, 53)
$dataCard.BorderStyle = 'None'
$leftPanel.Controls.Add($dataCard)

$dataTitle = New-Object System.Windows.Forms.Label
$dataTitle.Text = '数据保护'
$dataTitle.ForeColor = [System.Drawing.Color]::FromArgb(255, 243, 214)
$dataTitle.Font = New-UiFont 10.8 ([System.Drawing.FontStyle]::Bold)
$dataTitle.Location = New-Object System.Drawing.Point(14, 12)
$dataTitle.AutoSize = $true
$dataCard.Controls.Add($dataTitle)

$dataBody = New-Object System.Windows.Forms.Label
$dataBody.Text = '用户数据会保存在 LocalAppData 中，所以以后更新替换程序文件时不会清空你的桌面状态。'
$dataBody.ForeColor = [System.Drawing.Color]::FromArgb(210, 220, 235)
$dataBody.Font = New-UiFont 9.2
$dataBody.Location = New-Object System.Drawing.Point(14, 36)
$dataBody.Size = New-Object System.Drawing.Size(210, 54)
$dataCard.Controls.Add($dataBody)

$versionLabel = New-Object System.Windows.Forms.Label
$versionLabel.Text = "版本 " + $VersionInfo.version
$versionLabel.ForeColor = [System.Drawing.Color]::FromArgb(157, 177, 204)
$versionLabel.Font = New-UiFont 9.2
$versionLabel.Location = New-Object System.Drawing.Point(36, 640)
$versionLabel.AutoSize = $true
$leftPanel.Controls.Add($versionLabel)

$headline = New-Object System.Windows.Forms.Label
$headline.Text = "欢迎使用 $DisplayName 安装程序"
$headline.Font = New-UiFont 21.5 ([System.Drawing.FontStyle]::Bold)
$headline.ForeColor = [System.Drawing.Color]::FromArgb(28, 33, 40)
$headline.AutoSize = $true
$headline.Location = New-Object System.Drawing.Point($contentOffsetX, 0)
$rightPanel.Controls.Add($headline)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = '该安装程序会配置桌面运行环境、创建标准 Windows 快捷方式，并在首次安装时自动下载所需的大型运行时组件。'
$subtitle.Font = New-UiFont 10.6
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$subtitle.Location = New-Object System.Drawing.Point($contentOffsetX, 54)
$subtitle.Size = New-Object System.Drawing.Size(574, 50)
$rightPanel.Controls.Add($subtitle)

$stageWelcome = New-Object System.Windows.Forms.Label
$stageWelcome.Text = '1  欢迎'
$stageWelcome.TextAlign = 'MiddleCenter'
$stageWelcome.Font = New-UiFont 9.4 ([System.Drawing.FontStyle]::Bold)
$stageWelcome.ForeColor = [System.Drawing.Color]::White
$stageWelcome.BackColor = [System.Drawing.Color]::FromArgb(184, 155, 96)
$stageWelcome.Location = New-Object System.Drawing.Point($contentOffsetX, 124)
$stageWelcome.Size = New-Object System.Drawing.Size(134, 34)
$rightPanel.Controls.Add($stageWelcome)

$stageInstall = New-Object System.Windows.Forms.Label
$stageInstall.Text = '2  安装'
$stageInstall.TextAlign = 'MiddleCenter'
$stageInstall.Font = New-UiFont 9.4 ([System.Drawing.FontStyle]::Bold)
$stageInstall.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stageInstall.BackColor = [System.Drawing.Color]::FromArgb(232, 236, 242)
$stageInstall.Location = New-Object System.Drawing.Point((140 + $contentOffsetX), 124)
$stageInstall.Size = New-Object System.Drawing.Size(126, 34)
$rightPanel.Controls.Add($stageInstall)

$stageFinish = New-Object System.Windows.Forms.Label
$stageFinish.Text = '3  完成'
$stageFinish.TextAlign = 'MiddleCenter'
$stageFinish.Font = New-UiFont 9.4 ([System.Drawing.FontStyle]::Bold)
$stageFinish.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stageFinish.BackColor = [System.Drawing.Color]::FromArgb(232, 236, 242)
$stageFinish.Location = New-Object System.Drawing.Point((272 + $contentOffsetX), 124)
$stageFinish.Size = New-Object System.Drawing.Size(126, 34)
$rightPanel.Controls.Add($stageFinish)

$stepTitle = New-Object System.Windows.Forms.Label
$stepTitle.Text = '准备开始安装'
$stepTitle.Font = New-UiFont 14.8 ([System.Drawing.FontStyle]::Bold)
$stepTitle.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$stepTitle.Location = New-Object System.Drawing.Point($contentOffsetX, 186)
$stepTitle.AutoSize = $true
$rightPanel.Controls.Add($stepTitle)

$stepDetail = New-Object System.Windows.Forms.Label
$stepDetail.Text = '点击“下一步”开始准备桌面运行环境。首次安装会联网下载运行时组件，可能需要几分钟。'
$stepDetail.Font = New-UiFont 10.6
$stepDetail.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$stepDetail.Location = New-Object System.Drawing.Point($contentOffsetX, 220)
$stepDetail.Size = New-Object System.Drawing.Size(574, 48)
$rightPanel.Controls.Add($stepDetail)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point($contentOffsetX, 292)
$progressBar.Size = New-Object System.Drawing.Size(592, 22)
$progressBar.Style = 'Continuous'
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$rightPanel.Controls.Add($progressBar)

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point($contentOffsetX, 338)
$statusCard.Size = New-Object System.Drawing.Size(592, 142)
$statusCard.BackColor = [System.Drawing.Color]::White
$statusCard.BorderStyle = 'None'
$rightPanel.Controls.Add($statusCard)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = '安装状态'
$statusLabel.Font = New-UiFont 10.8 ([System.Drawing.FontStyle]::Bold)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(31, 41, 55)
$statusLabel.Location = New-Object System.Drawing.Point(16, 14)
$statusLabel.AutoSize = $true
$statusCard.Controls.Add($statusLabel)

$statusDetail = New-Object System.Windows.Forms.Label
$statusDetail.Text = '尚未开始更改此电脑上的任何内容。'
$statusDetail.Font = New-UiFont 10.4
$statusDetail.ForeColor = [System.Drawing.Color]::FromArgb(92, 102, 114)
$statusDetail.Location = New-Object System.Drawing.Point(16, 42)
$statusDetail.Size = New-Object System.Drawing.Size(548, 92)
$statusCard.Controls.Add($statusDetail)

$launchCheck = New-Object System.Windows.Forms.CheckBox
$launchCheck.Text = '点击“完成”后立即启动 ' + $DisplayName
$launchCheck.Checked = $true
$launchCheck.Location = New-Object System.Drawing.Point($contentOffsetX, 508)
$launchCheck.AutoSize = $true
$launchCheck.Font = New-UiFont 10.4
$rightPanel.Controls.Add($launchCheck)

$primaryButton = New-Object System.Windows.Forms.Button
$primaryButton.Text = '下一步 >'
$primaryButton.Size = New-Object System.Drawing.Size(156, 42)
$primaryButton.Location = New-Object System.Drawing.Point((446 + $contentOffsetX), 566)
$primaryButton.BackColor = [System.Drawing.Color]::FromArgb(24, 119, 242)
$primaryButton.ForeColor = [System.Drawing.Color]::White
$primaryButton.FlatStyle = 'Flat'
$primaryButton.FlatAppearance.BorderSize = 0
$primaryButton.Font = New-UiFont 10.6 ([System.Drawing.FontStyle]::Bold)
$rightPanel.Controls.Add($primaryButton)

$secondaryButton = New-Object System.Windows.Forms.Button
$secondaryButton.Text = '取消'
$secondaryButton.Size = New-Object System.Drawing.Size(132, 42)
$secondaryButton.Location = New-Object System.Drawing.Point((298 + $contentOffsetX), 566)
$secondaryButton.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 253)
$secondaryButton.ForeColor = [System.Drawing.Color]::FromArgb(42, 54, 69)
$secondaryButton.FlatStyle = 'Flat'
$secondaryButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(208, 216, 228)
$secondaryButton.FlatAppearance.BorderSize = 1
$secondaryButton.Font = New-UiFont 10.4
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
    $headline.Text = "正在安装 $DisplayName"
    $subtitle.Text = '安装程序正在后台准备本地运行环境，完成后会自动切换到完成页面。'
    $statusLabel.Text = '安装状态'
    $statusDetail.Text = ("状态：{0}`r`n更新时间：{1}" -f $progress.state, $progress.updatedAt)
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
      $headline.Text = "$DisplayName 已准备就绪"
      $subtitle.Text = "安装程序已在这台电脑上完成 $DisplayName 的准备工作。"
      $stepTitle.Text = '安装完成'
      $stepDetail.Text = $DisplayName + ' 已安装完成。你可以点击“完成”退出，或先打开安装目录查看文件。'
      $statusLabel.Text = '已就绪'
      $statusDetail.Text = '桌面和开始菜单快捷方式已创建。' + "`r`n" + '以后更新会保留你存放在 LocalAppData 中的数据。'
      $progressBar.Value = 100
      $primaryButton.Text = '完成'
      $primaryButton.Enabled = $true
      $secondaryButton.Text = '打开目录'
    } else {
      $script:installSucceeded = $false
      $failureSummary = Get-InstallFailureSummary
      Set-StageVisual -Current 'failed'
      $headline.Text = "$DisplayName 安装程序"
      $subtitle.Text = '安装程序未能在这台电脑上完成运行环境准备。'
      $stepTitle.Text = '安装失败'
      $stepDetail.Text = '运行环境安装没有完成。下面会直接显示本次失败原因，便于你重试或排查。'
      $statusLabel.Text = '失败原因'
      $statusDetail.Text = $failureSummary
      $progressBar.Value = 100
      $primaryButton.Text = '重试'
      $primaryButton.Enabled = $true
      $secondaryButton.Text = '关闭'
    }
  }
})

$primaryButton.Add_Click({
  if ($script:installSucceeded) {
    if ($launchCheck.Checked) {
      Start-InstalledApp
    }
    $form.Close()
    return
  }

  Remove-Item -Force $ProgressFile -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $RuntimeLogDir | Out-Null
  Remove-Item -Force $InstallStdoutLog, $InstallStderrLog -ErrorAction SilentlyContinue
  $script:installCompleted = $false
  $script:installSucceeded = $false
  $primaryButton.Enabled = $false
  Set-StageVisual -Current 'install'
  $headline.Text = "正在安装 $DisplayName"
  $subtitle.Text = '安装程序正在为当前 Windows 账户准备桌面运行环境、下载运行时组件并创建快捷方式。'
  $secondaryButton.Text = '取消'
  $stepTitle.Text = "正在安装 $DisplayName"
  $stepDetail.Text = '正在准备本地运行环境，并按需下载和展开桌面运行时组件。'
  $statusLabel.Text = '安装状态'
  $statusDetail.Text = '安装程序正在后台运行。'
  $progressBar.Style = 'Marquee'
  $script:installProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-WindowStyle',
    'Hidden',
    '-File',
    $InstallScript
  ) -PassThru -WindowStyle Hidden -RedirectStandardOutput $InstallStdoutLog -RedirectStandardError $InstallStderrLog
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
      $headline.Text = "$DisplayName 已可直接使用"
      $subtitle.Text = "当前这个版本的 $DisplayName 已经在这台电脑上准备完成。"
      $stepTitle.Text = '当前版本已安装'
      $stepDetail.Text = '你可以点击“完成”退出安装程序，或打开安装目录查看文件；也可以立刻启动 ' + $DisplayName + '。'
      $statusLabel.Text = '已就绪'
      $statusDetail.Text = '桌面运行环境和快捷方式都已存在。' + "`r`n" + '当前版本无需重新安装。'
      $progressBar.Value = 100
      $primaryButton.Text = '完成'
      $secondaryButton.Text = '打开目录'
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

Enable-ClearTextRendering -Control $form
Enable-DoubleBuffer -Control $form
foreach ($label in @($brandPill, $brandTitle, $brandSubtitle, $brandSummary)) {
  if ($label.PSObject.Properties.Match('UseCompatibleTextRendering').Count -gt 0) {
    try {
      $label.UseCompatibleTextRendering = $false
    } catch {}
  }
}

[void]$form.ShowDialog()

