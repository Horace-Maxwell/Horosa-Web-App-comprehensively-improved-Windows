!include "LogicLib.nsh"
!include "nsDialogs.nsh"

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
Var ExistingInstallPageReplaceDesc
Var ExistingInstallPageRepairDesc
Var ExistingInstallPageCancelDesc

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
    StrCpy $ExistingInstallTypeText "当前用户安装的正式桌面版"
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
    StrCpy $ExistingInstallTypeText "所有用户安装的正式桌面版"
    ${If} $0 != ""
      StrCpy $ExistingDesktopInstallPath $0
    ${EndIf}
    ${If} $1 != ""
      StrCpy $ExistingDesktopInstallVersion $1
    ${EndIf}
  ${EndIf}
FunctionEnd

Function AppendLegacyMarker
  Pop $0
  ${If} $0 == ""
    Return
  ${EndIf}

  ${If} $ExistingLegacyMarkerSummary == ""
    StrCpy $ExistingLegacyMarkerSummary $0
  ${Else}
    StrCpy $ExistingLegacyMarkerSummary "$ExistingLegacyMarkerSummary$\r$\n$0"
  ${EndIf}
FunctionEnd

Function DetectLegacyMarkers
  StrCpy $ExistingLegacyMarkerSummary "未发现"

  IfFileExists "$LOCALAPPDATA\Horosa\*.*" 0 +3
    Push "旧数据目录：$LOCALAPPDATA\Horosa"
    Call AppendLegacyMarker

  IfFileExists "$PROFILE\.horosa-logs\astrostudyboot\*.*" 0 +3
    Push "旧日志目录：$PROFILE\.horosa-logs\astrostudyboot"
    Call AppendLegacyMarker

  IfFileExists "$DESKTOP\START_HERE*.lnk" 0 +3
    Push "桌面旧入口：$DESKTOP\START_HERE*.lnk"
    Call AppendLegacyMarker

  IfFileExists "$DESKTOP\Horosa Local*.lnk" 0 +3
    Push "桌面旧入口：$DESKTOP\Horosa Local*.lnk"
    Call AppendLegacyMarker

  IfFileExists "$APPDATA\Microsoft\Windows\Start Menu\Programs\START_HERE*.lnk" 0 +3
    Push "开始菜单旧入口：$APPDATA\Microsoft\Windows\Start Menu\Programs\START_HERE*.lnk"
    Call AppendLegacyMarker

  IfFileExists "$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Local*.lnk" 0 +3
    Push "开始菜单旧入口：$APPDATA\Microsoft\Windows\Start Menu\Programs\Horosa Local*.lnk"
    Call AppendLegacyMarker

  SetShellVarContext all
  IfFileExists "$SMPROGRAMS\START_HERE*.lnk" 0 +3
    Push "所有用户开始菜单旧入口：$SMPROGRAMS\START_HERE*.lnk"
    Call AppendLegacyMarker

  IfFileExists "$SMPROGRAMS\Horosa Local*.lnk" 0 +3
    Push "所有用户开始菜单旧入口：$SMPROGRAMS\Horosa Local*.lnk"
    Call AppendLegacyMarker
  SetShellVarContext current
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
      StrCpy $ExistingRecommendationText "推荐操作：修复。当前检测到的是当前用户安装的正式桌面版，适合原地补齐程序文件并重建快捷方式。"
    ${Else}
      StrCpy $ExistingRepairBlockedReason "未检测到当前用户安装的正式桌面版，因此无法执行修复。"
      StrCpy $ExistingRecommendationText "推荐操作：替换。当前检测到的是所有用户安装的正式桌面版，离线安装包更适合执行替换。"
    ${EndIf}
  ${ElseIf} $ExistingInstallState == "legacy-launcher-found"
    StrCpy $ExistingInstallTypeText "旧本地启动器 / 浏览器壳痕迹"
    StrCpy $ExistingRepairBlockedReason "检测到的是旧启动器痕迹，建议选择替换完成正式桌面版安装。"
    StrCpy $ExistingRecommendationText "推荐操作：替换。安装器会清理旧入口快捷方式，但不会删除用户数据。"
  ${ElseIf} $ExistingInstallState == "both-found"
    ${If} $ExistingDesktopInstallRootKey == "HKCU"
      StrCpy $ExistingRepairSupported "1"
    ${Else}
      StrCpy $ExistingRepairBlockedReason "当前检测到的正式桌面版不是当前用户安装，无法安全执行修复。"
    ${EndIf}
    StrCpy $SelectedMaintenanceAction "replace"
    StrCpy $ExistingRecommendationText "推荐操作：替换。这样会同时更新正式桌面版，并清理旧启动器入口。"
  ${EndIf}

  ${If} $ExistingInstallState != "none"
    StrCpy $ExistingInstallSummaryText "安装类型：$ExistingInstallTypeText$\r$\n安装位置：$ExistingDesktopInstallPath$\r$\n已装版本：$ExistingDesktopInstallVersion$\r$\n旧入口痕迹：$ExistingLegacyMarkerSummary"
  ${EndIf}
