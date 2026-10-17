# Neon Trinity Studio 0.4.0 · Supabase Edition

Dex, Nix und Jax nutzen dieselbe Mediathek über ihre eigenen Discord-Konten. Das eigene Supabase-Projekt „neon-trinity“ ist bereits angelegt und in der App eingestellt. Ein eigener Teamserver und eine Kommandozeilen-Einrichtung sind nicht erforderlich.

## Update von 0.3.0

Version 0.3.1 behebt den fälschlich abgelehnten Sitzungsschlüssel beim Discord-Login. Eure vorhandenen Freischaltungen, GitHub-Verbindung und lokalen Daten bleiben verwendbar. Wenn Discord im Projekt noch deaktiviert ist, zeigt das Studio nun einen Hinweis mit einem direkten Link zu den Anbieter-Einstellungen. Die gespeicherte Application ID für Rich Presence aktiviert den Login-Anbieter nicht automatisch. Nach dem Update erneut Mit Discord anmelden wählen. Ein noch nicht eingerichtetes GitHub Pages wird jetzt verständlich angezeigt. Leere, manuell angelegte Repositories werden beim Einrichten der Albumwebsite vorbereitet.

## 1. Vorhandene Daten sichern

Öffne vor dem Wechsel in der alten App Einstellungen → Vollständiges Backup. Schließe die alte App und starte die neue Windows-Version. Die lokale Mediathek wird übernommen, wenn du dasselbe Windows-Benutzerkonto verwendest. Beim ersten freigeschalteten Login werden lokale Songs, Cover, Alben, Setlists und Auftritte mit Supabase zusammengeführt. Alte GitHub-Dateiverweise werden dabei durch echte Datei-Uploads ersetzt. Bereits lokal vorhandene Dateien und vollständige Backups bleiben verwendbar.

## 2. Vorhandene Discord-Anwendung verbinden

Öffne https://discord.com/developers/applications und wähle deine bereits erstellte Neon-Trinity-Anwendung. Unter OAuth2 → Redirects trägst du genau diese Adresse ein und speicherst:

```
https://xyhkpwhfgjamssojjzbu.supabase.co/auth/v1/callback
```

Öffne anschließend https://supabase.com/dashboard/project/xyhkpwhfgjamssojjzbu/auth/providers und wähle Discord. Aktiviere den Anbieter. Kopiere Client ID und Client Secret deiner Discord-Anwendung in die entsprechenden Felder und speichere. Der Client Secret gehört ausschließlich in Supabase. Für die Anmeldung wird kein Discord-Bot benötigt.

## 3. Rückkehr zur Desktop-App erlauben

Öffne https://supabase.com/dashboard/project/xyhkpwhfgjamssojjzbu/auth/url-configuration und ergänze unter Redirect URLs diese Einträge:

```
http://127.0.0.1:48731/auth/callback**
https://neon-trinity-studio.sassycrane.chatgpt.site/index.html
```

Der erste Eintrag erlaubt die Rückkehr in die Windows-App. Er zeigt auf deinen eigenen PC. Die zwei Sterne am Ende gehören dazu, damit die einmalige Sicherheitskennung akzeptiert wird. Der zweite Eintrag wird für die Browser-Version verwendet. Speichere die Änderung. Als Site URL kannst du die Adresse der Browser-Version verwenden.

## 4. Die drei Bandkonten einmal freischalten

Discord → Benutzereinstellungen → Erweitert → Entwicklermodus aktivieren. Danach jeweils Rechtsklick auf Dex, Nix und Jax → Benutzer-ID kopieren. Benötigt werden persönliche Benutzer-IDs, keine Server-, Rollen- oder Anwendungs-ID.

Öffne https://supabase.com/dashboard/project/xyhkpwhfgjamssojjzbu/sql/new und ersetze im folgenden SQL alle vier Platzhalter. Führe den Block erst aus, wenn dort die richtigen Zahlen stehen. Die Application ID ist zugleich die Client ID deiner Discord-Anwendung.

