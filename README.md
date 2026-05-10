🧞 CV Genie — Documentation
Version 1.0

CV Genie is a professional, client-side CV (Curriculum Vitae) builder designed to help users create beautiful, ATS-friendly resumes with zero friction. It features 13 distinct templates, server-rendered PDF/DOCX export, rich content assistance, deep ATS analysis, and a fully responsive mobile experience.

Live at: https://touhidsiddiqueeraj-bit.github.io/CV-Genie/

Table of Contents
Overview & Goals

Architecture & Tech Stack

Feature Breakdown

The Dashboard & Mobile Navigation

Smart Tabs (Edit, Content, Design, ATS, Tools)

CV Templates & Live Preview

Content Management

Design Customisation

ATS Analyser & Widget

Export System

Data Portability & Utilities

State Management & Undo/Redo

Important Global Variables & Data Structures

API Endpoints (Server-side)

Keyboard Shortcuts & Accessibility

Service Worker & PWA Enhancements

Common Maintenance Tasks

Adding a new CV Template

Adding a new Font Pair

Updating ATS Keyword Roles

Overview & Goals
CV Genie is designed to replace complex, bloated CV builders with a fast, privacy-respecting alternative. All data stays in the browser (except when explicitly exporting via a server for high-quality rendering). The application aims to:

Provide instant visual feedback for every change.

Offer serious document generation (PDF, DOCX, RTF) suitable for professional use.

Help users pass Applicant Tracking Systems (ATS) with built-in keyword analysis.

Work seamlessly on mobile devices, including the ability to switch between editing and previewing.

Architecture & Tech Stack
The application is a single, self-contained HTML file (SPA). There is no build step, no framework — just vanilla JavaScript, CSS, and carefully chosen libraries loaded from CDN.

Frontend Libraries:

html2pdf.js: Client-side PDF generation from HTML.

SortableJS: Drag-and-drop reordering for form sections and experience/education entries.

JSZip & FileSaver: Bundling multiple files (e.g., all 13 templates) into a ZIP download.

html2canvas: Rasterising the CV preview for client-side PDF/PNG.

pdf.js: Extracting text from LinkedIn profile PDF uploads.

Cropper.js: In-browser photo cropping and rotation.

LZ-String: Compressing CV state into shareable URL strings.

External Server (Microservice):

A companion Node.js server exposes two endpoints (/export-pdf and /export-docx) for generating high-quality, typographically precise files using headless Chrome and libraries like docx (on the server). The client gracefully falls back to browser-based exports if the server is unavailable.

Browser APIs Used:

Service Worker: Caches the app shell for offline access.

localStorage: Saves the current CV state and version history.

Clipboard API: For copying share links.

Feature Breakdown
The Dashboard & Mobile Navigation
The UI is split into a left-side Form Panel (the editor) and a main Preview Panel (the live CV).

Desktop (≥901px): The form panel and preview panel sit side-by-side. A unified toolbar above the preview handles template switching, undo/redo, export, and design quick-access.

Mobile (<901px): The form panel becomes a full-screen overlay. A floating "Preview" button (bottom-right) switches to the preview, where a sticky bottom nav bar lets you jump back to Edit, Preview, or Export.

Edit Mode: Nav bar is hidden; the form panel is shown.

Preview Mode: Form panel is hidden; the CV is shown full-width, and the bottom nav bar appears for quick actions.

Smart Tabs
The form panel is organised into five tabs, keeping the editor clean even on small screens:

✏️ Edit: All core CV sections (Personal Info, Summary, Skills, Experience, Education). Sections are collapsible and reorderable via drag-and-drop.

📚 Content: Content assistants.

Summary Templates: 15 role-specific professional summaries; click one, preview it in a confirmation dialog, and apply it to your CV.

Skill Cloud: Browse skills by category (Tech, Business, Creative, etc.) in a chip cloud. Select multiple and inject them into your Skills field.

🎨 Design: Visual settings.

Font Pairing: Choose from 6 typography combinations (e.g., Georgia, Inter, Playfair).

Accent Color: 8 preset colours to personalise the CV theme.

🎯 ATS: A powerful built-in analyser to check your CV's compatibility with Applicant Tracking Systems.

Target Role: Type a target job title (e.g., Software Engineer). The system parses this and compiles a relevant keyword list.

Custom Keywords: Manually add keywords not in the predefined lists; they are flagged with a star in the cloud.

