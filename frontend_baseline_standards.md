# Frontend Baseline Standards (wa-transcribe-2)

These notes are the source of truth for how frontend code should be built and reviewed in this project.

---

## 1) Project context and scope

This app is a local-first SvelteKit 5 workflow for:

1. audio input (upload or record)
2. transcription
3. correction and optional refinement
4. optional EN -> JA translation
5. export/copy

Current architecture assumptions:

- single-route UI flow
- SvelteKit frontend + Python backend (`/backend`)
- no auth or multi-user concerns in MVP
- predictable, debuggable state transitions over "smart" hidden behavior

---

## 2) Data ownership and async boundaries

Single source of truth:

- workflow/session state lives in a central pipeline store/controller
- child UI components are presentational and event-driven
- durable settings/state are persisted via a storage adapter (not ad hoc direct writes)

Where async work happens:

- service modules and orchestrator actions own async logic
- route/container triggers actions explicitly
- `$effect` is not used for primary data fetching or pipeline progression

Use `$effect` only for:

- DOM-only effects
- timers and subscriptions
- small client-only enhancements that do not own core data flow

---

## 3) Svelte 5 runes baseline

Correct usage:

- `$state` for mutable UI/session/form state
- `$derived` for computed view values
- `$effect` for imperative side effects only

Rules:

- do not use `$derived` just to wrap another reactive source
- async operations require cancellation or stale-result guards
- prevent late resolution from overwriting newer user actions

---

## 4) Component boundaries

Presentational component rules:

- no direct networking
- no model loading/transcription/refinement/translation calls
- no persistence side effects
- receive data + callbacks via props/events

Container/orchestrator responsibilities:

- step transitions
- invoking services
- loading/error state updates
- persistence triggers
- export/copy target selection logic

Keep each panel focused:

- `AudioInput`: input only
- `TranscriptPanel`: transcript viewing/editing
- `RefinementPanel`: correction/refinement controls + output
- `TranslationPanel`: translation controls + output
- `SaveBar`: copy/export/clear actions

---

## 5) Service layer contracts

Service interfaces should stay stable and explicit:

- `transcribeAudio(source, callbacks, signal) -> { text, chunks }`
- `applyCorrections(text, rules) -> { text, replacements, suggestions }`
- `refineTranscript(text, context, apiKey, signal) -> { text, chunksUsed }`
- `translateTranscript(text, signal) -> { text, chunksUsed }`
- `buildDiff(before, after) -> DiffSegment[]`

Rules:

- services are pure(ish) and reusable where practical
- services return typed, structured results (not UI-shaped strings only)
- no hidden global mutation from service code

---

## 6) State model and transitions

State model must be explicit and serializable.

Minimum recommended state:

- current step
- raw transcript
- corrected/refined transcript
- translated transcript
- correction rules
- processing states per stage
- errors per stage
- model readiness/loading metadata
- export target selection
- last-updated timestamps

Transition rules:

- actions are idempotent where possible
- each stage validates required input before running
- a failed stage never silently mutates downstream outputs
- clearing session is explicit and predictable

---

## 7) Error handling and observability

Baseline:

- never swallow errors
- show concise user-facing errors per stage
- keep enough debug detail in logs for diagnosis

For every async action:

- expose loading state
- expose success/failure state
- attach meaningful error context (stage + operation)

---

## 8) Performance and model loading posture

Principles:

- lazy-load heavy models when first needed
- show model/status progress where possible
- avoid duplicate in-flight work for the same stage

Controls:

- use cancellation (`AbortController`) for long-running actions
- reject stale results from older requests
- chunk long text where model/context limits require it

---

## 9) Persistence rules

Persistence should be intentional:

- store text outputs, correction rules, and user settings
- do not persist ephemeral UI noise unless it improves UX materially
- version storage schema to support safe migrations

Safety:

- writes are centralized (adapter/helpers), not scattered across components
- hydration is guarded against malformed data
- clear-session behavior is documented and test-covered

---

## 10) Accessibility and UX baseline

Minimum standards:

- keyboard-operable controls for every major action
- visible focus states
- semantic labels for inputs/buttons
- avoid duplicate screen reader announcements
- predictable Escape/close behavior for overlays/dialogs

UX consistency:

- clear "next action" affordances per step
- explicit empty/loading/error/success states
- copy/export actions always indicate which text target is selected

---

## 11) Testing baseline

Unit-test:

- correction normalization and matching
- chunking logic
- diff generation
- export formatting
- storage serialization/hydration

Integration-test:

- end-to-end step transitions with mocked services
- cancellation and stale-result guards
- error propagation per stage

Manual smoke tests:

- first model load and subsequent cached runs
- upload + recording flows
- long transcript behavior
- copy/export targets
- refresh restore

---

## 12) Patterns to avoid

Do not introduce:

- hidden pipeline progression in `$effect`
- business logic duplicated across multiple components
- network/model/persistence side effects inside presentational components
- async actions without cancellation or stale-write guards
- silent failures
- unbounded retries or duplicate concurrent requests
- state shape drift without updating tests and docs

---

## 13) Review checklist (PR or self-review)

- Is data ownership clear and centralized?
- Are async boundaries explicit and cancellable?
- Are child components presentational?
- Are errors surfaced to users and diagnosable in logs?
- Is persistence intentional, minimal, and safe?
- Are accessibility basics and loading/empty/error states covered?
- Are tests updated for changed behavior?

---

## 14) One rule that keeps the app healthy

Keep workflow state centralized, keep async logic explicit, and keep UI components mostly presentational.

If a change breaks one of those three, refactor before shipping.
These notes should serve as a source of truth for how to build frontend files going forward.
