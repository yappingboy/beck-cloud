# Writing Standard

**Applies to:** every doc in this repo — docs, runbooks, service docs, research notes, generated reference material, README files, changelogs.
**Does NOT apply to:** chat replies to Stephen (conversation, persona stays per SOUL.md).
**Source:** ASD-STE100 Issue 9 (2025-01-15), Parts 1 and 2. Full text archived at `docs/reference/asd-ste100-issue9/`.

---

## Scope: what is STE and what is not

| Content type | STE or not | Why |
|---|---|---|
| Runbooks, SOPs, procedures | **STE** | Imperative instructions, step-by-step |
| Reference docs (system-overview, services-catalog, networking-ingress, etc.) | **STE** | Descriptive information |
| Service READMEs / per-service docs | **STE** | Descriptive information |
| Research notes | **STE** | Descriptive information |
| Changelogs | **STE** | Descriptive information |
| `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `MEMORY.md` (workspace meta) | **Not STE** | Persona and memory, not user-facing tech docs |
| Chat replies to Stephen | **Not STE** | Conversation |
| Code, config, YAML, JSON | **Not STE** | Code obeys its own rules |

## Where the STE rules come from

ASD-STE100 Issue 9, Part 1, sections 1–9:
- **Section 1** (words): only approved dictionary words, one meaning per word.
- **Section 2** (phrases): imperative verbs, no phrasal verbs, no gerunds.
- **Section 3** (sentences): ≤20 words (procedural), ≤25 words (descriptive), active voice preferred, no semicolons, comma rules.
- **Section 4** (paragraphs): one topic per paragraph, ≤6 sentences per paragraph.
- **Section 5** (documents / procedures): numbered steps, letters, parentheticals.
- **Section 6** (descriptive writing): topic sentences, key words, gradual information.
- **Section 7** (safety): WARNING (injury/death) / CAUTION (equipment damage).
- **Section 8** (punctuation + word count): no semicolons, hyphens, parenthetical counts as 1 word.
- **Section 9** (writing practices): no phrasal verbs, consistent terminology, no pronoun ambiguity.

## The hard rules (non-negotiable)

These are the rules that, if violated, make the doc fail review:

1. **Sentence length.** Procedural (imperative) sentences ≤ 20 words. Descriptive sentences ≤ 25 words. Count words per STE rules 8.4–8.7 (number+unit = 1, hyphenated = 1, parenthetical = 1, abbreviation = 1).
2. **One idea per sentence.** No semicolons. Two ideas = two sentences.
3. **Imperative verbs in procedures.** Every numbered step starts with a verb: `Do`, `Make sure`, `Remove`, `Install`.
4. **Active voice.** `Remove the pod.` not `The pod is removed.` (Passive allowed only to hide the agent: `... is damaged.`)
5. **No phrasal verbs.** `Extinguish the fire.` not `Put out the fire.` `Release` not `give off`.
6. **No idioms, humor, metaphor.** STE is a controlled vocabulary.
7. **Consistent terminology.** Same object = same noun, same action = same verb. Pick one, use it everywhere.
8. **No undefined abbreviations.** First use: `Keycloak (the identity provider)`. After that: `Keycloak`.
9. **Pronouns unambiguous.** If `it` / `they` can refer to two nouns, spell the noun out.
10. **No Latin abbreviations.** Use `for example`, `that is`, or omit.

## The soft rules (recommended, not blocking)

These improve readability but don't fail review on their own:

- Prefer short words. `Use` over `utilize`. `Show` over `demonstrate`.
- One paragraph = one topic. Topic sentence first.
- Lists for discrete items (components, steps, options). Paragraphs for relationships.
- Hyphens to connect directly-related words: `low-altitude flight`, `three-to-one ratio`.
- Parentheses for references, item IDs, abbreviations, alternatives.
- Commas: after introductory phrases only. No decorative commas.
- Connectives: `and`, `but`, `then`, `thus`, `as a result`, `at the same time`.

## Voice: the one exception

`SOUL.md` persona (deadpan, compressed, snarky) is **conversation only**. Every file in this repo that a reader (including a future reader who is not the author) will reference is STE. If you find yourself adding a `:` or a joke to a doc, stop, that's chat, not a doc.

## Format conventions (house rules, not STE)

STE does not cover formatting. The house rules:

- **Filename:** kebab-case, no spaces: `deployment-runbook.md`, `namespace-descriptions.md`.
- **Headings:** sentence case, no trailing period.
- **Code blocks:** always labeled. ```` ```bash`, ```` ```yaml`, ```` ```python`.
- **Tables:** for structured data (services, ports, namespaces). Bullets for actions.
- **Safety callouts:** `WARNING:` (injury/death risk), `CAUTION:` (equipment damage), `NOTE:` (information only, no instruction). All-caps body, STE-compliant sentence.
- **Cross-references:** relative path, for example: `See [Networks & Ingress](../reference/networking-ingress.md).`
- **Dates:** ISO 8601 (`YYYY-MM-DD`).
- **Numbers + units:** space between, `10 °C`, `20 kg`, `172.16.0.20`.

## How to write a runbook (procedural)

1. **Title** (1 line, noun phrase).
2. **Purpose** (1 sentence, ≤ 25 words).
3. **Prerequisites** (bulleted list, noun phrases).
4. **Steps** — numbered `1. 2. 3.` each step:
   - Starts with an imperative verb.
   - ≤ 20 words.
   - One action per step.
   - Sub-steps: `A. B. C.` (max 2 levels deep).
   - Parentheticals for tool IDs, ports, flags.
5. **Verification** (how to confirm success, ≤ 3 steps).
6. **Rollback** (how to undo, only if rollback exists).

## How to write a reference doc (descriptive)

1. **Title** (noun phrase).
2. **Overview** (2–3 sentences, ≤ 25 words each).
3. **Sections**, each:
   - Topic sentence (first sentence states the section topic).
   - Supporting sentences (≤ 25 words each, active voice).
   - One paragraph per topic, ≤ 6 sentences per paragraph.
   - Tables for structured data.
4. **Key terms** (if the doc defines terms, list them at the top).

## How to write a service doc

```
# <Service Name>

