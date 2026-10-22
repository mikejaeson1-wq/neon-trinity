# Neon Trinity Studio 1.1.1

Dieses Fehlerupdate behebt die scheinbar leere lokale Mediathek nach Version 1.1.0 und den wiederkehrenden Fehler „Illegal invocation“ beim Mithören.

- **Bisherige lokale Ablage:** Das Studio legt seinen Datenordner wieder vor dem ersten Speicherzugriff eindeutig auf „Neon Trinity Studio“ fest. Version 1.1.0 konnte durch die neue Miniplayer-Einstellung zu früh einen zweiten Profilordner öffnen. Dadurch waren die zuvor gespeicherten Songs, Playlists und Sitzungen dort nicht sichtbar.
- **Vorhandene Daten erhalten:** Es werden keine Mediatheken gelöscht, verschoben oder zwischen Konten vermischt. Ein zusätzlich angelegter Ordner aus 1.1.0 bleibt erhalten. Neu darin importierte Songs erscheinen deshalb nicht automatisch in der ursprünglichen Ablage.
- **Mithören:** Der Browser-Netzwerkaufruf ist korrekt gebunden; die wiederkehrende Meldung „Failed to execute fetch on Window: Illegal invocation“ wird behoben.
- **Upgrade-Prüfung:** Zusätzlich zu den bisherigen Prüfungen wird auf Windows die tatsächliche Installerfolge 1.0.1 → 1.1.0 → 1.1.1 mit gespeicherten Band-Songs, privaten Songs zweier Konten und einer lokalen Playlist durchlaufen. Audiodaten und die zusätzliche Ablage werden auf Erhalt geprüft.

Das Studio vollständig schließen und das neue Setup über die vorhandene Installation installieren. Eine Deinstallation oder ein erneuter Import ist für diese Korrektur nicht erforderlich. Ohne Zugriff auf den jeweiligen Computer lässt sich nicht vorab bestätigen, welche Dateien dort noch vorhanden sind.

Die Komfortfunktionen aus 1.1.0 bleiben enthalten: drei Repeat-Stufen, frei skalierbarer Miniplayer, gespeicherte Warteschlange, Such- und Mediatheksfunktionen, Sleep-Timer sowie die Handy-Verbesserungen. Die ausführliche Liste steht in docs/QOL-1.1.md. Das Datenformat bleibt unverändert; keine Supabase-Migration erforderlich.
