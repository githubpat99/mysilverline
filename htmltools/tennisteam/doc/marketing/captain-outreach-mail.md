# Captain-Outreach: E-Mail-Vorlage & Ablauf

SQL-Seed: [../sql/seed_captain_outreach_8_teams.sql](../sql/seed_captain_outreach_8_teams.sql) — acht Teams **Meine Mannschaft**, Spieler 1–4, Sommer-Saison 2026, sechs Mittwoch-Termine (Mai/Juni), Admin-Labels `captain-outreach-01` … `08`.

**Hinweis:** Enthaelt **Admin- und Spieler-Tokens**. Bei oeffentlichem Repo oder geteiltem Archiv Vorsicht; Tokens sind Zugangsschluessel.

## Vor dem Versand

1. Tabellenprefix im SQL an `config/database.php` anpassen.
2. Seed **einmal** auf der Produktions-DB ausführen.
3. Die beiden **SELECT**-Statements am Dateiende ausführen und `admin_url` pro Empfänger zuordnen (Spalte `label`: `captain-outreach-01` … `08`).

**Platzhalter:**

- `{{VORNAME}}` – Anrede.
- `{{ADMIN_URL}}` – persönlicher Admin-Link aus der Export-Query (Haupt-CTA: Empfänger sollen direkt hier einsteigen, nicht zuerst die Website durchklicken).

**Bilder (wie auf mysilverline):** dieselben Medien-URLs wie im Website-Snippet – in der HTML-Variante unten eingebunden. Optional kannst du die beiden Dateien stattdessen **anhängen** (Vorher/Nachher) und im Text darauf verweisen.

---

## Bildsprache (wie auf mysilverline)

Kernaussage „Vom Chaos zum klaren Plan“: Vorher (Chat-Chaos, Excel am Handy) vs. Nachher (eine klare Übersicht, wenige Klicks, Transparenz). Die beiden Bilder entsprechen der Website – **ohne** Link auf die Landing; Empfangende sollen **direkt den Admin-Link** öffnen.

---

## Betreff (Vorschläge)

- Vom Chaos zum klaren Plan – direkt ausprobieren?
- Trainingsplanung fürs Team: eine Übersicht statt Chat-Chaos
- Silverline Trainingsplaner – dein ehrliches Feedback?

---

## E-Mail: HTML-Block (empfohlen)

Bilder von derselben URL wie auf der Website (`wp-content/uploads/2026/04/…`). `{{ADMIN_URL}}` ist der einzige Link – kein Ausflug zur Landing.

### So verschicken, damit es gut aussieht (nicht als Rohtext)

**Gmail im Browser** interpretiert eingefügten **HTML-Quellcode** fast immer als normalen Text – deshalb siehst du `<p>`, `<table>` usw. sichtbar. Das ist kein Fehler in der Vorlage, sondern am Editor.

**Praktisch für Gmail (5–10 persönliche Mails):**

1. **Keinen** HTML-Block aus dieser Datei in Gmail reinkopieren.
2. Neue Mail im **Standard-Editor** schreiben.
3. Text aus dem Abschnitt **„E-Mailtext (Gmail / Plaintext)“** übernehmen (Platzhalter ersetzen).
4. **Bilder:** In der Werkzeugleiste „Bild einfügen“ / Foto-Symbol nutzen – **hochladen** (PNG von der Website speichern) oder, falls Gmail die Option bietet, **per URL** einbinden:
   - Vorher: `https://mysilverline.it-pin.ch/wp-content/uploads/2026/04/Tennis_Frust_ohneSL.png`
   - Nachher: `https://mysilverline.it-pin.ch/wp-content/uploads/2026/04/Tennis_Happy_SL.png`
5. Unter jedes Bild kurz **Vorher** bzw. **Nachher** und 1–2 Zeilen Bildunterschrift tippen (wie in der HTML-Vorlage).
6. Den Admin-Link **als Link formatieren** (Text markieren → Ketten-Symbol / Link einfügen) oder die volle `https://…`-URL schreiben.

