#!/usr/bin/env python3
"""Generate CV fixtures for testing the CV-Genie import parser.
Writes /tmp/cvfix/{fixture1.txt, fixture2.docx, fixture3.pdf}"""
import os

OUT = "/tmp/cvfix"
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- fixture 1: TXT
FIXTURE1 = """CURRICULUM VITAE

Touhid Siddique
Senior Software Engineer
Dhaka, Bangladesh
touhid.siddique@gmail.com | +880 1712 345 678 | linkedin.com/in/touhidsiddique

PROFESSIONAL SUMMARY
Results-driven software engineer with 7+ years of experience building scalable
web applications. Specialised in JavaScript ecosystems and cloud-native
architecture. Proven record of mentoring teams and shipping products used by
millions.

WORK EXPERIENCE

Senior Software Engineer
TechCorp Solutions Ltd.
Jan 2021 - Present
* Led a team of 6 engineers building a multi-tenant SaaS platform
* Reduced API latency by 45% through caching and query optimisation
* Introduced CI/CD pipelines that cut release time from days to hours

Software Engineer
Globex Digital Agency
Mar 2018 - Dec 2020
- Built customer portals with React and Node.js
- Migrated legacy services to Docker containers

Junior Web Developer
Initech Systems
July 2016 - February 2018
* Maintained e-commerce checkout flows
* Wrote unit tests raising coverage to 80%

EDUCATION

BSc in Computer Science
University of Dhaka
2013 - 2016

SKILLS
JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, AWS, CI/CD, REST APIs, GraphQL, Team Leadership

LANGUAGES
Bengali (Native)
English (C1)
Hindi (B1)

REFERENCES
Available upon request.
"""
with open(os.path.join(OUT, "fixture1.txt"), "w", encoding="utf-8") as f:
    f.write(FIXTURE1)

# ---------------------------------------------------------------- fixture 2: DOCX
import docx
from docx.shared import Pt

doc = docx.Document()
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)

doc.add_heading("Amelia Bennett", level=0)
p = doc.add_paragraph("Senior Product Designer")
p = doc.add_paragraph("London, UK | amelia.bennett@email.com | +44 7700 900123 | linkedin.com/in/ameliabennett")

doc.add_heading("Profile", level=1)
doc.add_paragraph(
    "Product designer with 8 years of experience leading end-to-end design for B2B SaaS products. "
    "I pair rigorous research with fast prototyping to ship accessible, data-informed interfaces."
)

doc.add_heading("Experience", level=1)
doc.add_paragraph("Senior Product Designer, Northwind Labs \u2014 Jan 2021 to Present")
doc.add_paragraph("Lead designer for a design system used by 40+ engineers.", style="List Bullet")
doc.add_paragraph("Introduced token-based theming, cutting design QA time by 35%.", style="List Bullet")
doc.add_paragraph("Product Designer, Brightline Software \u2014 Mar 2018 to Dec 2020")
doc.add_paragraph("Designed onboarding flows that lifted activation by 22%.", style="List Bullet")
doc.add_paragraph("Ran monthly usability studies with 100+ participants.", style="List Bullet")
doc.add_paragraph("UI Designer, Studio Kappa \u2014 2016 \u2013 2018")
doc.add_paragraph("Delivered brand and interface design for 15 client projects.", style="List Bullet")

doc.add_heading("Education & Training", level=1)
doc.add_paragraph("BA (Hons) Graphic Communication, University of Leeds, 2012 - 2016")
doc.add_paragraph("Interaction Design Specialisation, UC San Diego, 2017")

doc.add_heading("Skills", level=1)
doc.add_paragraph("Figma, Design Systems, User Research, Prototyping, Accessibility, HTML/CSS, Design Tokens")

doc.add_heading("Languages", level=1)
doc.add_paragraph("English \u2014 Native")
doc.add_paragraph("French \u2014 Fluent")

doc.save(os.path.join(OUT, "fixture2.docx"))

# ---------------------------------------------------------------- fixture 3: PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("Sans", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("SansB", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"))

c = canvas.Canvas(os.path.join(OUT, "fixture3.pdf"), pagesize=A4)
w, h = A4
y = h - 20 * mm
LEFT = 20 * mm


def para(text, size=9.5, bold=False, gap=4.5, indent=0):
    global y
    c.setFont("SansB" if bold else "Sans", size)
    c.drawString(LEFT + indent, y, text)
    y -= size / 2.8 * mm + gap / 2.8 * mm


def head(text):
    global y
    y -= 3 * mm
    c.setFont("SansB", 11)
    c.drawString(LEFT, y, text.upper())
    y -= 8 * mm


para("Sofia Andersen", 17, bold=True, gap=6)
para("Data Analyst", 11, gap=2)
para("Berlin, Germany | s.andersen@mail.de | +49 30 1234 5678", gap=2)
para("linkedin.com/in/sofiaandersen", gap=6)

