# DST Metadata Map — education layer for the folkeskole cascade

**Purpose.** Orientation before API mining. Maps DST's *metadata layer* (variable
registers + classifications) onto the cascade's data gaps, so JOB 1 discovery calls
target the right register/classification instead of guessing table IDs.

Source pages:
- Variables (TIMES / Metadatabank): https://www.dst.dk/da/Statistik/dokumentation/Times
- Classifications (nomenklaturer): https://www.dst.dk/da/Statistik/dokumentation/nomenklaturer

DST has **two stacked layers** we care about:
1. **Registre** (TIMES) — the raw data sources (who/what/when is recorded).
2. **Nomenklaturer** — the classification schemes that dimension those registers
   (e.g. education *level*). StatBank tables are the published cross-tabs on top.

---

## A. Classifications (nomenklaturer) — the dimensions

| Classification | Slug | What it dimensions | Cascade use |
|---|---|---|---|
| **DISCED-15, afsluttede** | `disced15-audd` | Highest *completed* education, ISCED-aligned, 4-tier hierarchy | JOB 1b — attainment SHARE (tertiary %, upper-sec %) |
| **DISCED-15, igangværende** | `disced15-udd` | *Ongoing* education, same tiers | enrolment by level |
| **DDU, afsluttede** | `ddu-audd` | Danish 4-digit completed-education code (national detail) | maps to HFUDD11 attainment codes |
| **DDU, igangværende** | `ddu-udd` | Ongoing-education code | activity tables |
| **LER kodelister** | `ler` | Local pupil-register code lists (see below) | flows / dropout reasons |

### DISCED-15 structure (the attainment dimension)
4-tier hierarchy, ISCED-mapped. Codes ascend by level:
- **Hovedområde** (1-digit) = level
- **Hovedgruppe** (2-digit) = type within level
- **Mellemgruppe** (3-digit) = subject content
- **Undergruppe** (4-digit) = detailed subject
Levels run grundskole → gymnasial/erhvervsfaglig (upper-sec) → KVU / MVU / LVU
(kort/mellemlang/lang videregående = tertiary tiers).
> NOTE: the DISCED-15 detail page is >10MB (embeds the full code tree) — pull the
> level codes via the StatBank classification API, not WebFetch.

### DDU vs DISCED-15
DDU = the *national* Danish classification (4-digit unique code per completed
education); DISCED-15 = the *international* ISCED-aligned view of the same. HFUDD11
publishes on the attainment level; break out that dimension for JOB 1b.
DDU-tagged StatBank tables seen: **UDDALL10** (education activity 2005–2022),
**EUD34** (vocational activity), **KVEU20** (adult/continuing ed).

### LER kodelister (Lokalt ElevRegister)
Code lists for pupil *flows*, not levels. Primary list = **Afgangsårsag**
(departure reason, 115+ codes: completed / discontinued / transferred / etc.,
valid from 2023-12-01). Cross-referenced lists: Elev_årsag, Elevtype,
Kompetenceniveau, Fritagelse, Forløb. Useful for **frafald/dropout** decomposition,
not for headline counts. Does NOT itself carry folkeskole grade or institution type.

---

## B. Registers (TIMES) — the data sources

### Uddannelsesdata — the master education register family
`/Times/uddannelsesdata`. Register-based foundation for ALL public education
statistics. Named sub-registers (each a candidate data source):

| Register | Covers | Maps to cascade node |
|---|---|---|
| **Elevregistret** | Pupil enrolment (all levels) | denominator for per-pupil metrics |
| **Grundskole** | **Folkeskole pupils** | LEVER (1a) — pupil counts to derive kr/elev |
| **Grundskole_laerer** | **Folkeskole teachers** | teacher ratios / class size (1a extension) |
| **Afgangsregistret** | Completion / discontinuation | dropout, frafald |
| **Karakterer** (multi-level) | **Exam grades** | learning_outcomes (1c) — 9.-kl karaktergns |
| **Overgangsregistret** | **Transitions** (grundskole→ungdomsudd) | NEET path (1d), transition rate |
| **Befolkningens Uddannelse** | Attainment of population | education SHARE (1b) — parent of HFUDD11 |
| **LER-registre** (erhverv/grund/gym) | Local pupil registers | flow detail |

> The doc page says "der findes ingen variable under Uddannelsesdata" — variables
> live on the individual sub-register pages, not the index. This index is the map;
> drill into `Grundskole`, `Karakterer`, `Overgangsregistret` next.

### Undervisningsministeriets statistikberedskab — the ministry indicator set
`/Times/undervisningsministeriets-statistikberedskab`. 31 delopgaver linking
education ↔ labour ↔ income. Named delopgaver hitting cascade gaps:

| Delopgave | Likely content | Cascade node |
|---|---|---|
| `P2elev3`, `P2elev3_hulluk` | Pupil records | LEVER denominator (1a) |
| `P2udd_grundskole` … `P6udd_kvalifikation` | Education tracking by level | attainment (1b) |
| `P4ansatte` | Personnel/staff | teacher counts (1a) |
| `P5indk_efo`, `P5indk_su` | Income / SU funding | education→income (1b/1c edge) |
| `P9udd_karakter_udd` | **Grades by education** | learning_outcomes (1c) |

Stated purpose (verbatim): *"etablere et grundlag for uddannelsesstatistik og for
analyser af forholdet mellem uddannelse, arbejdsmæssige og indkomstmæssige forhold"*
— i.e. this beredskab is literally built to study the education→work→income chain,
which is the cascade's spine. Strong candidate source for hardening those edges.

### Institutionsregister
`/Times/institutionsregister`. Institutions + sector contacts. Variables: INST2,
INST3, ENHEDSART (type), EJER (ownership — municipal vs private), ADM (admin
kommune), MINS (ministry), NIV (level). Folkeskole not flagged as an explicit
category and **no funding/size variables** — so the LEVER spend figure is NOT here;
confirms JOB 1a must go to Subject 13 (municipal accounts) for kroner.

---

## C. What this changes for JOB 1 (mining plan refinements)

1. **LEVER (1a) is split across two sources, confirmed:**
   - *pupils* (denominator) → `Grundskole` register / `P2elev3` → StatBank ed-activity tables.
   - *kroner* (numerator) → NOT in education registers or institutionsregister →
     Subject 13 municipal accounts. Derive kr/elev by joining the two.
2. **learning_outcomes (1c) has a real register:** `Karakterer` / `P9udd_karakter_udd`.
   Hunt StatBank for the published grade table (9.-klasse afgangsprøve karaktergns).
   This replaces the static HCI 2020 dot — high-value, likely FOUND.
3. **attainment SHARE (1b):** `Befolkningens Uddannelse` register, dimensioned by
   DISCED-15/DDU level. Re-query HFUDD11 with the level dimension broken out; pull
   DISCED-15 level codes from the classification API.
4. **NEET / transitions (1d):** `Overgangsregistret` is the DK-native transition
   source (grundskole→ungdomsuddannelse); pair with AKU for the NEET rate itself.
5. **teacher ratios / class size:** `Grundskole_laerer` + `P4ansatte` — a bonus
   node the wishlist listed as "cast wider"; now confirmed to exist.

Next discovery calls (unchanged workflow, sharper targets):
```
python fetch_dst.py --discover-subject 4     # find StatBank tables from these registers
python fetch_dst.py --discover-subject 13    # municipal folkeskole spend (the kroner)
python fetch_dst.py --discover-table HFUDD11 # break out DISCED-15 level dimension
```
