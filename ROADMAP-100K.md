# airgap → 100K Stars

## An Advisory Committee Roadmap

Committee: **Naval Ravikant · Steve Jobs · Don Norman · Sam Altman · Ilya Sutskever · Peter Thiel**

Every milestone below is attributed to the member whose doctrine drives it, including the
dissent. Where the committee disagreed, the disagreement is recorded and resolved — not
smoothed over. A roadmap with no tension in it is a roadmap nobody argued for.

Baseline verified: **2026-09-12**.

---

## 1. The Committee

### Naval Ravikant — _Leverage, specific knowledge, long games_

> "Seek wealth, not money or status. Wealth is assets that earn while you sleep."

- **Doctrine:** Code and media are permissionless leverage. Stars are a _lagging_ indicator
  of value created, never a leading one. Play long-term games with long-term people.
  Specific knowledge can't be taught, only built — and it lives at the edge of what's new.
- **Verdict on airgap:** "This is a sovereignty tool, not a chat app. You're selling 27
  features when you should be selling one truth: _your AI, nobody else's server._"
- **Wants to kill:** Feature parity with ChatGPT. And the goal itself — 100K stars as a
  target is a desire-contract that makes you miserable for three years.

### Steve Jobs — _Product as marketing_

> "People don't know what they want until you show it to them."

- **Doctrine:** Start with the experience and work backwards to the technology. Say no to
  a thousand things. The demo _is_ the product. Real artists ship.
- **Verdict on airgap:** "I opened your repo and couldn't tell in five seconds why I should
  care. And your `main` branch hasn't shipped in twelve weeks. That's not a roadmap problem,
  that's a shipping problem."
- **Wants to kill:** The settings panel. Anything not visible in the first sixty seconds.

### Don Norman — _Human-centered design_

> "The real problem is not the technology, it's the conceptual model."

- **Doctrine:** Affordances, signifiers, mapping, feedback, discoverability. Minimize the
  Gulf of Execution ("what do I do?") and the Gulf of Evaluation ("what just happened?").
  Design for error and recovery. Make system state visible.
- **Verdict on airgap:** "You have three storage layers with overlapping names — memory,
  notes, stored values — and no explanation of when to use which. The user cannot build a
  mental model, so they will not trust it. And `file://` silently disables three features."
- **Wants to kill:** The memory/notes/store_value trichotomy. Irreversible destructive
  actions. Invisible failure modes.

### Sam Altman — _Scale, loops, timing_

> "Make something people want. Growth is the compounding of a good loop, not a campaign."

- **Doctrine:** Ride the right wave. Be 10x better, not 10%. Distribution is a product
  feature. Momentum is a channel. Iterate faster than your doubt.
- **Verdict on airgap:** "Local agents plus bring-your-own-key is a real wave — Ollama is at
  180K stars on exactly this instinct. But you have zero distribution and zero loop. Nobody
  who stars you today brings another person tomorrow."
- **Wants to kill:** The manual release process. The belief that a good README is
  distribution.

### Ilya Sutskever — _Research taste, the right primitive_

> "The most powerful ideas are simple, and they generalize."

- **Doctrine:** Don't hand-author capabilities; find the primitive they emerge from.
  Simplicity that scales beats a catalogue of special cases. And: be honest about
  evaluation — if you can't measure it, you don't know it.
- **Verdict on airgap:** "Twenty-seven hand-written tools is not a feature, it's a symptom.
  The general primitive — a safe sandboxed execution surface plus a tool-authoring
  interface — subsumes almost all of them. Build that one thing."
- **Wants to kill:** Hand-rolled tool #28. Any performance claim without a benchmark.

### Peter Thiel — _Monopoly, secrets, durability_

> "What important truth do very few people agree with you on?"

- **Doctrine:** Competition is for losers; monopoly of a small market first, then expand.
  Distribution beats product. Ask the seven questions — engineering, timing, monopoly,
  people, distribution, durability, secret.
- **Verdict on airgap:** "Your secret is correct and you buried it under a me-too feature
  list. _'The best agent architecture has no server'_ is a contrarian truth most engineers
  would argue with. Lead with it. Own 'zero-backend agent for people who cannot ship data
  out' completely, then expand outward."
