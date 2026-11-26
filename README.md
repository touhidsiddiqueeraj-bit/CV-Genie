<div align="center">

# CV Genie

**A fast, private, offline-capable CV builder — 31 templates including Europass, a matching cover letter builder (deterministic + Gemini AI), a 7-category ATS engine with job-description matching, profile photos, and fully local PDF / DOCX / RTF / Markdown / TXT export. Installable as a PWA and as an Android APK built by CI.**

[![CI](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/ci.yml/badge.svg)](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/ci.yml)
[![Release](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/release.yml/badge.svg)](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/release.yml)
[![APK](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/apk.yml/badge.svg)](https://github.com/touhidsiddiqueeraj-bit/CV-Genie/actions/workflows/apk.yml)

[Live demo](https://touhidsiddiqueeraj-bit.github.io/CV-Genie/) · [Templates](#-templates) · [What's new](#-whats-new-in-v25) · [Documentation](#-documentation)

</div>

---

![CV Genie — app overview](docs/images/hero-light.png)

## ✦ Why CV Genie

- **Private by default** — everything runs in your browser. No accounts, no tracking, no export server: PDF, DOCX, every format is generated on your device (the only optional network calls are to Google's Gemini, with your own key, for AI features).
- **No paywall at the download button** — every template, every export format, the cover letter, the matcher: free, forever. Most builders let you build for free, then charge $25/month to export.
- **Zero friction** — no build step, no dependencies to install. One HTML file, open it and go.
- **Installable & fully offline** — a real PWA: install it from the browser (the download icon in the header), and the service worker warms the app shell, the CDN libraries and the web fonts so CV Genie keeps working with no connection at all.
- **ATS-aware** — a 7-category engine with ~25 concrete checks (plus job-description matching and an optional Gemini AI coach) scores your CV on every keystroke and shows exactly what to fix.
- **Serious output** — vector PDF through the print dialog, an editable DOCX generated entirely in-browser, RTF, Markdown, plain text, plus bulk export of all 31 templates in one ZIP.
- **Works everywhere** — responsive down to phone screens, dark mode, and an installable Android APK built by CI.

## ✦ What's new in v2.10

**Adjustable skill levels, a photo-shape chooser, and a much smarter publications/volunteering parser.**

| Change | Details |
|---|---|
| **Skill level sliders** | Every skill in the Skills section now has a **1–5 slider** with a live badge. The rating designs read them directly: Scholar's signature 5-square ratings follow the slider (default 4), and Primo's skill bars fill to level × 20%. Levels persist in saves, share links, version history and the ATS keyword flow, and the sliders rebuild automatically after a CV import or skill-chip add. |
| **Photo display chooser** | The photo section's shape control is now **always visible** (not just after uploading) and gains a fourth option: **circle, rounded, square, or portrait (3:4)**. Each template can also declare its natural shape — Scholar now defaults to a clean **square** photo with a white keyline (the old fixed 20×30 mm portrait box turned circles into ellipses); your explicit choice always wins and sticks across templates. |
| **Smarter publications parsing** | The import parser was rebuilt around **date anchors**: records start at every inline or standalone date line, wrapped titles join until the first venue/status/DOI line (short continuations like "…buck-boost / converters" and hyphen wraps like "routine- / quality" fuse correctly), each venue/status slot fills once, and extra URLs such as *Earlier preprint version …: https://doi.org/…* stay with their record instead of spawning phantom publications. Statuses like "Under second round of revisions" are now recognised. On the reference CV this means **all 7 publications** import with correct titles, venues, statuses and primary DOIs. |
| **Smarter volunteering parsing** | Role keywords now match **whole words only** ("lead" no longer matches *Leading University…*), and organization lines (club / society / university / company keywords) are detected first — so "Leading University Social Service Club" + "Joint General Secretary" imports as **one entry with org and role in the right fields** instead of four inverted fragments. A "Role, Organization" line splits into both fields at once. |
| **Language ratings tweak** | Scholar renders **A1 with 2 of 5 squares**, matching the reference CV (previously 1); the level ladder is now Native/C2 = 5, C1 = 4, B2/B1 = 3, A2/A1 = 2. |
| **Verified** | New `fixture6-researcher2.pdf` (pure-date publications, hard wraps, preprint links, Leading-University volunteering) drives `test-cv-import.js` to **148 assertions**; `test-modules.js` gains 10 checks for the sliders, shape defaults and chooser visibility. Service-worker cache bumped to `cv-genie-v2.10`. |

## ✦ What's new in v2.9

**Researcher sections — Publications, Projects, Volunteering and Interests — and the Scholar template rebuilt as an exact recreation of the reference CV.**

| Change | Details |
|---|---|
| **Four new form sections** | **Publications** (title, venue, date, status, DOI link), **Projects** (name, description, link), **Volunteering** (organization, role, description) and **Interests** (a simple line) join the editor. They are collapsible, drag-reorderable like every other section, persist in saves / share links / version history, flow into the ATS plain-text view and keyword matching, and export to **DOCX, RTF, Markdown and TXT** (DOI links prefixed and coloured). The deterministic cover letter gained a researcher path: with no quantified work bullets but published papers, p3 grounds itself in your top publication instead of a generic fallback. |
| **Scholar: exact recreation** | The template was rebuilt against the reference CV's measured geometry: the **official current Europass logo** (extracted from the reference PDF) sits top-left of the navy `#003399` masthead above the *Curriculum Vitae* eyebrow, the 23 pt name and the tagline, with the photo flush right; the grey **Personal Information** block carries underlined values in a 2-column grid; section headers are letter-spaced `#1a3fa0` caps over thin `#003399` rules; publications render as bold wrapped titles with right-aligned grey dates, venue/status lines and blue DOI links; skills sit in a 3-column grid and languages in a 4-column grid, each with the signature **5-square proficiency ratings**. |
| **Import parses the new sections** | The universal CV parser (and the Gemini extraction schema) now understand **Publications**, **Projects**, **Volunteering** and **Interests** sections: wrapped publication titles are joined, trailing dates pair with entries, venues/statuses/DOIs are separated (a DOI closes an entry), projects close on their URL, and org/role volunteering pairs feed the new list. Imported sections appear as review groups with include checkboxes, exactly like the existing ones. |
| **Verified** | `test-cv-import.js` grew from 104 to **126 assertions** — a new end-to-end researcher fixture (`fixture5-researcher.pdf`: 3 publications with wrapped titles and DOIs, 2 link-closed projects, 2 volunteering pairs, skills/interests/languages) plus form-apply checks; `test-export-docx.js` now asserts publications, the DOI prefix and interests inside the generated OOXML. Service-worker cache bumped to `cv-genie-v2.9`. |

## ✦ What's new in v2.8

**The Scholar template — a 31st design modelled on a real researcher's CV.**

| Change | Details |
|---|---|
| **Scholar template** | Recreates the modern **Europass-editor look** from a reference CV PDF: a full-bleed navy `#003399` masthead with a *Curriculum Vitae* eyebrow, the name and tagline beside a white-framed portrait (respects the app-wide photo shape and size controls); **IBM Plex Sans** typography, loaded as a web font and cached for offline; letter-spaced small-caps section headers over thin navy rules; a labelled **Personal Information** grid (Address / Telephone / Email / Web); company-first experience and institution-first education entries with right-aligned grey dates; and the signature **6-square proficiency ratings** for skills and languages — square counts are hashed from the skill text (language levels map Native/C2 = 6 squares down to A1 = 1), so every CV renders deterministically. |
| **Verified** | Template registry, carousel, service-worker precache and the Playwright suites are updated to 31 templates; a gallery screenshot was added; the service-worker cache is bumped to `cv-genie-v2.8`. |

## ✦ What's new in v2.7

**Six more templates (30 total) and a rebuilt import pipeline.**

| Change | Details |
|---|---|
| **6 popular new templates** | **Primo** (after Zety's Primo — iconed sidebar with round contact chips and deterministic skill bars), **Diamond** (after Zety's Diamond — centred layout with ◆-framed headings), **Berlin** (Novoresume's minimalist ink-black header band), **Monogram** (the Initials family — colour badge with your initials), **Wall Street** (finance-grade serif conservatism — small-caps headings over double rules) and **Medic** (clinical-clean healthcare layout with a labelled contact grid and date pills) — **30 templates in total**. |
| **LinkedIn import rebuilt** | The old LinkedIn reader joined every PDF page into one giant line, so the name field swallowed the whole first page, and its positional splitter assumed fixed 4-line blocks that real exports break immediately. Extraction now goes through the same **coordinate-aware PDF reader** as the universal parser, and `parseLinkedInText` was rewritten on top of the battle-tested section parsers — with LinkedIn-specific cleanups: `· 2 yrs 3 mos` duration suffixes, `· Full-time` employment types, "500+ connections" / "Contact info" / "Show all…" noise and per-job "City, Country" lines are all stripped, and LinkedIn's ILR proficiency labels (*Full professional*, *Professional working*, *Limited working*, *Native or bilingual*) map to CEFR. |
| **Universal parser upgrades** | **Cross-segment date anchors** — column-split PDFs that put "Jan 2020 –" and "Present" in different segments of one row now pair correctly with their role line. **~30 new section-heading synonyms** (*Career Objective*, *Professional History*, *Research Experience*, *Summary of Qualifications*, *Licenses & Certifications*, *Training*, *Skills & Endorsements*, …) incl. all LinkedIn headings. **Heading-less pitch fallback** — a CV that opens with an unlabelled summary paragraph before its first job gets it picked up. Bare page-number lines, `(+880) …` phone prefixes and a **role-line fix** ("Junior Software Engineer" no longer mis-filed as a company because "Software" is also a company keyword) round it out. |
| **JD keyword extraction** | The ATS matcher now merges singular/plural forms ("dashboard" + "dashboards" count as one term) and **rescues single-occurrence technical phrases** — a posting that lists "Kubernetes cluster" or "Power BI" exactly once is still captured as the hard requirement it is. |
| **Verified** | `test-cv-import.js` grew from 80 to **104 assertions**: a full LinkedIn-PDF end-to-end fixture (`fixture4-linkedin.pdf` — identity, duration-stripped dates, role/company pairing, ILR levels) plus a unit battery for every new parser heuristic. Service-worker cache bumped to `cv-genie-v2.7`. |

## ✦ What's new in v2.6

**A modular codebase and six new templates — 24 designs in total.**

| Change | Details |
|---|---|
| **Modular architecture** | The 380 KB single file is gone: `index.html` is now a ~50 KB shell loading **20 native ES modules** (`js/`) and **10 sectioned stylesheets** (`css/`) — no build step, no bundler, files map 1:1 to features for painless debugging. The import graph is strictly one-directional (CI fails on cycles), the service worker precaches every module, and a new `scripts/test-modules.js` suite guards the graph. |
| **6 popular new templates** | **Tech** (Jake's Resume — the software-engineer standard from r/EngineeringResumes, ATS-perfect monochrome with right-aligned dates), **Harvard** (education-first career-services classic), **Cascade** (the big builders' signature tinted skills sidebar), **Functional** (skills-first layout for career changes), **Pastel** (soft tinted header band) and **Vogue** (fashion-editorial masthead) — 24 templates in total. |
| **Stronger CI guardrails** | `scripts/validate.js` now verifies the whole module graph: every import resolves, no cycles, every stylesheet linked, every template has meta + wireframe + renderer + CSS, every inline `onclick` handler maps to a real export, and the service worker precaches every file — catching broken refactors before they ship. |
| **Derived accent tints** | New `--cv-color-soft` / `--cv-color-tint` custom properties (computed as rgba) power the soft designs while staying parseable by the instant-PDF renderer. |

## ✦ What's new in v2.5

The final polish pass: a cohesive motion layer and small UI cleanups. Every animation is transform/opacity only (GPU-composited), one-shot, and fully neutralised by the global `prefers-reduced-motion` rule — nothing loops, nothing flashes.

| Area | Change |
|---|---|
| **First-load choreography** | The app assembles itself once on load: header slides in, form sections cascade with a 45ms stagger, the preview area and ATS widget rise in. Gated by a `boot` class that JS retires after ~1.4s, so it never replays on tab switches or re-renders. |
| **Sliding tab indicator** | The active-tab underline is now a shared “ink bar” that glides between tabs (repositioned on switch, resize and font-load) instead of each tab growing its own border. |
| **Modal & dialog motion** | Modals and the confirm dialog spring in (translate + settle overshoot) and fade out on close instead of vanishing. All five overlays also close on **Escape** (topmost first). |
| **Toast upgrade** | Toasts spring in with a slight overshoot, slide down when leaving, and stack instead of overlapping when several fire in quick succession. |
| **Micro-interactions** | Buttons lift on hover and press down on click; icon buttons scale; chips, colour dots and font pills pop when selected; the modal close button rotates 90°; export options nudge right on hover; dropzones and import banners give tactile press feedback; mobile nav icons bounce when activated. |
| **Page swaps** | Switching templates or toggling CV ↔ Letter plays a quick fade-and-settle on the document instead of a hard cut. |
| **Cleanup** | Collapsing form sections now fade their content as well as animating height; a duplicated `display:none` in the floating preview button was removed; version strings in the title and header (stuck at v2.3 since the v2.4 letter work) are aligned with the real version, and the service-worker cache is bumped to `cv-genie-v2.5` so installed clients pick the new shell up on refresh. |

## ✦ What's new in v2.4

| Area | Change |
|---|---|
| **Full letter editing** | Every part of the cover letter is now editable in the Letter tab — not just the four paragraphs. New fields for **date**, **subject line**, **salutation**, **recipient address block**, **custom sign-off** (free text with the classic presets as dropdown suggestions) and **signature name**. Leave any of them empty and the smart default you see in its placeholder is used (today's date, “Re: Application for …”, the right “Dear …”, your CV name). |
| **Any number of paragraphs** | The four paragraphs are no longer a fixed grid: **add** and **remove** paragraphs (one is always kept), with the first four carrying their semantic hints (opening / why this company / evidence / closing). The deterministic and Gemini writers still write their four-part draft and replace the list in one go. |
| **One envelope, every format** | A single `letterEnvelope()` resolver now feeds the preview **and** DOCX, RTF, Markdown and TXT exports, so they can never disagree — this also fixed the RTF export missing the date line, and a pre-existing RTF bug where the recipient block rendered the literal text `\line` instead of a line break. |
| **Backwards compatible** | Old saves, share links, undo history and version snapshots (which stored `p1`–`p4`) migrate transparently into the paragraph list; the first four slots keep the `clP1`–`clP4` ids. |
| **Verified** | New Playwright suite `scripts/test-letter-edit.js` (67 assertions — defaults, overrides, add/remove/renumber, single-paragraph guard, state round-trip, legacy-state migration, and all four export builders agreeing on the envelope). |

## ✦ What's new in v2.3

| Area | Change |
|---|---|
| **100% serverless exports** | The Render export microservice is gone. **DOCX is now generated in your browser** — a from-scratch WordprocessingML writer built on the bundled JSZip, producing a complete OOXML package (document, styles, doc properties) with your accent colour and font pairing, for the CV *and* the cover letter. No network, no cold starts, nothing to maintain. |
| **Vector PDF** | “High-quality PDF (server)” is replaced by **PDF (print dialog)**: a dedicated print stylesheet reduces the page to just the active document, and your browser's *Save as PDF* produces crisp, selectable vector text — better than the old server render, with zero infrastructure. The one-click html2pdf export stays for quick drafts. |
| **Installable PWA** | Web app manifest, a real `sw.js` service worker (app shell precached; CDN libraries and web fonts warmed at activation; network-first navigations so updates land on refresh), generated icon set (any + maskable + apple-touch), and an **Install** button in the header. Once installed, CV Genie works completely offline — editing, templates, ATS, deterministic cover letters and every export format. |
| **Android APK from CI** | A new [GitHub Actions workflow](.github/workflows/apk.yml) wraps the deployed PWA into a signed **Trusted Web Activity APK** (and AAB) using Bubblewrap — run it on demand or let it attach the APK to version releases. See [Android app](#-android-app-twa-apk). |
| **Legacy cleanup** | The last remnant of the server era is gone: an early inline service worker (a cache-first Blob registered in `<head>`) used to race the real one and could delete the app-shell cache from under it. `sw.js` is now the **only** registration, and CI enforces that — exactly one `serviceWorker.register('sw.js')`, no Blob workers. |
| **Verified** | New Playwright suites: `test-export-docx.js` (16 assertions — package structure, well-formed XML, content, letter mode, LibreOffice round-trip) and `test-pwa.js` (22 assertions — manifest, icons, SW lifecycle, cache warm-up, full offline boot, Gemini never cached). |

## ✦ What's new in v2.2

| Area | Change |
|---|---|
| **ATS engine v2** | The analyser is now a proper 7-category engine — contact, summary, experience, skills, education, impact & wording, and keywords — built from ~25 individual checks (action verbs, quantified achievements, duty phrasing, buzzwords, bullet length, date consistency, first person, recency…), each with a concrete fix. Weighted scoring, a letter grade, per-category bars and a prioritised *fix-these-first* list replace the old keyword-coverage number. |
| **AI Coach** | An optional Gemini review layered on top of the local report: verdict, quick wins, a rewritten summary, up to four rewritten bullets and suggested keywords — each with a one-click **Apply** button that edits the form in place. Uses your own free API key (same key as CV import), stored only in your browser. |
| **Job match integration** | The job-description matcher now feeds the engine — pasting a posting swaps the keyword category for a **Job match** category, and the sidebar widget, checks and score all update together. |
| **Bug fixes** | The *Add all missing keywords* button produced a broken `onclick` (quotes inside a double-quoted attribute) and never worked — rewritten with a data attribute. The JD *Clear* button also referenced a non-existent `saveState()`. |

## ✦ What's new in v2.1

| Area | Change |
|---|---|
| **Cover letter builder** | A full letter editor with a one-click draft generated deterministically from your CV, or full AI writing via Gemini (your own key): four tailored paragraphs in your chosen tone, grounded strictly in your CV and the pasted job description. The letter shares your CV's accent colour and fonts, so the pair reads as a matching set. Export as PDF, DOCX, RTF, Markdown or plain text. |
| **Job description match** | Paste a real posting and CV Genie extracts its keywords (multi-word phrases included), scores your CV against them, and shows exactly what's missing — click any missing keyword to add it, or add all missing at once. |
| **"What the ATS sees"** | An honest plain-text extraction of your CV in parse order, plus parse checks (email/phone detection, word count, sections, dates). See what a parser gets, not what a marketing score claims. |
| **Markdown & TXT export** | For GitHub profiles, web posting and online forms — works for both CV and cover letter. |

## ✦ What's new in v2.0

| Area | Change |
|---|---|
| **UI** | Complete minimalist redesign — neutral palette, hairline borders, stroke icons, clean type scale, calmer animations. The app chrome gets out of the way of your content. |
| **Europass CV** | New official-style Europass template — a faithful reproduction of the European Commission's official DOCX (logo header, right-aligned label gutter, blue heading rules, CEFR self-assessment grid, © European Union footer). |
| **4 more templates** | **Nordic** (Scandinavian minimalism), **Swiss** (International Typographic Style), **Academic** (conservative serif) and **Compact** (dense one-pager) — 18 templates in total. |
| **Profile photos** | Photo shape (circle / rounded / square), photo size (S / M / L), one-tap remove, and a cleaner crop-and-rotate editor. Photos now render in *every* template. |
| **Languages** | New Languages section with Native / A1–C2 levels. Feeds the Europass CEFR grid and renders as a styled list in other templates. Also picked up from LinkedIn imports. |
| **Content** | 20 summary templates (was 15) and 10 skill categories (added Legal and Science & Research). |
| **Bug fix** | Restoring state (undo/redo, versions, share links, JSON import) previously dropped the person's name — fixed. |
| **CI/CD** | GitHub Actions for validation, Pages deployment and releases (see [CI/CD](#-cicd)). |
| **Docs** | This README, with screenshots of every template. |

---

## ✦ Features

### Live editor with instant preview

Every keystroke updates the A4 preview (debounced 200 ms). Sections are collapsible and reorderable by drag-and-drop; experience, education, publication, project, volunteering and language entries are drag-reorderable too. Each skill gets a **1–5 proficiency slider** that drives the rating designs (Scholar's squares, Primo's bars) and travels with your save.

![Editor](docs/images/editor.png)

### Profile photos

Upload a picture, crop and rotate it in-browser (Cropper.js), then choose how it displays — **shape** (circle, rounded, square or portrait 3:4) and **size** (S / M / L). The chooser is visible before you even add a photo, and each template applies its natural shape until you pick one yourself (Scholar defaults to a clean square). The photo flows into all 31 templates: an ID-style photo in the label gutter on Europass, a white-framed square photo on Scholar, a framed circle on Modern, a colour-backed circle on Sidebar Bold. Shape and size controls update every template instantly, and the settings travel with saves, share links and version history.

### ATS analyser

The analyser scores your CV across **seven weighted categories** — contact details, summary, experience, skills, education, impact & wording, and keywords — using ~25 deterministic checks in the spirit of commercial ATS scanners: action-verb openers, quantified achievements, duty phrasing (*"responsible for…"*), buzzwords, bullet length and depth, date presence and consistency, first-person pronouns, recency, summary targeting, education completeness, overall length. Every failed or warned check comes with a one-line fix, the score ring gets a letter grade, and the category bars show exactly where points are lost. Everything runs locally, on every keystroke.

![ATS analyser](docs/images/ats.png)

**Keywords.** Type a target role and the engine matches it against a dictionary of 80+ roles and their keywords; add your own custom keywords too. Click any missing keyword to inject it straight into your Skills field. The score and per-category checklist stay pinned next to the preview.

**Job description match.** Dictionaries are generic; postings are not. Paste the actual job description and CV Genie extracts its key terms — favouring multi-word phrases like *design systems* or *stakeholder communication* over noise words — then swaps the keyword category for a **Job match** category: a match score, chips for every posting keyword (found and missing), and one-click *add all missing* as custom keywords. Everything runs locally; the posting never leaves your browser.

![Job description match](docs/images/ats-jd.png)

**AI Coach.** Optional, with your own free Gemini API key (the same one as CV import): Gemini reviews your CV — with the local report and the pasted posting as context — and returns a verdict, quick wins, a rewritten summary, up to four rewritten bullets (with the reasoning) and suggested keywords. Every rewrite has an **Apply** button that edits the form in place; unknown metrics come back as `[X%]` placeholders so nothing gets invented. The key is stored only in your browser; the request goes browser → Google directly, and it reuses the import's model fallback chain (`gemini-flash-latest` → `gemini-flash-lite-latest` → `gemini-3.5-flash-lite` → 3.6/3.8 flash → discovered models) with exponential-backoff retries and a patient second pass, so a busy free tier never leaves you stuck. A **Test** button next to the key field sends a tiny probe request and pinpoints key, model or region problems in one click.

![AI Coach](docs/images/ats-ai.png)

**What the ATS sees.** One click shows the plain text a parser extracts from your CV, in reading order, with parse checks — email and phone detection, word count range, section detection, date references, photo advisory. It's the same content every template produces, because parsing depends on content, not styling — and it's the honest view no builder shows you.

![What the ATS sees](docs/images/ats-text.png)

### Cover letter builder

A **Letter** tab beside the editor builds a cover letter that matches your CV — same accent colour, same fonts — from shared contact details. Fill in the company, hiring manager and role, pick a tone (formal / direct / warm), then either:

- **Draft from my CV** — a one-click offline draft from your own experience, skills and most recent role. No AI, no data leaving the browser.
- **Write with Gemini** — the AI writer drafts all four paragraphs (opening, why this company, evidence, closing) from your CV, the target role, your tone choice and the job description you pasted in the ATS tab. It uses only facts from your CV — unknown metrics come back as `[placeholder]` — and reuses the same free API key and model-fallback engine as the ATS coach. The letter lands in the editable fields and the preview switches to it instantly.

**Every part of the letter is editable** in the Letter tab: date, subject line, salutation, recipient address block, any number of paragraphs (add / remove — the four defaults carry the opening / why-this-company / evidence / closing hints), a free-text sign-off with the classic presets as suggestions, and the signature name. Empty fields fall back to the smart defaults shown in their placeholders (today's date, “Re: Application for …”, the context-appropriate “Dear …”, your CV name), so a drafted letter is already complete but nothing is locked. A single envelope resolver feeds the preview and every export format, so they always agree.

Toggle **CV / Letter** above the preview to switch documents; exports (PDF, RTF, Markdown, TXT) follow whichever is active. Letter content travels with saves, share links and version history like everything else.

![Cover letter](docs/images/letter.png)

### Template carousel — the default CV view

The CV preview **is** a **cover-flow style 3D carousel** — no gallery to open: your selected design sits large at the centre, the neighbouring designs flank it on both sides at an angle, and two more peek from the edges. Every page is a **live render of your own CV** in that design — not a static wireframe — in your current colour and fonts, updating as you edit. Drag or swipe, use the arrow keys, or click a side page to rotate it to the centre — **the design you centre on is applied automatically** (the counter shows where you are, e.g. *3 / 31*, and the ring wraps around, so you can spin through all 31 designs endlessly). Click the centre page or **Full view** (or the first toolbar button) to zoom into the full-page document view and back. For a quick switch, the toolbar dropdown still works. On mobile, the carousel is the viewpoint behind the floating **Preview** button.

![Template carousel](docs/images/gallery.png)

### Design controls

Six font pairings (now properly loaded as web fonts, so exports match the preview) and eight accent colours.

![Design tab](docs/images/design.png)

### Export — all local, all the time

Pick any combination of **PDF (print dialog)** — the page collapses to just the active document and your browser's *Save as PDF* produces crisp vector text — **PDF (instant)** for one-click raster drafts, **DOCX** generated entirely in-browser, instant **RTF**, **Markdown** and **plain text** — or export **all 31 templates** in one ZIP. The export dialog follows the active document: cover letters export as PDF / DOCX / RTF / Markdown / TXT. No format touches a server; DOCX is a complete OOXML package (Word, LibreOffice and Google Docs all open it) carrying your accent colour and font pairing.

![Export dialog](docs/images/export.png)

### Install it — offline forever

CV Genie is a real installable PWA. Click the **install icon** in the header (Chrome/Edge desktop, or *Add to Home Screen* on mobile) and it runs in its own window, launches instantly, and — because the service worker precaches the app shell and warms the CDN libraries and web fonts — **keeps working with no connection at all**: editing, all 31 templates, the ATS engine, deterministic cover letters and every export format. Navigations are network-first, so a deploy lands the next time you're online and refresh. The only thing that needs the network is the optional Gemini AI.

### Android app (TWA APK)

The same PWA is packaged as an Android app by CI. The [apk workflow](.github/workflows/apk.yml) uses [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) to wrap the deployed PWA into a **Trusted Web Activity** — a real, signed APK (plus an AAB for Play Store uploads) that shows CV Genie fullscreen on Android:

- **Get the APK** — run the workflow manually (Actions → *Build Android APK* → *Run workflow*), or grab `cv-genie-<version>.apk` from the artifacts of any run / attached to a `v*` release.
- **Install** — enable *install unknown apps* for your browser/file manager, then open the APK. It updates over itself as long as the signing key stays the same.
- **Signing** — the wrapper key is committed at [`android-signing/`](android-signing/README.md) so builds are fully automated; read that note before publishing to Google Play (it explains rotating to a private key via the `ANDROID_KEYSTORE_B64` secret, which the workflow prefers automatically).
- **Fullscreen verification** — for the TWA to open without a browser address bar, Android verifies the signing key against a [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started) statement on the site's host root. The statement is committed at `.well-known/assetlinks.json` and served by this repo's Pages. Because GitHub Pages project sites live under a shared `*.github.io` host, the statement must also be reachable at `https://touhidsiddiqueeraj-bit.github.io/.well-known/assetlinks.json` — copy the file into the **root of the `touhidsiddiqueeraj-bit.github.io` repository** (the user-site repo) once. Without it the app still runs, just with a URL bar on first launch.

### Mobile & dark mode

A dedicated mobile layout with edit/preview navigation, and a full dark theme (auto-detected from your OS, manually toggleable).

| Mobile — edit | Mobile — preview | Dark mode |
|:---:|:---:|:---:|
| ![Mobile edit](docs/images/mobile-edit.png) | ![Mobile preview](docs/images/mobile-preview.png) | ![Dark mode](docs/images/hero-dark.png) |

### Import your existing CV

Upload an old CV in **PDF, DOCX or plain text** (or paste its text) and CV Genie fills in the whole form — personal details, summary, work experience, education, publications, projects, volunteering, interests, skills and languages.

**How it works, in order of preference:**

1. **Local rule-based parser (default, fully offline).** Text is extracted in your browser — pdf.js for PDFs, JSZip for DOCX — and mapped onto the app's data model. For PDFs the extractor is **coordinate-aware**: text items are clustered into visual lines by position and font size, and large horizontal gaps are kept as column separators, so right-aligned date columns, multi-column skill grids, label/value contact grids and letter-spaced headers (`E D U C A T I O N`) all survive extraction in reading order — the name is picked up as the largest font in the page-1 header area. On top of that: section segmentation (plain and letter-spaced headers, ~60 heading synonyms incl. *Career Objective*, *Professional History*, *Summary of Qualifications*, *Licenses & Certifications*, *Training* and every LinkedIn heading), label/value contact pairs plus regex fallbacks (incl. `(+880) …` phone prefixes), experience/education entries anchored on date ranges — **including ranges split across PDF columns** — with role/company splitting across the common layouts (a stacked "Junior Software Engineer" line is correctly treated as a role even though "Software" is also a company keyword), volunteering mapped into experience, skill-list splitting, a **pitch-paragraph fallback** that picks up the opening summary of heading-less CVs, and CEFR language-level mapping (incl. LinkedIn's ILR proficiency labels). Every parse gets a **confidence score (0–100)**; the review screen shows exactly what was found, per-section checkboxes to untick anything you don't want, and a heads-up list of anything missing.
2. **Optional Gemini AI fallback.** When the layout is unusual, the CV isn't in English, or the parse just misses things, you can paste **your own free Google AI Studio API key** and let Gemini re-extract the CV with a strict JSON response schema. The key is stored only in your browser's `localStorage` and used for direct browser → Google calls; CV-Genie has no server-side AI. For PDFs the original file is sent as inline data alongside the pre-extracted text, so scanned PDFs need no separate OCR step. Models are **discovered at runtime** from your key's `/models` list — the picker defaults to `gemini-flash-latest`, and if a model is busy (429/500/503) or discontinued the app auto-retries with exponential backoff and falls back (`gemini-flash-lite-latest` → `gemini-3.5-flash-lite` → 3.6/3.8 flash → other available models), so it never gets stuck on one endpoint. AI results are merged with the parser's (parser values fill any gaps) and shown in the same review screen with an "AI" badge.

Importing pushes an undo snapshot first (Ctrl+Z restores your previous CV) and asks before overwriting existing content.

![Import dialog](docs/images/import-cv.png)

### Data portability

- **CV import** — upload any PDF/DOCX/text CV and autofill the form (local parser, optional Gemini AI with your own key — see above).
- **LinkedIn import** — upload your LinkedIn "Save to PDF" export and autofill the form (name, headline, location, About summary, experiences with clean dates, education, skills and languages with ILR→CEFR levels). Since v2.7 it runs on the same coordinate-aware PDF reader and section parsers as the universal import, with LinkedIn's decorations (`· 2 yrs 3 mos`, `· Full-time`, connection counts, "Contact info") stripped automatically.
- **Share links** — the entire CV is LZ-compressed into a URL. Anyone with the link sees your exact CV; nothing is sent to a server.
- **JSON backup** — full export/import of your state.
- **Version history** — save and restore up to 10 named snapshots.
- **Autosave** — state persists to `localStorage` every 5 minutes and when the tab is hidden.

---

## ✦ Templates

All 31 templates rendered with the same sample data:

| | | |
|:---:|:---:|:---:|
| [![Classic](docs/images/templates/classic.png)](docs/images/templates/classic.png) | [![Modern](docs/images/templates/modern.png)](docs/images/templates/modern.png) | [![Nordic](docs/images/templates/nordic.png)](docs/images/templates/nordic.png) |
| **Classic** — traditional serif | **Modern** — colour header, two columns | **Nordic** — Scandinavian minimalism |
| [![Minimal](docs/images/templates/minimal.png)](docs/images/templates/minimal.png) | [![Swiss](docs/images/templates/swiss.png)](docs/images/templates/swiss.png) | [![Executive](docs/images/templates/executive.png)](docs/images/templates/executive.png) |
| **Minimal** — light and elegant | **Swiss** — typographic grid | **Executive** — boardroom small-caps |
| [![Academic](docs/images/templates/academic.png)](docs/images/templates/academic.png) | [![Europass](docs/images/templates/europass.png)](docs/images/templates/europass.png) | [![Compact](docs/images/templates/compact.png)](docs/images/templates/compact.png) |
| **Academic** — conservative, centred | **Europass** — EU format with CEFR grid | **Compact** — dense one-pager |
| [![Sidebar Bold](docs/images/templates/sidebar-bold.png)](docs/images/templates/sidebar-bold.png) | [![Timeline](docs/images/templates/timeline.png)](docs/images/templates/timeline.png) | [![Tabular](docs/images/templates/tabular.png)](docs/images/templates/tabular.png) |
| **Sidebar Bold** — full-colour sidebar | **Timeline** — visual career timeline | **Tabular** — structured tables |
| [![Newspaper](docs/images/templates/newspaper.png)](docs/images/templates/newspaper.png) | [![Magazine](docs/images/templates/magazine.png)](docs/images/templates/magazine.png) | [![Infographic](docs/images/templates/infographic.png)](docs/images/templates/infographic.png) |
| **Newspaper** — two-column density | **Magazine** — editorial masthead | **Infographic** — data cards |
| [![Creative](docs/images/templates/creative.png)](docs/images/templates/creative.png) | [![Colorful](docs/images/templates/colorful.png)](docs/images/templates/colorful.png) | [![Corporate](docs/images/templates/corporate.png)](docs/images/templates/corporate.png) |
| **Creative** — tag-based skills | **Colorful** — bold gradient | **Corporate** — navy frame |
| [![Tech](docs/images/templates/tech.png)](docs/images/templates/tech.png) | [![Harvard](docs/images/templates/harvard.png)](docs/images/templates/harvard.png) | [![Cascade](docs/images/templates/cascade.png)](docs/images/templates/cascade.png) |
| **Tech** — Jake's Resume, the engineer standard | **Harvard** — education-first classic | **Cascade** — tinted skills sidebar |
| [![Functional](docs/images/templates/functional.png)](docs/images/templates/functional.png) | [![Pastel](docs/images/templates/pastel.png)](docs/images/templates/pastel.png) | [![Vogue](docs/images/templates/vogue.png)](docs/images/templates/vogue.png) |
| **Functional** — skills-first, for career changes | **Pastel** — soft tinted header band | **Vogue** — fashion-editorial masthead |
| [![Primo](docs/images/templates/primo.png)](docs/images/templates/primo.png) | [![Diamond](docs/images/templates/diamond.png)](docs/images/templates/diamond.png) | [![Berlin](docs/images/templates/berlin.png)](docs/images/templates/berlin.png) |
| **Primo** — iconed sidebar, skill bars | **Diamond** — centred, ◆-framed headings | **Berlin** — ink header band, ultra-clean |
| [![Monogram](docs/images/templates/monogram.png)](docs/images/templates/monogram.png) | [![Wall Street](docs/images/templates/wallstreet.png)](docs/images/templates/wallstreet.png) | [![Medic](docs/images/templates/medic.png)](docs/images/templates/medic.png) |
| **Monogram** — initials badge, airy serif | **Wall Street** — finance-grade navy serif | **Medic** — clinical clean, contact grid |
| [![Scholar](docs/images/templates/scholar.png)](docs/images/templates/scholar.png) | | |
| **Scholar** — modern Europass look, navy masthead, skill squares | | |

### About the Europass template

The [Europass CV](https://europa.eu/europass/en) is the European Union's standard CV format. CV Genie's Europass template is a faithful reproduction of the [official European Commission template](https://www.eeas.europa.eu/sites/default/files/standard_cv.docx) — structure, colours and typography were extracted directly from the official DOCX:

- **Header**: the official Europass logo, "Curriculum Vitae" and the candidate name in light blue, exactly like the original first-page header.
- **Personal information**: the name in the content column with contact lines (address, telephone, e-mail, website) and small blue pictograms; the profile photo sits in the label gutter, as in the official layout.
- **Job applied for; position; preferred job; studies applied for; personal statement** — the official stacked label block, filled with your job title and professional summary.
- **Work experience / Education and training** entries with dates right-aligned in the label gutter, position and qualification headings in navy, employers/institutions and square-bulleted activities in the content column.
- **Personal skills** with *Mother tongue(s)*, the official CEFR self-assessment grid (Understanding → Listening / Reading, Speaking → Spoken interaction / Spoken production, Writing) and its levels legend. Your skills are routed automatically into the official sub-labels — *Communication skills*, *Organisational / managerial skills*, *Job-related skills* and *Digital competence* (the section the EU added in its 2015 template revision).
- Official styling tokens: Arial, navy `#0E4194` caps headings with the `#2E90CB` rules, `#1593CB` field labels, `#C0C0C0` grid borders, and the "© European Union" footer. The footer reads *© European Union, 2002-2015 \| europass.cedefop.europa.eu* — that copyright range is the EU's own notice on the current official template (last revised 2015), so it is verbatim, not an outdated copy.

| Understanding | | Speaking | | Writing |
|---|---|---|---|---|
| Listening | Reading | Spoken interaction | Spoken production | |
| B2 | B2 | B2 | B2 | B2 |

Add languages in the **Languages** section of the Edit tab, choosing *Native* for your mother tongue(s) or a CEFR level (A1–C2) for others. The grid fills each skill column with the chosen level — edit the source if you need per-skill levels.

---

## ✦ Documentation

### Getting started

No build step. Either open `index.html` directly, or serve the folder (recommended, so the service worker and CDN fonts behave consistently):

```bash
# any static server works
python3 -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080. To publish your own copy, push to a GitHub repo and enable GitHub Pages with **Deploy from a branch** (`main` / root) — the site publishes automatically on every push.

### Architecture

The application is a **no-build modular SPA**: `index.html` is a small shell that loads ten sectioned stylesheets and one ES module entry (`js/main.js`), which pulls in the rest as **native ES modules** — no bundler, no transpilation, no `node_modules`. Files map 1:1 to features, so DevTools stack traces and breakpoints land in the exact file you'd expect. Around the app sit the PWA assets (manifest, service worker, icons) and the CI pipeline that validates, deploys and wraps it for Android.

**The module graph** (arrows read "imports", strictly one-directional — CI fails on cycles):

```
config ──────────┐            pure data: templates, colours, fonts, taxonomies
app-state ───────┤            shared mutable values + generated setters
ui ──────────────┤            toasts, modals, tabs ink, theme — imports no feature
gemini ──────────┤            shared Gemini client (discovery, fallback, backoff)
history ─────────┤            undo/redo stacks (state providers injected by main)
cvdata ──────────┤            DOM → data collectors (the single read model)
form ────────────┤            dynamic rows, drag-drop, photo editor, design controls
preview ─────────┤            templateHtml() + A4 scaling
render ──────────┤            debounced repaint dispatch ('cvgenie:preview-updated' event)
letter ──────────┤            envelope fields, paragraphs, render, RTF/MD/TXT
letter-engine ───┤            deterministic writer + Gemini rewrite
ats ─────────────┤            7-category engine, JD matcher, keyword chips, AI coach
export ──────────┤            print PDF, instant PDF, DOCX writer, RTF/MD/TXT, ZIP
versions ────────┤            version slots, share links, JSON backup
cv-import ───────┤            PDF/DOCX/TXT parser + Gemini extraction + LinkedIn
state ───────────┤            getState()/restoreState(), persistence, loadSaved()
carousel ─────────┘            3D template ring, preview modes, mobile nav
main.js — the composition root: boot order, tab/active-doc dispatch,
          keyboard shortcuts, install prompt, service-worker registration
globals.js — the window bridge (see below)     boot-prepaint.js — pre-paint theme
```

A few conventions that keep the graph debuggable:

- **Shared mutable state** lives in `js/app-state.js` as exported live bindings. Reads are plain imports; writes go through generated setters (`setCurrentTemplate(v)`…) so every mutation is greppable.
- **No cycles**: the render dispatcher repaints the CV and letter, then announces `cvgenie:preview-updated` on `window`; the ATS engine and the carousel subscribe. Same behaviour as direct calls, zero circular imports.
- **The window bridge** (`js/globals.js`): the markup keeps small inline handlers (`onclick="updatePreview()"`) and the Playwright suite drives the same public surface — so every module's exports are attached to `window` in one explicit, listed file (with live getters for exported `let`s). CI verifies every inline handler resolves.
- **CSS cascade order matters**: `overrides.css` (shared CV bits, print rules, ≤900 px mobile) loads *after* `templates.css` and `carousel.css` on purpose — those sections sat after the template/carousel blocks in the original single file, and the late load preserves the cascade.

**Frontend libraries** (loaded from CDN as classic scripts — available as `window` globals to every module)

| Library | Purpose |
|---|---|
| html2pdf.js / html2canvas | Client-side PDF and PNG rendering |
| JSZip + FileSaver.js | The in-browser DOCX writer, bulk ZIP export, DOCX import parsing |
| SortableJS | Drag-and-drop reordering (sections and list items) |
| pdf.js | Text extraction from LinkedIn PDF uploads |
| Cropper.js | In-browser photo cropping and rotation |
| LZ-String | Compressing CV state into shareable URLs |

**No backend.** PDF export uses the browser's own print-to-PDF (vector), DOCX is assembled client-side as an OOXML package, and the only optional network calls are direct browser → Google Gemini requests using the API key you paste in.

**Project structure**

```
.
├── index.html                  # shell: markup + <link>s + the js/main.js entry
├── css/                        # sectioned stylesheets (load order = cascade order)
│   ├── base.css                # design tokens, reset, dark theme
│   ├── layout.css              # app shell, panels, responsive breakpoints
│   ├── components.css          # buttons, forms, tabs, modals, toasts, …
│   ├── preview.css             # A4 document surface
│   ├── templates.css           # the 31 template designs
│   ├── carousel.css            # 3D template ring
│   ├── letter.css              # cover-letter envelope
│   ├── ats.css                 # ATS panel, JD matcher, import UI
│   ├── overrides.css           # late cascade overrides (print, ≤900px mobile)
│   └── motion.css              # keyframes, entrances, reduced-motion
├── js/                         # native ES modules — see the graph above
├── manifest.webmanifest        # PWA manifest (name, icons, display, colours)
├── sw.js                       # service worker — offline app shell + CDN warm
├── icons/                      # generated PWA icons (any / maskable / apple)
├── .well-known/assetlinks.json# Android TWA site association
├── android-signing/            # committed TWA wrapper keystore (+ rotation notes)
├── docs/images/                # screenshots used by this README
│   └── templates/*.png         # all 31 template previews
├── scripts/
│   ├── validate.js             # CI validation (module graph, cycles, bridge, SW shell, registry, PWA assets)
│   ├── apk-driver.js           # non-interactive Bubblewrap runner for the APK workflow
│   ├── make-icons.js           # regenerates icons/ from the brand SVG
│   ├── test-*.js / shoot-*.js  # Playwright E2E suites and screenshot generators
│   └── make-cv-fixtures.py     # sample CVs for the import-parser suite
└── .github/workflows/
    ├── ci.yml                  # validation on push/PR
    ├── apk.yml                 # Bubblewrap TWA → signed APK/AAB
    └── release.yml             # tagged releases with packaged artifact
```

### Smart tabs

| Tab | Contents |
|---|---|
| **Edit** | Personal info (photo, contact), Summary, Skills, Experience, Education, Languages — all collapsible and reorderable |
| **Content** | 20 summary templates · skill cloud (10 categories) |
| **Design** | Font pairing (6) · accent colour (8 presets) · 3D template carousel (live-rendered pages) |
| **Letter** | Company / hiring manager / recipient address · role · date · subject · salutation · tone · paragraphs (add / remove) · sign-off · signature · offline one-click draft · **Gemini AI writer** (own key) |
| **ATS** | Score ring + letter grade · 7-category breakdown · ~25 checks with fixes · target role & custom keywords · keyword cloud · job-description match · AI Coach (Gemini, own key) |
| **Tools** | LinkedIn import · JSON backup · share link · version history |

### State management & undo/redo

The whole CV is serialised by `getState()` into one plain object (template, colour, font pair, photo settings, section order, fields, experiences, education, languages, ATS keywords). Undo/redo stacks keep up to 50 snapshots; `restoreState()` rebuilds the form and preview from any snapshot. The same object powers share links, JSON backup, version history and autosave (`localStorage`, key `cvGenie_v2.0`, with migration from the v1 key).

### The in-browser DOCX writer

`buildDocx()` assembles a complete Office Open XML package with the JSZip the app already bundles — no external library, no server. It writes `[Content_Types].xml`, the package relationships, `docProps` (title, creator, timestamps), `word/styles.xml` (document defaults in your font pairing) and `word/document.xml` (A4 page, your accent colour on the name and section rules, the same content order as the RTF builder). Both documents are covered: `docxCvParts()` for the CV and `docxLetterParts()` for the cover letter. The suite `scripts/test-export-docx.js` downloads real exports through the UI and validates the ZIP structure, XML well-formedness and content with Python's zipfile + minidom, then round-trips the file through LibreOffice.

### The service worker

`sw.js` precaches the app shell at install (`./`, `index.html`, manifest, icons, **every `js/` module and `css/` stylesheet** — CI fails if a file is missing from the list), warms the exact CDN libraries and web fonts (woff2 URLs parsed out of the Google Fonts CSS) right after activation so the **first** visit already survives going offline, serves assets cache-first, and handles navigations network-first with a cached fallback so deploys land on the next refresh. The Gemini API is deliberately never cached — AI features simply wait for a connection. The cache name is versioned (`cv-genie-v2.10`); bump it when you want every install to refresh its cache. It is the app's **only** registration (from `js/main.js` on secure contexts; CI fails the build if a second service worker — e.g. an inline Blob worker — ever appears), so the caching strategy above is the whole truth.

### Keyboard shortcuts & accessibility

- `Ctrl/Cmd+Z` — undo · `Ctrl/Cmd+Y` — redo (outside text fields)
- `Ctrl/Cmd+S` — suppressed (prevents the browser save dialog)
- Section headers are clickable/focusable; icon buttons carry `aria-label`s; focus-visible rings throughout; dark mode honours `prefers-color-scheme` on first visit.

### PWA internals

The manifest lives at `manifest.webmanifest` (standalone display, theme `#18181b`, `any` + `maskable` icons generated by `scripts/make-icons.js` from the brand SVG). The service worker is `sw.js`, registered on secure contexts (GitHub Pages and localhost). See [Architecture](#architecture) for the caching strategy.

## ✦ CI/CD

GitHub Pages is configured to **deploy from the `main` branch**, so every push publishes the site automatically (the “pages build and deployment” run you'll see on each commit). Three GitHub Actions workflows sit alongside it:

| Workflow | Trigger | What it does |
|---|---|---|
| [ci.yml](.github/workflows/ci.yml) | push to `main`, PRs | Runs `scripts/validate.js`: shell structure, stylesheet links, `node --check` on every module, the full import graph (targets resolve, no cycles), template registry consistency (TEMPLATES ↔ TEMPLATE_META ↔ THUMB_WIRES ↔ renderers ↔ CSS), window-bridge coverage incl. every inline handler, service-worker precache completeness, README image references, workflow YAML parsing, PWA asset checks and a no-export-server guard |
| [apk.yml](.github/workflows/apk.yml) | manual, `v*` tags | Waits for the deployed manifest, then runs `scripts/apk-driver.js` (Bubblewrap TWA, non-interactive) → signed APK + AAB, uploaded as artifacts and attached to releases |
| [release.yml](.github/workflows/release.yml) | `v*` tags | Validates, packages the full app (`index.html` + `css/` + `js/` + PWA assets) into a versioned ZIP (+ SHA-256) and publishes a GitHub Release with generated notes |

> The old `deploy.yml` workflow (upload-artifact → deploy-pages) was removed in v2.7: it duplicated the branch deployment that was already publishing the site, and the two raced — the workflow's artifact-metadata lookup intermittently failed seconds after a successful upload. If you switch Pages to the "GitHub Actions" source mode in repo settings, re-add a deploy workflow.

## ✦ Common maintenance tasks

### Adding a new CV template

1. Add the slug to the `TEMPLATES` array in `js/config.js` (keep `TEMPLATE_META`, `THUMB_WIRES` and the switch in sync — CI checks this).
2. Add `{name, desc}` to `TEMPLATE_META` and a wireframe to `THUMB_WIRES` in `js/config.js` (tiny div-based layout sketch — shown as the carousel card's fallback if the live render fails).
3. Add a `case 'slug':` to the switch in `templateHtml(t, D)` in `js/preview.js` (built on the data from `collectPreviewData()`; shared helpers: `esc()`, `eH`, `dH`, `langLines`, `ph`, `skillList`, `contactLines`). The main preview and every 3D carousel card render through this one function, so the new design appears in the gallery automatically.
4. Add any template-specific CSS under `.cv-preview.cv-slug { … }` in `css/templates.css`. Soft fills should use the `--cv-color-soft` / `--cv-color-tint` custom properties (rgba-derived, so the instant-PDF renderer can parse them).

### Adding a font pair

Append `{name, heading, body}` to `FONT_PAIRS` and add the families to the Google Fonts `<link>` in `<head>` so the preview and exports render them.

### Updating ATS keyword roles

Edit the module-level `ROLE_KW` dictionary (just above the ATS engine). Target roles are matched longest-first and case-insensitively; these keywords are only used when no job description is pasted — a pasted posting always wins.

### Testing the CV import parser

`scripts/make-cv-fixtures.py` generates four sample CVs (TXT, DOCX via python-docx, PDF via ReportLab, and a LinkedIn-style profile PDF) into `/tmp/cvfix`; `scripts/test-cv-import.js` is a Playwright E2E suite (104 assertions) that runs the real app, imports each fixture through the modal, and checks every parsed field plus the apply-into-editor flow, the no-section-headers fallback, AI response mapping/merging and the guard rails:

```bash
python3 scripts/make-cv-fixtures.py
NODE_PATH="$(npm root -g)" node scripts/test-cv-import.js
```

The Gemini network call itself is intentionally not covered (it needs a real key); its response handling is tested via a canned JSON through `cviMapAi()`.

### Testing the ATS engine

`scripts/test-ats-v2.js` is a second Playwright suite (38 assertions): empty state, weak-vs-strong scoring, category bars and check rendering, role-keyword and job-description modes, chip and bulk keyword adding, and the full AI Coach flow with the Gemini network mocked — including the 503 error path (the button must re-enable and show an error, never spin forever).

```bash
NODE_PATH="$(npm root -g)" node scripts/test-ats-v2.js
```

`scripts/shoot-ats.js` regenerates the three ATS screenshots above the same way.

### Testing exports, the letter and the PWA

```bash
NODE_PATH="$(npm root -g)" node scripts/test-modules.js        # 16 checks — module graph, window bridge, 31 templates, SW precache
NODE_PATH="$(npm root -g)" node scripts/test-letter-edit.js     # 67 checks — full letter editing, envelope, exports agreement
NODE_PATH="$(npm root -g)" node scripts/test-export-docx.js   # 16 checks — DOCX packages, letter mode, LibreOffice round-trip
NODE_PATH="$(npm root -g)" node scripts/test-pwa.js            # 22 checks — manifest, SW lifecycle, offline boot, cache warm
```

`test-modules.js` guards the modular architecture itself: the ES-module graph loads with zero console errors and zero failed requests, all ten stylesheets load in cascade order, the window bridge exposes the public API (with live getters for mutable state), every one of the 31 templates renders real content, the carousel shows all designs as live renders, the service worker precaches every module and stylesheet, and the undo/redo providers are wired. `test-letter-edit.js` drives the real Letter tab: default layout and ids, smart fallbacks, every envelope override, add/remove/renumber of paragraphs, the single-paragraph guard, writer replacement, state round-trip and legacy `p1`–`p4` migration, and asserts the Markdown, plain-text, RTF and DOCX builders all carry the same envelope. `test-export-docx.js` drives the real export buttons, saves the downloads, then validates the ZIP/OOXML structure and content with Python's `zipfile` + `minidom` and converts one file with headless LibreOffice to prove it opens. `test-pwa.js` runs the service worker on `127.0.0.1` (a secure context) and asserts the full offline story — including that the Gemini API is never cached.

### Regenerating README screenshots

Serve the repo, then use Playwright against `restoreState()` with sample data and `changeTemplate(t)` — screenshot `#cvScaleOuter` per template into `docs/images/templates/`. `scripts/shoot-export.js` refreshes the export-dialog screenshot, `scripts/make-icons.js` regenerates the PWA icon set.

---

<div align="center">

**[Live demo](https://touhidsiddiqueeraj-bit.github.io/CV-Genie/)** · Built with vanilla HTML, CSS and JavaScript.

</div>
