!include "LogicLib.nsh"
!include "nsDialogs.nsh"

ManifestDPIAware true

!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"

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
  Delete "$DESKTOP\START_HERE*.lnk"
  Delete "$DESKTOP\Horosa Local*.lnk"
  Delete "$DESKTOP\Horosa Launcher*.lnk"

  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\START_HERE*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Local*.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Launcher*.lnk"

  RMDir /r "$SMPROGRAMS\Horosa Local"
  RMDir /r "$SMPROGRAMS\Horosa Launcher"
  RMDir /r "$SMPROGRAMS\START_HERE"

  SetShellVarContext all
  Delete "$SMPROGRAMS\START_HERE*.lnk"
  Delete "$SMPROGRAMS\Horosa Local*.lnk"
  Delete "$SMPROGRAMS\Horosa Launcher*.lnk"
  RMDir /r "$SMPROGRAMS\Horosa Local"
  RMDir /r "$SMPROGRAMS\Horosa Launcher"
  RMDir /r "$SMPROGRAMS\START_HERE"
  SetShellVarContext current
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

  ${IfNot} ${Silent}
    Call BuildExistingInstallState
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page Custom ExistingInstallPageCreate ExistingInstallPageLeave
!macroend

!endif
