!include "LogicLib.nsh"
!include "nsDialogs.nsh"

ManifestDPIAware true

!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
!define /ifndef CURRENT_SHORTCUT_FILE_NAME "Horosa.lnk"
!define /ifndef LEGACY_BRAND_SHORTCUT_FILE_NAME "星阙.lnk"

!ifndef BUILD_UNINSTALLER

Var ExistingInstallState
Var ExistingInstallTypeText
Var ExistingDesktopInstallPath
Var ExistingDesktopInstallVersion
Var ExistingDesktopInstallRootKey
Var ExistingLegacyMarkerSummary
Var ExistingInstallSummaryText
Var ExistingRecommendationText
Var ExistingRepairSupported
Var ExistingRepairBlockedReason
Var SelectedMaintenanceAction

Var ExistingInstallPageTitle
Var ExistingInstallPageSubtitle
Var ExistingInstallPageSummary
Var ExistingInstallPageInfo
Var ExistingInstallPageRadioReplace
Var ExistingInstallPageRadioRepair
Var ExistingInstallPageRadioCancel
Var ExistingLegacyHasDataDir
Var ExistingLegacyHasLogDir
Var ExistingLegacyHasShortcut
Var ShortcutHelperScriptPath
Var ShellDesktopDir
Var ShellProgramsDir
Var ShortcutHelperExitCode
Var ShortcutPathUnderTest
Var ShortcutExpectedTarget
Var ShortcutValidationResult
Var ShortcutRepairWarning

