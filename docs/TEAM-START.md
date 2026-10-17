# Neon Trinity Studio 0.5.0 · Supabase Edition

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


## Private lokale Mediathek (ab 0.5.0)

Öffne **Privat & lokal**, melde dich mit deinem eigenen Discord-Konto an und wähle **Private MP3s importieren**. Dateien, Titel und Cover bleiben auf diesem Gerät. Hier abgelegte Musik wird nicht in Supabase gespeichert, nicht auf Albumseiten veröffentlicht und nicht als Discord-Aktivität angezeigt. Die gemeinsame Band-Mediathek bleibt ein eigener Bereich.

Für diese MP3s gibt es **lokale Playlists**, die nur dein Konto auf diesem Gerät sieht. Bandplaylists und persönliche Playlists mit geräteübergreifendem Abgleich können nur Band-Songs enthalten. Beim Abmelden oder Konto-Wechsel stoppt ein privater Song und die private Sammlung wird ausgeblendet. Dein vollständiges Backup enthält deine eigene lokale Sammlung; lokale Dateien anderer Konten werden ausgelassen. Für eine Wiederherstellung persönlicher MP3s melde dich mit dem zugehörigen Discord-Konto an.

## Automatisch gemeinsam hören

Band-Songs starten nach der Discord-Anmeldung automatisch eine Hörsession. Unter **Team & Discord** kannst du das ausschalten oder die Session beenden. Private lokale Songs beenden eine bestehende Hörsession und werden nie dafür freigegeben. Ein Hörlink gibt den laufenden Band-Song an jeden weiter, der diesen Link besitzt, auch ohne Bandkonto.

Mit laufendem Discord Desktop und aktivierter Aktivitätsfreigabe erscheint ein **Mithören**-Button in der Aktivität. Das ist ein eigener Link-Button. Die spezielle native Spotify-Integration wird nicht nachgebildet. Discord entscheidet über die Darstellung; eigene Aktivitätsbuttons sind unter Umständen nur bei anderen Nutzern sichtbar.

Nach dem Klick auf den Hörlink wählen Gäste:

- **Im Browser mithören:** ein Klick startet den Ton, ohne Installation und ohne Konto. Der Tab muss geöffnet bleiben und kann in den Hintergrund.
- **Im Studio mithören:** Windows öffnet das installierte Studio über `neontrinity://listen/...`, auch wenn es bereits läuft. Es wird minimiert und übernimmt die Wiedergabe. Der Browser kann das Öffnen der App einmal bestätigen lassen. Das Studio lässt sich über die Taskleiste wieder öffnen.

Titelwechsel, Pause, Fortsetzen und Spulen folgen dem Gastgeber. Kleine Zeitabweichungen werden sanft korrigiert. Bei größeren Abweichungen wird neu ausgerichtet. Netzwerk und Audioausgabe beeinflussen den verbleibenden Versatz; eine samplegenaue Mehrraum-Audioanlage ist dies nicht. Bei längerer Verbindungsunterbrechung pausiert der Gast. Ohne Gastgeber endet die Session nach spätestens 90 Sekunden.

## Themes, Hover und Visualizer

Unter **Einstellungen** stehen neun Studio-Themes und die Hover-Effekte Neon-Leuchten, Schweben, Kontur, Leicht kippen und Ohne Effekt bereit. Theme, Hintergrund und Effekte gelten nur für dieses Gerät.

Der **Visualizer** analysiert die tatsächlich abgespielte Musik, auch private lokale MP3s. Wähle Spektrum, Spiegel, Orbit oder Wellenform und eines von fünf Farbthemen. Mit den drei Farbwählern gestaltest du dein eigenes Theme; Empfindlichkeit und Leuchten lassen sich anpassen. Vollbild zeigt nur die Visualisierung. Er benötigt keine Mikrofonfreigabe.

## Spotify Premium verbinden

Spotify hat im Studio einen eigenen Bereich. Du kannst deine Spotify-Playlists anzeigen, die Titel eigener und kollaborativer Playlists öffnen und auf einem ausgewählten Spotify-Connect-Gerät abspielen. Wiedergabe, Pause, Titelwechsel, Position und Lautstärke steuerst du im Studio. Der Ton wird vom offiziellen Spotify-Player auf PC, Handy oder einem anderen verfügbaren Gerät ausgegeben. Öffne Spotify dort zunächst und starte einen Song, damit das Gerät gefunden wird.

### Einmalig durch Dex

1. Öffne https://developer.spotify.com/dashboard und lege eine App an. Wähle **Web API**. Der App-Inhaber braucht Spotify Premium; zur Connect-Wiedergabe verwenden alle Beteiligten Premium-Konten.
2. Website: https://mikejaeson1-wq.github.io/neon-trinity. Datennutzung: https://mikejaeson1-wq.github.io/neon-trinity/privacy.html.
3. Trage exakt diese Redirect URI ein: `http://127.0.0.1:48732/spotify/callback`. Verwende die IP-Adresse, nicht localhost.
4. Schalte die Spotify-Konten von Dex, Nix und Jax unter **User Management** frei. Development Mode erlaubt derzeit bis zu fünf Nutzer. Die Freigabe der Discord-Konten ist davon unabhängig.
5. Kopiere die **Client ID** in Studio → Spotify → Einmalige Spotify-App-Einrichtung. Lasse „Öffentliche App-ID für Nix und Jax hinterlegen“ aktiviert und speichere. Das **Client Secret wird nicht benötigt** und gehört weder ins Studio noch in den Chat.
6. Wähle **Mit Spotify verbinden**, melde dich im geöffneten Browser an und erlaube den Zugriff. Kehre anschließend zum Studio zurück.