**Namespace:** <ns>
**Ports:** <port list>
**SSO:** <sso chain or none>
**Storage:** <PVC / hostPath / none>
**IngressRoute:** <host or none>

## Purpose
<1-2 sentences, what it does and why>

## Configuration
<env vars, mounts, key settings>

## Operations
<how to restart, scale, debug>

## Troubleshooting
<symptom → fix pairs>
```

## Review checklist (before commit)

- [ ] Every procedural sentence ≤ 20 words, every descriptive sentence ≤ 25 words.
- [ ] No semicolons.
- [ ] No phrasal verbs.
- [ ] No idioms, no jokes, no `:` or `:)`.
- [ ] Same object = same noun throughout the doc.
- [ ] First use of an abbreviation is expanded.
- [ ] No ambiguous pronouns.
- [ ] No `e.g.`, `i.e.`, `etc.` (Latin abbreviations).
- [ ] Every numbered step starts with a verb (do, make sure, remove, install).
- [ ] Safety callouts: `WARNING` / `CAUTION` / `NOTE` used correctly.
- [ ] Tables for structured data, bullets for actions.
- [ ] Filenames kebab-case, headings sentence case.

## Enforcement

- **Manual:** every doc PR (or direct commit) is checked against this standard before merge.
- **Automated:** `docs/scripts/ste-check.py` scans for:
  - Sentence length > 25 words (fail)
  - Semicolons (fail)
  - Known phrasal verbs (fail)
  - Latin abbreviations (fail)
  - Pronoun ambiguity (manual)
  - Undefined abbreviations (warn)
- **Drift:** if a doc drifts from this standard, the fix is to rewrite the doc in STE, not to relax the standard.
