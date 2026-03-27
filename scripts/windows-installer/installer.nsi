; ═══════════════════════════════════════════════════════════
; OpenAce Windows Installer — NSIS Script
; Creates a standard Windows installer with Start Menu entry,
; desktop shortcut, and uninstaller.
;
; Build: makensis installer.nsi (on Windows with NSIS installed)
; ═══════════════════════════════════════════════════════════

!include "MUI2.nsh"
!include "FileFunc.nsh"

; ── App Info ──
!define APP_NAME "OpenAce"
!define APP_VERSION "1.6.0"
!define APP_PUBLISHER "LikemindedPro"
!define APP_URL "https://github.com/LikemindedPro/OpenAce"
!define APP_EXE "Start OpenAce.bat"
!define INSTALL_DIR "$PROGRAMFILES\${APP_NAME}"

; ── Installer Config ──
Name "${APP_NAME} ${APP_VERSION}"
OutFile "..\OpenAce-${APP_VERSION}-windows-setup.exe"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin

; ── Modern UI ──
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"

; ── Pages ──
!insertmacro MUI_PAGE_WELCOME
; License page — include LICENSE if present in staging
  ; Copy LICENSE into staging during build, or comment this out
  ; !insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ═══════════════════════════════════════════════════════════
; Install Section
; ═══════════════════════════════════════════════════════════
Section "Install"
  SetOutPath "$INSTDIR"

  ; Copy launcher
  File "Start OpenAce.bat"
  File "icon.ico"

  ; Copy bundled Node.js
  SetOutPath "$INSTDIR\node"
  File /r "node\*.*"

  ; Copy OpenAce source
  SetOutPath "$INSTDIR\openace"
  File /r "openace\*.*"

  SetOutPath "$INSTDIR"

  ; Create data directory in AppData
  CreateDirectory "$APPDATA\OpenAce"

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry keys for Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\icon.ico"

  ; Get installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "EstimatedSize" "$0"

  ; Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Desktop shortcut
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\icon.ico"

SectionEnd

; ═══════════════════════════════════════════════════════════
; Uninstall Section
; ═══════════════════════════════════════════════════════════
Section "Uninstall"

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove Start Menu
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; Remove desktop shortcut
  Delete "$DESKTOP\${APP_NAME}.lnk"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  DeleteRegKey HKLM "Software\${APP_NAME}"

  ; Note: We do NOT remove %APPDATA%\OpenAce — user data should persist

SectionEnd
