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
