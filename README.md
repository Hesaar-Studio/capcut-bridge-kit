PHASE 4B — AI EDITING CONTRACT
CAPCUT BRIDGE KIT

Repository:
Hesaar-Studio/capcut-bridge-kit

============================================================
0. CURRENT PROJECT STATE — ALREADY IMPLEMENTED
============================================================

IMPORTANT:

This repository is NOT an empty project.

Several phases have ALREADY been implemented and tested.

DO NOT rebuild them.

DO NOT replace them.

DO NOT duplicate their functionality.

DO NOT rewrite existing architecture merely to implement Phase 4B.

Phase 4B must build ON TOP of the existing implementation.

The current project direction is:

AI
  ↓
CapCut Bridge Kit
  ↓
CapCut Desktop

The Bridge is an execution/integration layer.

It is NOT an autonomous AI video editor.

============================================================
1. PROJECT PURPOSE
============================================================

CapCut Bridge Kit exists to connect external AI systems to
CapCut Desktop.

Potential AI clients include:

- ChatGPT
- Claude
- Gravity / Antigravity
- Gemini
- future AI systems
- other MCP/API-compatible agents

The external AI is the:

DIRECTOR / DECISION MAKER

The Bridge is the:

EXECUTION + INTEGRATION LAYER

CapCut Desktop is the:

EDITING RUNTIME

The external AI should:

- understand the user's natural-language request
- reason about the task
- inspect the available project information
- decide what should happen
- decide which tools to call
- create editing plans
- decide whether confirmation is needed
- request execution

The Bridge should:

- expose capabilities
- inspect projects
- expose structured analysis
- validate structured commands
- route commands
- execute supported operations
- protect project files
- create backups
- validate changes
- verify results
- return structured execution receipts

The Bridge must NOT become another autonomous AI.

============================================================
2. ALREADY IMPLEMENTED — PHASE 2
============================================================

Phase 2 — Draft Engine has already been implemented.

The following package already exists:

draft_engine/

with:

draft_engine/__init__.py
draft_engine/models.py
draft_engine/validator.py
draft_engine/backup.py
draft_engine/reader.py
draft_engine/writer.py

Tests already exist:

tests/test_draft_engine.py

Phase 2 implementation includes:

- TimeRange
- VideoMaterial
- AudioMaterial
- TextMaterial
- Segment
- Track
- DraftProject
- serialization/deserialization
- project validation
- backup handling
- staged writes
- atomic replacement
- overwrite protection
- cache cleanup
- null timerange repair
- safe project writing

The Draft Engine uses standard Python functionality and existing
project structures.

IMPORTANT:

Do NOT rewrite Draft Engine.

Do NOT replace its models.

Do NOT create a second project model system.

Reuse it from Phase 4B where appropriate.

============================================================
3. PHASE 2 SAFETY MODEL
============================================================

The existing Draft Engine already follows a safety-oriented model.

The important behavior includes:

- staging before write
- validation
- backup before destructive changes
- atomic rename/replacement
- explicit overwrite confirmation
- cleanup of temporary/cache artifacts
- project integrity validation

Phase 4B must preserve this safety model.

A future mutating AI command MUST NOT bypass these protections.

============================================================
4. ALREADY IMPLEMENTED — PHASE 3A
============================================================

Phase 3A — Smart Editing Read-Only has already been implemented.

The following package already exists:

smart_editing/

with:

smart_editing/__init__.py
smart_editing/models.py
smart_editing/pause_detection.py
smart_editing/duplicate_detection.py
smart_editing/subtitle_ops.py
smart_editing/edit_planner.py

Tests already exist:

tests/test_smart_editing.py

Phase 3A contains:

- SubtitleItem
- SubtitleGap
- DuplicateCategory
- DuplicateCandidate
- EditAction
- PlanItem
- EditPlan

The duplicate categories include:

- EXACT_DUPLICATE
- HIGH_SIMILARITY
- POSSIBLE_DUPLICATE

Existing analysis includes:

- subtitle/timeline gap detection
- duplicate candidate detection
- subtitle extraction
- subtitle merging
- subtitle splitting
- subtitle timing adjustment
- EditPlan generation
- EditPlan validation

============================================================
5. IMPORTANT LIMITATION OF PHASE 3A
============================================================