Keyword Cloud: Shows every keyword the analyser is looking for. Present keywords are green, missing keywords are red. Clicking any missing keyword instantly adds it to your custom list and injects it into your Skills section.

Score Ring: A live donut chart showing your percentage match.

Checklist: Quick pass/fail for essential sections (Contact, Summary, Skills, etc.).

🔧 Tools: Utilities and data management.

Import LinkedIn Profile: Upload a LinkedIn "Save to PDF" export to autofill your CV.

JSON Backup: Export/import your entire CV state as a JSON file for safekeeping.

Share Link: Compress the entire CV state into an encoded URL parameter for easy sharing.

Version History: Manually snapshot your CV to save and restore up to 10 versions.

CV Templates & Live Preview
13 professionally designed templates are available. The preview updates live with every keystroke, debounced by 200ms for performance.

Template	Style Description
Classic	Traditional serif, centered name, simple and elegant.
Modern	Clean, colored header, two-column body.
Tabular	Structured table-based layout for technical or data roles.
Minimal	Light, airy, great for creative fields.
Colorful	Bold gradient header and sidebar.
Executive	Boardroom-ready, small caps, double-rule borders.
Timeline	Visual timeline for career progression.
Newspaper	Two-column layout, dense and information-rich.
Magazine	Editorial feel with a large colored masthead.
Infographic	Icon and card-based layout for visual impact.
Creative	Tag-based skills display and unique contact capsule.
Sidebar Bold	Prominent colored sidebar with contact/skills.
Corporate	Dark navy corporate header, clean and conservative.
The preview panel also shows an ATS Score Sidebar (desktop) / Strip (mobile) with a mini score ring and checklist, synced with the full ATS tab.

Content Management
Sections (Summary, Skills, Experience, Education) can be reordered by dragging their ⋮⋮ handles. The preview reflects the new order.

Dynamic Items: Experience and Education entries are draggable to reorder within their lists. Each entry has:

Drag handle (⋮⋮)

A red × remove button.

Fields for title, company/organisation, dates, and a description textarea.

Photo: Circular profile picture upload with integrated cropping and rotation (via Cropper.js). Max 5MB. The photo appears conditionally in every template.

Design Customisation
Accent Color: The selected color (--cv-color CSS variable) is used for borders, headers, skill tags, etc., across all templates.

Font Pairs: Changes --cv-font-heading and --cv-font-body CSS variables, instantly reflected in the preview and PDF exports.

ATS Analyser & Widget
The ATS (Applicant Tracking System) feature is a deep integration designed to maximise interview chances.

How it scores: You provide a Target Role. The system matches it against a hardcoded dictionary of ~60+ roles → keywords. It merges these role keywords with your custom-chipped keywords. The score is the percentage of these total keywords found in your CV text.

Interactive Cloud: This is the core user workflow. You see exactly which keywords are missing. A single click adds any missing keyword both to your analyser list and directly to the Skills field of your CV, instantly improving your score.

System-wide sync: The score, ring, and checklist are mirrored in the persistent ATS sidebar widget visible in the Preview panel.

Export System
Exporting is handled via a single modal. Users can select any combination of formats:

📕 High-Quality PDF (Server): Sends the raw HTML and computed styles of the CV preview to the server, which renders it with headless Chrome for perfect typography. Recommended for final submissions.

📕 PDF (Instant): Renders the CV client-side using html2pdf.js. Works offline, suitable for quick drafts.

📄 DOCX (Server): Sends structured JSON (name, experiences, etc.) to a server endpoint that assembles a native Word document using the docx npm library. Fully editable.

📄 RTF (Instant): Generates a Rich Text Format file entirely in the browser. A solid fallback for lightweight, editable text documents.

Bulk Export: The "Export All 13 Templates as ZIP" button iterates through every template with your current data and generates a zip file containing the selected formats for all 13 designs.

Data Portability & Utilities
JSON Backup: Full export and import of your CV state. The state structure is versioned (v: '1.0') for future compatibility.

Shareable Links: Uses LZ-String to compress the entire state into a URL. Anyone with the link can load your exact CV into their browser (no data is sent to a server).

Local Persistence: The app autosaves the state to localStorage under the key cvGenie_v2.0 every 30 seconds. It also migrates data from the cvGenie_v1.0 key on first load.

Version History: The user can manually save named versions (up to 10) to localStorage and restore or delete them.

State Management & Undo/Redo
The entire CV state is serialised into a single JavaScript object by the getState() function. The essentials are:

Undo Stack: A capped (50 items) array of state objects. Every structural change (addExperience, section reorder, manual edit) pushes the current state.

