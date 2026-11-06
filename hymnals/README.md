# Orion hymnals

## Storage (fast + simple)

Each hymnal is a **folder** with three files:

| File | Purpose |
|------|---------|
| `meta.json` | Name, language, id |
| `index.json` | **Lightweight list** (number + title only) — loaded for search/browse |
| `hymns.json` | Full text — loaded once per hymnal into memory |

- **Built-in** hymnals ship under `hymnals/` in the repo (default: **Afrikaans** and **English**, converted from Adventist Bibsoft data).
- **Imported** hymnals are copied to `%AppData%/orion/hymnals/` (Electron user data).

The UI loads `index.json` first (~tens of KB even for large books). Full lyrics stay in `hymns.json` until you open a hymn (today we load the whole file per hymnal when selected — fine up to a few thousand hymns; split per-hymn files later if needed).

## Stanza markup (authoring + projection)

Use one stanza per slide:

| Marker | Meaning |
|--------|---------|
| `[V1]` … `[V9]` | Verse (short tags) |
| `[Verse 1]` | Verse (long tags — toggle in UI) |
| `{Refrain}` or `{R}` | Refrain |
| `{Chorus}` or `{C}` | Chorus |
| `{Bridge}` or `{B}` | Bridge |

### `.hymn` text import

```
@number 1
@title Amazing Grace

[V1]
Amazing grace! how sweet the sound,

{Refrain}
Optional refrain lines

---
@number 2
@title Next hymn
...
```

Separate multiple hymns with a line `---`.

### JSON import (`orion-hymnal`)

```json
{
  "format": "orion-hymnal",
  "version": 1,
  "meta": { "label": "My church hymnal", "abbr": "CH", "language": "af" },
  "hymns": [
    {
      "number": 1,
      "title": "Title",
      "stanzas": [{ "kind": "verse", "verse": 1, "lines": ["Line 1"] }]
    }
  ]
}
```

See `examples/example.hymn` for a text sample.

## Bibsoft / Adventist legacy (`AdventistHymnals.mdb`)

Orion does **not** read `.mdb` at runtime. Use **Hymnals… → Import Bibsoft (.mdb)…** to convert into standard JSON folders under your profile (one book per row in the MDB `Hymnals` table).

Conversion rules:

| Bibsoft | Orion |
|---------|--------|
| `VerseNumber` 1…n | Verse stanza `[Vn]` |
| `VerseNumber` 0 | `{Refrain}` |
| `VerseText` with `\r` | `lines[]` for projection |

To ship built-in books from an MDB (maintainers):

```bash
npm run bundle:adventist-hymnals -- "C:\path\AdventistHymnals.mdb"
```

Writes `hymnals/adventist-*` folders (skips tiny test books).
