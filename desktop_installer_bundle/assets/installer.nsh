!include "LogicLib.nsh"
!include "nsDialogs.nsh"
; Both are include-guarded (___WINVER__NSH___ / FILEFUNC_INCLUDED) — the
; electron-builder template re-includes them later via common.nsh/multiUser.nsh
; as a warning-free no-op under /WX. Needed HERE because this file is parsed
; first and Function bodies compile at parse time.
!include "WinVer.nsh"    ; ${AtLeastWin10}
!include "FileFunc.nsh"  ; ${GetRoot} ${DriveSpace}

ManifestDPIAware true

!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
!define /ifndef CURRENT_SHORTCUT_FILE_NAME "星阙.lnk"
!define /ifndef LEGACY_BRAND_SHORTCUT_FILE_NAME "Horosa.lnk"

; Disk-space preflight thresholds (MB). The unpacked app is ~2.05 GB and first
; boot extracts another ~1.35 GB runtime into %LOCALAPPDATA%\HorosaDesktop —
; without a preflight, a low-disk install fails midway (or first boot half-
; extracts) and the user sees a cryptic "本地排盘服务未就绪" instead of the
; real cause. Overridable per-build via /D.
!define /ifndef HOROSA_MIN_FREE_INSTALL_MB 3072
!define /ifndef HOROSA_MIN_FREE_DATA_MB 3072
!define /ifndef HOROSA_MIN_FREE_COMBINED_MB 6144