head("About Me")
para("Analytical data specialist with 6 years of experience turning messy datasets into decisions.")
para("Comfortable owning the full pipeline from ingestion to executive dashboards.")

head("Employment History")
para("Data Analyst at Contoso \u2014 03/2019 - 06/2022", bold=True)
para("Built the company-wide reporting layer in SQL and Tableau.", indent=6)
para("Automated weekly reports, saving 12 hours per week.", indent=6)
para("Junior Data Analyst, Fabrikam Retail \u2014 08/2017 - 02/2019", bold=True)
para("Cleaned POS data and maintained the product catalogue.", indent=6)
para("Intern, Northwind Traders \u2014 Jan 2017 - Jun 2017", bold=True)
para("Supported the analytics team with ad-hoc queries.", indent=6)

head("Education")
para("MSc Statistics, London School of Economics, 2015 - 2017", bold=True)
para("BSc Mathematics, University of Manchester, 2012 - 2015", bold=True)

head("Technical Skills")
para("Python, SQL, Tableau, Excel (advanced), R, dbt, Airflow")

head("Languages")
para("German: Native, English: C2, French: B2, Spanish: A2")

c.showPage()
c.save()

# ---------------------------------------------------------------- fixture 4: LinkedIn-style PDF
# Mirrors the structure of LinkedIn's "Save to PDF" profile export: stacked
# identity lines, "About" heading, experience blocks with "· Full-time" and
# "· 2 yrs 3 mos" decorations, one skill per line, and LinkedIn's ILR-style
# language proficiency labels.
lc = canvas.Canvas(os.path.join(OUT, "fixture4-linkedin.pdf"), pagesize=A4)
y = h - 20 * mm


def lpara(text, size=9.5, bold=False, gap=4.5, indent=0):
    global y
    lc.setFont("SansB" if bold else "Sans", size)
    lc.drawString(LEFT + indent, y, text)
    y -= size / 2.8 * mm + gap / 2.8 * mm


def lhead(text):
    global y
    y -= 4 * mm
    lc.setFont("SansB", 11.5)
    lc.drawString(LEFT, y, text)
    y -= 9 * mm


lpara("Touhid Siddique", 16, bold=True, gap=6)
lpara("Senior Software Engineer", 10, gap=2)
lpara("Dhaka, Bangladesh", 9.5, gap=2)
lpara("500+ connections", 9.5, gap=2)
lpara("Contact info", 9.5, gap=6)

lhead("About")
lpara("Results-driven software engineer with 7 years of experience building scalable web")
lpara("applications. Specialised in JavaScript ecosystems and cloud-native architecture.")
lpara("Proven record of mentoring teams and shipping products used by millions.")

lhead("Experience")
lpara("Software Engineer", 10, bold=True, gap=2)
lpara("TechCorp Solutions Ltd. \u00b7 Full-time", 9.5, gap=2)
lpara("Jan 2021 - Present \u00b7 2 yrs 3 mos", 9.5, gap=2)
lpara("Dhaka, Bangladesh", 9.5, gap=2)
lpara("Built a multi-tenant SaaS platform serving 2M users.")
lpara("Led a team of 6 engineers across two squads.")
lpara("Junior Software Engineer", 10, bold=True, gap=2)
lpara("Globex Digital Agency", 9.5, gap=2)
lpara("Mar 2018 - Dec 2020 \u00b7 2 yrs 10 mos", 9.5, gap=2)
lpara("Dhaka, Bangladesh", 9.5, gap=2)
lpara("Built customer portals with React and Node.js.")

lhead("Education")
lpara("University of Dhaka", 10, bold=True, gap=2)
lpara("BSc in Computer Science and Engineering", 9.5, gap=2)
lpara("2013 - 2017", 9.5, gap=6)

lhead("Licenses & Certifications")
lpara("AWS Certified Solutions Architect", 9.5, gap=6)

lhead("Skills")
lpara("JavaScript")
lpara("TypeScript")
lpara("React")
lpara("Node.js")
lpara("Docker")
lpara("SQL")

lhead("Languages")
lpara("English")
lpara("Full professional proficiency")
lpara("Bengali")
lpara("Native or bilingual proficiency")

lc.showPage()
lc.save()

print("Fixtures written to", OUT)
for fn in sorted(os.listdir(OUT)):
    print(" -", fn, os.path.getsize(os.path.join(OUT, fn)), "bytes")

# ---------------------------------------------------------------- fixture 5: researcher CV
# Mirrors the structure of the reference CV that inspired the Scholar
# template: publications with wrapped titles + right-aligned dates + venue /
# status / DOI lines, projects closed by URLs, volunteering org+role pairs,
# skills categories and an interests line. Synthetic personal data.
rc = canvas.Canvas(os.path.join(OUT, "fixture5-researcher.pdf"), pagesize=A4)
ry = h - 20 * mm