- **Wants to kill:** Competing with Cline/Continue on features. Broad-market messaging.

---

## 2. Situation Assessment (verified 2026-09-12, updated after the push)

| Signal                        | Value                  | Read                                    |
| ----------------------------- | ---------------------- | --------------------------------------- |
| Stars / forks / watchers      | **0 / 0 / 0**          | Pre-launch, not post-failure            |
| Created                       | 2026-06-18             | ~3 months old                           |
| `origin/main` at first review | **2026-06-17**         | Was 12 weeks stale                      |
| Local vs `origin/main`        | **97 commits ahead**   | **Resolved — pushed 2026-09-12 08:42Z** |
| Open issues                   | 16 → **10**            | The 6 already-done issues auto-closed   |
| Demo (GitHub Pages)           | Reachable (HTTP 200)   | Now serving the pushed build            |
| README                        | Genuinely strong       | Best asset you have                     |
| Fetch proxy worker            | Reachable              | Healthy                                 |
| Stale branches                | ~10 local + ~14 remote | Reads as abandoned                      |

### The one finding that matters

> **Nothing had been pushed to `main` since v1.0.0.** Local `main` was 97 commits ahead.
> The local browser engine, GitHub tools, TTS, slash commands, file attachments, conversation
> branching, global search, ESLint/Prettier gates, and Release Drafter all existed — on a
> laptop. Issues #66–#73 sat open not because the work was unfinished but because the
> commits were never pushed.

**Resolved 2026-09-12.** The backlog was pushed at 08:42Z and the tracker went from 16 to
10 open issues on its own, confirming the audit in M0.3: the closing keywords were always
there, the commits just needed to land.

This was the binding constraint. All six members converge on it, from six directions:

- **Jobs:** "Real artists ship."
- **Ilya:** "You cannot evaluate an artifact nobody can run."
- **Sam:** "You cannot compound from zero."
- **Thiel:** "You have no durable asset until it exists in public."
- **Naval:** "Reputation compounds only when the work is visible."
- **Norman:** "A system whose state is invisible cannot be trusted."

**Therefore Phase 0 is not marketing. Phase 0 is shipping.**

### The competitive field (live counts, 2026-09-12)

| Project                      | Stars   | Created | Lesson                                      |
| ---------------------------- | ------- | ------- | ------------------------------------------- |
| n8n-io/n8n                   | 204,059 | 2019    | Six years of compounding, not one launch    |
| Significant-Gravitas/AutoGPT | 187,275 | 2023    | Rode a wave hard; faded when the wave moved |
| ollama/ollama                | 180,716 | 2023    | **Closest analogue — local-first instinct** |
| open-webui/open-webui        | 151,709 | 2023    | Won by being the default UI for Ollama      |
| langchain-ai/langchain       | 146,173 | 2022    | Category creation, then ecosystem           |
| cline/cline                  | 67,864  | 2024    | Fast rise via a sharp, singular wedge       |
| continuedev/continue         | 35,881  | 2023    | Steady, developer-trust-led growth          |

**Ollama is the template.** It proves the market for "run it yourself, own your inference"
is worth 180K stars — and it has no first-party agent UI that runs with zero backend. That
gap is airgap's opening.

---

## 3. Where the Committee Disagrees

### Tension 1 — Simplify vs. Expand

**Naval + Jobs** ("cut to the bone") vs. **Sam** ("more surface = more entry points").
**Ilya reframes it:** the fight isn't big vs. small, it's _hand-authored_ vs. _generated_.

> **Resolution:** Shrink the visible surface, deepen the substrate. Don't add tool #28 —
> ship the tool-authoring primitive so the surface grows without the core growing.

### Tension 2 — Narrow monopoly vs. Big wave

**Thiel** ("monopoly of a small market first") vs. **Sam** ("ride the largest wave").

> **Resolution:** Thiel's market _sits inside_ Sam's wave. "Zero-backend agent" is a small,
> defensible box within a very large wave. Narrow positioning, broad distribution.

### Tension 3 — Ignore the metric vs. Chase the metric

