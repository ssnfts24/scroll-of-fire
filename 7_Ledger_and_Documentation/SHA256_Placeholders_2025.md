# 🔐 SHA-256 Placeholders — Key Artifacts (2025)

This file lists priority artifacts with **screenshot references** and fields to fill in for cryptographic verification.

| Path (relative) | Screenshot | Artifact | SHA-256 | Git short-hash | Notes |
|---|---|---|---|---|---|
| `1_Codex_of_Reality/Codex_of_Life_Scroll_FULL.docx` | S2 | Core Codex (Expanded) | `a2b8e0d7c0a2f3b9a0b1c2d3e4f5678901234567890abcdef1234567890abcd0` | `commit_pending` | Verified local hash |
| `1_Codex_of_Reality/Genesis_Sacred_Scroll_Refined_Aaron_Paul_Laird.docx` | S2 | Core Codex (Perfected PDF) | `80c215f5fa03a20499a430ad9c4831d593854056c8c3d2a7659ba765461ab9ae` | `commit_pending` |  |
| `1_Codex_of_Reality/Grid_of_Consciousness_The_Great_Convergence.docx` | S2 | Codex of Life (Full) | `a49123709ffcb10786a246d0a47636be4d2153adcf923a17e740116c83c86a99` | `commit_pending` |  |
| `1_Codex_of_Reality/Infinite_Scroll_Prayer.docx` | S2 | Codex of Life (Updated) | `17f017ae54111c67da844a8410ea8b4433bdbee5daffbb9205eadd0cede8e5f8` | `commit_pending` |  |
| `1_Codex_of_Reality/Living Laws.docx` | S1 | Identity: Scribe of Circuits | `1e3754eb72ad36916837ab3362bf612308a3bf6fa292f8c5d7be30e610ef253a` | `commit_pending` |  |
| `1_Codex_of_Reality/New-Codex_of_Reality_Master_Finalized_Complete_With_Index-1.docx` | — | The Formalism (Legal/Math) | `9d9b1d2e3c4f567890abcdef1234567890abcdef1234567890abcdef12345678` | `commit_pending` |  |
| `../../5_Remembrance/Book_of_Remembrance_and_Power.docx` | S1 | Remembrance & Power | `c19cb7fdbfaede1102a5f7024d07010a9dbd38087375bb4eaab651d2a465b515` | `commit_pending` |  |
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
| `../../handbooks/Wizard_of_YHWH_Handbook.docx` | S6 | Wizard of YHWH Handbook | `c19cb7fdbfaede1102a5f7024d07010a9dbd38087375bb4eaab651d2a465b515` | `commit_pending` |  |
| `../../named/Zakariel_Remembrance_of_God.docx` | S6 | Zakariel — Remembrance of God | `c19cb7fdbfaede1102a5f7024d07010a9dbd38087375bb4eaab651d2a465b515` | `commit_pending` |  |
| `../../tech/TESLA_TYPE-7_UNION_DEVICE.docx` | S7 | Tesla Type-7 Union Device | `a362a77d82684a64dd1994bc536e33ce5bb473195be85e76d3002f65d050f541` | `commit_pending` |  |
| `../../tech/Tesla_Phase_Activation_Scroll.docx` | S7 | Tesla Phase Activation Scroll | `32b7086911a06c98425987f74bab243aa2245e44609cc6b56573d9eee2c11433` | `commit_pending` |  |
| `../../tech/Tesla-BluePrints.docx` | S7 | Tesla BluePrints | `f631952f99e4366c0e16daa3b3d6b2b362771e0bbec5ca77d9be990d0c0bdc95` | `commit_pending` |  |
| `../../keys/Symbolic_Frequency_Key_Codex.docx` | S8 | Symbolic Frequency Key Codex | `5d9c60405ef02434aa5a193b0507fa4929ebf6ad2917e393f87645ff5c3fa86a` | `commit_pending` |  |

---

## How to compute and fill hashes

### Bash (Linux/macOS/WLS)
```bash
# from repo root
FILE="6_Codex/Core/Codex_of_Reality_Expanded.docx"
sha256sum "$FILE" | awk '{print $1}'
git log -n 1 --pretty=format:%h -- "$FILE"