; ============================================================================
; Win issue #18 — "升级安装从来都没有成功过，只能卸载之后再安装才能成功"
; ----------------------------------------------------------------------------
; electron-builder's default _CHECK_APP_RUNNING (allowOnlyOneInstallerInstance.nsh)
; sends a polite WM_CLOSE then a taskkill scoped by `$_.Path.StartsWith('$INSTDIR')`
; (PowerShell) / `/FI "USERNAME eq %USERNAME%"` (cmd). On real machines this FAILS:
;   * electron/main.js intercepts window 'close' with event.preventDefault() to run
;     an async runtime shutdown first, so the polite WM_CLOSE never terminates
;     Horosa.exe; and
;   * the $INSTDIR PowerShell .StartsWith filter mis-handles the Chinese product
;     path ("星阙"), and the USERNAME filter can miss — so neither default kill lands.
; Result: "星阙 无法关闭" -> $INSTDIR\Horosa.exe stays locked -> "Failed to uninstall
; old application files: 2" -> the in-place upgrade can NEVER succeed (issue #18).
;
; Override the hook with a robust, path-INDEPENDENT force-termination:
;   (1) taskkill /F /IM Horosa.exe — kills the app image directly (main + renderer +
;       gpu + utility), releasing the $INSTDIR file locks. NO /T (so the auto-update
;       installer, if ever a Horosa.exe descendant, is never tree-killed) and NO
;       path/USERNAME filter (those are exactly what break the default macro).
;   (2) Stop ONLY Horosa's embedded sidecars — java.exe/python.exe whose path is under
;       our unique "embedded-runtime" extraction dir — so the user's own Java/Python is
;       never touched (v2.5.4+ already cascades these via the Job Object; this also
;       covers pre-2.5.4 orphans and any machine where the Job Object failed).
;   (3) Bounded verify+re-kill loop (settles NTFS handles); only as a last resort fall
;       back to the manual-close prompt (mirrors the default macro's safety net, and is
;       skipped under ${Silent} so an in-app auto-update is never blocked by a dialog).
; ============================================================================
!macro customCheckAppRunning
  ${If} ${isUpdated}
    ; in-app auto-update: the app called quitAndInstall and is stopping its own
    ; sidecars + exiting — give that graceful path a moment before forcing anything.
    Sleep 1200
  ${EndIf}
  DetailPrint "正在结束正在运行的星阙实例以完成安装（升级无需先卸载）…"
  ; (1) force-kill the app image — load-bearing, path/encoding independent.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Sleep 600
  ; (2) best-effort: kill ONLY Horosa's embedded sidecars (scoped by path token).
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq 'java.exe' -or $$_.Name -eq 'python.exe') -and $$_.Path -like '*embedded-runtime*' } | ForEach-Object { try { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }"`
  Pop $0
  Sleep 400
  ; (3) verify the app image is gone; re-force-kill up to 5x, settling handles.
  StrCpy $R1 0
  horosa_killloop:
    IntOp $R1 $R1 + 1
    nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /NH | "$SYSDIR\find.exe" /I "${APP_EXECUTABLE_FILENAME}"`
    Pop $R0
    ${If} $R0 == 0
      ; still running -> force-kill again + wait for handle release
      nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
      Pop $0
      Sleep 1000
      ${If} $R1 < 5
        Goto horosa_killloop
      ${Else}
        ${IfNot} ${Silent}
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "无法自动结束正在运行的星阙。$\r$\n请手动退出星阙（含系统托盘 / 任务管理器中的 Horosa.exe）后点击“重试”。" /SD IDCANCEL IDRETRY horosa_killloop
          Quit
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ; app image confirmed gone (or best-effort under silent); final short settle.
  Sleep 300
!macroend

; ============================================================================
; TRUE-uninstall-only cache cleanup. The electron-builder template inserts this
; into Section "un.Uninstall" (uninstaller.nsh `!insertmacro customUnInstall`),
; which is compiled ONLY in the BUILD_UNINSTALLER pass — so this macro MUST
; live here, OUTSIDE the `!ifndef BUILD_UNINSTALLER` guard below. (The previous
; customUnInstall definition sat inside that guard and was therefore DEAD CODE
; for the uninstaller — and uninstall left the multi-GB runtime cache + logs +
; updater cache behind forever.)
;
; An in-place upgrade runs THIS (old) uninstaller as
;     old-uninstaller.exe /S /KEEP_APP_DATA --updated _?=<dir>
; (app-builder-lib installUtil.nsh) -> ${isUpdated} is true -> skip everything;
; same idiom as the template's own app-data block (uninstaller.nsh).
;
; User charts/settings (Local Storage / IndexedDB) live DIRECTLY under
; $LOCALAPPDATA\HorosaDesktop and MUST survive: only regenerable caches/logs
; are removed; NEVER RMDir HorosaDesktop itself.
;
; WARNING to future editors: removing the ${ifNot} ${isUpdated} guard would
; delete the 1.35 GB runtime cache on EVERY auto-update.
; ============================================================================
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; $LOCALAPPDATA is shell-var-context sensitive; the caches are per-user.
    ; Mirror the template's context dance for legacy per-machine installs.
    ${if} $installMode == "all"
      SetShellVarContext current
    ${endif}
    DetailPrint "正在清理星阙运行时缓存与日志（约 1-3 GB，可能需要一点时间）…"
    RMDir /r "$LOCALAPPDATA\HorosaDesktop\embedded-runtime"
    RMDir /r "$LOCALAPPDATA\HorosaDesktop\logs"
    RMDir /r "$LOCALAPPDATA\HorosaRt"
    RMDir /r "$TEMP\HorosaRt"
    RMDir /r "$PROFILE\.horosa-rt"
    RMDir /r "$LOCALAPPDATA\horosa-desktop-bundle-updater"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endif}
  ${endif}
!macroend

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
Var FirstInstallPageTitle
Var FirstInstallPageSubtitle
Var FirstInstallPageSummary
Var FirstInstallPageInfo
Var ShortcutHelperScriptPath
Var ShellDesktopDir
Var ShellProgramsDir
Var ShortcutHelperExitCode
Var ShortcutPathUnderTest
Var ShortcutExpectedTarget
Var ShortcutValidationResult
Var ShortcutRepairWarning
Var ShortcutHelperReady

Function PrepareShortcutHelperScript
  StrCpy $ShortcutHelperScriptPath "$TEMP\horosa-shortcut-helper.vbs"
  StrCpy $ShortcutHelperReady "0"
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
  StrCpy $ShortcutHelperReady "1"
  Return

shortcut_helper_write_failed:
  StrCpy $ShortcutHelperReady "0"
  DetailPrint "WARNING: cannot write shortcut helper script; using native shortcut creation instead."
  Return

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
  ; A shortcut existing at the expected path is the success condition. The
  ; cscript/VBScript deep target check is best-effort only and must never
  ; produce a false failure (or a scary message) on machines where VBScript is
  ; blocked/unavailable -- creation already guarantees the correct target.
  StrCpy $ShortcutValidationResult "0"
  IfFileExists "$ShortcutPathUnderTest" 0 shortcut_validate_done
  StrCpy $ShortcutValidationResult "1"
shortcut_validate_done:
FunctionEnd

Function CreateShortcutWithPowerShell
  Call PrepareShortcutHelperScript
  ${If} $ShortcutHelperReady == "1"
    ClearErrors
    nsExec::ExecToStack '"$SYSDIR\cscript.exe" //NoLogo "$ShortcutHelperScriptPath" ensureshortcut "$ShortcutPathUnderTest" "$ShortcutExpectedTarget" "$INSTDIR" "$ShortcutExpectedTarget,0" "星阙"'
    Pop $ShortcutHelperExitCode
    Pop $0
    ${If} $ShortcutHelperExitCode != 0
      DetailPrint "WARNING: shortcut creation helper failed -> $ShortcutPathUnderTest :: $0"
    ${EndIf}
  ${EndIf}
  ; Guarantee a shortcut even when VBScript/cscript is blocked or fails
  ; (locked-down AV/ASR rules, Windows VBScript deprecation, OneDrive lock, or
  ; the helper could not be written): fall back to native NSIS CreateShortCut.
  ; Native creation is in-process Win32 (no script engine), so it succeeds where
  ; the cscript path is blocked.
  IfFileExists "$ShortcutPathUnderTest" shortcut_create_done
  SetOutPath "$INSTDIR"
  ClearErrors
  CreateShortCut "$ShortcutPathUnderTest" "$ShortcutExpectedTarget" "" "$ShortcutExpectedTarget" 0 SW_SHOWNORMAL "" "星阙"
  IfFileExists "$ShortcutPathUnderTest" 0 shortcut_create_done
  DetailPrint "INFO: created shortcut via native NSIS fallback -> $ShortcutPathUnderTest"
shortcut_create_done:
FunctionEnd

; ============================================================================
; Disk-space preflight. The unpacked app (~2.05 GB) + first-boot runtime
; extraction (~1.35 GB into %LOCALAPPDATA%\HorosaDesktop) + updater cache need
; real headroom; the template's SectionSetSize check covers only the install
; drive, interactively, with zero margin. If a drive cannot be measured
; (nonexistent letter, exotic UNC) the gate is SKIPPED — the CreateDirectory/
; write probes in ValidateInstallDirectory still catch unusable targets.
; Exit code 112 = ERROR_DISK_FULL (self-documenting in electron-updater logs).
; ============================================================================
Function CheckHorosaDiskSpace
  ${GetRoot} "$INSTDIR" $0
  ${If} $0 == ""
    Return
  ${EndIf}
  StrCpy $0 "$0\"
  ${GetRoot} "$LOCALAPPDATA" $1
  StrCpy $1 "$1\"

  ClearErrors
  ${DriveSpace} "$0" "/D=F /S=M" $2
  ${If} ${Errors}
  ${OrIf} $2 == ""
    Return
  ${EndIf}

  ${If} $0 == $1
    ; Same drive: one combined threshold. >9 digits of free MB (~ >1 PB)
    ; would wrap the 32-bit IntCmp below — treat as plenty and skip.
    StrLen $3 $2
    ${If} $3 > 9
      Return
    ${EndIf}
    ${If} $2 < ${HOROSA_MIN_FREE_COMBINED_MB}
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONSTOP "磁盘空间不足，无法安装星阙。$\r$\n$\r$\n驱动器 $0 需要至少 6 GB 可用空间（程序约 2 GB，另有首次启动解压的内置运行时约 1.4 GB 及更新缓存），当前仅剩 $2 MB。$\r$\n$\r$\n请清理磁盘空间，或返回上一步选择其他驱动器后重试。"
        Abort
      ${EndIf}
      DetailPrint "ERROR: insufficient disk space on $0 (need ${HOROSA_MIN_FREE_COMBINED_MB} MB, have $2 MB)"
      SetErrorLevel 112
      Quit
    ${EndIf}
    Return
  ${EndIf}

  ; Different drives: per-drive thresholds.
  StrLen $3 $2
  ${If} $3 < 10
  ${AndIf} $2 < ${HOROSA_MIN_FREE_INSTALL_MB}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "安装目标驱动器 $0 空间不足。$\r$\n$\r$\n安装星阙需要该驱动器至少 3 GB 可用空间，当前仅剩 $2 MB。$\r$\n请清理磁盘空间，或返回上一步选择其他安装位置。"
      Abort
    ${EndIf}
    DetailPrint "ERROR: insufficient disk space on install drive $0 ($2 MB free)"
    SetErrorLevel 112
    Quit
  ${EndIf}

  ClearErrors
  ${DriveSpace} "$1" "/D=F /S=M" $4
  ${If} ${Errors}
  ${OrIf} $4 == ""
    Return
  ${EndIf}
  StrLen $5 $4
  ${If} $5 < 10
  ${AndIf} $4 < ${HOROSA_MIN_FREE_DATA_MB}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "系统数据盘 $1 空间不足。$\r$\n$\r$\n星阙首次启动会在本地应用数据目录（HorosaDesktop）解压约 1.4 GB 的内置运行时，需要该驱动器至少 3 GB 可用空间，当前仅剩 $4 MB。$\r$\n请先清理该驱动器的空间后重试。"
      Abort
    ${EndIf}
    DetailPrint "ERROR: insufficient disk space on data drive $1 ($4 MB free)"
    SetErrorLevel 112
    Quit
  ${EndIf}
FunctionEnd

Function ValidateInstallDirectory
  ${If} $INSTDIR == ""
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "请选择有效的星阙安装目录。"
    ${Else}
      DetailPrint "ERROR: empty install directory"
    ${EndIf}
    Abort
  ${EndIf}

  Call CheckHorosaDiskSpace

  StrLen $0 "$INSTDIR"
  ${If} $0 > 180
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "当前安装目录路径较长，可能降低 Windows 兼容性：$\r$\n$INSTDIR$\r$\n$\r$\n建议选择更短的路径，例如 C:\Horosa 或用户目录下的 Horosa。"
    ${Else}
      DetailPrint "WARNING: long install directory path: $INSTDIR"
    ${EndIf}
  ${EndIf}

  ClearErrors
  CreateDirectory "$INSTDIR"
  ${If} ${Errors}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "无法创建安装目录：$\r$\n$INSTDIR$\r$\n$\r$\n请换一个目录，或使用有权限的账户重新运行安装器。"
    ${Else}
      DetailPrint "ERROR: cannot create install directory: $INSTDIR"
    ${EndIf}
    Abort
  ${EndIf}

  ClearErrors
  FileOpen $0 "$INSTDIR\.horosa-install-write-test" w
  ${If} ${Errors}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "安装目录不可写：$\r$\n$INSTDIR$\r$\n$\r$\n请换一个目录，或以管理员权限重新运行安装器。"
    ${Else}
      DetailPrint "ERROR: install directory is not writable: $INSTDIR"
    ${EndIf}
    Abort
  ${EndIf}
  FileWrite $0 "Horosa installer write test"
  FileClose $0
  Delete "$INSTDIR\.horosa-install-write-test"
FunctionEnd

Function FirstInstallPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "准备安装星阙"
  Pop $FirstInstallPageTitle

  ${NSD_CreateLabel} 0 14u 100% 20u "安装器将使用随包 Java / Python / Web 运行时，不依赖本机预装环境。您可以返回上一步选择安装目录。"
  Pop $FirstInstallPageSubtitle

  ${NSD_CreateGroupBox} 0 40u 100% 66u "安装位置与稳定性检查"
  Pop $0

  ${NSD_CreateLabel} 8u 54u 92% 34u "当前选择：$INSTDIR$\r$\n如选择父目录，安装器会自动创建 Horosa 子目录。安装前会检查目录是否可创建、可写，并在升级时保留用户数据。"
  Pop $FirstInstallPageSummary

  ${NSD_CreateLabel} 8u 88u 92% 16u "首次启动会解压内置运行时，之后会使用缓存快速启动；启动页提供“自检修复并重试”来恢复损坏缓存。"
  Pop $FirstInstallPageInfo

  nsDialogs::Show
FunctionEnd

Function ExistingInstallPageCreate
  ${If} ${Silent}
    Abort
  ${EndIf}

  ${If} $ExistingInstallState == "none"
    Call FirstInstallPageCreate
    Return
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
  ${If} $ExistingInstallState == "none"
    Call ValidateInstallDirectory
    Return
  ${EndIf}

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
    Call ValidateInstallDirectory
    Call PrepareRepairMode
    Return
  ${EndIf}

  StrCpy $SelectedMaintenanceAction "replace"
  Call ValidateInstallDirectory
  ${If} $ExistingLegacyMarkerSummary != "未发现"
    Call CleanupLegacyLauncherArtifacts
  ${EndIf}
FunctionEnd

!macro customInit
  ; --- Windows 10+ 门槛（在任何 UI/状态检测之前）。Electron 35 仅支持 Win10+，
  ; 老系统装完即首启黑屏闪退且无任何提示。1633 = ERROR_INSTALL_PLATFORM_UNSUPPORTED.
  ${IfNot} ${AtLeastWin10}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "星阙桌面版需要 Windows 10 或更高版本。$\r$\n$\r$\n当前系统版本过旧（Windows 8.1 及更早版本无法运行内置运行时），安装已取消。"
    ${EndIf}
    SetErrorLevel 1633
    Quit
  ${EndIf}
  ; --- 仅提示（不拦截、仅交互式）：Win10 内部版本低于 1809 (17763)。
  ; SetRegView 64 已由模板的 check64BitAndSetRegView 在 customInit 之前设置。
  ${IfNot} ${Silent}
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuild"
    ${If} $0 != ""
    ${AndIf} $0 < 17763
      MessageBox MB_OK|MB_ICONEXCLAMATION "检测到您的 Windows 10 版本较旧（内部版本 $0，低于 1809）。$\r$\n星阙仍可安装，但建议升级 Windows 以获得更好的兼容性（如系统级长路径支持）。" /SD IDOK
    ${EndIf}
  ${EndIf}
  ; --- 静默流（/S 与应用内自动更新）唯一的解压前钩子：磁盘空间预检。
  ; 交互流由 ValidateInstallDirectory（目录页 leave）覆盖，可返回换盘。
  ${If} ${Silent}
    Call CheckHorosaDiskSpace
  ${EndIf}
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

; ============================================================================
; Win issue #18 (round 2) — in-place upgrade STILL fails AFTER the v2.6.0
; customCheckAppRunning fix, and even after a full reboot. The reporter:
;   "程序都关了，关机重启，再运行安装程序也报这个错" -> "Failed to uninstall old
;   application files: 2".
; ----------------------------------------------------------------------------
; A reboot proves NO Horosa process is alive, yet the upgrade still dies. That
; "2" is the *old* uninstaller's exit code, surfaced by app-builder-lib's
; handleUninstallResult (node_modules/.../include/installUtil.nsh): an in-place
; upgrade first runs the PREVIOUSLY-INSTALLED uninstaller
;   old-uninstaller.exe /S /KEEP_APP_DATA --updated _?=$INSTDIR
; and on a non-zero exit the DEFAULT handler does `SetErrorLevel 2; Quit`,
; aborting the whole upgrade. That old uninstaller is the binary already on disk
; -> built from the version the user currently has (typically PRE-2.6.0) -> it
; still carries electron-builder's buggy defaults that our v2.6.0 fix could only
; repair in the NEW installer/uninstaller, never in the OLD one:
;   * its KILL_PROCESS fallback filters by `/FI "USERNAME eq %USERNAME%"`, which
;     mis-matches a non-ASCII (Chinese) Windows username, so it never kills the
;     app; and/or
;   * un.atomicRMDir aborts the moment ANY file under the Chinese "…\星阙" install
;     dir is briefly locked (360/Defender real-time scan, OneDrive, an autostart
;     relaunch) -> returns non-zero.
; customCheckAppRunning runs in the NEW installer and cannot help here, because
; the failure is the OLD uninstaller's own logic, not a live process the new
; installer could kill.
;
; The mature fix is to make the INSTALLER resilient to a failing prior
; uninstaller instead of surrendering. handleUninstallResult offers exactly one
; lever: when `customUnInstallCheck` is defined it is inserted INSTEAD of the
; default `SetErrorLevel 2; Quit`. We take over: on a non-zero old-uninstaller
; exit we force-terminate any lingering app + OUR embedded runtime, then forcibly
; clear the stale PROGRAM directory ourselves (retrying to ride out AV/handle
; release) and CONTINUE — the fresh files are about to be written over the same
; $INSTDIR. Only a genuinely unbreakable lock falls back to a clear, actionable
; message (manual install) or a real non-zero exit (silent auto-update) — never
; the cryptic "code 2". User data (userData / %APPDATA%) is never touched: we
; only clear the program install dir, and only when it actually contains our exe.
; ============================================================================
!macro customUnInstallCheck
  ; $R0 = exit code of the OLD uninstaller app-builder-lib just ran (0 = success).
  ${If} $R0 == 0
    Goto horosa_unchk_done
  ${EndIf}

  ; The dir the old uninstaller failed to clear == this in-place upgrade's target.
  ; (Must use the built-in $INSTDIR, NOT app-builder-lib's $installationDir: that
  ; global is declared inside uninstallOldVersion, which the NSIS compiler reaches
  ; AFTER handleUninstallResult where this macro is inserted -> "not declared".)
  StrCpy $R2 "$INSTDIR"
  ; Safety: only act when this really is a Horosa program dir (contains our exe).
  ; Otherwise the failure wasn't a locked program file -> don't risk a broad
  ; RMDir; the fresh install overwrites anything stale anyway.
  ${IfNot} ${FileExists} "$R2\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "旧版本主程序不存在或路径未知，跳过强制清理，继续安装。"
    Goto horosa_unchk_done
  ${EndIf}

  DetailPrint "旧版本卸载器返回 $R0；改用内置清理流程继续升级（无需先手动卸载）…"

  ; Force-terminate any lingering app image + Horosa's OWN embedded runtime only
  ; (path/encoding independent — same proven approach as customCheckAppRunning).
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($$_.Name -eq 'java.exe' -or $$_.Name -eq 'python.exe') -and $$_.Path -like '*embedded-runtime*' } | ForEach-Object { try { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }"`
  Pop $0
  Sleep 800

  ; Forcibly clear the stale program dir ourselves, retrying to outlast AV /
  ; handle release. Only the program dir is removed — NOT user data.
  StrCpy $R1 0
  horosa_unchk_clean:
    IntOp $R1 $R1 + 1
    ; re-kill in case an autostart entry relaunched the app between tries.
    nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"'
    Pop $0
    RMDir /r "$R2"
    ${IfNot} ${FileExists} "$R2\${APP_EXECUTABLE_FILENAME}"
      ; the load-bearing exe is gone -> $INSTDIR is safe to overwrite. Done.
      DetailPrint "旧版本程序文件已清理，继续安装新版本。"
      Goto horosa_unchk_done
    ${EndIf}
    ${If} $R1 < 6
      Sleep 1200
      Goto horosa_unchk_clean
    ${EndIf}

    ; Still locked after retries (e.g. AV holding a handle). Be honest & helpful.
    ; (Falls through from the loop above — no label here: NSIS /WX flags unused labels.)
    ${IfNot} ${Silent}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "无法清理旧版本安装目录：$\r$\n$R2$\r$\n$\r$\n通常是安全软件（如 360 / Defender 实时防护）或仍在运行的星阙正占用文件。$\r$\n请暂时关闭安全软件实时防护、或手动删除上述文件夹后点击“重试”。" /SD IDCANCEL IDRETRY horosa_unchk_reset
    ${EndIf}
    DetailPrint "ERROR: 无法清理旧版本安装目录 $R2（文件被占用）。"
    SetErrorLevel 2
    Quit
  horosa_unchk_reset:
    StrCpy $R1 0
    Goto horosa_unchk_clean

  horosa_unchk_done:
!macroend

!macro customInstall
  Call ValidateInstallDirectory
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

; NOTE: the customUnInstall macro that used to be defined HERE was dead code —
; it sat inside this !ifndef BUILD_UNINSTALLER guard while the template only
; inserts customUnInstall in the BUILD_UNINSTALLER pass (and it Call'd a
; non-un. function, which could never compile there anyway). The live
; definition now sits near the top of this file, OUTSIDE the guard. Defining a
; second one here would be a duplicate-macro compile error.

!endif