Nix und Jax erhalten die App-ID beim Team-Abgleich automatisch. Sie melden sich im Spotify-Bereich jeweils mit ihrem eigenen Spotify-Konto an. Die Kontoverbindung bleibt je Studio-Konto verschlüsselt auf dem PC. Spotify-Zugriffsschlüssel werden weder in Supabase noch in Backups geschrieben.

Spotify begrenzt den Abruf von Titellisten auf eigene und kollaborative Playlists. Bei anderen Playlists kann die Anwendung nur die von Spotify verfügbaren Metadaten anzeigen; ein Link öffnet die Playlist im offiziellen Player. Lokale Spotify-Dateien und nicht verfügbare Titel werden in der Titelauswahl nicht als abspielbar angeboten.

Das Studio lädt keine Spotify-Audiodateien herunter. Der Audio-Visualizer und die eigene synchrone Discord-Hörsession arbeiten mit euren MP3s. Spotify-Musik läuft über Spotify Connect. Beim Start aus dem Spotify-Bereich pausiert der MP3-Player und eine eigene Hörsession endet, damit nicht beide Musikquellen gleichzeitig spielen.

**Verbindung entfernen** löscht die im Studio gespeicherte Spotify-Sitzung des aktuellen Kontos. Zusätzlich kannst du unter https://www.spotify.com/account/apps/ die App-Berechtigung in Spotify widerrufen. Die Spotify-Entwickler-App und ihre Client-ID müssen einmalig vom App-Inhaber eingerichtet werden; ohne diese ID lässt sich die Anmeldung nicht live abschließen.


## 14. Gemeinsamer Player, Miniplayer und Equalizer

Ab Version 0.6 zeigt der untere Player immer die gewählte Musikquelle. Bei Spotify stehen Titel, Interpret, Cover und Wiedergabefortschritt direkt dort. Play/Pause, voriger/nächster Titel, Position, Lautstärke, Zufall und Wiederholung steuern dein eigenes Spotify-Konto auf dem laufenden Spotify-Connect-Gerät. Die Steuerung bleibt beim Wechsel zu einem anderen Studio-Bereich verfügbar.

Unter Player & Equalizer wählst du fünf Player-Skins und drei Ansichten: Classic Rack, Cover Player oder Kompakt. Über das Miniplayer-Symbol unten rechts öffnest du ein kleines, frei verschiebbares Fenster über anderen Anwendungen. Das Studio hält die Wiedergabe im Hintergrund aufrecht. Über ◈ im Miniplayer lassen sich Skin und Ansicht direkt ändern; über ↗ kehrst du zum Studio zurück.

EQ öffnet den 10-Band-Equalizer. Schalte ihn ein, wähle Neutral, Rock, Bass, Stimmen, Electronic oder Nacht, oder stelle die zehn Frequenzbänder selbst ein. Vorverstärkung, Balance und automatische Pegelreserve helfen bei der Klangregelung. Die Einstellungen bleiben auf diesem Gerät. Der Equalizer bearbeitet Band-Songs und private lokale MP3s. Spotify Connect gibt den Ton in Spotify aus: Dafür verwendest du in Spotify unter Einstellungen → Wiedergabe den dortigen Equalizer.

## 15. Eigene öffentliche Profile

Öffne Profile im Studio. Als Dex, Nix oder Jax bearbeitest du nur dein eigenes Profil: Profilname, Beschreibung und eigenes PNG-, JPG- oder WebP-Bild bis 8 MiB. Das Bild wird mittig quadratisch zugeschnitten; prüfe die Vorschau und klicke Profil öffentlich speichern. Bilder kannst du dort ersetzen oder entfernen.

Die Profile sind ohne Installation unter https://mikejaeson1-wq.github.io/neon-trinity/profile.html erreichbar. Über das Teilen-Symbol kopierst du den persönlichen Link von Dex, Nix oder Jax. Besucher sehen das öffentliche Profil und die veröffentlichten Bandalben. Spotify-Playlists, Spotify-Höraktivität, persönliche Bandplaylists und private lokale Songs bleiben davon getrennt.

Zum Folgen und Liken melden sich Besucher auf der Profilwebsite mit Discord an. Es ist keine Freischaltung als Bandmitglied nötig; die interne Bandmediathek bleibt für Besucher gesperrt. Pro Discord-Konto gibt es je Profil einen Follow und einen Like. Erneutes Klicken nimmt die Reaktion zurück. Meine Likes und Abos entfernen löscht alle eigenen Reaktionen. Folgen speichert das Abo; es versendet keine Nachrichten oder Benachrichtigungen.

## 16. Besucher-Anmeldung einmalig freischalten

Dex ergänzt in https://supabase.com/dashboard/project/xyhkpwhfgjamssojjzbu/auth/url-configuration unter Redirect URLs genau diesen zusätzlichen Eintrag:

https://mikejaeson1-wq.github.io/neon-trinity/profile.html

Die bestehenden Einträge für die Windows-App und die Browser-Version bleiben erhalten. Die Discord-Redirect-Adresse ist weiterhin die bestehende Supabase-Callback-Adresse; in der Discord-App muss dafür keine neue Callback-Adresse angelegt werden.

Danach testen: Profilwebsite öffnen → Mit Discord anmelden → Rückkehr zur Profilwebsite → Folgen oder Gefällt mir. Ohne den zusätzlichen Supabase-Eintrag kann die Anmeldung stattdessen zur bisherigen Studio-Adresse zurückführen.