Function PrepareShortcutHelperScript
  StrCpy $ShortcutHelperScriptPath "$TEMP\horosa-shortcut-helper.vbs"
  Delete "$ShortcutHelperScriptPath"
  ClearErrors
  FileOpen $0 "$ShortcutHelperScriptPath" w
  IfErrors shortcut_helper_write_failed
  FileWrite $0 "Option Explicit$\r$\n"
  FileWrite $0 "Dim mode$\r$\n"
  FileWrite $0 "If WScript.Arguments.Count = 0 Then$\r$\n"
  FileWrite $0 "  WScript.Echo $\"Missing mode$\"$\r$\n"
  FileWrite $0 "  WScript.Quit 90$\r$\n"
  FileWrite $0 "End If$\r$\n"
  FileWrite $0 "mode = LCase(WScript.Arguments(0))$\r$\n"
  FileWrite $0 "Select Case mode$\r$\n"
  FileWrite $0 "  Case $\"getspecialfolder$\"$\r$\n"
  FileWrite $0 "    If WScript.Arguments.Count < 2 Then$\r$\n"
  FileWrite $0 "      WScript.Echo $\"Missing special folder name$\"$\r$\n"
  FileWrite $0 "      WScript.Quit 91$\r$\n"
  FileWrite $0 "    End If$\r$\n"
  FileWrite $0 "    Dim specialShell$\r$\n"
  FileWrite $0 "    Set specialShell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $0 "    WScript.Echo specialShell.SpecialFolders(WScript.Arguments(1))$\r$\n"
  FileWrite $0 "    WScript.Quit 0$\r$\n"
  FileWrite $0 "  Case $\"ensureshortcut$\"$\r$\n"
  FileWrite $0 "    Call EnsureShortcut()$\r$\n"
  FileWrite $0 "  Case $\"checkshortcut$\"$\r$\n"
  FileWrite $0 "    Call CheckShortcut()$\r$\n"
  FileWrite $0 "  Case Else$\r$\n"
  FileWrite $0 "    WScript.Echo $\"Unknown mode: $\" & mode$\r$\n"
  FileWrite $0 "    WScript.Quit 92$\r$\n"
  FileWrite $0 "End Select$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "Sub EnsureFolder(folderPath)$\r$\n"
  FileWrite $0 "  Dim ensureFso$\r$\n"
  FileWrite $0 "  Set ensureFso = CreateObject($\"Scripting.FileSystemObject$\")$\r$\n"
  FileWrite $0 "  If folderPath = $\"$\" Then Exit Sub$\r$\n"
  FileWrite $0 "  If ensureFso.FolderExists(folderPath) Then Exit Sub$\r$\n"
  FileWrite $0 "  Dim parentFolder$\r$\n"
  FileWrite $0 "  parentFolder = ensureFso.GetParentFolderName(folderPath)$\r$\n"
  FileWrite $0 "  If parentFolder <> $\"$\" And Not ensureFso.FolderExists(parentFolder) Then$\r$\n"
  FileWrite $0 "    Call EnsureFolder(parentFolder)$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  ensureFso.CreateFolder folderPath$\r$\n"
  FileWrite $0 "End Sub$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "Function Normalize(value)$\r$\n"
  FileWrite $0 "  Normalize = LCase(Replace(Trim(CStr(value)), $\"/$\", Chr(92)))$\r$\n"
  FileWrite $0 "End Function$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "Sub EnsureShortcut()$\r$\n"
  FileWrite $0 "  If WScript.Arguments.Count < 6 Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"Missing shortcut arguments$\"$\r$\n"
  FileWrite $0 "    WScript.Quit 93$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  Dim linkPath, targetPath, workingDir, iconLocation, description$\r$\n"
  FileWrite $0 "  linkPath = WScript.Arguments(1)$\r$\n"
  FileWrite $0 "  targetPath = WScript.Arguments(2)$\r$\n"
  FileWrite $0 "  workingDir = WScript.Arguments(3)$\r$\n"
  FileWrite $0 "  iconLocation = WScript.Arguments(4)$\r$\n"
  FileWrite $0 "  description = WScript.Arguments(5)$\r$\n"
  FileWrite $0 "  Dim shortcutFso, shortcutShell, shortcut$\r$\n"
  FileWrite $0 "  Set shortcutFso = CreateObject($\"Scripting.FileSystemObject$\")$\r$\n"
  FileWrite $0 "  Set shortcutShell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $0 "  On Error Resume Next$\r$\n"
  FileWrite $0 "  Call EnsureFolder(shortcutFso.GetParentFolderName(linkPath))$\r$\n"
  FileWrite $0 "  If shortcutFso.FileExists(linkPath) Then shortcutFso.DeleteFile linkPath, True$\r$\n"
  FileWrite $0 "  Err.Clear$\r$\n"
  FileWrite $0 "  Set shortcut = shortcutShell.CreateShortcut(linkPath)$\r$\n"
  FileWrite $0 "  shortcut.TargetPath = targetPath$\r$\n"
  FileWrite $0 "  shortcut.WorkingDirectory = workingDir$\r$\n"
  FileWrite $0 "  shortcut.IconLocation = iconLocation$\r$\n"
  FileWrite $0 "  shortcut.Description = description$\r$\n"
  FileWrite $0 "  shortcut.Save$\r$\n"
  FileWrite $0 "  If Err.Number <> 0 Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"SAVE:$\" & Err.Description$\r$\n"
  FileWrite $0 "    WScript.Quit 20$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  Err.Clear$\r$\n"
  FileWrite $0 "  Set shortcut = shortcutShell.CreateShortcut(linkPath)$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.TargetPath) <> Normalize(targetPath) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"TARGET:$\" & shortcut.TargetPath$\r$\n"
  FileWrite $0 "    WScript.Quit 21$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.WorkingDirectory) <> Normalize(workingDir) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"WORKDIR:$\" & shortcut.WorkingDirectory$\r$\n"
  FileWrite $0 "    WScript.Quit 22$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.IconLocation) <> Normalize(iconLocation) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"ICON:$\" & shortcut.IconLocation$\r$\n"
  FileWrite $0 "    WScript.Quit 23$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  WScript.Echo $\"OK$\"$\r$\n"
  FileWrite $0 "  WScript.Quit 0$\r$\n"
  FileWrite $0 "End Sub$\r$\n"
  FileWrite $0 "$\r$\n"
  FileWrite $0 "Sub CheckShortcut()$\r$\n"
  FileWrite $0 "  If WScript.Arguments.Count < 5 Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"Missing shortcut check arguments$\"$\r$\n"
  FileWrite $0 "    WScript.Quit 94$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  Dim linkPath, targetPath, workingDir, iconLocation$\r$\n"
  FileWrite $0 "  linkPath = WScript.Arguments(1)$\r$\n"
  FileWrite $0 "  targetPath = WScript.Arguments(2)$\r$\n"
  FileWrite $0 "  workingDir = WScript.Arguments(3)$\r$\n"
  FileWrite $0 "  iconLocation = WScript.Arguments(4)$\r$\n"
  FileWrite $0 "  Dim shortcutFso, shortcutShell, shortcut$\r$\n"
  FileWrite $0 "  Set shortcutFso = CreateObject($\"Scripting.FileSystemObject$\")$\r$\n"
  FileWrite $0 "  Set shortcutShell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $0 "  If Not shortcutFso.FileExists(linkPath) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"MISSING$\"$\r$\n"
  FileWrite $0 "    WScript.Quit 30$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  On Error Resume Next$\r$\n"
  FileWrite $0 "  Set shortcut = shortcutShell.CreateShortcut(linkPath)$\r$\n"
  FileWrite $0 "  If Err.Number <> 0 Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"READ:$\" & Err.Description$\r$\n"
  FileWrite $0 "    WScript.Quit 31$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.TargetPath) <> Normalize(targetPath) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"TARGET:$\" & shortcut.TargetPath$\r$\n"
  FileWrite $0 "    WScript.Quit 32$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.WorkingDirectory) <> Normalize(workingDir) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"WORKDIR:$\" & shortcut.WorkingDirectory$\r$\n"
  FileWrite $0 "    WScript.Quit 33$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  If Normalize(shortcut.IconLocation) <> Normalize(iconLocation) Then$\r$\n"
  FileWrite $0 "    WScript.Echo $\"ICON:$\" & shortcut.IconLocation$\r$\n"
  FileWrite $0 "    WScript.Quit 34$\r$\n"
  FileWrite $0 "  End If$\r$\n"
  FileWrite $0 "  WScript.Echo $\"OK$\"$\r$\n"
  FileWrite $0 "  WScript.Quit 0$\r$\n"
  FileWrite $0 "End Sub$\r$\n"
  FileClose $0
  Return

