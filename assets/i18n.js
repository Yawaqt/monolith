// German / English strings. Faction and disposition names stay as in the game.
const S = {
  // public site
  p_home: ['Start', 'Home'], p_team: ['Team', 'Team'], p_results: ['Ergebnisse', 'Results'], p_events: ['Termine', 'Events'], p_apps: ['Apps', 'Apps'],
  portal: ['Teambereich', 'Team area'], my_account: ['Mein Konto', 'My account'],
  hero_kicker: ['Warhammer 40.000 · Wien', 'Warhammer 40,000 · Vienna'],
  hero_text: ['Kompetitives Warhammer-40k-Team aus Wien. Hier findest du unser Team, unsere Turnierergebnisse und wo wir als Nächstes spielen.', 'A competitive Warhammer 40k team from Vienna. Meet the team, see our tournament results and where we play next.'],
  see_results: ['Ergebnisse ansehen', 'See results'], see_events: ['Nächste Termine', 'Upcoming events'],
  s_players: ['Spieler', 'Players'], s_games: ['Turnierspiele', 'Tournament games'], s_record: ['Bilanz (S-U-N)', 'Record (W-D-L)'], s_tournaments: ['Turniere', 'Tournaments'],
  latest_tournament: ['Letztes Turnier', 'Latest tournament'], all_results: ['Alle Ergebnisse', 'All results'], whole_team: ['Ganzes Team', 'Whole team'],
  meet_team: ['Das Team', 'The team'], next_up: ['Als Nächstes', 'Coming up'], all_events: ['Alle Termine', 'All events'],
  results_intro: ['Alle Turnierspiele unserer Spieler, neueste zuerst. Teamscore nach Punkte-Differenz (0–5 = 10-10, je 5 Punkte eine Stufe).', 'Every tournament game by our players, newest first. Team score from the point difference (0–5 = 10-10, one step per 5 points).'],
  team_intro: ['Unsere Spieler und die Armeen, die sie spielen.', 'Our players and the armies they play.'],
  events_pub_intro: ['Hier spielen wir als Nächstes. Komm vorbei und sag Hallo.', 'Where we play next. Come by and say hi.'],
  no_events: ['Gerade keine Termine geplant.', 'No events planned right now.'], t_games: ['{n} Turnierspiele', '{n} tournament games'],
  apps_pub_intro: ['Werkzeuge für die 40k-Community. Mit einem kostenlosen Konto wird alles gespeichert.', 'Tools for the 40k community. With a free account everything is saved.'],
  footer_text: ['Kompetitives Warhammer-40k-Team aus Wien.', 'Competitive Warhammer 40k team from Vienna.'],
  footer_note: ['Warhammer 40.000 ist eine Marke von Games Workshop. Diese Seite ist ein Fanprojekt und nicht mit Games Workshop verbunden.', 'Warhammer 40,000 is a trademark of Games Workshop. This is a fan site, not affiliated with Games Workshop.'],
  filter_player: ['Spieler filtern', 'Filter by player'],
  follow_title: ['Folgt uns auf Instagram', 'Follow us on Instagram'], follow_text: ['Turnierberichte, bemalte Armeen und was im Team so passiert.', 'Tournament reports, painted armies and what the team is up to.'],
  follow_btn: ['@monolith40k öffnen', 'Open @monolith40k'],
  bcp_profile: ['BCP-Profil', 'BCP profile'], bcp_hint: ['Link zu deinem Profil auf bestcoastpairings.com (in der BCP-App: Profil → Teilen → Link kopieren).', 'Link to your profile on bestcoastpairings.com (in the BCP app: Profile → Share → Copy link).'],
  bcp_invalid: ['Bitte einen Link von bestcoastpairings.com einfügen.', 'Please paste a link from bestcoastpairings.com.'],
  tour_import: ['Ganzes Turnier eintragen', 'Log a whole tournament'], tour_import_intro: ['Alle Runden eines Turniers auf einmal eintragen – z. B. direkt aus deinen Ergebnissen in der BCP-App abgeschrieben.', 'Enter every round of a tournament at once – e.g. straight from your results in the BCP app.'],
  round: ['Runde', 'Round'], add_round: ['+ Runde', '+ Round'], remove_round: ['Runde entfernen', 'Remove round'], save_rounds: ['{n} Spiele speichern', 'Save {n} games'],
  rounds_missing: ['Bitte bei jeder Runde Gegner-Fraktion und beide Punktzahlen eintragen (leere Runden löschen).', 'Please fill in opponent faction and both scores for every round (remove empty rounds).'],
  rounds_saved: ['{n} Spiele gespeichert', '{n} games saved'],
  nav_home: ['Übersicht', 'Home'], nav_team: ['Team', 'Team'], nav_analysis: ['Analyse', 'Analysis'], nav_apps: ['Apps', 'Apps'], nav_admin: ['Verwaltung', 'Admin'],
  nav_roster: ['Anmeldung', 'Roster'], nav_matches: ['Match Log', 'Match log'], nav_archive: ['Spiele-Archiv', 'Game archive'], nav_events: ['Events', 'Events'],
  nav_calendar: ['Kalender', 'Calendar'], nav_lineup: ['Aufstellung', 'Line-up'], nav_cash: ['Kasse', 'Cash'], nav_matrix: ['Live Matrix', 'Live matrix'],
  nav_stats: ['Statistik', 'Statistics'], nav_master: ['Master Matrix', 'Master matrix'], nav_masterteam: ['Master Team', 'Master team'], nav_pairing: ['Pairing', 'Pairing'],
  nav_members: ['Mitglieder', 'Members'], nav_profile: ['Profil', 'Profile'], nav_collection: ['Collection Tracker', 'Collection tracker'],
  menu: ['Menü', 'Menu'], close: ['Schließen', 'Close'],
  // auth
  sign_in: ['Anmelden', 'Sign in'], sign_up: ['Konto erstellen', 'Create account'], sign_out: ['Abmelden', 'Sign out'],
  email: ['E-Mail', 'Email'], password: ['Passwort', 'Password'], display_name: ['Anzeigename', 'Display name'],
  forgot: ['Passwort vergessen?', 'Forgot password?'], reset_sent: ['Wir haben dir einen Link zum Zurücksetzen geschickt.', 'We sent you a reset link.'],
  have_account: ['Schon ein Konto? Anmelden', 'Have an account? Sign in'], no_account: ['Noch kein Konto? Registrieren', 'No account yet? Sign up'],
  google: ['Mit Google anmelden', 'Continue with Google'], check_mail: ['Fast fertig: Bitte bestätige deine E-Mail über den Link, den wir dir geschickt haben.', 'Almost done: please confirm your email via the link we sent you.'],
  login_title: ['Willkommen beim Team', 'Welcome to the team'], login_sub: ['Melde dich an, um Spiele, Events und Auswertungen zu sehen.', 'Sign in to see games, events and analysis.'],
  new_password: ['Neues Passwort', 'New password'], save_password: ['Passwort speichern', 'Save password'],
  // roles
  role: ['Rolle', 'Role'], r_guest: ['Gast', 'Guest'], r_team: ['Team', 'Team'], r_captain: ['Captain', 'Captain'], r_admin: ['Admin', 'Admin'],
  pending: ['Dein Konto wartet auf Freischaltung durch einen Admin. Bis dahin kannst du die Apps nutzen.', 'Your account is waiting for an admin to approve it. Until then you can use the apps.'],
  no_access: ['Für diesen Bereich hast du keine Berechtigung.', 'You don’t have access to this area.'],
  not_linked: ['Dein Konto ist noch keinem Spieler zugeordnet. Ein Admin kann das unter „Mitglieder“ erledigen.', 'Your account isn’t linked to a player yet. An admin can do that under “Members”.'],
  // common
  save: ['Speichern', 'Save'], cancel: ['Abbrechen', 'Cancel'], delete: ['Löschen', 'Delete'], edit: ['Bearbeiten', 'Edit'], add: ['Hinzufügen', 'Add'], new: ['Neu', 'New'],
  confirm_delete: ['Wirklich löschen?', 'Delete this?'], yes: ['Ja', 'Yes'], maybe: ['Vielleicht', 'Maybe'], no: ['Nein', 'No'], all: ['Alle', 'All'],
  loading: ['Lade …', 'Loading …'], saved: ['Gespeichert', 'Saved'], error: ['Fehler', 'Error'], none: ['Noch keine Einträge.', 'Nothing here yet.'],
  player: ['Spieler', 'Player'], players: ['Spieler', 'Players'], army: ['Armee', 'Army'], armies: ['Armeen', 'Armies'], faction: ['Fraktion', 'Faction'],
  disposition: ['Disposition', 'Disposition'], date: ['Datum', 'Date'], time: ['Uhrzeit', 'Time'], type: ['Typ', 'Type'], notes: ['Notizen', 'Notes'], note: ['Notiz', 'Note'],
  from: ['Von', 'From'], to: ['Bis', 'To'], since: ['Ab Datum', 'Since'], sort: ['Sortierung', 'Sort'], search: ['Suchen', 'Search'], total: ['Gesamt', 'Total'],
  games: ['Spiele', 'Games'], wins: ['Siege', 'Wins'], draws: ['Unent.', 'Draws'], losses: ['Niederl.', 'Losses'], winrate: ['Siegquote', 'Win rate'],
  avg_gp: ['Ø Our GP', 'Avg our GP'], avg_diff: ['Ø Punkte-Diff.', 'Avg point diff'], practice: ['Practice', 'Practice'], tournament: ['Tournament', 'Tournament'],
  win: ['Sieg', 'Win'], draw: ['Unentschieden', 'Draw'], loss: ['Niederlage', 'Loss'], external: ['Externer Gegner', 'External opponent'],
  demo: ['Demo-Modus', 'Demo mode'], demo_as: ['Ansicht als', 'Viewing as'], demo_reset: ['Demo zurücksetzen', 'Reset demo'],
  demo_note: ['Demo: Daten bleiben nur in diesem Browser. Trage deine Supabase-Daten in assets/config.js ein, um echte Konten zu nutzen.', 'Demo: data stays in this browser only. Add your Supabase details in assets/config.js for real accounts.'],
  // home
  hello: ['Hallo', 'Hi'], next_events: ['Nächste Events', 'Next events'], recent: ['Letzte Ergebnisse', 'Recent results'], my_form: ['Meine Bilanz', 'My record'],
  team_form: ['Team-Bilanz', 'Team record'], open_games: ['Spiel eintragen', 'Log a game'], your_answer: ['Deine Antwort', 'Your answer'],
  // roster
  roster_intro: ['Wer spielt welche Armeen und Wunsch-Dispositionen. Unten die Abdeckung im Team.', 'Who plays which armies and preferred dispositions. Team coverage below.'],
  wish1: ['Wunsch-Disposition 1', 'Preferred disposition 1'], wish2: ['Wunsch-Disposition 2', 'Preferred disposition 2'], same_disp: ['Dieselbe Disposition doppelt gewählt', 'Same disposition chosen twice'],
  coverage: ['Abdeckung im Team', 'Team coverage'], add_player: ['Spieler hinzufügen', 'Add player'], active: ['Aktiv', 'Active'], position: ['Position', 'Position'],
  covered_by: ['gespielt von', 'played by'], not_covered: ['Nicht abgedeckt', 'Not covered'],
  // matches
  log_intro: ['Neues Spiel direkt nach dem Spiel eintragen. Interne Übungsspiele nur einmal eintragen: Teamkollegen als Gegner wählen, das Spiel zählt automatisch für beide.', 'Log each game right after playing. Internal practice games only once: pick the teammate as opponent and it counts for both.'],
  tour_name: ['Turniername', 'Tournament name'], our_player: ['Unser Spieler', 'Our player'], our_army: ['Unsere Armee', 'Our army'], our_disp: ['Unsere Disposition', 'Our disposition'],
  opp_faction: ['Gegner-Fraktion', 'Opponent faction'], opp_disp: ['Gegner-Disposition', 'Opponent disposition'], opp_player: ['Gegner', 'Opponent player'], opp_name: ['Name des Gegners', 'Opponent name'],
  our_score: ['Unsere Punkte', 'Our score'], opp_score: ['Gegner-Punkte', 'Opp score'], team_score: ['Teamscore', 'Team score'], result: ['Ergebnis', 'Result'], diff: ['Differenz', 'Difference'],
  internal: ['Intern', 'Internal'], save_game: ['Spiel speichern', 'Save game'], latest: ['Zuletzt eingetragen', 'Latest entries'], vs: ['vs', 'vs'],
  score_rule: ['Teamscore: 0–5 Differenz = 10-10 · 6–10 = 11-9 · je 5 Punkte eine Stufe · über 50 = 20-0', 'Team score: 0–5 difference = 10-10 · 6–10 = 11-9 · one step per 5 points · over 50 = 20-0'],
  newest: ['Neueste zuerst', 'Newest first'], oldest: ['Älteste zuerst', 'Oldest first'], best: ['Bestes Ergebnis', 'Best result'], worst: ['Schlechtestes Ergebnis', 'Worst result'],
  n_games: ['{n} Spiele', '{n} games'], edit_game: ['Spiel bearbeiten', 'Edit game'],
  // events
  events_intro: ['Termine und Zusagen. Jeder antwortet für sich mit Ja, Vielleicht oder Nein.', 'Dates and replies. Everyone answers for themselves: yes, maybe or no.'],
  new_event: ['Neues Event', 'New event'], event: ['Event', 'Event'], location: ['Ort', 'Location'], kind: ['Art', 'Kind'], team_size: ['Teamgröße', 'Team size'],
  upcoming: ['Kommende', 'Upcoming'], past: ['Vergangene', 'Past'], going: ['Dabei', 'Going'], no_answer: ['Keine Antwort', 'No answer'],
  tap_to_set: ['Als Captain: Namen antippen, um die Antwort zu ändern.', 'As captain: tap a name to change their answer.'],
  // calendar
  today: ['Heute', 'Today'], prev: ['Zurück', 'Previous'], next: ['Weiter', 'Next'],
  // lineup
  lineup_intro: ['Wer ist bei einem Event dabei, welche Armeen deckt das ab und ist das Team komplett?', 'Who is in for an event, which armies that covers, and is the team complete?'],
  choose_event: ['Event wählen', 'Choose event'], confirmed: ['Zugesagt (Ja)', 'Confirmed (yes)'], complete: ['Team komplett', 'Team complete'], missing: ['Es fehlen noch {n}', '{n} still missing'],
  army_coverage: ['Abgedeckte Armeen', 'Armies covered'],
  // cash
  cash_intro: ['Startgelder und offene Beträge. Offene Posten rot, bezahlte grün.', 'Entry fees and open amounts. Open in red, paid in green.'],
  cash_own: ['Deine Startgelder', 'Your entry fees'], amount: ['Betrag', 'Amount'], paid: ['Bezahlt', 'Paid'], paid_on: ['Bezahlt am', 'Paid on'], open: ['Offen', 'Open'],
  per_player: ['Übersicht pro Spieler', 'Per player'], new_payment: ['Neue Zahlung', 'New payment'], sum: ['Summe', 'Sum'],
  // matrix
  matrix_intro: ['Ø Teamergebnis eurer Armeen gegen jede Fraktion aus dem Match Log, gerundet. 15-5 und 5-15 ergibt 10-10. „–“ = noch kein Spiel.', 'Average team result of your armies against each faction from the match log, rounded. 15-5 and 5-15 make 10-10. “–” = no game yet.'],
  our_armies: ['Unsere Armeen (Zeilen)', 'Our armies (rows)'], add_army: ['Armee hinzufügen', 'Add army'], ahead: ['wir vorne', 'we lead'], behind: ['wir hinten', 'we trail'], even: ['ausgeglichen', 'even'],
  // stats
  stats_intro: ['Alles automatisch aus dem Match Log. Interne Spiele zählen für beide Spieler. Siegquote: Unentschieden = ½ Sieg.', 'All from the match log. Internal games count for both players. Win rate: draw = ½ win.'],
  most_played: ['Meistgespielte Armee', 'Most played army'], games_with: ['Spiele damit', 'Games with it'], as_ours: ['Spiele (als unsere Armee)', 'Games (as our army)'],
  vs_faction: ['Spiele gegen diese Fraktion', 'Games vs this faction'], our_gp_vs: ['Unser Ø GP gegen sie', 'Our avg GP vs them'], pvp: ['Player vs Player (interne Spiele)', 'Player vs player (internal games)'],
  // master matrix
  master_intro: ['Eigene Einschätzung 1–5 pro Spieler gegen jede Fraktion, unabhängig vom Match Log. Jeder pflegt seine eigene Spalte.', 'Your own 1–5 rating per player against each faction, independent of the match log. Everyone maintains their own column.'],
  avg_score: ['Ø Wert', 'Average'], legend: ['Legende (Punkte-Differenz → Wert)', 'Legend (point difference → rating)'],
  // master team
  mteam_intro: ['Einschätzung gegen ein konkretes Gegnerteam: Fraktionen eintragen, die Werte kommen aus der Master Matrix.', 'Rating against a specific opponent team: enter their factions, values come from the master matrix.'],
  opp_team: ['Gegnerteam', 'Opponent team'], new_team: ['Neues Gegnerteam', 'New opponent team'], avg_player: ['Ø pro Spieler', 'Avg per player'], choose_team: ['Gegnerteam wählen', 'Choose opponent team'],
  // pairing
  pairing_intro: ['Gegner-Armeen und eure 5 Spieler mit Armee eintragen. Die Matrix zeigt das Ø Our GP (0–20, 10 = ausgeglichen) aus dem Match Log.', 'Enter the opponent armies and your 5 players with their army. The matrix shows avg our GP (0–20, 10 = even) from the match log.'],
  basis: ['Datenbasis', 'Data basis'], basis_team: ['Team (alle Spieler mit dieser Armee)', 'Team (all players with this army)'], basis_player: ['Nur dieser Spieler', 'This player only'],
  best_matchup: ['Bestes Matchup', 'Best matchup'], best_counter: ['Bester Konter je Gegner', 'Best counter per opponent'], defender: ['Defender', 'Defender'], avg_total: ['Ø gesamt', 'Avg total'],
  game_counts: ['Anzahl Spiele je Paarung', 'Games per pairing'], few_games: ['Weniger als 3 Spiele: Wert noch unsicher.', 'Fewer than 3 games: value still uncertain.'],
  saved_pairings: ['Gespeicherte Pairings', 'Saved pairings'], title: ['Titel', 'Title'], opp_armies: ['Gegner-Armeen', 'Opponent armies'], our_lineup: ['Unsere Spieler', 'Our players'],
  only_captain_save: ['Nur Captains können Pairings speichern; rechnen kann jeder.', 'Only captains can save pairings; anyone can calculate.'],
  // members
  members_intro: ['Neue Konten sind Gäste. Gib Teammitgliedern die Rolle Team und ordne sie ihrem Spieler zu.', 'New accounts are guests. Give team members the Team role and link them to their player.'],
  linked_player: ['Spieler-Zuordnung', 'Linked player'], joined: ['Seit', 'Joined'], waiting: ['Warten auf Freischaltung', 'Waiting for approval'], none_linked: ['— keiner —', '— none —'],
  // profile
  language: ['Sprache', 'Language'], account: ['Konto', 'Account'],
  // apps
  apps_intro: ['Werkzeuge für alle mit Konto. Weitere Apps folgen.', 'Tools for everyone with an account. More apps coming.'],
  collection_desc: ['Deine Modellsammlung nach Fraktionen, mit automatisch aktuellen Punkten aus dem Munitorum Field Manual.', 'Your model collection by faction, with points kept current from the Munitorum Field Manual.'],
  more_apps: ['Weitere Apps', 'More apps'], more_apps_desc: ['Hier kommen später weitere Tools dazu.', 'More tools will appear here later.'], open_app: ['Öffnen', 'Open'],
};
let lang = 'de';
export function setLang(l) { lang = l === 'en' ? 'en' : 'de'; document.documentElement.lang = lang; }
export function getLang() { return lang; }
export function t(key, vars) {
  const v = S[key]; let s = v ? v[lang === 'en' ? 1 : 0] : key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
