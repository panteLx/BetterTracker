# Pathologie-Listen – Design

Datum: 2026-11-18 · Status: Entwurf, wartet auf Freigabe

## Hintergrund und Ziel

Die Pathologie schickt alle ca. 2 Wochen eine „Patientenliste" als PDF (Spalten: Proben-Nr, Patient inkl. Geburtsdatum, Eingang, Liq, Einsender, Material). Die Liste muss ergänzt zurückgeschickt werden:

- **Behandlungsart:** Stat. / Hybrid / AOP
- **Versichertennummer und Kasse** (Quelle: Krankenhausinformationssystem)
- Rot markierte Zeilen (Krebsregister) brauchen **unbedingt** Kasse und Vers-Nr.

Ziel: Liste hochladen, Eingaben in BetterTracker erfassen, Antwort-PDF exportieren, die Originaldaten und Eingaben enthält.

### Nicht-Ziele
- Keine Verbindung zu `caseFiles`, PVS-Einreichungen, Rechnungen oder OPS. Die Patienten sind andere und bleiben getrennt.
- Kein Import der bereits beantworteten Altlisten.
- Keine Anbindung an das KIS, kein Versand.

### Anti-Ziele
- Falsch eingelesene Namen/Nummern, die unbemerkt gespeichert werden. Es gibt deshalb immer eine Vorschau vor dem Speichern.
- Eine Krebsregister-Zeile, die ohne Kasse/Vers-Nr. rausgeht, ohne dass es auffällt.

## Beobachtungen an den Beispiel-PDFs

