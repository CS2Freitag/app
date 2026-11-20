import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'standard-backup');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'defaultBackup.generated.json');

function extractFilenameDateMs(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return 0;
  const ts = Date.parse(match[1]);
  return Number.isFinite(ts) ? ts : 0;
}

function parseTimestamp(exportedAt, filename, mtimeMs) {
  if (typeof exportedAt === 'string') {
    const ts = Date.parse(exportedAt);
    if (Number.isFinite(ts)) return ts;
  } else if (typeof exportedAt === 'number' && Number.isFinite(exportedAt)) {
    return exportedAt;
  }
  const fileDate = extractFilenameDateMs(filename);
  if (fileDate > 0) return fileDate;
  return mtimeMs || 0;
}

function publicAssetExists(relPath) {
  if (!relPath || typeof relPath !== 'string') return false;
  if (relPath.startsWith('data:') || relPath.startsWith('http://') || relPath.startsWith('https://')) {
    return true;
  }
  const cleanRel = relPath.replace(/^\/+/, '');
  return fs.existsSync(path.join(PUBLIC_DIR, cleanRel));
}

async function resolveBackupFromZip(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const jsonCandidates = [];
  const primary = zip.file('backup.json');
  if (primary) jsonCandidates.push(primary);

  for (const entry of Object.values(zip.files)) {
    if (!entry.dir && entry.name.toLowerCase().endsWith('.json') && entry.name !== 'backup.json') {
      jsonCandidates.push(entry);
    }
  }

  let parsed = null;
  for (const entry of jsonCandidates) {
    try {
      const text = await entry.async('text');
      const data = JSON.parse(text);
      if (data && Array.isArray(data.maps)) {
        parsed = data;
        break;
      }
    } catch {
      // try next json file
    }
  }

  if (!parsed || !Array.isArray(parsed.maps)) {
    throw new Error(`Keine gültige backup.json mit maps-Array im ZIP gefunden: ${path.basename(filePath)}`);
  }

  // Restore radar images from ZIP if a map's image/lowerImage is missing locally & not a data URI
  const resolvedMaps = await Promise.all(
    parsed.maps.map(async (m) => {
      const next = { ...m };
      if (!publicAssetExists(next.image)) {
        const upperEntry =
          zip.file(`radar_images/${m.id}_upper.png`) ||
          zip.file(`radar_images/${m.id}_upper.jpg`) ||
          zip.file(`radar_images/${m.id}.png`);
        if (upperEntry) {
          const b64 = await upperEntry.async('base64');
          const ext = upperEntry.name.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
          next.image = `data:image/${ext};base64,${b64}`;
        }
      }
      if (next.lowerImage && !publicAssetExists(next.lowerImage)) {
        const lowerEntry =
          zip.file(`radar_images/${m.id}_lower.png`) ||
          zip.file(`radar_images/${m.id}_lower.jpg`);
        if (lowerEntry) {
          const b64 = await lowerEntry.async('base64');
          const ext = lowerEntry.name.toLowerCase().endsWith('.jpg') ? 'jpeg' : 'png';
          next.lowerImage = `data:image/${ext};base64,${b64}`;
        }
      }
      return next;
    })
  );

  return {
    ...parsed,
    maps: resolvedMaps,
  };
}

function resolveBackupFromJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.maps)) {
    throw new Error(`Ungültige Backup-JSON (kein maps-Array): ${path.basename(filePath)}`);
  }
  return parsed;
}

export async function syncDefaultBackup({ quiet = false } = {}) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true });
  const candidateFiles = entries
    .filter((e) => e.isFile() && /\.(json|zip)$/i.test(e.name) && !e.name.startsWith('.'))
    .map((e) => path.join(BACKUP_DIR, e.name));

  if (candidateFiles.length === 0) {
    if (fs.existsSync(OUTPUT_FILE)) {
      if (!quiet) console.log('[sync-default-backup] Keine neuen Dateien in standard-backup/; behalte vorhandenen Stand.');
      return { updated: false, source: null };
    }
    throw new Error('Kein Standard-Backup (.json oder .zip) im Ordner standard-backup/ gefunden.');
  }

  const loaded = [];
  for (const filePath of candidateFiles) {
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    try {
      const data = filename.toLowerCase().endsWith('.zip')
        ? await resolveBackupFromZip(filePath)
        : resolveBackupFromJson(filePath);

      const priorityTs = parseTimestamp(data.exportedAt, filename, stat.mtimeMs);
      loaded.push({
        filePath,
        filename,
        priorityTs,
        mtimeMs: stat.mtimeMs,
        data,
      });
    } catch (err) {
      console.warn(`[sync-default-backup] Überspringe ungültige Datei "${filename}": ${err.message}`);
    }
  }

  if (loaded.length === 0) {
    throw new Error('Keine gültige Backup-Datei (.json oder .zip) in standard-backup/ gefunden.');
  }

  loaded.sort((a, b) => {
    if (b.priorityTs !== a.priorityTs) return b.priorityTs - a.priorityTs;
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return b.filename.localeCompare(a.filename);
  });

  const winner = loaded[0];
  const normalized = {
    type: winner.data.type || 'cs2freitag_full_backup',
    version: winner.data.version || 1,
    exportedAt: winner.data.exportedAt || new Date(winner.priorityTs || Date.now()).toISOString(),
    app: winner.data.app || 'CS2Freitag',
    sourceFile: winner.filename,
    settings: {
      theme: winner.data.settings?.theme || 'dark',
      lang: winner.data.settings?.lang || 'de',
      favorites: Array.isArray(winner.data.settings?.favorites)
        ? winner.data.settings.favorites
        : ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis', 'cobblestone'],
    },
    maps: winner.data.maps,
  };

  const outContent = JSON.stringify(normalized, null, 2);
  const existingContent = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, 'utf-8') : null;

  if (existingContent !== outContent) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, outContent, 'utf-8');
    if (!quiet) {
      console.log(
        `[sync-default-backup] Standard-Karten aktualisiert aus "${winner.filename}" (${normalized.maps.length} Karten, Stand: ${normalized.exportedAt}).`
      );
    }
    return { updated: true, source: winner.filename, mapCount: normalized.maps.length };
  }

  if (!quiet) {
    console.log(
      `[sync-default-backup] Standard-Karten bereits aktuell ("${winner.filename}", ${normalized.maps.length} Karten).`
    );
  }
  return { updated: false, source: winner.filename, mapCount: normalized.maps.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncDefaultBackup().catch((err) => {
    console.error('[sync-default-backup] Fehler:', err);
    process.exit(1);
  });
}