def rpara(text, size=9.5, bold=False, gap=4.5, indent=0, right=False):
    global ry
    rc.setFont("SansB" if bold else "Sans", size)
    if right:
        rc.drawRightString(w - 20 * mm, ry, text)
    else:
        rc.drawString(LEFT + indent, ry, text)
    ry -= size / 2.8 * mm + gap / 2.8 * mm


def rpub(title_lines, date, venue, status, doi):
    global ry
    # title line 1 and the date share a baseline (as in the reference CV)
    rc.setFont("SansB", 10)
    rc.drawString(LEFT, ry, title_lines[0])
    rc.setFont("Sans", 8)
    rc.drawRightString(w - 20 * mm, ry, date)
    ry -= 10 / 2.8 * mm + 2 / 2.8 * mm
    for extra in title_lines[1:]:
        rpara(extra, 10, bold=True, gap=2)
    rpara(venue, 8.8, gap=2)
    rpara(status, 8.8, gap=2)
    rpara("DOI: " + doi, 7.6, gap=7)


def rhead(text):
    global ry
    if ry < 34 * mm:  # keep each section block on one page
        rc.showPage()
        ry = h - 20 * mm
    ry -= 4 * mm
    rc.setFont("SansB", 11.5)
    rc.drawString(LEFT, ry, text)
    ry -= 9 * mm


rpara("Dr. Amira Rahman", 16, bold=True, gap=6)
rpara("Embedded Systems Researcher \u2014 Applied ML and Power Electronics", 10, gap=2)
rpara("amira.rahman@example.edu", 9.5, gap=2)
rpara("+880 1712 345 678", 9.5, gap=6)

rhead("Summary")
rpara("Embedded systems researcher with hands-on experience spanning firmware, applied")
rpara("machine learning, and simulation. Leading author on three journal papers with two")
rpara("accepted at international venues. Active open-source maintainer.")

rhead("Experience")
rpara("Research Assistant", 10, bold=True, gap=2)
rpara("Green Energy Lab \u00b7 Dhaka", 9.5, gap=2)
rpara("January 2024 - Present", 9.5, gap=2)
rpara("Built data-acquisition firmware for solar MPPT test benches.")
rpara("Lab Instructor", 10, bold=True, gap=2)
rpara("City Institute of Technology", 9.5, gap=2)
rpara("March 2022 - December 2023", 9.5, gap=2)
rpara("Ran embedded-systems labs for undergraduate cohorts of 60 students.")

rhead("Education")
rpara("M.Sc. in Electrical Engineering", 10, bold=True, gap=2)
rpara("University of Engineering and Technology", 9.5, gap=2)
rpara("2024", 9.5, gap=6)
rpara("B.Sc. in EEE", 10, bold=True, gap=2)
rpara("City University", 9.5, gap=2)
rpara("2022", 9.5, gap=6)

rhead("Publications")
rpub(["Helios-B: Simulation-Based Validation of a Dual-Microcontroller Predictive",
      "MPPT Controller with On-Device Retraining for Tropical Deployment"],
     "September 2026", "IJPEDS \u00b7 Paper ID 90011", "Accepted, pending publication",
     "https://doi.org/10.5281/zenodo.99990001")
rpub(["Sampling limits of digitally controlled buck converters under monsoon humidity"],
     "October 2026", "IEEE Transactions on Power Electronics \u00b7 Manuscript ID TPE-26-001",
     "Under first review", "https://doi.org/10.5281/zenodo.99990002")
rpub(["A survey of machine learning in battery management across 400 studies"],
     "October 2026", "Preprint", "Preprint", "https://doi.org/10.5281/zenodo.99990003")

rhead("Projects")
rpara("Aurora Editor", 10, bold=True, gap=2)
rpara("An open source schematic editor", 8.8, gap=2)
rpara("https://github.com/example/aurora", 7.6, gap=6)
rpara("Nimbus Dashboard", 10, bold=True, gap=2)
rpara("Weather station telemetry viewer", 8.8, gap=2)
rpara("https://github.com/example/nimbus", 7.6, gap=6)

rhead("Volunteering")
rpara("Robotics Club", 10, bold=True, gap=2)
rpara("Joint General Secretary", 8.8, gap=6)
rpara("Science Olympiad Committee", 10, bold=True, gap=2)
rpara("Publicity Secretary", 8.8, gap=6)

rhead("Skills")
rpara("Scientific Writing & Research, Embedded Systems & Firmware, Machine Learning,")
rpara("Simulation & Modeling")

rhead("Interests")
rpara("Chess, Astronomy, Cycling, Documentary Films")

rhead("Languages")
rpara("Bengali: Native, English: C2, Hindi: A2")