shortcut_helper_write_failed:
  MessageBox MB_OK|MB_ICONSTOP "星阙安装器无法写入快捷方式校验脚本，安装已中止。"
  Abort

FunctionEnd

Function ResolveShellDesktopDir
  Call PrepareShortcutHelperScript
  nsExec::ExecToStack '"$SYSDIR\cscript.exe" //Nologo "$ShortcutHelperScriptPath" getSpecialFolder "Desktop"'
  Pop $ShortcutHelperExitCode
  Pop $ShellDesktopDir
  ${If} $ShortcutHelperExitCode != 0
    StrCpy $ShellDesktopDir "$DESKTOP"
  ${EndIf}
FunctionEnd

Function ResolveShellProgramsDir
  Call PrepareShortcutHelperScript
  nsExec::ExecToStack '"$SYSDIR\cscript.exe" //Nologo "$ShortcutHelperScriptPath" getSpecialFolder "Programs"'
  Pop $ShortcutHelperExitCode
  Pop $ShellProgramsDir
  ${If} $ShortcutHelperExitCode != 0
    StrCpy $ShellProgramsDir "$SMPROGRAMS"
  ${EndIf}
FunctionEnd

Function DetectDesktopInstallRecord
  StrCpy $ExistingInstallTypeText ""
  StrCpy $ExistingDesktopInstallPath "未记录"
  StrCpy $ExistingDesktopInstallVersion "版本未知"
  StrCpy $ExistingDesktopInstallRootKey ""

  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $1 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $2 HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    ${If} $1 == ""
      ReadRegStr $1 HKCU "${UNINSTALL_REGISTRY_KEY_2}" "DisplayVersion"
    ${EndIf}
    ${If} $2 == ""
      ReadRegStr $2 HKCU "${UNINSTALL_REGISTRY_KEY_2}" "UninstallString"
    ${EndIf}
  !endif

  ${If} $0 != ""
  ${OrIf} $2 != ""
    StrCpy $ExistingDesktopInstallRootKey "HKCU"
    StrCpy $ExistingInstallTypeText "当前用户正式桌面版"
    ${If} $0 != ""
      StrCpy $ExistingDesktopInstallPath $0
    ${EndIf}
    ${If} $1 != ""
      StrCpy $ExistingDesktopInstallVersion $1
    ${EndIf}
    Return
  ${EndIf}

  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $1 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $2 HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    ${If} $1 == ""
      ReadRegStr $1 HKLM "${UNINSTALL_REGISTRY_KEY_2}" "DisplayVersion"
    ${EndIf}
    ${If} $2 == ""
      ReadRegStr $2 HKLM "${UNINSTALL_REGISTRY_KEY_2}" "UninstallString"
    ${EndIf}
  !endif

  ${If} $0 != ""
  ${OrIf} $2 != ""
    StrCpy $ExistingDesktopInstallRootKey "HKLM"
    StrCpy $ExistingInstallTypeText "所有用户正式桌面版"
    ${If} $0 != ""
      StrCpy $ExistingDesktopInstallPath $0
    ${EndIf}
    ${If} $1 != ""
      StrCpy $ExistingDesktopInstallVersion $1
    ${EndIf}
  ${EndIf}
FunctionEnd

