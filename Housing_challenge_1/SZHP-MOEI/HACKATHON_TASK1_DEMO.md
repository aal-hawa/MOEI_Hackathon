# Task 1 Demo Playbook - AI Agent for Housing Arrears Rescheduling

## One-Line Pitch

This is an MOEI Finance and Collection decision agent that turns a five-working-day arrears rescheduling review into an instant, governed, explainable officer service.

## The Wow Moment

Do not pitch this as a dashboard. Pitch it as a **government decision room in software**.

The differentiator is the **MOEI Decision Twin**:

- It does not only say "approve" or "escalate".
- It shows the current decision path.
- It identifies the exact blockers.
- It calculates the route to a compliant outcome.
- It gives the officer the next best action.
- It explains the value differently for judges, academics, citizens/students, and MOEI employees.

Say this line:

"Most teams built a chatbot or a dashboard. We built a decision twin for MOEI: a governed AI employee that can explain the decision, simulate the path to compliance, and hand officers an audit-ready case file."

## Winning Narrative

The old process depends on officers manually checking applicant data, loan arrears, salary evidence, repayment capacity, policy limits, and exceptional circumstances. The agent now performs those checks immediately and gives officers a standardized recommendation:

1. Verify application completeness and supporting documents.
2. Retrieve applicant, loan, arrears, salary, family, and repayment data.
3. Evaluate financial capacity, debt burden, income-per-family-member, delay duration, and risk.
4. Enforce MOEI governance: 20% deduction cap, approved repayment period, and active-application validation.
5. Propose rescheduling amount, duration, monthly installment, and deduction rate.
6. Document the rationale and route high-risk, incomplete, duplicate, or rule-failing cases to an officer.

## Demo Flow

1. Open `http://localhost:3000/admin`.
2. Login with `admin@szhp.gov.ae` / `Admin@2024`.
3. The first screen is the Task 1 command board, not a generic dashboard.
4. Point to the proof strip:
   - Current SLA: `5 working days`
   - Agent SLA: `Instant`
   - Governance: `Unified rules`
   - Exceptions: `Human handoff`
5. Open an `AI Assessed` case to show the auto path, or an `Escalated` case to show human review.
6. In case detail, show the split officer layout:
   - Applicant profile and financial data on the left
   - AI assessment output on the right
   - Confidence gauge and decision path
   - Governance pass/fail checks
   - Recommended amount, duration, installment, and deduction rate
   - Rationale, risk factors, missing documents, and audit evidence
   - `Approve` and `Escalate to Officer` actions
7. Then show the wow layer:
   - **MOEI Decision Twin**
   - **Route To Green**
   - **Next Best Action**
   - **Public Value Intelligence**
   - Judge lens, academic lens, citizen/student lens, and MOEI employee lens

## Official Rule Coverage

| Official rule or requirement | Product proof |
| --- | --- |
| 20% deduction cap | `MOEI-20` check, prominent proposed deduction rate, fail routes to human review |
| Repayment period must not exceed approved remaining loan period | `DUR-001` check and recommended duration cap |
| Existing active request validation | `ACTIVE-001` check detects duplicate active rescheduling applications |
| Salary certificate required | Document completeness check requires `salary_certificate` |
| Detailed salary or income statement required | Document completeness accepts `income_statement`, `detailed_salary_statement`, or `bank_statement` |
| Supporting documents required for circumstances | Medical and hardship categories add reason-specific document requirements |
| Financial situation analysis | Income, family size, income per member, arrears, delay days, DBR, payment risk |
| Recommendation paths | Approve, conditionally approve, request documents, refer to officer, reject |
| Human review for exceptional or high-risk cases | `escalated` status plus human-review reason and audit log |

## Rubric Map

| Rubric category | Points | How to present it |
| --- | ---: | --- |
| Agentic Decision Intelligence | 25 | The agent retrieves data, validates eligibility, analyzes arrears and financial capacity, chooses a recommendation, and writes rationale without waiting for an officer. |
| Policy Compliance and Governance | 25 | Show `MOEI-20`, `DUR-001`, `ACTIVE-001`, document checks, confidence, risk, and audit trail. |
| Technical Excellence and Data Integration | 20 | Highlight same-origin frontend/backend, UAE PASS login flow, loan/arrears/applicant tables, document upload and AI extraction hooks. |
| Impact on Service Transformation | 15 | Point to `5 working days -> Instant`, unified rules, reduced manual effort, consistency, and transparent routing. |
| Demo, Explainability, UX | 15 | Use the redesigned MOEI operations screen, confidence gauge, rationale panel, risk factors, and officer actions. |

## Judge Questions

**Why is this not a chatbot?**  
Because the agent performs the officer's assessment workflow: it checks data, applies rules, proposes financial terms, records rationale, and escalates exceptions.

**What is the innovation beyond automation?**  
The Decision Twin. It turns a case into an explainable, counterfactual decision model: what passed, what failed, what would make it compliant, and what the officer should do next.

**How do you avoid black-box decisions?**  
Every decision has pass/fail governance checks, numerical calculations, risk factors, confidence score, decision path, and written rationale.

**What happens if documents are missing?**  
The request becomes incomplete and is escalated or marked for document request. Missing salary or income evidence is shown in the case detail.

**What happens if the applicant already has an active request?**  
The `ACTIVE-001` governance check fails and the case is routed to human review.

**What is the measurable impact?**  
The review moves from a five-working-day manual process to an instant standardized assessment, while keeping human control over high-risk and exceptional cases.

## Final Pitch

"We built a governed AI decision agent for MOEI Finance and Collection. It instantly transforms a housing arrears request into an explainable recommendation: amount, duration, installment, 20% deduction compliance, active-request validation, document completeness, confidence, risk, rationale, and human-review routing. It gives officers speed without sacrificing control."
