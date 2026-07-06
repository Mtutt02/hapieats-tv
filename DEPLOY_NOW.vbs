Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd.exe /k ""cd /d C:\Projects\hapieats-tv && deploy.bat""", 1, False
