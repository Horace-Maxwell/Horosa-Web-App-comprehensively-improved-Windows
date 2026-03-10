Option Explicit

Dim fso, shell, scriptDir, repoRoot, pythonwExe, launcherScript, depsRoot, installScript, wizardScript, cmd, exitCode
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(scriptDir)
pythonwExe = fso.BuildPath(repoRoot, "local\workspace\runtime\windows\python\pythonw.exe")
launcherScript = fso.BuildPath(scriptDir, "src\horosa_desktop.pyw")
depsRoot = shell.ExpandEnvironmentStrings("%LocalAppData%") & "\HorosaDesktop\runtime-pydeps"
installScript = fso.BuildPath(scriptDir, "install_desktop_runtime.ps1")
wizardScript = fso.BuildPath(scriptDir, "install_desktop_wizard.ps1")

If Not fso.FileExists(pythonwExe) Then
  MsgBox "Bundled pythonw.exe not found." & vbCrLf & pythonwExe, vbCritical, "Horosa Desktop"
  WScript.Quit 1
End If

If Not fso.FileExists(launcherScript) Then
  MsgBox "Desktop launcher script not found." & vbCrLf & launcherScript, vbCritical, "Horosa Desktop"
  WScript.Quit 1
End If

If Not fso.FileExists(installScript) Then
  MsgBox "Desktop runtime install script not found." & vbCrLf & installScript, vbCritical, "Horosa Desktop"
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & installScript & """"
exitCode = shell.Run(cmd, 0, True)
If exitCode <> 0 Or Not fso.FolderExists(depsRoot) Then
  If fso.FileExists(wizardScript) Then
    shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & wizardScript & """", 0, False
  Else
    MsgBox "Desktop runtime is not installed yet." & vbCrLf & "Please run Install_Horosa_Desktop.vbs first.", vbExclamation, "Horosa Desktop"
  End If
  WScript.Quit 1
End If

cmd = "cmd.exe /c set PYTHONPATH=" & depsRoot & "&& """ & pythonwExe & """ """ & launcherScript & """"
shell.Run cmd, 0, False