rc.showPage()
rc.save()
print("fixture5-researcher.pdf written")

# ---------------------------------------------------------------- fixture 6: researcher CV v2 (hard mode)
# Mirrors the real reference CV's harder publication layout that tripped the
# v2.9 parser: PURE date lines below wrapped titles (no inline date), short
# title continuations ("converters"), an "Earlier preprint version …: URL"
# extra link line, hyphen-wrapped titles ("routine-" / "quality envelope"),
# and volunteering orgs whose names contain role-ish words ("Leading
# University … Club"). Synthetic data.
rc2 = canvas.Canvas(os.path.join(OUT, "fixture6-researcher2.pdf"), pagesize=A4)
ry = h - 20 * mm


def r2para(text, size=9.5, bold=False, gap=4.5):
    global ry
    rc2.setFont("SansB" if bold else "Sans", size)
    rc2.drawString(LEFT, ry, text)
    ry -= size / 2.8 * mm + gap / 2.8 * mm


def r2pub(title_lines, date, *meta):
    global ry
    for tl in title_lines:
        r2para(tl, 10, bold=True, gap=2)
    r2para(date, 8)
    for m in meta:
        r2para(m, 8.8, gap=2)
    ry -= 2.4 * mm


def r2head(text):
    global ry
    if ry < 34 * mm:
        rc2.showPage()
        ry = h - 20 * mm
    ry -= 4 * mm
    rc2.setFont("SansB", 11.5)
    rc2.drawString(LEFT, ry, text)
    ry -= 9 * mm


r2para("Dr. Nadia Karim", 16, bold=True, gap=6)
r2para("Embedded Systems Researcher \u2014 Applied ML and Power Electronics", 10, gap=2)
r2para("nadia.karim@example.edu", 9.5, gap=2)
r2para("+880 1712 345 678", 9.5, gap=6)

r2head("Publications")
r2pub(["Helios-C: Design and Simulation-Based Validation of a Dual-Microcontroller",
       "Predictive Solar MPPT Controller with On-Device LSTM Retraining for Dhaka Monsoon",
       "SHS Deployment in Bangladesh"],
      "September 2026",
      "IJPEDS \u00b7 Paper ID 25195",
      "Paper is accepted, pending publication.",
      "DOI: https://doi.org/10.5281/zenodo.11111101")
r2pub(["Sampling and quantization limits of digitally controlled inverting buck-boost",
       "converters"],
      "October 2026",
      "IJPEDS \u00b7 Paper ID 25525",
      "Under second round of revisions",
      "DOI: https://doi.org/10.5281/zenodo.11111102")
r2pub(["Machine learning in battery management systems: a two-tier scoping review of 199",
       "eligible records with in-depth classification and validation audit of 103 studies"],
      "October 2026",
      "IEEE Transactions on Transportation Electrification",
      "Under 1st round of reviews",
      "DOI: https://doi.org/10.5281/zenodo.11111103",
      "Earlier preprint version (199 eligible studies): https://doi.org/10.5281/zenodo.11111104")
r2pub(["Is Wireless Security Ready for the AI Era? Evidence from a Curated Corpus of 130",
       "Studies, 2021\u20132026"],
      "October 2026",
      "IET Communications \u00b7 Manuscript ID COM-2026-10-0413",
      "Under first review",
      "DOI: https://doi.org/10.5281/zenodo.11111105")
r2pub(["Modeling electrical losses in CsPbI3 solar cells: stacked idealizations and a routine-",
       "quality envelope at 17.0%"],
      "October 2026",
      "Manuscript ID ADV26-AR-05017",
      "Submitted",
      "DOI: https://doi.org/10.5281/zenodo.11111106")
r2pub(["Oxidation-Budgeted Design of Lead-Free RbGeI3 Solar Cells: Back-Surface-Field Enhancement",
       "Benchmarked Against CsGeI3"],
      "October 2026",
      "Manuscript ID JAP26-AR-04819",
      "Submitted",
      "DOI: https://doi.org/10.5281/zenodo.11111107")

r2head("Volunteering")
r2para("Leading University Social Service Club", 10, bold=True, gap=2)
r2para("Joint General Secretary", 8.8, gap=6)
r2para("Leading University Electronics Club", 10, bold=True, gap=2)
r2para("Publicity Secretary", 8.8, gap=6)

r2head("Skills")
r2para("Scientific Writing & Research")
r2para("Embedded Systems & Firmware")
r2para("Machine Learning & Data Science")
r2para("Software Development")
r2para("Simulation & Modeling")

r2head("Interests")
r2para("Gaming, Travelling, Movies, Music, Strength-Sports")

r2head("Languages")
r2para("Bengali: Native, English: C2, Hindi: B1, German: A1")

rc2.showPage()
rc2.save()
print("fixture6-researcher2.pdf written")
