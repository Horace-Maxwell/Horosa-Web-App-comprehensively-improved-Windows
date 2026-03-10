Option Explicit

Dim fso, shell, scriptDir, wizardScript, cmd, exitCode
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
wizardScript = fso.BuildPath(scriptDir, "install_desktop_wizard.ps1")

If Not fso.FileExists(wizardScript) Then
  MsgBox "Installer UI script not found." & vbCrLf & wizardScript, vbCritical, "Horosa Desktop"
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & wizardScript & """"
exitCode = shell.Run(cmd, 0, True)
WScript.Quit exitCode