Phase 3A is READ-ONLY ANALYSIS.

It is NOT an autonomous AI editor.

This distinction is fundamental.

The current Smart Editing layer does NOT decide:

- whether a clip should actually be removed
- whether a pause is creatively undesirable
- which duplicate should be selected
- how the final video should feel
- what editing style the user wants

It provides structured evidence to an external AI.

For example:

Bridge analysis may report:

"Subtitle gap = 2.5 seconds"

The external AI decides whether that gap should be removed.

The Bridge does NOT independently decide that.

============================================================
6. PHASE 3A PAUSE DETECTION LIMITATION
============================================================

Existing pause detection is based on subtitle/timeline gaps.

It does NOT claim to perform acoustic silence detection.

Do NOT change the meaning of this capability.

Do NOT describe it as:

"audio silence detection"

unless an actual audio-analysis implementation exists.

Current conceptual meaning:

subtitle/timeline gap analysis.

============================================================
7. PHASE 3A DUPLICATE DETECTION LIMITATION
============================================================

Existing duplicate detection is text-based.

It uses text similarity analysis.

It does NOT claim:

- visual duplicate detection
- acoustic duplicate detection
- semantic video understanding
- speaker recognition
- facial recognition

Do not advertise capabilities that do not exist.

============================================================
8. EXISTING SMART EDITING PARAMETERS
============================================================

Existing Phase 3A behavior includes approximately:

Gap analysis:

default minimum gap:

1.0 second

Duplicate detection:

sliding window:

60 seconds

Similarity thresholds include:

exact:
1.0

high similarity:
> 0.85

possible similarity:
> 0.70

Do NOT arbitrarily change these values in Phase 4B.

============================================================
9. PHASE 3A DESIGN DECISION
============================================================

The current architecture deliberately separates:

ANALYSIS

from:

DECISION

from:

EXECUTION

The correct model is:

User
 ↓
External AI
 ↓
Bridge analysis tools
 ↓
Analysis result
 ↓
External AI makes decision
 ↓
EditPlan
 ↓
Bridge validates plan
 ↓
Bridge executes only supported operations
 ↓
CapCut

Do NOT collapse these layers.

============================================================
10. ALREADY EXISTING BRIDGE LANES
============================================================

The project already contains Bridge functionality including:

Windows File Lane

and

Live Lane

The Windows bridge implementation includes functionality such as:

- CapCut binary discovery
- CapCut process detection
- CapCut launch
- CapCut quit
- draft reading
- draft writing
- sandbox footage creation
- null timerange repair
- replay handling
- text insertion
- live launch
- live quit
- live play
- live split
- live export
- live shot

Existing code includes:

capcut-bridge-win.py

Do NOT rewrite this file for Phase 4B.

============================================================
11. EXISTING SAFETY LIMITATION
============================================================

The existing live export implementation does NOT necessarily
verify that export completion/output-file creation has occurred.

Do NOT falsely report export verification.

Phase 4B must preserve the distinction between:

requested

started

completed

verified

These are not interchangeable.

============================================================
12. EXISTING PROJECT TEST STATUS
============================================================

Previous phases already had successful tests.

Phase 2 introduced:

9 dedicated Draft Engine tests.

The broader Python suite previously reached:

18 tests.

Phase 3A added:

11 dedicated Smart Editing tests.

The broader Python suite previously reached:

29 tests.

The existing Node test also passed:

tests/rate_limit.test.mjs

IMPORTANT:

These tests are primarily unit/mock-level tests.

They do NOT prove complete live CapCut Desktop integration.

Do not claim that the entire system is production-verified
against every CapCut Desktop version.

============================================================
13. CURRENT ARCHITECTURAL PRINCIPLE
============================================================

The Bridge is NOT supposed to perform all editing decisions.

The Bridge is the execution arm of AI.

Correct:

AI
 ↓
Bridge analysis
 ↓
AI decision
 ↓
Bridge execution
 ↓
CapCut

Incorrect:

User
 ↓
Bridge's own AI
 ↓
Bridge independently decides everything
 ↓
CapCut

Do NOT introduce an autonomous editing brain.

============================================================
14. THREE-WAY FUTURE ARCHITECTURE
============================================================

The architecture may eventually support:

External AI
      ↕