- Zwei Listen (16.10.–01.11. und 02.11.–17.11.2026) haben dieselben Quellspalten, aber die Rückmeldung wurde unterschiedlich notiert: in einer Liste eine kombinierte Spalte („Stat. Hybrid – AOK Rhld. – U359383274"), in der anderen zwei Spalten („Hybrid" | „A039662644 – DAK/BKK"). Reihenfolge Kasse/Nr. wechselt.
- Das Krebsregister-Kennzeichen kam einmal als **rote Zeilenfüllung** und einmal als **Textzusatz** („Karzinom Kasse + Vers-Nr. angeben") in einer Zusatzspalte rechts der Material-Spalte.
- Es gibt zweizeilige Zellen (Patient, Material), leere schmale Zusatzspalten und Freitext-Vermerke („Rektum CA", „Verstorben", Privatpatient „PR").

Das Quellformat ist also nicht stabil. Der Import muss tolerant sein, die Vorschau ist Pflicht.

## Ansätze

- **A – PDF-Upload mit automatischem Einlesen (gewählt):** kein Abtippen, Vorschau fängt Parserfehler ab. Nachteil: Parser hängt am Layout der Pathologie.
- B – Text einfügen: robuster, aber Rotmarkierung geht verloren und ein Schritt mehr.
- C – Komplett manuell: zu aufwendig bei ~30 Zeilen alle 2 Wochen.

## Design

### Platzierung
Neue Seite `/cases/[workspaceId]/pathology` im Cases-Modul, Nav-Eintrag „Pathologie". Berechtigungen: die vorhandene Workspace-Mitgliedschaft (read = ansehen/exportieren, write = importieren/bearbeiten). *(Meine Entscheidung: kein neuer Bereich außerhalb von Cases, damit Zugriff und Navigation nicht doppelt gepflegt werden.)* Daten sind komplett getrennt von allen bestehenden Cases-Tabellen.

### Datenmodell (neue Tabellen in `lib/db/schema.ts`)

`pathology_lists`: id, workspaceId, periodStart, periodEnd (Textdatum wie im Rest des Schemas), sourceFileName, isArchived, createdByUserId, timestamps.

`pathology_list_entries`: id, listId, position, `sampleNumber` (z. B. „H 2026 015956"), `patientName`, `dateOfBirth`, `receivedDate`, `liquid` (S/K/G), `sender`, `material`, `isCancerRegistry` (bool), `treatmentType` (stat | hybrid | aop, nullable), `insurer`, `insuranceNumber`, `note` (Freitext, z. B. „Rektum CA"), timestamps.

Eindeutigkeit: `(workspaceId, sampleNumber)`. Wird dieselbe Probe erneut hochgeladen (überlappende Zeiträume), wird sie in der Vorschau als „bereits vorhanden" markiert und übersprungen, nicht überschrieben.

### Import
1. Upload der PDF (nur PDF, Größenlimit wie bei anderen Uploads im Projekt).
2. Serverseitiges Einlesen: Text mit Positionen und Füllfarben. Spalten werden über die Kopfzeile („Proben-Nr", „Patient", …) erkannt, nicht über feste Koordinaten. Zweizeilige Zellen werden zusammengeführt; Geburtsdatum wird aus „*TT.MM.JJJJ" im Patientenfeld gelöst.
3. Krebsregister-Erkennung: rote/orange Zeilenfüllung **oder** Text „Kasse + Vers-Nr. angeben"/„Krebsregister" irgendwo in der Zeile (auch rechts der Material-Spalte).
4. Zeitraum wird aus dem Titel „Zeitraum TT.MM.JJJJ bis TT.MM.JJJJ" gelesen.
5. **Vorschau-Tabelle** (Anzahl Zeilen, markierte Krebsregister-Zeilen, Duplikate) zum Prüfen und Korrigieren, dann Speichern.
6. Schlägt das Einlesen fehl oder liefert 0 Zeilen, klare Fehlermeldung. Es wird nichts gespeichert.

Das benötigte PDF-Einleseverfahren (Bibliothek) steht noch nicht im Projekt und wird im Plan festgelegt (muss serverseitig ohne Netzwerkzugriff laufen und Füllfarben liefern können; Prüfung gegen die drei Beispiel-PDFs).

### Bearbeiten
Listenübersicht: Karten je Liste mit Zeitraum, Fortschritt („x von y ausgefüllt") und Anzahl offener Krebsregister-Zeilen. Detailseite: Tabelle mit Inline-Bearbeitung von Behandlungsart (Auswahl), Vers-Nr., Kasse (mit Vorschlägen aus bisher eingegebenen Kassen im Workspace, z. B. „AOK Rhld.", „Techniker", „DAK/BKK"), Bemerkung und Krebsregister-Checkbox (Fallback, falls die Erkennung danebenliegt). Krebsregister-Zeilen sind rot hervorgehoben und werden bei fehlenden Angaben deutlich markiert. Listen lassen sich archivieren (wie Cases/To-dos), nicht hart löschen.

### Export
PDF, A4 quer, Titel „Patientenliste: Zeitraum … bis …", Spalten wie das Original plus **zwei Antwortspalten**: Behandlungsart | „Vers-Nr. – Kasse" (+ Bemerkung angehängt). Krebsregister-Zeilen rot hinterlegt wie im Original. Technisch über das vorhandene `@react-pdf/renderer`-Gerüst (`lib/services/pdf/`). Sind Krebsregister-Zeilen unvollständig, erscheint vor dem Export eine Warnung mit Liste, der Export wird aber nicht blockiert. *(Meine Entscheidung: Warnung statt Sperre.)*

### Umsetzung nach Projektmuster
Service in `lib/services/pathology-service.ts`, Zod-Validatoren, Route-Handler mit Guards aus `case-workspace-guards.ts`, Antworten über `lib/http.ts`, Prefetch + `HydrationBoundary` auf den Seiten, neuer i18n-Namespace `Pathology` in `en-US` und `de-DE`, Migration via `db:generate`. Audit-Log bei Import, Archivieren und Export mit **Zählwerten, nicht mit Patientendaten**.

### Datenschutz
Namen, Geburtsdaten und Versichertennummern sind Gesundheitsdaten: nicht in Logs, nicht in Fehlermeldungen, nicht im Audit-Log. Die hochgeladene PDF wird nicht dauerhaft abgelegt, nur ihr Dateiname.

## Dem Bauenden überlassen
Wahl der PDF-Bibliothek, exakte Spaltenbreiten im Export, Detailtexte der UI, Tastaturnavigation in der Tabelle.

## Verifikation
Es gibt keine Tests im Repo. Prüfung per `npm run lint`, `npm run build` und Browser-Check: Import der beiden Beispiel-Quelllisten (Zeilenzahl 18 bzw. 30, die zwei roten Zeilen der neuen Liste erkannt; von der älteren Liste liegt nur die beantwortete Fassung vor, die Quellspalten sind aber identisch), Eingabe, Export-PDF optisch gegen deine Antwort-PDF.
