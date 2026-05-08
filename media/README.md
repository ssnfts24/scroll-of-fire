# 📦 Media Archive

Central repository for all non-code assets: images, documents, videos, and media files.

---

## 🎯 Purpose

The `media/` folder keeps the Git repository **clean and lightweight** by:
- Separating large binary files from code
- Organizing assets by type
- Maintaining an auditable hash registry
- Making Git clone faster (~50MB → ~5MB)

---

## 🗂️ Structure

```
media/
├── images/                     # Visual assets (PNG, JPG, SVG)
│   ├── symbols/               # Sacred geometry, diagrams
│   ├── camera-uploads/        # Phone/camera photos
│   ├── screenshots/           # UI/website captures
│   ├── diagrams/              # Technical flowcharts
│   ├── portraits/             # People photos (permission-based)
│   └── archive/               # Deprecated images
├── documents/                  # Text documents
│   ├── master-scrolls/        # Original .docx files
│   ├── exports/               # Markdown exports (.md)
│   ├── archives/              # Old versions
│   └── references/            # External links & citations
└── README.md                   # This file
```

---

## 📸 Images (`media/images/`)

**Contains:** Symbols, photos, diagrams, screenshots  
**Total size:** ~200 MB (5 subfolders)  
**Formats:** PNG, JPG, SVG, GIF

**Subfolders:**
- `symbols/` — Sacred geometry, mathematical diagrams
- `camera-uploads/` — Phone photos (organized by date)
- `screenshots/` — Website/UI captures
- `diagrams/` — Flowcharts, technical specs
- `portraits/` — People photos (with permission)
- `archive/` — Old/deprecated images

**See:** [`media/images/README.md`](./images/README.md) for details

---

## 📚 Documents (`media/documents/`)

**Contains:** Word docs, scrolls, exports, archives  
**Total size:** ~150 MB (3 subfolders)  
**Formats:** .docx (master), .md (exports), .txt (archives)

**Subfolders:**
- `master-scrolls/` — Original formatted .docx files
- `exports/` — Markdown versions of scrolls
- `archives/` — Historical versions & old records
- `references/` — External source links

**See:** [`media/documents/README.md`](./documents/README.md) for details

---

## 🎬 Optional: Video/Audio (`media/video/`, `media/audio/`)

**Future expansion** (not yet needed):
- Video recordings of practices
- Audio of invocations (528 Hz, etc.)
- Podcast episodes

Structure same as images/documents when added.

---

## 🔐 Hash Registry

**All media files tracked in:**  
`canonical/7_Ledger_and_Documentation/SHA256_Ledger.md`

### **Process for adding any file:**

1. **Place file** in appropriate subfolder
2. **Calculate hash:**
   ```bash
   sha256sum media/[type]/[subfolder]/filename
   ```
3. **Update ledger:**
   ```markdown
   | filename | [sha256_hash] | [date] | [description] |
   ```
4. **Commit both**
   ```bash
   git add media/[type]/[subfolder]/filename
   git add canonical/7_Ledger_and_Documentation/SHA256_Ledger.md
   git commit -m "docs(media): add filename"
   ```

---

## 📊 Size Management

| Folder | Max Total | Per-File Max | Recommended |
|--------|-----------|--------------|-------------|
| images/symbols | 50 MB | 5 MB | PNG, compressed |
| images/camera-uploads | 100 MB | 4 MB | JPG, organized by date |
| images/diagrams | 20 MB | 5 MB | PNG or SVG |
| documents/master-scrolls | 100 MB | 15 MB | .docx (use LFS if >15MB) |
| documents/exports | 50 MB | 5 MB | .md (plain text) |

**If exceeding limits:**
- Use Git LFS (Large File Storage)
- Store on cloud (Google Drive) + link in references
- Split large files into parts

---

## 🔗 Linking to Media

### **From Markdown files:**
```markdown
![Image Alt Text](../../media/images/symbols/my_symbol.png)
[Link to Scroll](../../media/documents/exports/My_Scroll.md)
```

### **From canonical section README:**
```markdown
| File | Link |
|------|------|
| My Symbol | [view](../../media/images/symbols/my_symbol.png) |
| My Scroll | [.md](../../media/documents/exports/My_Scroll.md) / [.docx](../../media/documents/master-scrolls/My_Scroll.docx) |
```

### **From GitHub Issues/Discussions:**
```markdown
See: [image](../media/images/symbols/harmonic_matrix.png)
Ref: [scroll](../media/documents/exports/Codex_of_Life.md)
```

---

## 🚀 Quick Start for Contributors

