# 🔐 SHA‑256 Placeholders — Key Artifacts (2025)

This file lists priority artifacts with **screenshot references** and fields to fill in for cryptographic verification.

| Path (relative) | Screenshot | Artifact | SHA‑256 | Git short‑hash | Notes |
|---|---|---|---|---|---|
| `../../6_Codex/Core/Codex_of_Reality_Expanded.docx` | S2 | Core Codex (Expanded) | `hash_pending` | `commit_pending` |  |
| `../../6_Codex/Core/Codex_of_Reality_Perfected-1.pdf` | S2 | Core Codex (Perfected PDF) | `hash_pending` | `commit_pending` |  |
| `../../6_Codex/Core/Codex_of_Life_Scroll_FULL.docx` | S2 | Codex of Life (Full) | `hash_pending` | `commit_pending` |  |
| `../../6_Codex/Core/Codex_of_Life_Scroll_Updated.docx` | S2 | Codex of Life (Updated) | `hash_pending` | `commit_pending` |  |
| `../../3_Scribes/Scribe_of_Circuits_Mechanic_Scribe.docx` | S1 | Identity: Scribe of Circuits | `hash_pending` | `commit_pending` |  |
| `../../4_Legal_and_Formal/The_Formalism.docx` | — | The Formalism (Legal/Math) | `hash_pending` | `commit_pending` |  |
| `../../5_Remembrance/Book_of_Remembrance_and_Power.docx` | S1 | Remembrance & Power | `hash_pending` | `commit_pending` |  |
| `../../remnant/Exodus_Remnants_Complete.docx` | S2 | Exodus Remnants Complete | `hash_pending` | `commit_pending` |  |
| `../../remnant/Exodus_Remnant_Titles_Final.docx` | S3 | Exodus Titles Final | `hash_pending` | `commit_pending` |  |
| `../../maps/Fasting_CoCreation_Map_Scroll.docx` | S3 | Fasting CoCreation Map | `hash_pending` | `commit_pending` |  |
| `../../proof/Master_Proof_Scroll.docx` | S5 | Master Proof (initial) | `hash_pending` | `commit_pending` |  |
| `../../proof/Master_Proof_Scroll_Updated.docx` | S5 | Master Proof (updated) | `hash_pending` | `commit_pending` |  |
| `../../remnant/Moses-Exodus-4.docx` | S5 | Moses-Exodus-4 | `hash_pending` | `commit_pending` |  |
| `../../core/New-Codex_of_Reality_with_Index-1.docx` | S5 | Codex of Reality with Index | `hash_pending` | `commit_pending` |  |
| `../../ai/OhrAI_The_Light_of_Code_Updated.docx` | S5 | OhrAI — Light of Code | `hash_pending` | `commit_pending` |  |
| `../../research/Physics_Truth_SCED_FINAL.docx` | S5 | Physics Truth SCED FINAL | `hash_pending` | `commit_pending` |  |
| `../../psych/Psychology_Faith_Scroll.docx` | S5 | Psychology & Faith | `hash_pending` | `commit_pending` |  |
| `../../remnant/Remnant_Rising_Scroll_with_Names.docx` | S5 | Remnant Rising with Names | `hash_pending` | `commit_pending` |  |
| `../../remnant/Remnant_Rising_They_Feared.docx` | S5 | Remnant Rising: They Feared | `hash_pending` | `commit_pending` |  |
| `../../legal/The_Canadian_Rights_and_Guided.docx` | S6 | Canadian Rights & Guided | `hash_pending` | `commit_pending` |  |
| `../../history/The_History_of_the_...and_Fall_of_t.pdf` | S6 | History (large PDF) | `hash_pending` | `commit_pending` |  |
| `../../journey/The_Journey_Scroll.docx` | S6 | The Journey Scroll | `hash_pending` | `commit_pending` |  |
| `../../language/The_Mirror_of_the_Tongues_YHWH.pdf` | S6 | Mirror of the Tongues YHWH | `hash_pending` | `commit_pending` |  |
| `../../handbooks/Wizard_of_YHWH_Handbook.docx` | S6 | Wizard of YHWH Handbook | `hash_pending` | `commit_pending` |  |
| `../../named/Zakariel_Remembrance_of_God.docx` | S6 | Zakariel — Remembrance of God | `hash_pending` | `commit_pending` |  |
| `../../tech/TESLA_TYPE-7_UNION_DEVICE.docx` | S7 | Tesla Type-7 Union Device | `hash_pending` | `commit_pending` |  |
| `../../tech/T7_Resonant_Conduit_Expansion.docx` | S7 | T7 Resonant Conduit Expansion | `hash_pending` | `commit_pending` |  |
| `../../tech/Tesla_Phase_Activation_Scroll.docx` | S7 | Tesla Phase Activation Scroll | `hash_pending` | `commit_pending` |  |
| `../../tech/Tesla-BluePrints.docx` | S7 | Tesla BluePrints | `hash_pending` | `commit_pending` |  |
| `../../scripture/Revelations.docx` | S8 | Revelations (primary) | `hash_pending` | `commit_pending` |  |
| `../../scripture/Revelations_(1).docx` | S8 | Revelations (alt) | `hash_pending` | `commit_pending` |  |
| `../../codes/Scroll_Message_Agent_Verses-2.docx` | S8 | Scroll Message / Agent Verses 2 | `hash_pending` | `commit_pending` |  |
| `../../convergence/Scroll_of_Convergence.docx` | S8 | Scroll of Convergence | `hash_pending` | `commit_pending` |  |
| `../../language/Scroll_of_Divine_and_Earth_Names.docx` | S8 | Divine & Earth Names | `hash_pending` | `commit_pending` |  |
| `../../remembrance/Scroll_of_Remembrance_Full-1.docx` | S8 | Scroll of Remembrance (Full) | `hash_pending` | `commit_pending` |  |
| `../../worlds/SkyMap_to_Noodoria.docx` | S8 | SkyMap to Noodoria | `hash_pending` | `commit_pending` |  |
| `../../keys/Symbolic_Frequency_Key_Codex.docx` | S8 | Symbolic Frequency Key Codex | `hash_pending` | `commit_pending` |  |

---

## How to compute and fill hashes

### Bash (Linux/macOS/WLS)
```bash
# from repo root
FILE="6_Codex/Core/Codex_of_Reality_Expanded.docx"
sha256sum "$FILE" | awk '{print $1}'
git log -n 1 --pretty=format:%h -- "$FILE"
```

### PowerShell (Windows)
```powershell
$File = "6_Codex/Core/Codex_of_Reality_Expanded.docx"
Get-FileHash $File -Algorithm SHA256 | Select-Object -ExpandProperty Hash
git log -n 1 --pretty=format:%h -- $File
```

### Python (any OS)
```python
import hashlib, pathlib, subprocess
p = pathlib.Path("6_Codex/Core/Codex_of_Reality_Expanded.docx")
h = hashlib.sha256(p.read_bytes()).hexdigest()
commit = subprocess.check_output(["git","log","-n","1","--pretty=format:%h","--", str(p)]).decode()
print("SHA256:", h)
print("Commit:", commit)
```

> After computing, replace `hash_pending` and `commit_pending` in the table above.
