# Tennisteam: Landing-Copy & Video-Storyboard

Kurztexte fuer eine Landingpage (z. B. WordPress-Block oder Silverline-Seite) plus 5 Bildschirm-Momente fuer ein Erklaervideo (Chaos → Klarheit).

---

## Positionierung (Kernbotschaft)

**Einzeiler (Headline):**  
Wer kommt – ohne Gruppenchat-Chaos.

**Unterzeile (Sub):**  
Eine klare Saison, alle Termine auf einen Blick, persoenlicher Link pro Person. Ideal fuer Trainingsgruppen und Teams mit festem Kader – nicht fuer komplettes Vereinsmanagement.

**Abgrenzung (klein, Footer oder FAQ):**  
Kein Clubdesk-Ersatz: Fokus auf Teilnahme und Terminuebersicht, nicht auf Verwaltung, Finanzen oder Gaeste-Umfragen wie bei Doodle.

---

## Landing: empfohlene Abschnitte

### 1. Hero

- **Headline:** Wer kommt – ohne Gruppenchat-Chaos.
- **Sub:** Saisonplanung, Rueckmeldungen und Teamuebersicht in einer schlanken App. Handy-first, ohne Passwort fuer Spielerinnen und Spieler.
- **CTA primaer:** Demo ansehen / Jetzt Team anlegen (je nach Angebot)
- **CTA sekundaer:** So funktioniert’s (Anker zur Kurzuebersicht)

### 2. Problem (Schmerz)

**Ueberschrift:** Kennst du das?  
**Bullets:**

- Drei WhatsApp-Threads, wer am Mittwoch wirklich kommt.
- Excel oder Tabellen, die auf dem Handy kaum lesbar sind.
- Kurz vor dem Training noch Ersatz suchen – ohne Ueberblick.

### 3. Loesung (Nutzen)

**Ueberschrift:** Ein Ueberblick fuer alle  
**Bullets:**

- **Saison statt Einzelchaos:** Zeitraum, Standard-Zeit und -Ort – viele Termine, logisch gebunden.
- **Persoenlicher Link:** Ein Tap, Status setzen (dabei, nein, Ersatz, bei Bedarf), optionaler Kommentar.
- **Transparenz:** Das Team sieht auf einen Blick, wer wie reagiert hat – ohne Nachfragen.
- **Admin leicht bedienbar:** Termine und Saisons pflegen, bei Bedarf fuer Spieler mit eintragen.

### 4. Fuer wen?

**Ueberschrift:** Passt besonders, wenn …  
**Bullets:**

- ihr eine **wiederkehrende Aktivitaet** plant (Training, Probe, Stammtisch-Sport, …).
- der **Kader ueblicherweise gleich** bleibt.
- ihr **keine** komplexe Gaeste-Umfrage „welcher von 12 Slots“ braucht – sondern klare **Termine mit Rueckmeldung**.

### 5. Nicht fuer … (Ehrlichkeit baut Vertrauen)

- komplette Vereinsverwaltung, Beitraege, Dokumente.
- einmalige Terminfindung unter wechselnden Teilnehmern (klassisches Doodle-Szenario).
- sehr grosse Organisationen mit vielen Rechten und Hierarchien.

### 6. So geht’s (3 Schritte)

1. **Team anlegen** – Admin-Link sichern.  
2. **Saison und Termine** – Standardwerte, bei Bedarf automatisch Termine erzeugen.  
3. **Spieler-Links teilen** – fertig; jede Person sieht dieselbe Wahrheit.

### 7. Vertrauen / Technik (kurz)

- Daten auf **eigener Datenbank** (MariaDB), **kein** Wildwuchs an Drittanbieter-Accounts fuer Spieler.
- **Mobile-first**, **PWA**-faehig (Link auf Homescreen moeglich).

### 8. CTA Schlussblock

**Ueberschrift:** Weniger Orga, mehr Spielspass.  
**Button:** [Passend zu eurem Angebot: Kontakt / Early Bird / Demo]

---

## Video-Storyboard: „Vom Chaos zum Spielspass“

Ziel-Laenge: **60–90 Sekunden**. Ton: freundlich, nicht werblich-uebertrieben.

| Beat | Inhalt (Voiceover-Idee) | Bild / Screen in der App |
|------|-------------------------|---------------------------|
| **1 – Chaos (5–10 s)** | Gruppenchat, viele blaue Haekchen, niemand weiss, wer kommt. | **Kein App-Screen:** Stock/Illu Smartphone mit Nachrichtenflut oder kurz Text-Overlay „Noch jemand da?“ |
| **2 – Versprechen (5 s)** | Eine Seite, eine Saison, alle Antworten an einem Ort. | **Hero der Landing** oder schlicht Logo + Headline „Wer kommt – ohne Chaos“ |
| **3 – Spieler: Terminwahl (15–20 s)** | Ich oeffne meinen Link, sehe die Saison, tippe den naechsten Termin an. | **`index.html`:** Liste der Termine (kompakte Zeilen mit Datum, Kurz-Zahlen). Tap auf einen Termin. |
| **4 – Spieler: Status (15–20 s)** | Zwei Taps: dabei oder nicht – speichern. Optional Kommentar. | **`index.html`:** Bereich mit Status-Buttons (Dabei, Abwesend, …), Speichern, kurz Erfolg. |
| **5 – Teamuebersicht (15–20 s)** | So sieht’s fuer alle aus: wer ist dabei, wer offen, wer Ersatz. | **`index.html`:** Karte „Alle Spieler“ mit Pill-Status (dicht), ggf. Scroll leicht. |
| **6 – Abschluss (10–15 s)** | Weniger Orga, mehr Spielspass – Demo ansehen oder loslegen. | **End-Card:** Logo, CTA, URL (optional letzter kurzer Blick auf **`index.html`** Teamübersicht – kein Admin-Screen im Video nötig). |

**Tipp:** Beat 3–5 am besten **am echten Demo-Team** mit 4–5 Namen, damit die Liste „lebendig“ wirkt. Für schnelle Clips reicht oft **Bilder + Text + CTA** ohne Screenrecording.

---

## SEO / Snippet (optional)

**Title:** Team-Termine & Rueckmeldungen ohne WhatsApp-Chaos  
**Description:** Saisonplanung, persoenliche Links, klare Teilnahme-Uebersicht – mobil nutzbar. Fuer Trainingsgruppen und Teams mit festem Kader.

---

*Dokument fuer interne Nutzung / WordPress-Snippets; Anpassung Preise und CTAs bei Bedarf.*
