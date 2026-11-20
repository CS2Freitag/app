# Standard-Karten Backup-Ordner (`standard-backup`)

In diesem Ordner liegt der **Standard-Kartenbestand** (Karten, Callouts, Bereiche/Zonen, Farben, Favoriten & Einstellungen) für **CS2Freitag**.

## So aktualisierst du die Standard-Karten automatisch über GitHub:

1. Exportiere in der App unter **Einstellungen → Gesamtes Backup (JSON / ZIP)** entweder:
   - **JSON exportieren** (`CS2Freitag_Backup_JSON_YYYY-MM-DD.json`) oder
   - **ZIP exportieren** (`CS2Freitag_Backup_ZIP_YYYY-MM-DD.zip`).
2. Lade diese `.json`- oder `.zip`-Datei direkt hier in diesen Ordner (`standard-backup/`) auf GitHub hoch (du kannst die alte Datei ersetzen oder einfach die neue Datei dazulegen).
3. Sobald der Upload auf `main` (bzw. `master`) gespeichert ist, startet GitHub Actions automatisch den Build (`npm run build`), erkennt automatisch das **neueste** Backup nach `exportedAt`-Zeitstempel (bzw. Dateinamen-Datum), entpackt bei Bedarf das ZIP-Archiv und übernimmt alle Karten, Callouts, Bereiche und Einstellungen als neuen Standard!