```sql
begin;
insert into private.nt_allowed_discord (discord_id, alias)
values
  ('DEX_DISCORD_ID', 'Dex'),
  ('NIX_DISCORD_ID', 'Nix'),
  ('JAX_DISCORD_ID', 'Jax')
on conflict (discord_id) do update
set alias = excluded.alias, enabled = true;

update public.nt_config
set discord_client_id = 'DISCORD_APPLICATION_ID'
where id = 1;
commit;
```

Du kannst diese drei Benutzer-IDs auch im Chat nennen, damit die Zuordnung für dich eingetragen wird. Client Secret und Zugangstokens bleiben in den jeweiligen Einstellungen.

## 5. Alle drei melden sich an

Jeder lädt dasselbe neue Windows-Paket herunter, entpackt es vollständig und startet Neon Trinity Studio.exe. Unter Team & Discord klickt jeder auf Mit Discord anmelden. Nach der Anmeldung im Browser zum Studio zurückkehren. Ein noch nicht freigeschaltetes Konto zeigt dort seine Discord-ID und den Button Freischaltung erneut prüfen.

Lade zum Prüfen eine MP3 hoch. Die anderen sollten sie in ihrer Mediathek sehen und abspielen können. Songs, Cover, Alben, Playlists und Auftritte werden zentral gespeichert. Unterschiedliche Einträge werden zusammengeführt; Änderungen am selben Eintrag zeigen einen Konflikt. Persönlicher Hintergrund und Theme bleiben pro Gerät erhalten. Bei unterbrochener Echtzeitverbindung wird alle acht Sekunden abgeglichen.

## Öffentliche Albumseiten und Hörlinks

Die gemeinsame Mediathek funktioniert sofort nach der Discord-Einrichtung. Für externe Besucher benötigt ihr zusätzlich eine einmalig bereitgestellte öffentliche Player-Website. Die Browser-Studioadresse kann weiterhin auf ihren bisherigen privaten Benutzerkreis beschränkt sein.

Dex öffnet Einstellungen → Optional: GitHub & öffentliche Albumwebsite. Dort das gewünschte GitHub-Konto und Repository verbinden und Albumwebsite einrichten / aktualisieren wählen. Für die gemeinsame Website-Einstellung muss Dex zuvor mit Discord angemeldet sein. Das Feld Eigene Domain / öffentliche Website-Adresse bleibt ohne eigene Domain leer. Ein Link mit github.com führt zum Repository; die Website-Adresse lautet beispielsweise https://mikejaeson1-wq.github.io/neon-trinity. Falls noch kein Repository existiert, kann es dort angelegt werden. Auf GitHub liegen die Website-Dateien und auf Wunsch der Quellcode. Musik und Cover bleiben in Supabase. Nach dem erfolgreichen GitHub-Pages-Build werden Album- und Hörlinks für Gäste erreichbar.

Alternativ kann das Paket Neon-Trinity-Webseite.zip auf einem beliebigen statischen Webhosting entpackt werden. Die darin enthaltenen Dateien kommen direkt in das öffentliche Webverzeichnis. Anschließend trägt Dex die Basisadresse der Website unter Team & Discord ein. Eine vorhandene Wunschdomain lässt sich beim jeweiligen Webhost anbinden; eine Domainregistrierung ist nicht enthalten.

Im Album Veröffentlichen wählen und die öffentliche Freigabe bestätigen. Nur freigegebene Alben samt enthaltenen Songs und Covern werden für Gäste abrufbar. Alben können wieder zurückgezogen werden; bereits ausgestellte Dateilinks laufen nach höchstens fünf Minuten aus. Bereits heruntergeladene Kopien können nicht zurückgerufen werden.

