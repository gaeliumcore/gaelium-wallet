; --------------------------------------------------------------------------
; customInit — runs in .onInit, BEFORE the install section reads the registry
; to detect the old uninstaller. By deleting UninstallString here we prevent
; electron-builder from launching the v1.0.0 uninstaller (which would show a
; blockchain-data prompt). We delete both HKLM and HKCU to cover both modes:
; - HKLM: perMachine install (allusers, requires admin) — the v1.0.0 default
; - HKCU: perUser install (current user only)
; The installer still overwrites $INSTDIR and re-creates all registry entries,
; so nothing is lost. User data in %APPDATA%\Gaelium is never touched.
; --------------------------------------------------------------------------
!macro customInit
  ; Kill wallet and daemon so files are unlocked for overwrite
  nsExec::ExecToLog 'taskkill /f /im gaeliumd.exe'
  nsExec::ExecToLog 'taskkill /f /im "Gaelium Wallet.exe"'
  Sleep 2000

  ; Remove UninstallString from BOTH registry roots so uninstallOldVersion() exits early
  ; HKLM (perMachine install, v1.0.0 default)
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "QuietUninstallString"
  ; HKCU (perUser install)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "QuietUninstallString"
!macroend

!macro customUnInstall
  ; Kill wallet and daemon if running
  nsExec::ExecToLog 'taskkill /f /im gaeliumd.exe'
  nsExec::ExecToLog 'taskkill /f /im "Gaelium Wallet.exe"'
  Sleep 2000

  ; Only prompt and clean AppData during genuine uninstall, NEVER during upgrade
  ; ${isUpdated} checks if --updated flag was passed in command line
  ; /SD IDNO is a safety net: in silent mode (/S), auto-answer No (preserve data)
  ${ifNot} ${isUpdated}
    ExpandEnvStrings $0 "%APPDATA%\Gaelium"
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to remove blockchain data and wallet files?$\n$\n($0)" /SD IDNO IDYES removeData IDNO skipData
    removeData:
      RMDir /r "$0"
    skipData:

    ExpandEnvStrings $1 "%APPDATA%\gaelium-wallet"
    IfFileExists "$1\*.*" 0 +2
      RMDir /r "$1"

    ExpandEnvStrings $2 "%LOCALAPPDATA%\gaelium-wallet-updater"
    IfFileExists "$2\*.*" 0 +2
      RMDir /r "$2"
  ${endIf}

  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\Gaelium Wallet.lnk"
  RMDir /r "$SMPROGRAMS\Gaelium Wallet"
!macroend

!macro customInstall
  ; Fix shortcut to point to correct exe
  CreateShortCut "$SMPROGRAMS\Gaelium Wallet\Gaelium Wallet.lnk" "$INSTDIR\Gaelium Wallet.exe" "" "$INSTDIR\Gaelium Wallet.exe" 0
  CreateShortCut "$DESKTOP\Gaelium Wallet.lnk" "$INSTDIR\Gaelium Wallet.exe" "" "$INSTDIR\Gaelium Wallet.exe" 0

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayIcon" "$INSTDIR\Gaelium Wallet.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "Publisher" "Gaelium Core"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "URLInfoAbout" "https://gaelium.io"
!macroend
