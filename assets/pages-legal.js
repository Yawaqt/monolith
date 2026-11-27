// Imprint (Offenlegung § 25 MedienG) and privacy policy (DSGVO). German is the binding version.
import { t, getLang } from './i18n.js?v=202611271005';
import { state, esc } from './core.js?v=202611271005';

const legal = () => (state.pub && state.pub.site && state.pub.site.legal) || {};
const fill = (v, what) => v ? esc(v) : `<span class="todo">[${esc(what)}]</span>`;

export function privacy(el) {
  const L = legal();
  const owner = fill(L.owner, 'Name / Verein – in Verwaltung → Team-Seite eintragen');
  const place = fill(L.place, 'Ort bzw. Anschrift');
  const mail = L.email ? `<a href="mailto:${esc(L.email)}">${esc(L.email)}</a>` : fill('', 'E-Mail-Adresse');
  el.innerHTML = `<article class="post legal">
  ${getLang() === 'en' ? `<p class="notice">${esc(t('legal_en_note'))}</p>` : ''}
  <h1>Impressum &amp; Datenschutz</h1>
  <p class="mute">Stand: November 2026</p>

  <h2>Offenlegung gemäß § 25 Mediengesetz</h2>
  <p><b>Medieninhaber und verantwortlich für den Inhalt:</b> ${owner}<br>
  <b>Sitz / Ort:</b> ${place}<br>
  <b>Kontakt:</b> ${mail}</p>
  <p><b>Gegenstand der Website:</b> Informationen über das Warhammer-40.000-Team „Monolith 40k“ (Spieler, Ergebnisse, Termine, News) und Hilfsmittel für Mitglieder. Die Website ist ein nicht-kommerzielles Hobbyprojekt.</p>
  <p>Warhammer 40.000 ist eine Marke von Games Workshop Limited. Diese Website ist ein Fanprojekt und steht in keiner Verbindung zu Games Workshop.</p>

  <h2>Datenschutzerklärung</h2>
  <p>Der Schutz deiner Daten ist uns wichtig. Wir verarbeiten personenbezogene Daten nur im Rahmen der Datenschutz-Grundverordnung (DSGVO) und des österreichischen Datenschutzgesetzes (DSG). Hier erfährst du, welche Daten wir wofür verarbeiten.</p>

  <h3>1. Verantwortlicher</h3>
  <p>${owner}, ${place}, ${mail}</p>

  <h3>2. Besuch der Website (Hosting)</h3>
  <p>Die Website wird über <b>GitHub Pages</b> (GitHub, Inc., USA, ein Unternehmen von Microsoft) bereitgestellt. Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Seite und Browser-Informationen, um die Seite auszuliefern und vor Missbrauch zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Eine Übermittlung in die USA stützt GitHub auf das EU-US Data Privacy Framework bzw. auf Standardvertragsklauseln der EU-Kommission.</p>
  <p>Schriften und Programmbibliotheken werden direkt von dieser Website geladen; es besteht <b>keine Verbindung zu Google Fonts</b> oder anderen fremden Schrift- oder Werbediensten.</p>

  <h3>3. Konto und Anmeldung</h3>
  <p>Für Konten und die Datenbank nutzen wir <b>Supabase</b> (Supabase, Inc., USA). Die Daten werden auf Servern in der EU (Irland) gespeichert. Bei der Registrierung verarbeiten wir E-Mail-Adresse, Anzeigename, Passwort (nur verschlüsselt als Hash gespeichert), Rolle, Sprache und Zeitpunkt der Registrierung. Rechtsgrundlage ist die Bereitstellung des Kontos auf deinen Wunsch (Art. 6 Abs. 1 lit. b DSGVO).</p>
  <p>Wenn du dich <b>mit Google anmeldest</b>, erhalten wir von Google deine E-Mail-Adresse und deinen Namen; Google erfährt, dass du dich bei uns anmeldest. Dafür gelten zusätzlich die Datenschutzbestimmungen von Google. Die Anmeldung mit E-Mail und Passwort ist ohne Google möglich.</p>

  <h3>4. Daten im Teambereich (Mitglieder)</h3>
  <p>Für freigeschaltete Mitglieder speichern wir Daten, die für den Teambetrieb nötig sind: Spielergebnisse und Armeen, Zu- und Absagen zu Terminen, Turnier- und Pairing-Planung mit Notizen sowie interne Kassa-Einträge. Diese Daten sehen nur angemeldete Mitglieder; einzelne Bereiche nur Captains oder Admins. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO (Organisation des Teams).</p>
  <p><b>Öffentlich sichtbar</b> sind nur: Spielername, freiwilliges Foto und Steckbrief (Lieblingsarmee, „Über mich“), die Armeen, mit denen jemand auf Turnieren gespielt hat, sowie Team-Bilanzen pro Turnier <b>ohne</b> Namen einzelner Spieler.</p>

  <h3>5. Fotos, Steckbrief und Gruppenfotos</h3>
  <p>Profilfoto, Lieblingsarmee und „Über mich“ sind freiwillig und werden auf Grundlage deiner Einwilligung veröffentlicht (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit im Profil ändern oder löschen; damit widerrufst du die Einwilligung für die Zukunft. Gruppenfotos veröffentlichen wir nur mit Einverständnis der abgebildeten Personen – wenn du auf einem Foto nicht zu sehen sein möchtest, melde dich bei uns, wir entfernen es.</p>

  <h3>6. Match History und Daten-Statistik</h3>
  <p>In der Match History kann jedes Konto eigene Spiele eintragen. Diese Einträge sieht nur die eintragende Person. Für den Bereich „Daten“ werden diese Einträge zusammen mit den Spielen aus dem Team-Match-Log <b>anonym zusammengefasst</b> (z. B. Siegquoten pro Fraktion); dort erscheinen weder Namen noch einzelne Spiele, und der Bereich ist nur mit Konto sichtbar. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der Funktion) und lit. f (anonyme Auswertung).</p>

  <h3>6a. Kalender-Abo</h3>
  <p>Mitglieder können die Team-Termine in ihren eigenen Kalender (z. B. Google, Apple, Outlook) übernehmen. Dafür erhält jedes Konto einen persönlichen, geheimen Link. Ruft der Kalenderdienst diesen Link ab, erhält er Termine und die eigene Zusage; der Anbieter des Kalenders verarbeitet diese Daten dann nach seinen eigenen Datenschutzbestimmungen. Der Link kann im Teambereich jederzeit erneuert werden, der alte funktioniert dann nicht mehr. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
  <h3>7. Collection Tracker</h3>
  <p>Deine Modellsammlung wird in deinem Konto gespeichert und ist nur für dich sichtbar. Um aktuelle Punktewerte zu laden, ruft der Tracker eine öffentliche Datendatei über das Open-Source-Netzwerk <b>jsDelivr</b> ab; dabei wird deine IP-Adresse technisch an jsDelivr übermittelt (Art. 6 Abs. 1 lit. f DSGVO).</p>

  <h3>7a. Farbrezepte</h3>
  <p>Deine Farbrezepte (Text und Fotos) werden in deinem Konto gespeichert und sind zunächst nur für dich sichtbar. Wenn du ein Rezept ausdrücklich „für alle teilst“, ist es öffentlich auf der Website zu sehen, zusammen mit deinem Anzeigenamen (Art. 6 Abs. 1 lit. a DSGVO). Du kannst das Teilen jederzeit beenden oder das Rezept löschen. Score-Tracker, MathHammer und Pairing-Trainer speichern ihre Eingaben nur im Speicher deines Browsers.</p>

  <h3>8. Lokale Speicherung, keine Tracking-Cookies</h3>
  <p>Wir verwenden <b>keine Analyse-, Werbe- oder Tracking-Cookies</b>. Im Speicher deines Browsers (Local Storage) legen wir nur ab, was für die Funktion nötig ist: deine Anmeldung, die gewählte Sprache und Einstellungen wie zuletzt gewählte Armee oder Filter. Das ist nach § 165 Abs. 3 TKG 2021 ohne Einwilligung zulässig, weil es für den von dir gewünschten Dienst unbedingt erforderlich ist.</p>

  <h3>9. Links zu anderen Seiten</h3>
  <p>Links zu Instagram oder (im Teambereich) Best Coast Pairings werden erst aktiv, wenn du sie anklickst. Ab dann gelten die Datenschutzbestimmungen dieser Anbieter.</p>

  <h3>10. Speicherdauer</h3>
  <p>Kontodaten speichern wir, bis du dein Konto löschst. Match History und Sammlung werden mit dem Konto gelöscht. Spielergebnisse, die als Teil der Team-Geschichte im Match Log stehen, bleiben auf Grundlage unseres berechtigten Interesses an einer vollständigen Team-Statistik erhalten; auf Wunsch anonymisieren oder löschen wir sie.</p>

  <h3>11. Deine Rechte</h3>
  <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, eine Einwilligung jederzeit zu widerrufen. Vieles kannst du selbst erledigen: Im <b>Profil</b> kannst du deine Daten herunterladen und dein Konto löschen. Für alles andere schreib uns an ${mail}.</p>
  <p>Wenn du meinst, dass wir deine Daten nicht rechtmäßig verarbeiten, kannst du dich bei der <b>Österreichischen Datenschutzbehörde</b> beschweren: Barichgasse 40–42, 1030 Wien, <a href="mailto:dsb@dsb.gv.at">dsb@dsb.gv.at</a>, <a href="https://www.dsb.gv.at" target="_blank" rel="noopener">www.dsb.gv.at</a>.</p>
  </article>`;
  document.title = 'Impressum & Datenschutz';
}