Function DetectLegacyMarkers
  StrCpy $ExistingLegacyMarkerSummary "未发现"
  StrCpy $ExistingLegacyHasDataDir "0"
  StrCpy $ExistingLegacyHasLogDir "0"
  StrCpy $ExistingLegacyHasShortcut "0"

  IfFileExists "$LOCALAPPDATA\Horosa\*.*" 0 +3
    StrCpy $ExistingLegacyHasDataDir "1"

  IfFileExists "$PROFILE\.horosa-logs\astrostudyboot\*.*" 0 +3
    StrCpy $ExistingLegacyHasLogDir "1"

  IfFileExists "$DESKTOP\START_HERE*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"

  IfFileExists "$DESKTOP\Horosa Local*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"

  IfFileExists "$APPDATA\Microsoft\Windows\Start Menu\Programs\START_HERE*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"

  IfFileExists "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Local*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"

  SetShellVarContext all
  IfFileExists "$SMPROGRAMS\START_HERE*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"

  IfFileExists "$SMPROGRAMS\Horosa Local*.lnk" 0 +3
    StrCpy $ExistingLegacyHasShortcut "1"
  SetShellVarContext current

  StrCpy $ExistingLegacyMarkerSummary ""
  ${If} $ExistingLegacyHasDataDir == "1"
    StrCpy $ExistingLegacyMarkerSummary "旧数据目录"
  ${EndIf}
  ${If} $ExistingLegacyHasLogDir == "1"
    ${If} $ExistingLegacyMarkerSummary == ""
      StrCpy $ExistingLegacyMarkerSummary "旧日志目录"
    ${Else}
      StrCpy $ExistingLegacyMarkerSummary "$ExistingLegacyMarkerSummary、旧日志目录"
    ${EndIf}
  ${EndIf}
  ${If} $ExistingLegacyHasShortcut == "1"
    ${If} $ExistingLegacyMarkerSummary == ""
      StrCpy $ExistingLegacyMarkerSummary "旧快捷方式/入口"
    ${Else}
      StrCpy $ExistingLegacyMarkerSummary "$ExistingLegacyMarkerSummary、旧快捷方式/入口"
    ${EndIf}
  ${EndIf}
  ${If} $ExistingLegacyMarkerSummary == ""
    StrCpy $ExistingLegacyMarkerSummary "未发现"
  ${EndIf}
FunctionEnd

Function BuildExistingInstallState
  StrCpy $ExistingInstallState "none"
  StrCpy $ExistingInstallSummaryText ""
  StrCpy $ExistingRecommendationText ""
  StrCpy $ExistingRepairSupported "0"
  StrCpy $ExistingRepairBlockedReason ""
  StrCpy $SelectedMaintenanceAction "replace"

  Call DetectDesktopInstallRecord
  Call DetectLegacyMarkers

  ${If} $ExistingDesktopInstallRootKey != ""
  ${AndIf} $ExistingLegacyMarkerSummary != "未发现"
    StrCpy $ExistingInstallState "both-found"
  ${ElseIf} $ExistingDesktopInstallRootKey != ""
    StrCpy $ExistingInstallState "desktop-installed"
  ${ElseIf} $ExistingLegacyMarkerSummary != "未发现"
    StrCpy $ExistingInstallState "legacy-launcher-found"
  ${EndIf}

  ${If} $ExistingInstallState == "desktop-installed"
    ${If} $ExistingDesktopInstallRootKey == "HKCU"
      StrCpy $ExistingRepairSupported "1"
      StrCpy $SelectedMaintenanceAction "repair"
      StrCpy $ExistingRecommendationText "推荐操作：修复"
    ${Else}
      StrCpy $ExistingRepairBlockedReason "未检测到当前用户安装的正式桌面版，因此无法执行修复。"
      StrCpy $ExistingRecommendationText "推荐操作：替换"
    ${EndIf}
  ${ElseIf} $ExistingInstallState == "legacy-launcher-found"
    StrCpy $ExistingInstallTypeText "旧启动器痕迹"
    StrCpy $ExistingRepairBlockedReason "检测到的是旧启动器痕迹，建议选择替换完成正式桌面版安装。"
    StrCpy $ExistingRecommendationText "推荐操作：替换"
  ${ElseIf} $ExistingInstallState == "both-found"
    ${If} $ExistingDesktopInstallRootKey == "HKCU"
      StrCpy $ExistingRepairSupported "1"
    ${Else}
      StrCpy $ExistingRepairBlockedReason "当前检测到的正式桌面版不是当前用户安装，无法安全执行修复。"
    ${EndIf}
    StrCpy $SelectedMaintenanceAction "replace"
    StrCpy $ExistingRecommendationText "推荐操作：替换"
  ${EndIf}

  ${If} $ExistingInstallState != "none"
    StrCpy $ExistingInstallSummaryText "安装类型：$ExistingInstallTypeText$\r$\n已装版本：$ExistingDesktopInstallVersion    旧入口痕迹：$ExistingLegacyMarkerSummary$\r$\n推荐操作：$ExistingRecommendationText$\r$\n安装位置：$ExistingDesktopInstallPath"
  ${EndIf}
