# Neon Trinity Studio 0.8.1

Behebt „Failed to execute 'fetch' on 'Window': Illegal invocation“ beim Erstellen
und Prüfen von Musikbox-Links. Der Upload verwendet die Browserfunktion jetzt mit
dem korrekten Aufrufkontext. Bereits reservierte Links können erneut angefordert
werden; eine erneute Einrichtung oder Anmeldung ist dafür nicht nötig.

Dieselbe Korrektur gilt für die Spotify-Anbindung der Handy-App.

## Seit Version 0.8.0

Songs und Alben erhalten per Rechtsklick → Musikbox-Link kopieren eine direkte
MP3-URL für die Conan-Musikbox. Songs werden beim ersten Teilen bereitgestellt;
Alben werden einmalig zu einer durchgehenden MP3 in Albumreihenfolge encodiert.
Weitere Aufrufe verwenden denselben Link für dieselbe Audiofassung.

Die Links funktionieren ohne Anmeldung, laufen nicht automatisch ab und lassen
sich über Rechtsklick → Geteilte MP3-Links entfernen wieder entfernen. Private
lokale Musik und Spotify bleiben ausgeschlossen. Ein GitHub-Token ist nicht nötig.

Discord erhält ausdrücklich eine Hört-Aktivität für laufende Musik. Bei Pause
oder Leerlauf wird die Studio-Aktivität entfernt. Die Verbindungsprüfung zeigt,
welchen Aktivitätstyp das Studio sendet und welchen Discord tatsächlich bestätigt.
Eine separat eingerichtete automatische Spielerkennung verwaltet Discord selbst.

Update: Einstellungen → Studio & Updates → Prüfen, herunterladen und installieren.
