; Keep the Panorama install folder separate from standard Orion.
; The shortcut, window, and Apps list still use the name Orion.
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Orion Panorama"
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Orion Panorama"
!macroend