FunctionEnd

Function UpdateMaintenanceInfoText
  ${If} $ExistingRepairSupported != "1"
    ${If} $ExistingRepairBlockedReason != ""
      ${NSD_SetText} $ExistingInstallPageInfo "修复不可用：请改选“替换”或“取消”。"
    ${Else}
      ${NSD_SetText} $ExistingInstallPageInfo ""
    ${EndIf}
  ${Else}
    ${NSD_SetText} $ExistingInstallPageInfo ""
  ${EndIf}
FunctionEnd

Function ExistingActionSelectionChanged
  Pop $0

  ${NSD_GetState} $ExistingInstallPageRadioCancel $1
  ${If} $1 == ${BST_CHECKED}
    StrCpy $SelectedMaintenanceAction "cancel"
    Call UpdateMaintenanceInfoText
    Return
  ${EndIf}

  ${NSD_GetState} $ExistingInstallPageRadioRepair $1
  ${If} $1 == ${BST_CHECKED}
    StrCpy $SelectedMaintenanceAction "repair"
    Call UpdateMaintenanceInfoText
    Return
  ${EndIf}

  StrCpy $SelectedMaintenanceAction "replace"
  Call UpdateMaintenanceInfoText
FunctionEnd

Function PrepareRepairMode
  ${If} $ExistingDesktopInstallRootKey != "HKCU"
    Return
  ${EndIf}

  DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  !ifdef UNINSTALL_REGISTRY_KEY_2
    DeleteRegValue HKCU "${UNINSTALL_REGISTRY_KEY_2}" "UninstallString"
  !endif
FunctionEnd

Function CleanupLegacyLauncherArtifacts
  Delete "$DESKTOP\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$DESKTOP\Horosa.lnk"
  Delete "$DESKTOP\START_HERE*.lnk"
  Delete "$DESKTOP\Horosa Local*.lnk"
  Delete "$DESKTOP\Horosa Launcher*.lnk"
  Delete "$DESKTOP\Horosa Desktop*.lnk"
  Delete "$DESKTOP\Horosa-cscript32.lnk"
  Delete "$DESKTOP\Horosa-cscript64.lnk"
  Delete "$DESKTOP\Horosa-longdesc.lnk"
  Delete "$DESKTOP\Horosa-missing-target.lnk"

  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\START_HERE*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Local*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Launcher*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Desktop*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-cscript32.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-cscript64.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-longdesc.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-missing-target.lnk"

  RMDir /r "$SMPROGRAMS\Horosa Local"
  RMDir /r "$SMPROGRAMS\Horosa Launcher"
  RMDir /r "$SMPROGRAMS\START_HERE"
  RMDir /r "$SMPROGRAMS\Horosa Desktop"

  SetShellVarContext all
  Delete "$SMPROGRAMS\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$SMPROGRAMS\Horosa.lnk"
  Delete "$SMPROGRAMS\START_HERE*.lnk"
  Delete "$SMPROGRAMS\Horosa Local*.lnk"
  Delete "$SMPROGRAMS\Horosa Launcher*.lnk"
  Delete "$SMPROGRAMS\Horosa Desktop*.lnk"
  RMDir /r "$SMPROGRAMS\Horosa Local"
  RMDir /r "$SMPROGRAMS\Horosa Launcher"
  RMDir /r "$SMPROGRAMS\START_HERE"
  RMDir /r "$SMPROGRAMS\Horosa Desktop"
  SetShellVarContext current

  Call ResolveShellDesktopDir
  ${If} $ShellDesktopDir != ""
    Delete "$ShellDesktopDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellDesktopDir\Horosa.lnk"
    Delete "$ShellDesktopDir\START_HERE*.lnk"
    Delete "$ShellDesktopDir\Horosa Local*.lnk"
    Delete "$ShellDesktopDir\Horosa Launcher*.lnk"
    Delete "$ShellDesktopDir\Horosa Desktop*.lnk"
  ${EndIf}

  Call ResolveShellProgramsDir
  ${If} $ShellProgramsDir != ""
    Delete "$ShellProgramsDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellProgramsDir\Horosa.lnk"
    Delete "$ShellProgramsDir\START_HERE*.lnk"
    Delete "$ShellProgramsDir\Horosa Local*.lnk"
    Delete "$ShellProgramsDir\Horosa Launcher*.lnk"
    Delete "$ShellProgramsDir\Horosa Desktop*.lnk"
    Delete "$ShellProgramsDir\Horosa-cscript32.lnk"
    Delete "$ShellProgramsDir\Horosa-cscript64.lnk"
    Delete "$ShellProgramsDir\Horosa-longdesc.lnk"
    Delete "$ShellProgramsDir\Horosa-missing-target.lnk"
  ${EndIf}