**Wenn du wirklich HTML aus einer Datei brauchst:** z. B. **Outlook (Desktop)** oder **Thunderbird** mit HTML-Einfügen/Add-on, oder ein kleines Tool wie **Brevo** (kostenloser Tarif) / anderes E-Mail-Tool, das einen **HTML-Code**- oder **Quelltext**-Modus für den Nachrichtentext hat. Dann den Block unten ohne die äußeren Markdown-Codefences (` ```html `) einfügen und Platzhalter ersetzen.

```html
<p>Hallo {{VORNAME}},</p>

<p>bist du auch wieder mit Einsätzen und Trainingsplanung am Jonglieren. Mehrere WhatsApp-Chats, am Ende ist unklar, wer wirklich kommt – dazu Excel oder Screenshots auf dem Handy und Rückfragen, die nichts bringen.</p>

<p>Wir haben den Silverline Trainingsplaner gebaut, genau in dieser Logik: vom Chaos zum klaren Plan – Saison und Termine an einem Ort, persönliche Links fürs Team, Zu- und Absagen mit wenigen Klicks, mobil nutzbar, und Transparenz für alle, wer wie reagiert hat.</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:16px 0;">
  <tr>
    <td style="vertical-align:top;padding:0 8px 16px 0;">
      <img src="https://mysilverline.it-pin.ch/wp-content/uploads/2026/04/Tennis_Frust_ohneSL.png" width="100%" style="max-width:300px;height:auto;display:block;border-radius:8px;" alt="Vorher: Organisationschaos, viele Chats">
      <p style="margin:8px 0 0;font-size:13px;color:#555;font-weight:bold;">Vorher</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666;">Unklare Teilnahme in mehreren Chats, Excel oder Screenshots am Handy, Rückfragen ohne Erfolg.</p>
    </td>
    <td style="vertical-align:top;padding:0 0 16px 8px;">
      <img src="https://mysilverline.it-pin.ch/wp-content/uploads/2026/04/Tennis_Happy_SL.png" width="100%" style="max-width:300px;height:auto;display:block;border-radius:8px;" alt="Nachher: klare Übersicht im Team">
      <p style="margin:8px 0 0;font-size:13px;color:#555;font-weight:bold;">Nachher</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666;">Eine Liste: wer dabei ist, wer nicht, wer offen – Saison und Termine in der App, wenige Klicks pro Person.</p>
    </td>
  </tr>
</table>

<p>Meine Kolleginnen und Kollegen finden das Tool toll, sind aber voreingenommen. Deine ehrliche Sicht wäre mir sehr wertvoll.</p>

<p><strong>Direkt loslegen (Admin – nur für dich, bitte nicht weitergeben):</strong><br>
<a href="{{ADMIN_URL}}">{{ADMIN_URL}}</a></p>

<p>Ich habe dir schon „Meine Mannschaft“ mit Platzhalter-Spielern 1–4 und einer Sommersaison 2026 plus ein paar Terminen angelegt. Du kannst alles anpassen oder löschen.</p>

<p><strong>Kurz ehrlich:</strong> Für dein Team ist es bewusst simpel – Link öffnen, Status setzen, fertig. Als Organisator hast du etwas mehr Maske (Team, Saison, Spieler), aber den grossen Teil habe ich vorbereitet. Einmal <strong>10–15 Minuten</strong> reichen, um das auf euch zuzuschneiden; danach ist der Alltag für dich eher selten Admin, meist nur noch die Spieler-Ansicht.</p>

<p><strong>So würde ich es angehen:</strong></p>
<ol>
  <li>Admin-Link öffnen und <strong>einmal durchscrollen</strong> – dann siehst du, was schon da ist.</li>
  <li><strong>Teamname</strong> (und optional Standard-Ort) anpassen und speichern. <strong>Saison und Termine</strong> nur anfassen, wenn sie nicht zu eurer Realität passen – sonst lassen.</li>
  <li><strong>Spieler</strong> auf echte Namen setzen (Lizenz/Klassierung nur wenn du willst), dann die <strong>persönlichen Links</strong> ans Team schicken – ab dann läuft’s für die meisten Klicks im Spieler-Modus.</li>
</ol>

<p>Wenn du magst, schreib mir einfach zurück, was du davon hältst – auch drei Sätze reichen. Melde dich bitte auch, wenn ich dir weiterhelfen kann.</p>

<p>Liebe Grüsse<br>Patrick</p>
```

---

## E-Mailtext (Gmail / Plaintext) – kanonisch

Hier der Text, den du in Gmail & Co. reinkopierst. Die Zeilen `image.png` sind Platzhalter: **an dieser Stelle die beiden Vorher-/Nachher-Bilder einfügen** (oder Anhänge; Gmail zeigt manchmal `image.png` im Entwurf).

Hallo Roger,

bist du auch wieder mit Interclub-Einsätzen und Trainingsplanung am Jonglieren. Mehrere WhatsApp-Chats, am Ende ist unklar, wer wirklich kommt – dazu Excel oder Screenshots auf dem Handy und Rückfragen, die nichts bringen.

Wir haben den Silverline Trainingsplaner gebaut, genau in dieser Logik: vom Chaos zum klaren Plan – Saison und Termine an einem Ort, persönliche Links fürs Team, Zu- und Absagen mit wenigen Klicks, mobil nutzbar, und Transparenz für alle, wer wie reagiert hat.
 
 


Meine Kolleginnen und Kollegen finden das Tool toll, sind aber voreingenommen. Deine ehrliche Sicht wäre mir sehr wertvoll.

Direkt loslegen (Admin – nur für dich, bitte nicht weitergeben):
https://mysilverline.it-pin.ch/htmltools/tennisteam/admin.html?token=f9dc8a5063a3e70be3a84084957d310ffd10a029a716303eda54b24209ec3f78

Ich habe dir schon „Meine Mannschaft“ mit Platzhalter-Spielern 1–4 und einer Sommersaison 2026 plus ein paar Terminen angelegt. Du kannst alles anpassen oder löschen.

Kurz ehrlich: Für dein Team ist es bewusst simpel – Link öffnen, Status setzen, fertig. Als Organisator hast du etwas mehr Maske (Team, Saison, Spieler), aber den grossen Teil habe ich vorbereitet. Einmal 10–15 Minuten reichen, um das auf euch zuzuschneiden; danach ist der Alltag für dich eher selten Admin, meist nur noch die Spieler-Ansicht.

So würde ich es angehen:

1. Admin-Link öffnen und einmal durchscrollen – dann siehst du, was schon da ist.
2. Teamname (und optional Standard-Ort) anpassen und speichern. Saison und Termine anpassen - und generieren lassen. Keine Angst, du kannst alles wieder löschen und bei Bedarf auch einzeln anpassen.
3. Spieler auf echte Namen setzen (Lizenz/Klassierung nur wenn du willst), dann die persönlichen Links ans Team schicken – ab dann läuft’s für die meisten Klicks im Spieler-Modus.

Wenn du magst, schreib mir einfach zurück, was du davon hältst – auch drei Sätze reichen. Melde dich bitte auch, wenn ich dir weiterhelfen kann.

Liebe Grüsse  
Patrick