Redo Stack: Cleared on any new undoable action.

Restoration: restoreState() completely rebuilds the form and preview from a state object, including repopulating dynamic fields and setting all visual preferences.

Important Global Variables & Data Structures
Understanding these will help you modify the app.

Variable	Type	Description
currentTemplate	string	The active template slug (e.g., 'modern').
currentColor	string	Hex color code for the accent (e.g., '#059669').
currentFontPair	number	Index of the active font pair in the FONT_PAIRS array.
photoData	string	Base64-encoded data URL of the cropped profile photo, or null.
sectionOrder	string[]	E.g., ['summary', 'skills', 'experience', 'education'].
customKWList	string[]	User-entered custom ATS keywords, stored in lowercase.
versionSlots	object[]	Array of {timestamp, preview, state} objects for version history.
exportSel	object	Boolean flags for the export modal: serverPdf, clientPdf, serverDocx, rtf.
pendindLinkedInData	object	Parsed data from an uploaded LinkedIn PDF, awaiting user confirmation.
TEMPLATE_META: Object keyed by template slug, storing name, icon, and desc for the UI.
SUMMARY_TEMPLATES: Array of {label, text} for the 15 pre-written summary options.
SKILL_CATEGORIES: Object mapping a category name to an array of skill strings.
ROLE_KW (inside runATSAnalysis): A massive dictionary mapping role names (e.g., 'software engineer') to arrays of keywords.

API Endpoints (Server-side)
The app expects a thin server running at a configurable base URL (default set in PDF_SERVER_URL and DOCX_SERVER_URL variables). The server provides two endpoints:

POST /export-pdf

Request Body (JSON):

json
{
  "html": "<div class=\"cv-preview cv-modern\">...</div>",
  "color": "#2563eb",
  "fontHeading": "Georgia, serif",
  "fontBody": "Georgia, serif"
}
Response: application/pdf binary download.

POST /export-docx

Request Body (JSON):

json
{
  "name": "John Doe",
  "title": "Software Engineer",
  "contact": "john@example.com | ...",
  "summary": "...",
  "skills": "...",
  "experiences": [{ "title": "...", "company": "...", "dates": "...", "description": "..." }],
  "education": [{ "degree": "...", "institution": "...", "year": "..." }]
}
Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document binary download.

Both endpoints handle CORS and should return structured JSON errors ({ "error": "message" }) on failure.

Keyboard Shortcuts & Accessibility
Ctrl+Z / Cmd+Z: Undo (only when not in a text field).

Ctrl+Y / Cmd+Y or Ctrl+Shift+Z: Redo (only when not in a text field).

Ctrl+S / Cmd+S: Suppressed to prevent the browser save dialog.

Tab Navigation: Form is standard HTML; Tab and Shift+Tab navigate all fields.

Section Collapse: Headers are keyboard-focusable buttons.

Color Contrast: Dark mode is fully supported and auto-detected on load via prefers-color-scheme or manual toggle.

Service Worker & PWA Enhancements
A minimal Service Worker is registered on the fly from a blob URL. It caches the root (/) under the cache name cvgenie-v1, allowing the app to load offline. The install and fetch events handle caching; skipWaiting ensures the new worker activates immediately. This is a basic "cache-first" strategy suitable for the static single-file nature of the app.

Common Maintenance Tasks
Adding a new CV Template
Add the slug string to the TEMPLATES array (e.g., 'fresh').

Add its metadata to TEMPLATE_META.

In the _updatePreviewNow() function's giant switch statement, add a new case 'fresh' block. Build the html string using the same helper variables ($eH, $dH, esc(), $ph, etc.).

If the new template needs unique CSS, add a .cv-preview.cv-fresh rule in the <style> block.

Adding a new Font Pair
Add an object to the FONT_PAIRS array: {name:'New Pair', heading:'...', body:'...'}.

You may need to import the font in the <style> tag (e.g., an @import statement for Google Fonts) if it's not already loaded by the user's OS.

The new pair will automatically appear in the Design tab and Preview toolbar.

Updating ATS Keyword Roles
Locate the ROLE_KW variable inside the runATSAnalysis() function. The targetRole input is matched (longest-match-wins) against the keys of this object. The matching is flexible: the user's typed role can contain the key, or the key can contain the typed role.

To add a role: Add a new key (e.g., 'architect') with an array of relevant keywords.

To tune keywords: Simply edit the arrays. Remember all matching is case-insensitive.