FunctionEnd

Function CleanupInstallShortcutArtifacts
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Desktop.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-cscript32.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-cscript64.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-longdesc.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa-missing-target.lnk"
  Delete "$DESKTOP\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$DESKTOP\Horosa.lnk"
  Delete "$DESKTOP\Horosa Desktop.lnk"
  Delete "$SMPROGRAMS\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$SMPROGRAMS\Horosa.lnk"
  Delete "$SMPROGRAMS\Horosa Desktop.lnk"
  Delete "$SMPROGRAMS\Horosa-cscript32.lnk"
  Delete "$SMPROGRAMS\Horosa-cscript64.lnk"
  Delete "$SMPROGRAMS\Horosa-longdesc.lnk"
  Delete "$SMPROGRAMS\Horosa-missing-target.lnk"

  Call ResolveShellDesktopDir
  ${If} $ShellDesktopDir != ""
    Delete "$ShellDesktopDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellDesktopDir\Horosa.lnk"
    Delete "$ShellDesktopDir\Horosa Desktop.lnk"
    Delete "$ShellDesktopDir\Horosa-cscript32.lnk"
    Delete "$ShellDesktopDir\Horosa-cscript64.lnk"
    Delete "$ShellDesktopDir\Horosa-longdesc.lnk"
    Delete "$ShellDesktopDir\Horosa-missing-target.lnk"
  ${EndIf}

  Call ResolveShellProgramsDir
  ${If} $ShellProgramsDir != ""
    Delete "$ShellProgramsDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellProgramsDir\Horosa.lnk"
    Delete "$ShellProgramsDir\Horosa Desktop.lnk"
    Delete "$ShellProgramsDir\Horosa-cscript32.lnk"
    Delete "$ShellProgramsDir\Horosa-cscript64.lnk"
    Delete "$ShellProgramsDir\Horosa-longdesc.lnk"
    Delete "$ShellProgramsDir\Horosa-missing-target.lnk"
  ${EndIf}
FunctionEnd

Function CleanupCurrentDesktopShortcuts
  Call CleanupInstallShortcutArtifacts

  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\${CURRENT_SHORTCUT_FILE_NAME}"
  Delete "$DESKTOP\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$DESKTOP\${CURRENT_SHORTCUT_FILE_NAME}"
  Delete "$SMPROGRAMS\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
  Delete "$SMPROGRAMS\${CURRENT_SHORTCUT_FILE_NAME}"

  Call ResolveShellDesktopDir
  ${If} $ShellDesktopDir != ""
    Delete "$ShellDesktopDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellDesktopDir\${CURRENT_SHORTCUT_FILE_NAME}"
  ${EndIf}

  Call ResolveShellProgramsDir
  ${If} $ShellProgramsDir != ""
    Delete "$ShellProgramsDir\${LEGACY_BRAND_SHORTCUT_FILE_NAME}"
    Delete "$ShellProgramsDir\${CURRENT_SHORTCUT_FILE_NAME}"
  ${EndIf}
FunctionEnd

Function ValidateShortcutTarget
  StrCpy $ShortcutValidationResult "0"

  IfFileExists "$ShortcutPathUnderTest" 0 shortcut_validate_done

  InitPluginsDir
  FileOpen $1 "$PLUGINSDIR\validate-shortcut.ps1" w
  FileWrite $1 "$$ErrorActionPreference = 'Stop'$\r$\n"
  FileWrite $1 "$$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($$env:HOROSA_SHORTCUT_PATH)$\r$\n"
  FileWrite $1 "if ($$shortcut.TargetPath -eq $$env:HOROSA_EXPECTED_TARGET) { exit 0 }$\r$\n"
  FileWrite $1 "exit 1$\r$\n"
  FileClose $1

  System::Call 'Kernel32::SetEnvironmentVariable(t, t) i ("HOROSA_SHORTCUT_PATH", "$ShortcutPathUnderTest").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t) i ("HOROSA_EXPECTED_TARGET", "$ShortcutExpectedTarget").r0'
  ClearErrors
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\validate-shortcut.ps1"' $0
  System::Call 'Kernel32::SetEnvironmentVariable(t, t) i ("HOROSA_SHORTCUT_PATH", "").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t) i ("HOROSA_EXPECTED_TARGET", "").r0'

  ${If} $0 == 0
    StrCpy $ShortcutValidationResult "1"
  ${EndIf}