Für eine Hörsession einen gemeinsamen Song starten, unter Team & Discord Hörsession starten wählen und den Link teilen. Gäste brauchen kein Bandkonto. Titelwechsel, Pause und Wiedergabeposition folgen dem Gastgeber. Browser können beim ersten Start einen Klick auf Mithören verlangen. Nach Beenden der Sitzung oder mehr als 90 Sekunden ohne Lebenszeichen des Gastgebers wird der Hörlink ungültig. Hörlinks sind eigene Studio-Funktionen.

## Discord-Aktivität und Miniplayer

Starte Discord als Desktop-Anwendung und erlaube die Aktivitätsanzeige in den Discord-Einstellungen. Die gemeinsame Application ID wird aus Supabase übernommen. Du kannst sie unter Team & Discord prüfen. Discord-Aktivität verbinden und dann einen Song starten. Mit Miniplayer öffnen wird ein separates, kleines Player-Fenster geöffnet. Diese Funktionen gehören zur Windows-App. Den echten Discord-Login und die Rich-Presence-Anzeige müssen wir mit deiner Discord-Anwendung praktisch testen.

## Speicher und Backups

Das Projekt verwendet aktuell den kostenlosen Supabase-Tarif. Für Dateien stehen derzeit 1 GB zur Verfügung; pro importierter MP3 erlaubt das Studio höchstens 48 MiB. Auch der monatliche Datenverkehr ist begrenzt. Bei längerer Inaktivität kann Supabase kostenlose Projekte pausieren. Erstelle regelmäßig vollständige Backups einschließlich der Musikdateien.

## Wenn die Anmeldung nicht klappt

Provider is not enabled: Discord in Supabase unter Authentication → Sign In / Providers aktivieren und Client ID sowie Client Secret speichern. Redirect-Fehler: die Discord-Callbackadresse aus Schritt 2 und die Supabase-Redirect-URLs aus Schritt 3 genau vergleichen. Konto nicht freigeschaltet: persönliche Benutzer-ID mit der Freigabetabelle abgleichen. Zweite Studio-Instanz geöffnet: diese schließen und den Login neu starten. Ein nicht erreichbarer Albumlink bedeutet meist, dass die öffentliche Player-Website noch nicht bereitgestellt oder der GitHub-Pages-Build noch nicht fertig ist.

## Installation für Nix und Jax

Öffnet https://mikejaeson1-wq.github.io/neon-trinity/install.html und klickt auf Studio für Windows installieren. Öffnet die heruntergeladene Setup-Datei. Das Studio wird automatisch für euer Windows-Konto installiert. Danach unter Team & Discord mit eurem eigenen freigeschalteten Discord-Konto anmelden. Eure gemeinsame Musik wird automatisch geladen. Node.js, GitHub-Token und Supabase-Einrichtung werden dafür nicht benötigt.

## Updates im Studio

Ab Version 0.4.0 sucht die installierte Windows-App beim Start und danach alle vier Stunden nach neuen Versionen. Unter Einstellungen → Studio & Updates könnt ihr jederzeit selbst prüfen. Update herunterladen lädt die neue Version im Studio; Neustarten & installieren schließt das Studio, installiert das Update und öffnet es wieder. Anmeldung, Musik und persönliche Einstellungen bleiben erhalten.

Die bisherige ZIP-Ausgabe kann sich noch nicht selbst aktualisieren. Installiert die Setup-Version einmal auf demselben Windows-Konto; eure vorhandenen App-Daten bleiben erhalten.

## Persönliche Playlists

Beim Erstellen einer Playlist wählt ihr unter Sichtbarkeit: Für die Band oder Nur für mich. Persönliche Playlists werden eurem angemeldeten Discord-Konto zugeordnet und sind für die anderen beiden nicht sichtbar. Sie werden auch auf euren anderen Geräten nach der Anmeldung geladen. Gemeinsame Auftritte verwenden nur Band-Setlists. Die Sichtbarkeit wird beim Erstellen festgelegt; vorhandene gemeinsame Playlists bleiben gemeinsam.
