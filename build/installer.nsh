!macro customUnInstall
  ; Kill wallet and daemon if running
  nsExec::ExecToLog 'taskkill /f /im gaeliumd.exe'
  nsExec::ExecToLog 'taskkill /f /im "Gaelium Wallet.exe"'
  Sleep 2000
  
  ; Remove AppData\Roaming\Gaelium (blockchain data, wallet)
  ExpandEnvStrings $0 "%APPDATA%\Gaelium"
  MessageBox MB_YESNO "Do you also want to remove blockchain data and wallet files?$\n$\n($0)" IDYES removeData IDNO skipData
  removeData:
    RMDir /r "$0"
  skipData:

  ; Also remove Electron app data
  ExpandEnvStrings $1 "%APPDATA%\gaelium-wallet"
  IfFileExists "$1\*.*" 0 +2
    RMDir /r "$1"
  
  ; Remove installation directory completely
  RMDir /r "$INSTDIR"
  
  ; Remove desktop shortcut
  Delete "$DESKTOP\Gaelium Wallet.lnk"
  
  ; Remove start menu shortcuts
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