shortcut_validate_done:
FunctionEnd

Function CreateShortcutWithPowerShell
  InitPluginsDir
  FileOpen $1 "$PLUGINSDIR\create-shortcut.vbs" w
  FileWrite $1 "Set fso = CreateObject($\"Scripting.FileSystemObject$\")$\r$\n"
  FileWrite $1 "Set shell = CreateObject($\"WScript.Shell$\")$\r$\n"
  FileWrite $1 "finalPath = WScript.Arguments.Item(0)$\r$\n"
  FileWrite $1 "tempPath = fso.GetParentFolderName(finalPath) & $\"\\Horosa Shortcut.tmp.lnk$\"$\r$\n"
  FileWrite $1 "If fso.FileExists(tempPath) Then fso.DeleteFile tempPath, True$\r$\n"
  FileWrite $1 "If fso.FileExists(finalPath) Then fso.DeleteFile finalPath, True$\r$\n"
  FileWrite $1 "Set shortcut = shell.CreateShortcut(tempPath)$\r$\n"
  FileWrite $1 "shortcut.TargetPath = WScript.Arguments.Item(1)$\r$\n"
  FileWrite $1 "shortcut.WorkingDirectory = WScript.Arguments.Item(2)$\r$\n"
  FileWrite $1 "shortcut.IconLocation = WScript.Arguments.Item(3)$\r$\n"
  FileWrite $1 "shortcut.Description = WScript.Arguments.Item(4)$\r$\n"
  FileWrite $1 "shortcut.Save$\r$\n"
  FileWrite $1 "fso.MoveFile tempPath, finalPath$\r$\n"
  FileClose $1

  ClearErrors
  ExecWait '"$SYSDIR\cscript.exe" //NoLogo "$PLUGINSDIR\create-shortcut.vbs" "$ShortcutPathUnderTest" "$ShortcutExpectedTarget" "$INSTDIR" "$ShortcutExpectedTarget,0" "星阙"' $0
FunctionEnd

Function ExistingInstallPageCreate
  ${If} ${Silent}
    Abort
  ${EndIf}

  ${If} $ExistingInstallState == "none"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "检测到已安装的星阙"
  Pop $ExistingInstallPageTitle

  ${NSD_CreateLabel} 0 14u 100% 16u "您正在维护此电脑上已有的星阙安装。请选择替换、修复，或直接退出安装器。"
  Pop $ExistingInstallPageSubtitle

  ${NSD_CreateGroupBox} 0 32u 100% 56u "已检测到的内容"
  Pop $0

  ${NSD_CreateLabel} 8u 44u 92% 32u "$ExistingInstallSummaryText"
  Pop $ExistingInstallPageSummary

  ${NSD_CreateGroupBox} 0 92u 100% 52u "请选择维护方式"
  Pop $0

  ${NSD_CreateRadioButton} 8u 104u 92% 10u "替换（安装新版本，保留用户数据）"
  Pop $ExistingInstallPageRadioReplace
  ${NSD_OnClick} $ExistingInstallPageRadioReplace ExistingActionSelectionChanged

  ${NSD_CreateRadioButton} 8u 116u 92% 10u "修复（重写程序文件并重建快捷方式）"
  Pop $ExistingInstallPageRadioRepair
  ${NSD_OnClick} $ExistingInstallPageRadioRepair ExistingActionSelectionChanged

  ${NSD_CreateRadioButton} 8u 128u 92% 10u "取消（退出安装器，不做更改）"
  Pop $ExistingInstallPageRadioCancel
  ${NSD_OnClick} $ExistingInstallPageRadioCancel ExistingActionSelectionChanged

  ${NSD_CreateLabel} 8u 140u 92% 8u ""
  Pop $ExistingInstallPageInfo

  ${If} $ExistingRepairSupported != "1"
    EnableWindow $ExistingInstallPageRadioRepair 0
    ${NSD_SetText} $ExistingInstallPageRadioRepair "修复（当前环境不可用）"
  ${EndIf}

  ${If} $SelectedMaintenanceAction == "repair"
    ${NSD_Check} $ExistingInstallPageRadioRepair
  ${ElseIf} $SelectedMaintenanceAction == "cancel"
    ${NSD_Check} $ExistingInstallPageRadioCancel
  ${Else}
    ${NSD_Check} $ExistingInstallPageRadioReplace
  ${EndIf}

  Call UpdateMaintenanceInfoText
  nsDialogs::Show
FunctionEnd