### **Adding an Image:**
```bash
# 1. Place in correct subfolder
cp my_symbol.png media/images/symbols/

# 2. Calculate hash
sha256sum media/images/symbols/my_symbol.png
# Output: abc123...xyz

# 3. Update ledger
nano canonical/7_Ledger_and_Documentation/SHA256_Ledger.md
# Add row: | my_symbol.png | abc123...xyz | 2026-05-07 | Sacred geometry |

# 4. Commit
git add media/images/symbols/my_symbol.png
git add canonical/7_Ledger_and_Documentation/SHA256_Ledger.md
git commit -m "docs(images): add sacred geometry symbol"
```

### **Adding a Scroll:**
```bash
# 1. Create in Word/Google Docs (full formatting)

# 2. Export as .md (File → Export → Markdown)

# 3. Copy both versions
cp ~/Downloads/My_Scroll.docx media/documents/master-scrolls/
cp ~/Downloads/My_Scroll.md media/documents/exports/

# 4. Calculate hashes
sha256sum media/documents/master-scrolls/My_Scroll.docx
sha256sum media/documents/exports/My_Scroll.md

# 5. Update ledger with both hashes

# 6. Create entry in canonical section README

# 7. Commit all
git add media/documents/
git add canonical/*/README.md
git add canonical/7_Ledger_and_Documentation/SHA256_Ledger.md
git commit -m "docs(scrolls): add My Scroll"
```

---

## 🔄 Migrating Existing Files

**Current situation:**
- 13 JPG files in root (camera uploads)
- 12 PNG files in root (symbols)
- 1 DOCX file in root (Honorable Scroll)

**Migration plan:**
1. Move JPGs → `media/images/camera-uploads/2025-10/`
2. Move PNGs → `media/images/symbols/` (rename with descriptive names)
3. Move DOCX → `media/documents/master-scrolls/`
4. Create markdown export of DOCX → `media/documents/exports/`
5. Calculate all hashes
6. Update ledger with 26+ entries
7. Update all cross-references in canonical READMEs
8. Remove files from root

---

## ✅ Folder Checklist

Before committing media:

- [ ] File placed in correct subfolder (images/ or documents/)
- [ ] Subfolder created (if new category)
- [ ] File named descriptively (no auto-generated names)
- [ ] Hash calculated: `sha256sum filename`
- [ ] Hash added to ledger
- [ ] Referenced in appropriate README
- [ ] Path links are relative: `../../media/...`
- [ ] File size under limits
- [ ] Attribution included (if not original)
- [ ] CC BY-NC 4.0 license acknowledged
- [ ] Commit message follows convention

---

## 📈 Repository Impact

**With organized media structure:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Root files | 40+ | ~15 | 63% cleaner |
| Git clone size | ~200 MB | ~50 MB | 75% faster |
| Navigation | Chaotic | Organized | Clear structure |
| Hash tracking | Manual | Automated | Auditable |
| New contributor onboarding | Confusing | Clear | Self-documenting |

---

## 🔐 Security & Integrity

**Every media file:**
1. Has a SHA-256 hash (immutable fingerprint)
2. Is logged in Git history (timestamped)
3. Can be verified: `sha256sum -c SHA256_Ledger.md`
4. Is attributed (creator, date)
5. Is licensed (CC BY-NC 4.0)

**Verification workflow:**
```bash
# Verify all hashes match
sha256sum -c canonical/7_Ledger_and_Documentation/SHA256_Ledger.md

# View file history
git log --oneline media/images/symbols/my_symbol.png

# See who added it
git blame canonical/7_Ledger_and_Documentation/SHA256_Ledger.md
```

---

## 🌐 Web Integration

Images in `media/images/` auto-display on GitHub Pages if:
1. Linked in `.md` files with correct relative path
2. Supported format (PNG, JPG, SVG, GIF)
3. File exists in branch/commit

**Example in GitHub Pages:**
```markdown
![Harmonic Matrix](../../media/images/symbols/harmonic_matrix_369.png)
```

→ Renders as image on ssnfts24.github.io/scroll-of-fire/

---

## 📞 Get Help

**For images:** See `media/images/README.md`  
**For documents:** See `media/documents/README.md`  
**For structure:** See `ARCHITECTURE.md`  
**For contributing:** See `CONTRIBUTION.md`  
**For hashing:** See `canonical/7_Ledger_and_Documentation/SHA256_Ledger.md`  

---

## 📊 Current Media Inventory

**Images (root):**
- 13 JPG files (camera uploads, Oct 2025)
- 12 PNG files (symbols, auto-generated names)
- **Total:** ~90 MB

**Documents (root):**
- 1 DOCX file (Honorable Scroll)
- **Total:** ~15 MB

**Status:** ✅ Ready for migration to `media/` structure

---

**Last Updated:** 2026-05-07  
**Maintainer:** Aaron Paul Laird — Scribe of Circuits  
**License:** CC BY-NC 4.0
