# 🧞 CV Genie

**A free, private, browser-based CV builder. No sign-up. No server. No data ever leaves your device.**

🔗 **[Live Demo](https://touhidsiddiqueeraj-bit.github.io/CV-Genie/)**

---


Warning: Full ATS functionality is currently broken

## ✨ Features

### 🎨 13 Professional Templates
| Template | Style |
|---|---|
| 🏛️ Classic | Traditional serif, timeless layout |
| ✨ Modern | Clean header with color sidebar |
| 📊 Tabular | Table-based, structured format |
| ◻️ Minimal | Light & elegant, lots of whitespace |
| 🎨 Colorful | Bold gradient header, skill bars |
| 💼 Executive | Boardroom-ready, small-caps name |
| 📅 Timeline | Visual career timeline with dots |
| 📰 Newspaper | Two-column editorial layout |
| 📖 Magazine | Large editorial name display |
| 📈 Infographic | Data cards with stat tags |
| 🎯 Creative | Tag-based contact chips |
| 📌 Sidebar Bold | Full-color sidebar panel |
| 🏢 Corporate | Blue bordered corporate style |

### 📤 Export Options
- **PDF** — ATS-optimized, text-selectable, A4 format
- **DOCX** — Fully formatted Word document with proper XML
- **Export All as ZIP** — All 13 templates exported as PNGs in one click

### 🎯 ATS Score Analyzer
- Real-time ATS compatibility score (0–100) with visual ring indicator
- Role-specific keyword matching for: Software Engineer, Product Manager, Data Scientist, DevOps, UX Designer, Marketing Manager, Construction Manager, and more
- Checklist breakdown: contact info, summary length, skills, experience, education, keyword density
- Color-coded keyword cloud showing matched vs missing terms

### 🛠️ Content Tools
- **15 Summary Templates** covering: Software Engineer, Product Manager, Data Scientist, UX Designer, Marketing Manager, Project Manager, Sales Executive, Teacher, Nurse, Accountant, Construction Manager, HR Professional, Consultant, Entrepreneur, Recent Graduate
- **Skill Cloud** with 8 industry categories: Technology, Business, Creative, Construction, Healthcare, Finance, Marketing, Education — click to add skills in bulk

### 🎨 Design Controls
- **6 Font Pairings**: Classic Serif, Modern Sans, Roboto + Lora, Montserrat + Merriweather, Playfair + Source, Poppins + Inter
- **8 Accent Colors** applied across all templates
- Drag-and-drop section reordering (Summary, Skills, Experience, Education)
- Drag-and-drop reordering within Experience and Education lists

### 📸 Photo Support
- Upload a profile photo
- Built-in crop & rotate editor (square crop, 300×300px output)
- Photo shown/hidden per template automatically

### 💾 Data & Privacy
- **Auto-saves** to localStorage every 5 minutes
- **Version History** — save up to 10 named snapshots, load or delete any
- **JSON export/import** — full backup and restore
- **Share via URL** — compresses full CV state into a shareable link (LZ-string)
- All data stays in your browser — zero network requests for your CV data

### ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Cmd+S` | Save version snapshot |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Y` | Redo |

### 📱 Mobile Friendly
- Responsive layout with bottom navigation bar on mobile
- Separate Edit / Preview panels with tab switching
- Touch-friendly drag handles and buttons

### 🌙 Dark Mode
- Toggle in the header, or follows system preference automatically
- Persisted across sessions

### 📄 LinkedIn PDF Import
- Drop or upload your LinkedIn PDF export
- Auto-extracts name, title, email, phone, summary, skills, experience, and education

---

## 🚀 Usage

**No installation needed.** Just open the file:

```bash
# Option 1 — open directly
double-click CV_Genie.html

# Option 2 — open from terminal
xdg-open CV_Genie.html   # Linux
open CV_Genie.html        # macOS
start CV_Genie.html       # Windows
```

Or use the **[live hosted version](https://touhidsiddiqueeraj-bit.github.io/CV-Genie/CV_Genie.html)** — no download required.

---

## 🔧 Tech Stack

This is a **zero-dependency, single HTML file** application. Everything is self-contained.

| Library | Purpose |
|---|---|
| [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) | PDF export |
| [html2canvas](https://html2canvas.hertzen.com/) | Template PNG export |
| [SortableJS](https://sortablejs.github.io/Sortable/) | Drag-and-drop reordering |
| [JSZip](https://stuk.github.io/jszip/) | ZIP file generation |
| [FileSaver.js](https://github.com/eligrey/FileSaver.js) | File download triggering |
| [PDF.js](https://mozilla.github.io/pdf.js/) | LinkedIn PDF parsing |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | Photo crop & rotate |
| [LZ-String](https://pieroxy.net/blog/pages/lz-string/index.html) | URL share compression |
| Google Fonts | Inter, Lora, Merriweather, Montserrat, Playfair Display, Poppins, Roboto, Source Serif 4 |

No build tools. No npm. No frameworks. Just a browser.

---

## 📁 Project Structure

```
CV-Genie/
├── CV_Genie.html   # The entire application
└── README.md
```

---

## 🤝 Contributing

1. Fork the repo
2. Edit `CV_Genie.html` directly
3. Open it in a browser to test
4. Submit a pull request

Ideas welcome — new templates, export formats, ATS keyword sets, accessibility improvements.

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with vanilla HTML, CSS, and JavaScript. No tracking. No ads. No sign-up.*