Function ExistingInstallPageLeave
  ${NSD_GetState} $ExistingInstallPageRadioCancel $0
  ${If} $0 == ${BST_CHECKED}
    MessageBox MB_ICONQUESTION|MB_YESNO "确定退出安装器并保留当前安装吗？" IDYES +2
    Abort
    SetErrorLevel 0
    Quit
  ${EndIf}

  ${NSD_GetState} $ExistingInstallPageRadioRepair $0
  ${If} $0 == ${BST_CHECKED}
    ${If} $ExistingRepairSupported != "1"
      MessageBox MB_OK|MB_ICONEXCLAMATION "$ExistingRepairBlockedReason$\r$\n请改选“替换”或“取消”。"
      Abort
    ${EndIf}
    StrCpy $SelectedMaintenanceAction "repair"
    Call PrepareRepairMode
    Return
  ${EndIf}

  StrCpy $SelectedMaintenanceAction "replace"
  ${If} $ExistingLegacyMarkerSummary != "未发现"
    Call CleanupLegacyLauncherArtifacts
  ${EndIf}
FunctionEnd

!macro customInit
  StrCpy $ExistingInstallState "none"
  StrCpy $ExistingInstallTypeText ""
  StrCpy $ExistingDesktopInstallPath "未记录"
  StrCpy $ExistingDesktopInstallVersion "版本未知"
  StrCpy $ExistingDesktopInstallRootKey ""
  StrCpy $ExistingLegacyMarkerSummary "未发现"
  StrCpy $ExistingInstallSummaryText ""
  StrCpy $ExistingRecommendationText ""
  StrCpy $ExistingRepairSupported "0"
  StrCpy $ExistingRepairBlockedReason ""
  StrCpy $SelectedMaintenanceAction "replace"
  StrCpy $ExistingLegacyHasDataDir "0"
  StrCpy $ExistingLegacyHasLogDir "0"
  StrCpy $ExistingLegacyHasShortcut "0"
  StrCpy $ShortcutPathUnderTest ""
  StrCpy $ShortcutExpectedTarget ""
  StrCpy $ShortcutValidationResult "0"
  StrCpy $ShortcutRepairWarning ""
  ${IfNot} ${Silent}
    Call BuildExistingInstallState
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page Custom ExistingInstallPageCreate ExistingInstallPageLeave
!macroend

!macro customInstall
  Call CleanupCurrentDesktopShortcuts
  StrCpy $ShortcutRepairWarning ""
  StrCpy $ShortcutExpectedTarget "$INSTDIR\Horosa.exe"
  StrCpy $ShortcutPathUnderTest "$newStartMenuLink"
  Call CreateShortcutWithPowerShell
  Call ValidateShortcutTarget
  ${If} $ShortcutValidationResult != "1"
    Delete "$newStartMenuLink"
    Call CreateShortcutWithPowerShell
    Call ValidateShortcutTarget
    ${If} $ShortcutValidationResult != "1"
      StrCpy $ShortcutRepairWarning "开始菜单快捷方式未能正确重建，请从安装目录中的 Horosa.exe 启动一次后再重新创建快捷方式。"
      DetailPrint "WARNING: failed to validate Start Menu shortcut target -> $newStartMenuLink"
    ${EndIf}
  ${EndIf}

  StrCpy $ShortcutExpectedTarget "$INSTDIR\Horosa.exe"
  StrCpy $ShortcutPathUnderTest "$newDesktopLink"
  Call CreateShortcutWithPowerShell
  Call ValidateShortcutTarget
  ${If} $ShortcutValidationResult != "1"
    Delete "$newDesktopLink"
    Call CreateShortcutWithPowerShell
    Call ValidateShortcutTarget
    ${If} $ShortcutValidationResult != "1"
      ${If} $ShortcutRepairWarning == ""
        StrCpy $ShortcutRepairWarning "桌面快捷方式未能正确重建，请从开始菜单或安装目录中的 Horosa.exe 启动一次后再重新创建桌面快捷方式。"
      ${Else}
        StrCpy $ShortcutRepairWarning "$ShortcutRepairWarning$\r$\n桌面快捷方式未能正确重建，请从开始菜单或安装目录中的 Horosa.exe 启动一次后再重新创建桌面快捷方式。"
      ${EndIf}
      DetailPrint "WARNING: failed to validate Desktop shortcut target -> $newDesktopLink"
    ${EndIf}
  ${EndIf}

  ${If} $ShortcutRepairWarning != ""
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "$ShortcutRepairWarning"
    ${Else}
      DetailPrint "WARNING: $ShortcutRepairWarning"
    ${EndIf}
  ${EndIf}
!macroend

Function .onInstSuccess
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
FunctionEnd

!macro customUnInstall
  Call CleanupCurrentDesktopShortcuts
!macroend

!endif
