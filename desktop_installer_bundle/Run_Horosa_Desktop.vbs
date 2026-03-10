Option Explicit

Dim fso, shell, scriptDir, repoRoot, pythonwExe, launcherScript, launchScript, depsRoot, installScript, wizardScript, cmd, exitCode, pwshExe
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Dim displayName
displayName = "星阙"

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(scriptDir)
pythonwExe = fso.BuildPath(repoRoot, "local\workspace\runtime\windows\python\pythonw.exe")
launcherScript = fso.BuildPath(scriptDir, "src\horosa_desktop.pyw")
launchScript = fso.BuildPath(scriptDir, "launch_desktop_runtime.ps1")
depsRoot = shell.ExpandEnvironmentStrings("%LocalAppData%") & "\HorosaDesktop\runtime-pydeps"
installScript = fso.BuildPath(scriptDir, "install_desktop_runtime.ps1")
wizardScript = fso.BuildPath(scriptDir, "install_desktop_wizard.ps1")
pwshExe = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\PowerShell\7\pwsh.exe"
If Not fso.FileExists(pwshExe) Then
  pwshExe = "powershell.exe"
End If

If Not fso.FileExists(launcherScript) Then
  MsgBox "未找到桌面启动脚本。" & vbCrLf & launcherScript, vbCritical, displayName
  WScript.Quit 1
End If

If Not fso.FileExists(installScript) Then
  MsgBox "未找到桌面运行环境安装脚本。" & vbCrLf & installScript, vbCritical, displayName
  WScript.Quit 1
End If

If Not fso.FileExists(launchScript) Then
  MsgBox "未找到桌面启动桥接脚本。" & vbCrLf & launchScript, vbCritical, displayName
  WScript.Quit 1
End If

cmd = """" & pwshExe & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & installScript & """"
exitCode = shell.Run(cmd, 0, True)
If exitCode <> 0 Or Not fso.FolderExists(depsRoot) Then
  If fso.FileExists(wizardScript) Then
    shell.Run """" & pwshExe & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & wizardScript & """", 0, False
  Else
    MsgBox "桌面运行环境尚未安装完成。" & vbCrLf & "请先运行安装程序。", vbExclamation, displayName
  End If
  WScript.Quit 1
End If

If Not fso.FileExists(pythonwExe) Then
  MsgBox "桌面运行时尚未准备完成。" & vbCrLf & "请重新运行安装程序后再试。" & vbCrLf & pythonwExe, vbCritical, displayName
  WScript.Quit 1
End If

cmd = """" & pwshExe & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & launchScript & """"
shell.Run cmd, 0, False
