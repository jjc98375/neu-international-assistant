# Corpus sources — 2026-07 research pass

Verified official Northeastern pages added to `northeastern_docs/` (saved via headless-Chrome
print-to-PDF on 2026-07-17). All URLs were live-checked at research time. Grouped by the five
runtime categories (see `CATEGORIES` in `ingest.py` for the folder→category mapping).

## Billing & Tuition (`billing` ← folders `Billing`, `Tuition&Fees`)

| Page | URL | Contains |
|---|---|---|
| Tuition and Fees 2025-2026 | studentfinance.northeastern.edu/billing-payments/tuition-and-fees/ | Graduate per-credit rates by college (Khoury MSCS $1,875/credit, CPS, Law, D'Amore-McKim, COE, Bouvé, CAMD) |
| Billing FAQ | studentfinance.northeastern.edu/billing-payments/billing-faq/ | E-bill posting schedule, due dates |
| Financing Options | studentfinance.northeastern.edu/billing-payments/financing-options/ | Monthly payment plan ($45/term, 2–5 installments) |
| Payment Methods | studentfinance.northeastern.edu/billing-payments/payment-methods/ | Flywire + CIBC international payment instructions |
| Billing Policies | studentfinance.northeastern.edu/policies-procedures/billing-policies/ | Late fees ($150 + 1%/month), account holds |
| NUSHP Effective Dates and Costs | studenthealthplan.northeastern.edu/effective-dates-costs/ | NUSHP 2026-27 rates (student/spouse/child) |

## Course Registration (`course`)

| Page | URL | Contains |
|---|---|---|
| Guidelines on Maintaining Status | international.northeastern.edu/ogs/current-students/understanding-visa-requirements/guidelines-on-maintaining-status/ | Full-time requirements: undergrad 12cr, grad 8–9cr, on-ground rules (cross-listed in Visa/) |
| Reduced Course Load | …/understanding-visa-requirements/reduced-course-load/ | RCL types (Academic/Medical/Final Term), 50% minimum, pre-authorization |
| Final Term | …/understanding-visa-requirements/final-term/ | Final-semester enrollment rules, Intent to Complete notice |
| Registration | registrar.northeastern.edu/group/registration/ | Time tickets, registration dates, add/drop, waitlists |
| Full-Time Status | catalog.northeastern.edu/graduate/professional-studies/academic-policies-procedures/full-time-status/ | Graduate credit-hour policy tied to F-1 requirement |
| Academic Calendars 2025-26 / 2026-27 | registrar.northeastern.edu/wp-content/uploads/sites/9/… | Dated add/drop deadlines (native PDFs) |

## Co-op & Employment (`employment`)

| Page | URL | Contains |
|---|---|---|
| Economic Hardship | international.northeastern.edu/ogs/employment/off-campus-employment/economic-hardship/ | F-1 hardship work auth: 1 yr enrollment, 20 hr/wk cap, USCIS filing |
| Volunteering | …/employment/other-topics/volunteering/ | Charitable volunteering vs unpaid internships (CPT required) |
| Co-op Information | careers.northeastern.edu/co-op-information/ | 4–8 month terms, GPA minimums, international-student authorization path |
| Tax Information | …/ogs/tax-information/ | Sprintax, Form 8843 / 1040NR, February access codes |
| SSN Instructions | …/ogs/wp-content/uploads/sites/2/2020/06/Social-Security-Number-Instructions.pdf | SSN timing rules (native PDF — HTML page is JS-rendered) |

## Scholarships (`scholarships`)

| Page | URL | Contains |
|---|---|---|
| International Students Aid | studentfinance.northeastern.edu/applying-for-aid/international-students/ | International Scholars Award (≤$28K/yr UG), grad merit, no need-based aid |
| Merit Scholarships | admissions.northeastern.edu/cost-financial-aid/merit-scholarships/ | Auto-considered UG merit $10–30K/yr, Ujima Global Leaders |
| Toronto Scholarships | toronto.northeastern.edu/admissions/scholarships/ | Canada Domestic & Excellence 25/50%, COE 25%, Career Advancement 50%, 50% stack cap |
| Vancouver Scholarships | vancouver.northeastern.edu/admissions/scholarships/ | Canada Excellence, COE MS 25%, CAMD Info Design 40% (intl-eligible) |
| Khoury Masters Scholarships | khoury.northeastern.edu/apply/masters-apply/financial-support-for-masters-students/scholarships-for-masters-students/ | WiCyS 25%, Double Husky 25%, CA campuses 15–25% by GPA |
| Graduate Funding Hub | graduate.northeastern.edu/admissions-aid/tuition-financial-aid/ | RA/TA assistantships, fellowships, doctoral funding |
| Graduate Assistantships | studentfinance.northeastern.edu/applying-for-aid/graduate/types-of-aid/graduate-assistantships/ | Stipend + tuition-remission mechanics |

## Visa & Immigration (`visa` ← folders `Visa`, `Arrival`, `forms`)

| Page | URL | Contains |
|---|---|---|
| International Travel | international.northeastern.edu/ogs/current-students/traveling/international-travel/ | Re-entry docs, travel signature, automatic visa revalidation |
| Renewing Your Visa | …/current-students/traveling/renewing-your-visa/ | Expired stamp while enrolled, home-country interviews |
| F-2 J-2 Dependents | …/new-students/i-20-ds-2019-application/dependents/ | Dependent I-20/DS-2019 (⚠ includes DHS rule eff. 2025-04-11: G-325R re-registration at age 14 — recheck ~2027-01) |
| Transferring Out | …/current-students/understanding-visa-requirements/transferring-out/ | SEVIS transfer to another school |
| Request for SEVIS I-20/DS-2019 | …/ogs/forms-and-guides/request-for-sevis-i-20-ds-2019/ | Replacing lost/damaged I-20 |
| Guidelines on Maintaining Status | (cross-listed from Course Registration) | Central F-1 responsibilities hub |

## Campus-specific documents — 2026-07-18 research pass

Saved into campus subfolders (`<Category>/<Campus>/…`); ingestion tags them via
`CAMPUS_FOLDERS` in `ingest.py` so retrieval can filter by `metadata.campus`.

### Canada (Toronto · Vancouver — study-permit system, not F-1)

| File (folder) | URL | Contains |
|---|---|---|
| Applying for a Study Permit (Visa/Canada) | international.northeastern.edu/ogs/student-support/global-campuses/canada/applying-for-a-study-permit/ | IRCC process, PAL, port-of-entry (⚠ notes 2026-04-01 IRCC co-op permit change) |
| Co-op Work Permit (Employment/Canada) | …/canada/co-op-work-permit/ | Canadian co-op work permit rules (⚠ may predate the 2026-04-01 IRCC change — recheck) |
| Post-Graduation Work Permit (Employment/Canada) | …/canada/post-graduation-work-permit/ | PGWP eligibility |
| Working While Studying (Employment/Canada) | …/canada/working-while-studying/ | On/off-campus hour limits in Canada |
| Health Insurance Canada (Billing/Canada) | …/canada/health-insurance/ | GuardMe/OHIP/MSP — Canada campuses do NOT use NUSHP |
| Tuition and Fees (Tuition&Fees/Vancouver) | vancouver.northeastern.edu/tuition-and-fees/ | Vancouver CAD tuition (no Toronto equivalent exists — program pages only) |
| Immigration Instructions Toronto / Vancouver (Visa/Toronto, Visa/Vancouver) | …/ogs/forms-and-guides/student-admissions-and-immigration-instructions-{toronto,vancouver}/ | Campus-specific admission/immigration steps |

### London (UK Student visa, GBP)

| File (folder) | URL | Contains |
|---|---|---|
| How to Get a UK Student Visa (Visa/London) | nulondon.ac.uk/admissions/visas/student-visa-application-process/how-to-get-a-student-visa/ | CAS, £3,000 deposit, CAS Shield |
| Enrolment for Visa Students (Visa/London) | nulondon.ac.uk/admissions/visas/enrolment-for-visa-students/ | Right-to-study checks, registration docs |
| UK Student Visa Work Rules (Employment/London) | nulondon.ac.uk/admissions/visas/work-rules/ | 20 hr/week term-time, no self-employment |
| Undergraduate / Postgraduate Fees (Tuition&Fees/London) | nulondon.ac.uk/admissions/…fees/ | Intl UG £23,857–£28,411/yr (2026/27); PG per programme |
| International Student Fees and Payment (Billing/London) | nulondon.ac.uk/admissions/international-students/international-student-fees/ | Payment plans via Quercus, deposits |
| Student Money Bursaries (Scholarships/London) | nulondon.ac.uk/student-life/student-money/ | NU London Bursary (home-only), Hardship Fund |
| Term Dates (Course Registration/London) | nulondon.ac.uk/term-dates/ | 2025-26 → 2027-28 term dates |

### US regional (Seattle · Silicon Valley · Oakland — share the F-1/OGS corpus)

| File (folder) | URL | Contains |
|---|---|---|
| New Students / Housing (Arrival/Seattle) | seattle.northeastern.edu/student-resources/new-students/, …/housing-in-seattle/ | Campus orientation, housing/cost-of-living |
| New Students / Relocating (Arrival/Silicon Valley) | siliconvalley.northeastern.edu/student-resources/… | Orientation incl. F-1 session, CA driver's license for F-1/F-2 |
| International Student Support (Arrival/Oakland) | oakland.northeastern.edu/student-life/student-support-services/international-student-support/ | ISA advising |
| Programs (Course Registration/Silicon Valley) | siliconvalley.northeastern.edu/programs/ | Program-to-campus mapping |
| MSCS Program and Scholarships (Scholarships/Oakland) | oakland.northeastern.edu/academics/graduate-education/master-of-science-in-computer-science/ | Campus tuition + scholarship notes |

## Research notes / dead ends

- OGS pages live under `international.northeastern.edu/ogs/…` (not `ogs.northeastern.edu`).
- `graduate.northeastern.edu/regional-campus-scholarship` → 404 (page moved/removed; the award is US-residents-only anyway).
- `coe.northeastern.edu` DNS-failed at research time; COE India/China/Africa merit scholarships confirmed only via search snippets — not ingested.
- GEM Fellowship excluded (US citizens/PRs only).
- Grace-period content (60-day post-completion) already covered by the existing OPT PDF; not duplicated.
- Campus pass (2026-07-18): `bayarea.northeastern.edu/scholarships2025/` is a hard 404 (appears in search results but dead). No Toronto tuition page exists (program pages only). Academic calendar is university-wide — nothing campus-specific to add. NU London has no dedicated international-merit-scholarship page (that content lives on the UG fees page).