FunctionEnd

Function UpdateMaintenanceInfoText
  ${If} $SelectedMaintenanceAction == "repair"
    StrCpy $0 "$ExistingRecommendationText$\r$\n执行结果：将保留用户数据目录，原地补齐程序文件并重建快捷方式。$\r$\n提示：此页面仅在重复运行完整安装包时出现；应用内自动更新不受影响。"
  ${ElseIf} $SelectedMaintenanceAction == "cancel"
    StrCpy $0 "$ExistingRecommendationText$\r$\n执行结果：将退出安装器，不会修改程序文件、快捷方式或用户数据。$\r$\n提示：此页面仅在重复运行完整安装包时出现；应用内自动更新不受影响。"
  ${Else}
    ${If} $ExistingLegacyMarkerSummary != "未发现"
      StrCpy $0 "$ExistingRecommendationText$\r$\n执行结果：将安装新版本，并清理旧启动器快捷方式/入口；不会删除用户数据。$\r$\n提示：此页面仅在重复运行完整安装包时出现；应用内自动更新不受影响。"
    ${Else}
      StrCpy $0 "$ExistingRecommendationText$\r$\n执行结果：将用当前安装包替换程序文件；不会删除命盘、配置和缓存数据。$\r$\n提示：此页面仅在重复运行完整安装包时出现；应用内自动更新不受影响。"
    ${EndIf}
  ${EndIf}

  ${NSD_SetText} $ExistingInstallPageInfo $0
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

  ${NSD_CreateLabel} 0 0 100% 14u "检测到已安装的星阙"
  Pop $ExistingInstallPageTitle

  ${NSD_CreateLabel} 0 16u 100% 16u "您正在维护此电脑上已有的星阙安装。请选择替换、修复，或直接退出安装器。"
  Pop $ExistingInstallPageSubtitle

  ${NSD_CreateGroupBox} 0 34u 100% 72u "已检测到的内容"
  Pop $0

  ${NSD_CreateLabel} 8u 48u 92% 50u "$ExistingInstallSummaryText"
  Pop $ExistingInstallPageSummary

  ${NSD_CreateGroupBox} 0 110u 100% 86u "请选择维护方式"
  Pop $0

  ${NSD_CreateRadioButton} 8u 124u 92% 10u "替换"
  Pop $ExistingInstallPageRadioReplace
  ${NSD_OnClick} $ExistingInstallPageRadioReplace ExistingActionSelectionChanged

  ${NSD_CreateLabel} 20u 136u 88% 10u "安装新版本并保留用户数据；若检测到旧入口，会一并清理旧快捷方式。"
  Pop $ExistingInstallPageReplaceDesc

  ${NSD_CreateRadioButton} 8u 150u 92% 10u "修复"
  Pop $ExistingInstallPageRadioRepair
  ${NSD_OnClick} $ExistingInstallPageRadioRepair ExistingActionSelectionChanged

  ${NSD_CreateLabel} 20u 162u 88% 10u "保留当前安装目录和用户数据，重新写入程序文件并重建快捷方式。"
  Pop $ExistingInstallPageRepairDesc

  ${NSD_CreateRadioButton} 8u 176u 92% 10u "取消"
  Pop $ExistingInstallPageRadioCancel
  ${NSD_OnClick} $ExistingInstallPageRadioCancel ExistingActionSelectionChanged

  ${NSD_CreateLabel} 20u 188u 88% 10u "退出安装器，不做任何更改。"
  Pop $ExistingInstallPageCancelDesc

  ${If} $ExistingRepairSupported != "1"
    EnableWindow $ExistingInstallPageRadioRepair 0
    ${NSD_SetText} $ExistingInstallPageRepairDesc "$ExistingRepairBlockedReason"
  ${EndIf}

  ${NSD_CreateLabel} 0 202u 100% 28u ""
  Pop $ExistingInstallPageInfo

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

  ${IfNot} ${Silent}
    Call BuildExistingInstallState
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page Custom ExistingInstallPageCreate ExistingInstallPageLeave
!macroend

!endif
