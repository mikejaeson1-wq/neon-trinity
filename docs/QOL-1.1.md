# Neon Trinity Studio 1.1 · Komfortupdate

Dieses Update setzt die 25 Punkte der QoL-Roadmap um und ergänzt einen frei skalierbaren Miniplayer.

1. **Repeat:** Aus → ganze Playlist → einzelner Song → Aus. Repeat 1 zeigt eine kleine 1 bzw. REP1. Desktop, Miniplayer und Handy verwenden denselben Ablauf. Manuelles Weiter springt auch bei Repeat 1 zum nächsten Titel.
2. **Weiterhören:** Das Studio merkt je Konto Warteschlange und Position. Beim nächsten Öffnen bietet „Weiterhören“ die gespeicherte Wiedergabe an. Musik startet erst nach einem Klick.
3. **Vorheriger Titel:** Nach mehr als drei Sekunden beginnt der aktuelle Song von vorn. Erneut drücken führt zum vorherigen Song.
4. **Zehn Sekunden springen:** Im Hauptplayer und Miniplayer über −10 und +10; im Studio standardmäßig mit den Pfeiltasten links/rechts. Auch auf dem Handy verfügbar.
5. **Lautstärke:** Feinere Schritte mit dem Mausrad am Regler, Stummschalten und Wiederherstellung der vorherigen Lautstärke je Quelle.
6. **Shuffle:** Alle verfügbaren Titel einmal durchlaufen. Zurück folgt dem tatsächlichen Hörverlauf. Bei Repeat aus stoppt die automatische Wiedergabe nach dem Durchlauf.
7. **Mehrfachauswahl:** Unter Studio-Werkzeuge → Warteschlange mehrere eigene MP3s gemeinsam verschieben oder entfernen. Der laufende Titel bleibt beim Entfernen erhalten.
8. **Warteschlangensuche:** Filter nach Titel und Interpret, auch direkt in der Playlist des Miniplayers.
9. **Aufräumen:** Bereits gespielte Einträge entfernen oder nur den laufenden Titel behalten.
10. **Direkt rückgängig:** Änderungen aus dem Verlauf sowie Änderungen der Warteschlange direkt über die Meldung zurücknehmen. Der vorhandene Schutz gegen zwischenzeitliche Änderungen bleibt aktiv.
11. **Globale Suche:** Band-Songs, eigene lokale Songs, Alben und sichtbare Playlists. Spotify berücksichtigt die bereits geladenen Inhalte des eigenen Kontos. Filter trennen die Quellen.
12. **Ansichten merken:** Scrollposition, Suchbegriff und Sortierung je Bereich und Konto. Formulare behalten beim erneuten Zeichnen ihre Texteingaben und den Fokus; Dateien und Kennwörter werden nicht als Formularentwurf gespeichert.
13. **Schnellzugriff:** Aktuelle Ansicht anheften. Angeheftete Bereiche und Alben links persönlich sortieren oder entfernen.
14. **Schnellbearbeitung:** Titel und Interpret in der Mediathek doppelt anklicken. Für mehrere ausgewählte Songs Interpret, Stimmen und Genre/Notiz gemeinsam ändern.
15. **Duplikatvergleich:** Identische Dateien bzw. gleiche Titel, Interpreten und Dauer vergleichen. Anhören und gezielt bearbeiten oder entfernen; keine automatische Löschung.
16. **Import:** Anzahl, aktuelle Datei, verbleibende Dateien und Abbrechen. Bereits vollständig gespeicherte Songs bleiben bei einem Abbruch erhalten. Fehler benennen die betroffene Datei.
17. **Dateien wieder zuordnen:** In Privat & lokal einen Ordner wählen. Identische MP3s werden anhand ihrer SHA-256-Prüfsumme wieder zugeordnet; Playlists und Songdaten bleiben bestehen. Normalerweise ist das nicht nötig, da das Studio eine eigene Kopie speichert.
18. **Verbindungen:** Erneute Prüfung bei Netzwerkfehlern und Rückkehr ins Internet. Der vorhandene automatische Supabase-Abgleich bleibt aktiv, ohne eine Warteschlange neu zu starten.
19. **Sleep-Timer:** Unter Player & Equalizer bzw. Einstellungen 15/30/60/90 Minuten oder das aktuelle Songende wählen. Eigene MP3s können in den letzten zehn Sekunden ausgeblendet werden. Spotify wird pausiert. Der Timer läuft bei geöffnetem Studio.
20. **Freigabestatus:** Am Hauptplayer Quelle, erlaubte Discord-Titelanzeige und erlaubtes Mithören erkennen. Diese Schalter bleiben voneinander unabhängig.
21. **Miniplayer-Fenster:** An Rändern und Ecken frei skalieren; alternativ unter ◈ Breite und Höhe eingeben. Größe, Position und „Immer im Vordergrund“ werden gespeichert. Bei einem entfernten Monitor wird das Fenster auf einem vorhandenen Bildschirm sichtbar geöffnet. Die Playlist wächst mit dem Fenster; Player-Updates überschreiben die gewählte Größe nicht. Classic bleibt auswählbar.
22. **Tastenkürzel:** Unter Player & Equalizer eigene Belegungen aufnehmen, ausschalten oder zurücksetzen. Doppelte und reservierte Belegungen werden gemeldet. Die Kürzel gelten im aktiven Studio und haben beim Schreiben keine Wirkung.
23. **Handybedienung:** Größere Player-Tasten, gut erreichbare Zeitsprünge und größere Suchleisten. Eine Positionsänderung wird erst beim Loslassen übernommen.
24. **Offline-Verwaltung:** Downloadfortschritt mit Abbrechen, Speicheranzeige, Kennzeichnung gespeicherter Band-Songs und gemeinsames Entfernen ausgewählter Downloads. Konten bleiben getrennt.
25. **Neuerungen:** Nach dem Update ein Hinweis im Studio und eine Übersicht mit Links zu den neuen Einstellungen.

## Aktualisieren

Im Studio Einstellungen → Studio & Updates → Nach Updates suchen → Update herunterladen → Neustarten & installieren.

Für die Handy-App die Seite bei bestehender Internetverbindung neu öffnen; die Offline-Dateien bleiben erhalten. Bereits geöffnete alte Tabs gegebenenfalls schließen und die App erneut öffnen.

Die bestehende Kontentrennung und die Supabase-Datenstruktur bleiben kompatibel. Private lokale Songs werden durch die neuen Such-, Import- oder Bearbeitungsfunktionen nicht in öffentliche oder gemeinsame Playlists übernommen.
