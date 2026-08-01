# Validation — interviews and kill/pivot

| Field            | Value                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Gate**         | 15–20 offer-stage candidate interviews before treating corridor numbers as product truth     |
| **Status**       | Not started (0 / 15)                                                                         |
| **Last updated** | 2026-08-01                                                                                   |
| **Related**      | [PRODUCT.md](./PRODUCT.md), [PRD.md](./PRD.md), [CALIBRATION.md](../src/data/CALIBRATION.md) |

Do **not** market planner output as accurate ETAs. Interviews decide keep / kill / pivot.

---

## 1. Who to interview

Offer-stage (or late-stage) candidates deciding accept / negotiate hybrid / move / change home shortlist in Jabodetabek — especially corridors around SCBD/Sudirman, Kuningan, BSD with feeder homes along KRL/MRT.

Skip: pure remote roles, casual browsers with no decision window, HR/facilities (later B2B path).

---

## 2. Session script (≈20–30 min)

1. **Context** — office location, salary band (optional), hybrid days, current/candidate homes.
2. **Baseline** — how they stress-test commute today (Maps, Grab, spreadsheet, gut).
3. **Run the tool** — pin office + 1–2 homes; try best-price mix and one road mode.
4. **Trust** — which figures feel useful vs suspicious? P50/P80? Fares? Transit legs?
5. **Decision** — would anything change: home shortlist, hybrid ask, accept/reject rationale?
6. **Ask** — what would make this worth sharing with partner / parents / HR?

Log: date, persona notes, corridor, modes tried, distrust triggers, decision change (Y/N + what), verbatim quotes if allowed.

---

## 3. Success signal (product metric)

Count an interview as a **positive decision signal** if the user changes (or clearly intends to change) at least one of:

- Home shortlist
- Hybrid / WFH negotiation ask
- Offer accept/reject rationale

**Not** success: download count alone.

---

## 4. Kill / pivot criteria

After **15–20** interviews (or earlier if pattern is overwhelming):

| Decision  | When                                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| **Keep**  | ≥ ~40% show a decision signal; distrust is about calibration, not the wedge             |
| **Pivot** | Wedge wrong (wrong persona/moment) but commute modeling still wanted — rewrite PRODUCT  |
| **Kill**  | Persistent distrust of bands _and_ no decision signal; users only want live Grab/Google |

Also kill/pause heavy build if interviews stall because the tool is unusable (placement broken, routes empty) — fix UX before counting more interviews.

---

## 5. Tracker

| #    | Date | Corridor | Decision signal? | Notes                         |
| ---- | ---- | -------- | ---------------- | ----------------------------- |
| 1–15 | —    | —        | —                | (fill as interviews complete) |

After synthesis, update PRD status and [CALIBRATION.md](../src/data/CALIBRATION.md) with lived P50-ish samples.

---

## Document control

Update status and tracker rows as interviews land. Change kill thresholds only with an explicit PRODUCT/PRD note.