**Naval** vs. everyone else.

> **Resolution:** 100K is the **direction**, never the **weekly KPI**. Weekly KPIs are
> time-to-first-magic, contributor count, and referral sources. Stars are read quarterly,
> like a financial statement — not daily, like a stock ticker.

### Tension 4 — Design purity vs. Shipping now

**Norman** ("fix the conceptual model before you grow") vs. **Jobs + Sam** ("ship now").

> **Resolution:** Ship Phase 0 immediately, but **gate Phase 2 on Norman's fixes**. You can
> be small and slightly confusing. You cannot be large and confusing — confusion at scale
> becomes support debt and churn.

---

## 4. The Star Ladder

100K stars puts a repo in roughly the top 100 on GitHub. Be honest about what each gate
actually _proves_:

| Gate  | Stars      | What it proves                       | Typical trigger                                  |
| ----- | ---------- | ------------------------------------ | ------------------------------------------------ |
| **0** | 0 → 100    | It works, and it is shippable        | Push `main`. Fix first run.                      |
| **1** | 100 → 1K   | Strangers find it without you        | One breakout moment — HN / video / X             |
| **2** | 1K → 10K   | It's the default answer to a search  | Comparison content + ecosystem + repeat cadence  |
| **3** | 10K → 50K  | Other people's success depends on it | Tool registry, third-party content, integrations |
| **4** | 50K → 100K | It's infrastructure                  | Provider docs, regulated adoption, governance    |

---

## Phase 0 — Ship What You Built

**Weeks 1–2 · Gate 0 → 100 stars · Led by Jobs, seconded by Ilya**

> **Jobs:** "You can't market a product that isn't on the shelf."