CapCut Bridge
      ↕
CapCut Desktop
      ↕
CapCut-native AI capabilities

However:

DO NOT assume CapCut exposes a controllable external AI API.

Do NOT invent one.

CapCut AI should only be integrated if a real supported interface
is verified.

============================================================
15. PHASE 4A — ALREADY DESIGNED
============================================================

Phase 4A established the conceptual AI Editing Contract.

The planned files are:

ai_contract/__init__.py
ai_contract/capabilities.py
ai_contract/schemas.py
ai_contract/receipt.py
ai_contract/dispatcher.py

and:

tests/test_ai_contract.py

The Phase 4A design was reviewed and approved.

Phase 4B is now the implementation phase.

============================================================
16. PHASE 4B OBJECTIVE
============================================================

Implement the provider-neutral AI Editing Contract.

The contract must become the common interface between:

ChatGPT
Claude
Gravity
Gemini
future AI clients

and:

CapCut Bridge Kit

The same contract must work regardless of the AI provider.

============================================================
17. CORE CAPABILITY CATALOG
============================================================

The conceptual capability/tool catalog is:

1. get_capabilities

2. inspect_project

3. inspect_timeline

4. inspect_media

5. inspect_subtitles

6. analyze_gaps

7. analyze_duplicates

8. create_edit_plan

9. validate_edit_plan

10. preview_edit_plan

11. execute_edit_plan

12. verify_execution

13. get_execution_receipt

These are conceptual contract operations.

Inspect the repository first.

If an existing implementation requires a different naming or
structure, adapt carefully and document the reason.

Do not create fake capabilities.

============================================================
18. CAPABILITY REGISTRY
============================================================

Implement:

ai_contract/capabilities.py

The registry must expose the ACTUAL capabilities available in
the current runtime.

Possible states include:

- available
- unavailable
- experimental
- read_only
- requires_confirmation
- requires_live_capcut

Only use states that make sense for the actual implementation.

The registry must be:

- deterministic
- typed
- JSON serializable
- provider-neutral

Example conceptual response:

{
  "protocol_version": "1.x",
  "bridge_version": "...",
  "capabilities": [
    {
      "name": "inspect_project",
      "available": true,
      "read_only": true
    }
  ]
}

This is conceptual.

Do not invent version numbers.

============================================================
19. SCHEMAS
============================================================

Implement:

ai_contract/schemas.py

The schema layer should clearly distinguish:

- request
- response
- capability
- analysis result
- EditPlan
- validation result
- execution request
- execution result
- error result

All structures must be:

- typed
- deterministic
- JSON serializable

Do not create one giant generic dictionary for everything.

============================================================
20. EXISTING MODEL REUSE
============================================================

Where possible, reuse:

Draft Engine models

and:

Smart Editing models

especially:

- DraftProject
- Track
- Segment
- TextMaterial
- SubtitleItem
- SubtitleGap
- DuplicateCandidate
- EditPlan
- PlanItem

Do NOT duplicate these into completely unrelated parallel models
unless an adapter is genuinely required.

============================================================
21. PERSIAN / FARSI IS FIRST-CLASS
============================================================

Persian/Farsi support is REQUIRED.

The contract must support full Unicode/UTF-8.

Human-facing data may be Persian.

This includes:

- prompts
- project names
- media names
- subtitles
- descriptions
- EditPlan descriptions
- warnings
- errors
- receipts
- reports
- user-facing messages

Example user prompt:

"مکث‌های طولانی این ویدیو را پیدا کن و برای حذف آماده کن"

The external AI interprets this.

The Bridge receives structured data such as:

{
  "operation": "analyze_gaps",
  "parameters": {
    "min_gap_sec": 1.0
  }
}

Machine identifiers remain English.

Human content may remain Persian.

Do NOT create separate Persian API endpoints.

Do NOT transliterate Persian.

Do NOT strip Unicode.

Do NOT convert Persian to ASCII.

============================================================
22. PERSIAN TEST REQUIREMENTS
============================================================

tests/test_ai_contract.py

MUST include tests for:

- Persian project name
- Persian subtitle
- Persian EditPlan description
- Persian warning
- Persian error
- JSON serialization/deserialization
- Unicode round-trip

Use real Persian strings.

Example:

"پروژه آموزشی روانشناسی"

"این یک زیرنویس فارسی برای آزمایش است."

"مکث طولانی شناسایی شد."

============================================================
23. NATURAL LANGUAGE IS NOT THE BRIDGE'S JOB
============================================================

The Bridge does NOT need an LLM.

Do NOT add:

- OpenAI SDK
- Anthropic SDK
- Gemini SDK
- LLM inference
- NLP model

to interpret user prompts.

The external AI performs natural-language understanding.

Bridge receives structured requests.

Correct separation:

Natural Language Understanding
=
External AI

Structured Contract
=
Bridge

Execution
=
Bridge / CapCut

============================================================
24. DISPATCHER
============================================================

Implement:

ai_contract/dispatcher.py

The dispatcher is ONLY a routing/contract layer.

It must:

1. receive structured request
2. validate request
3. identify operation
4. check capability
5. route supported operation
6. reject unsupported operation
7. return structured result/error

It must NOT:

- make creative decisions
- invent edits
- call an LLM
- choose which footage is better
- decide which duplicate should be removed
- bypass security
- bypass backup
- bypass validation
- bypass confirmation
- bypass verification

============================================================
25. READ-ONLY OPERATIONS FIRST
============================================================

The first genuinely usable Phase 4B operations should be read-only.

Integrate existing:

Draft Engine

and:

Smart Editing

functionality.

Potential read-only operations:

- inspect_project
- inspect_timeline
- inspect_media
- inspect_subtitles
- analyze_gaps
- analyze_duplicates
- create_edit_plan
- validate_edit_plan
- preview_edit_plan

Do not create duplicate algorithms.

============================================================
26. MUTATION SAFETY
============================================================

Do NOT implement destructive execution merely because:

execute_edit_plan

exists in the schema.

The contract may define the operation while the capability reports:

unavailable

until a verified safe implementation exists.

Never fake execution.

Never return:

"success"

unless the requested operation actually occurred.

Never return:

"verified"

unless verification actually occurred.

============================================================
27. EXECUTION RECEIPT
============================================================

Implement:

ai_contract/receipt.py

ExecutionReceipt should support appropriate fields such as:

- execution_id
- project_name
- requested_operation
- actions
- status
- applied
- validation
- verification
- backup
- warnings
- errors

Possible statuses:

- planned
- awaiting_confirmation
- executing
- verified
- failed
- rolled_back
- unsupported

Only use states appropriate to actual behavior.

============================================================
28. PROVIDER NEUTRALITY
============================================================

The contract must not contain logic like:

if provider == "chatgpt"

or:

if provider == "claude"

or:

if provider == "gemini"

or:

if provider == "gravity"

Do not create provider-specific branches.

============================================================
29. MCP
============================================================

DO NOT rewrite MCP in Phase 4B.

Future architecture:

AI
 ↓
MCP
 ↓
AI Editing Contract
 ↓
Bridge

MCP should eventually be an adapter over the contract.

Do not create a second incompatible schema system.

============================================================
30. REST
============================================================

DO NOT rewrite REST in Phase 4B.

Future architecture:

AI / Client
 ↓
REST
 ↓
AI Editing Contract
 ↓
Bridge

============================================================
31. EXISTING MCP/REST FILES
============================================================

Existing files include potentially:

bridge_system/bridge_server.py

chatgpt-capcut-server.py

chatgpt-functions-schema.json

chatgpt-openapi-spec.json

Inspect them.

Do not modify them unless absolutely necessary.

If modification is genuinely required:

STOP BEFORE MODIFYING.

Report:

- file
- reason
- exact required change
- compatibility impact

============================================================
32. CAPCUT AI
============================================================

Do NOT assume external CapCut AI API access.

Do NOT invent APIs.

Do NOT create fake tools.

The architecture may later support a CapCut AI adapter.

But only after a real interface is verified.

============================================================
33. SECURITY
============================================================

Preserve existing security.

Do not:

- expose bridge publicly
- weaken localhost restrictions
- weaken CORS
- add hardcoded secrets
- bypass path validation
- bypass project protection
- bypass backups
- bypass validation

============================================================
34. NO UI WORK
============================================================

Do NOT modify:

- Control Panel
- frontend
- UI
- design
- branding
- README

