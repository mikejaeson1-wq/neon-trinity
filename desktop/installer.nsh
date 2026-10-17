!macro customInstall
  WriteRegStr HKCU "Software\Classes\neontrinity" "" "URL:Neon Trinity Mithoeren"
  WriteRegStr HKCU "Software\Classes\neontrinity" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\neontrinity\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\neontrinity\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Classes\neontrinity\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    DeleteRegKey HKCU "Software\Classes\neontrinity"
  ${EndIf}
!macroend