| #    | Milestone                                                                                                                                                                | Owner voice  | Rationale                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0.1 | **Push the 97 commits to `main`.** — **done 2026-09-12 08:42Z.** Still open: tag and release **v1.1.0** with the CHANGELOG `[Unreleased]` block promoted.                | Jobs         | Twelve weeks of silence reads as death. Releases are the heartbeat of an OSS project.                                                                |
| M0.2 | **Close #66–#73** — the six issues whose work was already landed and unpushed. — **done: the push closed them with no manual action**                                    | Ilya         | An issue tracker that lies is worse than no tracker. It is the first thing a serious contributor reads. Tracker went 16 → 10 on its own.             |
| M0.3 | **Audited the issue-closing convention — no fix needed.** All six commits already carry the keyword, so the push closes them. Verified by scanning all 97 commit bodies. | Ilya         | The tracker was reporting an unpushed repo, not a broken process. Confirm a defect before scheduling a fix for it.                                   |
| M0.4 | **Redeploy the GitHub Pages demo from `main`.** Verify it serves the current build.                                                                                      | Sam          | The demo is the top of the funnel. A stale funnel converts at zero no matter how good the product is.                                                |
| M0.5 | **Land #54 (API key obfuscation at rest).** — **done locally, awaiting push**                                                                                            | Thiel        | For a privacy tool, plaintext keys in localStorage is the first thing a security-minded evaluator checks. It's the cheapest credibility you can buy. |
| M0.6 | **Archive or delete the ~24 stale branches.** Keep `wip/online-enhancement-cache-queue` only with a comment stating its known gap list.                                  | Jobs / Thiel | Focus is legible. Branch clutter signals abandonment to every visitor who clicks the dropdown.                                                       |
| M0.7 | **Make CI visibly green** and confirm lint + tests gate every PR (#71). — **verified, no change needed**                                                                 | Ilya         | No evaluation, no trust. `ci.yml` already runs `npm run lint` and `npm test` on `main` and every PR.                                                 |

**Exit criteria:** `main` == local · v1.1.0 tagged and published · open issues ≤ 10 ·
demo rebuilt from `main` · CI badge green.

---

## Phase 1 — The First Sixty Seconds

**Weeks 3–8 · Gate 100 → 1K stars · Led by Jobs + Norman**

> **Norman:** "The user should never have to ask 'what do I do now?'"
> **Jobs:** "It should work before you ask anything of the user."

| #    | Milestone                                                                                                                                                                                                                                                                          | Owner voice | Rationale                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1 | **Zero-key first run.** Make the local browser engine (WebLLM, Qwen2.5-0.5B ≈310 MB) the **default on the hosted demo** — no API key, no signup, no configuration. — **done locally, awaiting push**                                                                               | Jobs + Sam  | **The single highest-leverage item in this roadmap.** "I don't have an API key" is where nearly every visitor leaves. Remove the ask entirely. |
| M1.2 | **Measure time-to-first-magic:** clone → open → first agent answer that used a tool. Target ≤ 60s with a key, ≤ 90s zero-key. Measured **in-lab, never by telemetry.**                                                                                                             | Ilya        | You cannot improve what you don't measure — and you must not measure it by tracking users.                                                     |
| M1.3 | **The 30-second demo (#69).** Silent, captioned, autoplaying above the fold: local model loads → agent searches the web → saves a note → renders a chart.                                                                                                                          | Jobs        | The demo is the product. This asset will do more conversion work than every other line of copy combined.                                       |
| M1.4 | **First-run onboarding:** three questions maximum (role → provider → goal), which then preconfigure persona, model, and three starter prompts.                                                                                                                                     | Norman      | Collapse the Gulf of Execution to zero. An empty textarea is the most intimidating UI in software.                                             |
| M1.5 | **Fix the conceptual model.** One visible sentence distinguishing memory / notes / per-chat storage — or unify them into one concept with scopes. Add **undo** for destructive actions (`forget_all`, delete chat, delete note). Surface `file://` limitations _before_ they bite. | Norman      | Three overlapping stores with no model is why users won't rely on it. Reliability requires predictability.                                     |
| M1.6 | **Positioning rewrite above the fold.** Keep the headline; make the sub-headline the secret: _"The only AI agent with no server to leak to."_                                                                                                                                      | Thiel       | Lead with the contrarian truth, not the feature inventory. Features invite comparison; a secret invites curiosity.                             |
| M1.7 | **Launch #1, concentrated:** Show HN + r/LocalLLaMA + r/selfhosted + r/privacy + X thread, same week.                                                                                                                                                                              | Sam         | One loud moment beats a quiet drip. Aim the launch at the Ollama/LocalLLaMA audience — they already believe your premise.                      |

**Exit criteria:** 100 stars · ≥3 unprompted community posts · TTFM measured and under target
· demo video live in README · zero-key demo path working.

**Dissent — Naval:** "Don't optimize the funnel before you're sure the thing is loved. Get
ten users who'd be devastated if airgap disappeared; then scale." _Accepted as a gate check:
personally email ten Phase-1 users before starting Phase 2._

---

## Phase 2 — The Loop

**Months 3–6 · Gate 1K → 10K stars · Led by Sam + Thiel**

> **Sam:** "You don't get a thousand users by getting one user a thousand times."
> **Thiel:** "Name the category you intend to monopolize."

| #    | Milestone                                                                                                                                                                                          | Owner voice   | Rationale                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2.1 | **"Works with" integration grid:** Ollama, llama.cpp, LM Studio, vLLM, OpenRouter, Groq, Mistral, Together — each with a copy-paste config block.                                                  | Thiel + Sam   | Integrations are distribution you don't pay for. Align with Ollama's 180K-star audience instead of competing with it.                                         |
| M2.2 | **Honest comparison pages:** vs ChatGPT/Claude, vs Cline/Continue, vs Open WebUI, vs LibreChat — each including _where airgap loses._                                                              | Norman + Jobs | Comparison content is how people build a mental model of _when to choose you._ Radical honesty converts better than spin and is the only sustainable version. |
| M2.3 | **The founder's essay:** "Why I stopped sending my work to someone else's server." Long-form, published on the project site, then X thread + HN.                                                   | Naval         | Media is permissionless leverage. The founder's regulated-industry context is specific knowledge nobody else can write. _Learn to sell._                      |
| M2.4 | **Land #43 (themes) and #44 (templates).** Dark mode first.                                                                                                                                        | Jobs + Norman | Dark mode isn't a feature in a dev tool — it's whether developers take you seriously. Templates scaffold the Gulf of Execution for new users.                 |
| M2.5 | **Land #14 (PWA notifications)** and #21 (TTS polish).                                                                                                                                             | Sam           | Long-running agents need to notify. Completing the loop turns a demo into a daily tool.                                                                       |
| M2.6 | **Ilya's primitive, v1: shareable tool manifests.** Promote the existing custom-tools feature into a one-file JSON manifest, plus a `tools/` directory of community-contributed manifests in-repo. | Ilya          | Stop hand-authoring capabilities. Make adding one a single file — then the surface grows without the core growing.                                            |
| M2.7 | **Public eval harness.** Reproducible tool-calling benchmark across Mistral-Small, GPT-4o-mini, and Qwen2.5-7B (via Ollama). Publish the table.                                                    | Ilya          | Without evaluation you're guessing. And the table itself becomes a citable artifact that earns links from other people's writing.                             |
| M2.8 | **Contributor funnel:** `good first issue` on ≥10 issues, a "Your first tool in 30 minutes" guide, and `docs/ARCHITECTURE.md` with decision records.                                               | Sam           | Contributors are your first thousand evangelists — they have equity in the outcome.                                                                           |
| M2.9 | **Release cadence: one note-worthy release every three weeks.**                                                                                                                                    | Sam           | Momentum is a channel. A repo with a recent commit converts visitors; a stale one doesn't.                                                                    |

**Exit criteria:** 1,000 stars · ≥20 contributors · ≥5 third-party blog or video mentions ·
eval table published · ≥8 documented integrations · ten interviewed users who'd be
devastated to lose it.

---

## Phase 3 — The Ecosystem

**Months 6–18 · Gate 10K → 50K stars · Led by Ilya + Sam + Thiel**

> **Ilya:** "Build the thing that makes the next hundred things cheap."
> **Thiel:** "Every monopoly is a small market owned completely."

| #    | Milestone                                                                                                                    | Owner voice | Rationale                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3.1 | **Tool registry v2:** signed manifests, install-by-URL, a dedicated community registry repo.                                 | Ilya + Sam  | This is the compounding engine. Every tool author becomes a distribution node with a reason to link back.                                                  |
| M3.2 | **#11 Multi-model side-by-side.**                                                                                            | Ilya        | Now justified — it converts the static eval table into a live, interactive product and makes evaluation visible to the user.                               |
| M3.3 | **#42 Advanced memory — reframed.** Ship the **memory inspector** (see, edit, export, expire) _before_ importance scoring.   | Norman      | The user must be able to see and correct what the system believes. Scoring without visibility is a black box.                                              |
| M3.4 | **Move off localStorage to IndexedDB + OPFS,** with encrypted export/import.                                                 | Naval       | Sovereignty is the promise. A 5 MB ceiling and "clearing site data loses everything" break the promise at exactly the moment someone starts relying on it. |
| M3.5 | **i18n the README** — zh, ja, de, es, fr, pt-BR.                                                                             | Sam         | Translation is the cheapest star multiplier in open source, and non-English devs are heavily overrepresented in self-hosting.                              |
| M3.6 | **Own the phrase "zero-backend agent."** A category page defining it, with airgap as the reference implementation.           | Thiel       | Name the category you're the monopoly of. If you don't name it, someone else will and you'll be a competitor in it instead of the owner.                   |
| M3.7 | **Promote the local engine to first-class.** Default on the hosted demo; expand `LOCAL_TOOLS` beyond today's 6-of-27 subset. | Ilya        | On-device is the generalization; remote API is the special case. The roadmap should reflect that, not the reverse.                                         |

**Exit criteria:** 10,000 stars · ≥50 contributors · ≥1,000 community tool installs ·
README in ≥6 languages · memory inspector shipped.

---

## Phase 4 — Infrastructure

**Months 18–36 · Gate 50K → 100K stars · Led by Thiel + Naval**

> **Thiel:** "Durability is the last mover advantage."
> **Naval:** "Play long-term games with long-term people."

| #    | Milestone                                                                                                                                         | Owner voice   | Rationale                                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4.1 | **Get recommended by others:** appear in Ollama, Mistral, and Open WebUI docs; awesome-selfhosted; provider quickstarts.                          | Thiel         | Endorsement distribution beats advertising distribution and it compounds for free.                                                                         |
| M4.2 | **Regulated-industry proof:** publish an architecture + threat-model document; land 2–3 named reference deployments (fintech, healthcare, legal). | Naval + Thiel | This is the durable moat. Anyone can clone the code; nobody can clone a compliance story or a reference customer.                                          |
| M4.3 | **Governance:** steering committee or foundation-lite so the project outlives the founder's attention.                                            | Thiel         | Last-mover advantage requires the entity to still exist.                                                                                                   |
| M4.4 | **Catch the next wave** with the zero-backend version of it — on-device multimodality, agent-to-agent protocols, whatever follows.                | Sam           | Waves carry you further than effort. Be early to the next one while the current one still carries you.                                                     |
| M4.5 | **Publish and enforce the "No" list permanently.**                                                                                                | Jobs          | Deciding what not to do is as important as deciding what to do — and it's the only defense against the thousand good ideas that will arrive with traction. |

**Exit criteria:** 50,000 → 100,000 stars. See honest odds below.

---

## 5. Cross-Cutting Ownership Matrix

| Area                     | Phase 0                        | Phase 1                          | Phase 2                                          | Phase 3                             | Phase 4                               | Owner voice   | Success measure                           |
| ------------------------ | ------------------------------ | -------------------------------- | ------------------------------------------------ | ----------------------------------- | ------------------------------------- | ------------- | ----------------------------------------- |
| **Developer experience** | Push, CI green, branch hygiene | Onboarding, undo, visible state  | "First tool in 30 min" guide, `good first issue` | Tool SDK, registry, IndexedDB       | Governance, contribution ladder       | Norman + Ilya | PR merge time < 3 days; ≥20 contributors  |
| **Documentation**        | CHANGELOG → v1.1.0             | Demo video, conceptual-model fix | Comparison pages, integration grid, eval table   | Architecture decision records, i18n | Threat model, reference architectures | Norman + Ilya | Time-to-first-magic ≤ 60s                 |
| **Community**            | Close stale issues             | Ten user interviews              | Contributor funnel, release cadence              | Community registry, tutorials       | Steering committee                    | Sam + Naval   | ≥50 contributors; ≥5 third-party mentions |
| **Feature priorities**   | #54 key obfuscation            | Zero-key engine, #69 demo        | #43 themes, #44 templates, #14, #21              | #11 multi-model, #42 memory         | Governance, next-wave                 | Jobs + Ilya   | Every feature traceable to an issue       |
| **Branding**             | Tidy repo, v1.1.0              | 30s demo, hero rewrite           | Founder essay, "Works with" grid                 | Category page                       | Reference deployments                 | Jobs + Naval  | Unaided recall of the one-liner           |
| **Positioning**          | Ship the secret                | "No server to leak to"           | Own "zero-backend agent"                         | Category definition                 | Infrastructure status                 | Thiel         | Named in comparisons by others            |

---

## 6. The "No" List

Committed in public, so it can be held against us:

- **No backend, no hosted inference, no accounts.** It breaks the promise — the only asset.
- **No telemetry, ever.** Measure in-lab and by self-reported signal. A privacy tool that
  tracks users is a contradiction, and the community will find it.
- **No Electron or native wrapper before 10K stars.** Focus; the web's zero-install is the leverage.
- **No mobile app before 25K stars.**
- **No feature parity with ChatGPT/Cline/Continue.** That's their war, and we'd lose it.
- **No paid tier before 10K stars.** It splits the community and slows adoption exactly when velocity matters.
- **No "AI agent framework" positioning.** LangChain owns that frame at 146K stars.
- **No growth hacking.** No star-for-star, no pods, no inflated numbers.
  _Naval: reputation is the only asset here; don't spend it._

---

## 7. Metrics That Actually Matter

**Weekly:** time-to-first-magic (lab-measured) · demo → local-engine conversion · new
contributors · issues closed · referral sources for new stars · PR merge latency.

**Quarterly:** stars · retention proxy (self-reported return usage via Discussions poll,
_not_ tracking) · third-party mentions · tool-registry installs.

**Explicitly not a KPI:** raw star count, watched weekly.

---

## 8. Honest Odds

| Milestone     | Timeline  | Probability | Requires                                     |
| ------------- | --------- | ----------- | -------------------------------------------- |
| 100 stars     | 90 days   | ~70%        | Ship `main` and fix the first run            |
| 1,000 stars   | 12 months | ~50%        | One breakout moment + the zero-key demo      |
| 10,000 stars  | 24 months | ~20%        | Ecosystem + repeated launches + contributors |
| 100,000 stars | 36 months | ~5–10%      | A **wave**, not just a plan                  |

No plan reaches 100K by itself. Every project on the benchmark list that got there either
rode a wave (AutoGPT, Ollama) or compounded for six years (n8n). A plan increases the odds
of being positioned to catch the wave; it cannot create the wave.

> **Naval, closing:** "If you need the 100K to be happy, you've already lost the three
> years. Build the thing that deserves it. The number is a receipt, not a goal."

---

## 9. The Next Five Actions — This Week

1. ~~**`git push origin main`** — ship the 97 parked commits.~~ **Done** 2026-09-12 08:42Z.
   The tracker went 16 → 10 open issues by itself.
2. ~~**Close #66–#73.**~~ **Done** — step 1 closed them; no manual action was needed.
3. **Push the four remaining local commits** (M0.5, M1.1, M1.6 and this doc), then tag
   **v1.1.0** with the CHANGELOG `[Unreleased]` block promoted.
4. **Redeploy the GitHub Pages demo from `main`** and verify it serves the current build —
   it should now pick up the new zero-key start screen.
5. **Record the 30-second demo (#69)** and place it above the fold in the README.
6. **Archive the ~24 stale branches** (M0.6). Not started — deleting branches is
   destructive and `wip/online-enhancement-cache-queue` still holds unmerged work.

Everything else in this roadmap is downstream of item 1.

### Phase 0 work completed locally (unpushed)

- **M0.3** — audited the issue-closing convention across all 97 commit bodies; no defect
  found, so no fix was scheduled. Corrected the earlier assumption in this document.
- **M0.5 (#54)** — API keys are now obfuscated at rest in localStorage (`obf1:` prefix)
  via `obfuscateSecret` / `deobfuscateSecret` in `js/utils.js`, applied in `saveSettings()`
  and unwrapped in `init()`. Legacy plaintext values pass through untouched and are
  re-saved obfuscated, so no migration step is needed. Five tests added.
- **M0.7** — `ci.yml` already runs `npm run lint` and `npm test` on `main` and every PR.
  Verified rather than changed; no work scheduled.
- **M1.2** — added opt-in, local-only timing (`?perf=1` or `airgap_perf=1`): marks
  `init-start`, `ui-ready`, `send`, `response-complete`, surfaced via `perfReport()`. No
  network, no storage write, no telemetry. `tests/perf.spec.js` asserts budgets so
  regressions fail CI. **Baseline measured in-lab (mocked CDN + instant provider):** init
  → UI ready **128 ms**, send → first response **102 ms**, page load → first response
  **1147 ms**. The app's own overhead is negligible; the remaining time-to-first-magic is
  page load plus provider latency, so that is where the leverage is — not in this code.
- **M1.6** — positioning now leads with the secret: "The only AI agent with no server to
  leak to" appears above the fold in the README and as the start-screen headline.
- **M1.1** — the start screen now leads with **Run in your browser** (no key needed) and
  puts bring-your-own-key behind a divider, so the demo no longer asks for a key up front.
  Added `localEngineSupported()`; the local option is hidden on `file://`, where the
  ES-module engine cannot load, so an affordance that cannot work is never offered.
  README quick start and CHANGELOG updated; two tests added.

Suite: **177 passing**.

---

_Committee: Naval Ravikant · Steve Jobs · Don Norman · Sam Altman · Ilya Sutskever ·
Peter Thiel. Perspectives synthesized from their published positions; this document is an
exercise in applied thinking, not a record of their actual advice or endorsement._