Phase 4B is backend contract architecture.

============================================================
35. NO LIVE AUTOMATION CHANGES
============================================================

Do NOT modify:

- Windows Live Lane
- pyautogui workflows
- Win32 automation
- macOS automation

unless absolutely required for contract compatibility.

============================================================
36. TESTING
============================================================

Create:

tests/test_ai_contract.py

Minimum coverage:

1. capability registry
2. capability serialization
3. capability states
4. request validation
5. response serialization
6. supported routing
7. unsupported routing
8. read-only routing
9. provider neutrality
10. ExecutionReceipt serialization
11. execution states
12. no fake success
13. mutation rejection when unsupported
14. no unintended mutation
15. Persian project name
16. Persian subtitle
17. Persian EditPlan
18. Persian warning/error
19. Unicode JSON round-trip
20. compatibility with existing EditPlan

Then run:

python -m unittest discover -s tests -p "test_*.py"

Also run:

tests/rate_limit.test.mjs

All previous tests must continue to pass.

============================================================
37. REGRESSION PROTECTION
============================================================

Phase 4B must not break:

- Draft Engine
- Smart Editing
- Windows File Lane
- Windows Live Lane
- existing bridge
- existing plugin
- existing MCP
- existing REST
- security behavior

If a regression occurs:

STOP.

Do not silently repair unrelated architecture.

============================================================
38. FILES TO CREATE
============================================================

Create:

ai_contract/__init__.py
ai_contract/capabilities.py
ai_contract/schemas.py
ai_contract/receipt.py
ai_contract/dispatcher.py
tests/test_ai_contract.py

============================================================
39. FILES NOT TO MODIFY BY DEFAULT
============================================================

Do not modify unless absolutely necessary:

capcut-bridge-win.py
capcut-bridge.py
capcut-plugin-win.py
chatgpt-capcut-server.py
bridge_system/bridge_server.py
chatgpt-functions-schema.json
chatgpt-openapi-spec.json
README.md
frontend
Control Panel
existing tests
configuration

============================================================
40. GIT SAFETY
============================================================

The repository already exists.

DO NOT:

- git init
- git reset
- force push
- rewrite history
- delete branches
- commit
- push

Do not modify Git history.

============================================================
41. NO FAKE CAPABILITIES
============================================================

This rule is critical.

The schema may describe future capabilities.

But the runtime must distinguish:

DEFINED

from:

IMPLEMENTED

from:

AVAILABLE

from:

VERIFIED

Example:

execute_edit_plan

may exist in the contract.

But if safe execution is not implemented:

available = false

Do not pretend it works.

============================================================
42. NO FAKE VERIFICATION
============================================================

Never say:

"execution verified"

unless the Bridge actually inspected the resulting state.

Never say:

"export completed"

unless completion is actually known.

Never say:

"edit applied"

unless the mutation actually happened.

============================================================
43. PHASE 4B SUCCESS CRITERIA
============================================================

Phase 4B is successful if:

- ai_contract exists
- capability registry works
- schemas are typed and serializable
- dispatcher routes safely
- existing Draft Engine is reused
- existing Smart Editing is reused
- Persian/Unicode works correctly
- unsupported operations are explicitly rejected
- no fake success exists
- no autonomous AI was added
- no provider-specific logic exists
- existing tests still pass
- new AI Contract tests pass
- no existing functionality is unnecessarily rewritten

============================================================
44. FINAL REPORT
============================================================

After implementation, STOP.

Do NOT continue to Phase 5.

Do NOT implement:

- MCP V2
- REST V2
- Control Panel integration
- destructive editing
- CapCut AI integration
- external AI SDKs
- autonomous AI editing

Report exactly:

1. files created
2. files modified
3. existing files preserved
4. final capability registry
5. final tool catalog
6. schema summary
7. dispatcher behavior
8. ExecutionReceipt states
9. Persian/Unicode support
10. Phase 2 integration
11. Phase 3A integration
12. tests executed
13. previous test count
14. new test count
15. total test count
16. regression results
17. currently available capabilities
18. currently unavailable capabilities
19. security status
20. known limitations
21. files requiring future integration
22. whether any existing code had to be changed and why

Then STOP.

NO COMMIT.

NO PUSH.

NO AUTOMATIC NEXT PHASE.
