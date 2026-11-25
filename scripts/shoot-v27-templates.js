// Screenshot each of the 6 new v2.7 templates with sample data (local server).
const { chromium } = require('playwright');
const NEW = ['primo', 'diamond', 'berlin', 'monogram', 'wallstreet', 'medic'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1380, height: 1000 } });
  await page.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    switchTab('edit', null);
    /* sample data so every template shows real content */
    document.getElementById('fullName').value = 'Amelia Bennett';
    document.getElementById('title').value = 'Senior Product Designer';
    document.getElementById('email').value = 'amelia.bennett@email.com';
    document.getElementById('phone').value = '+44 7700 900123';
    document.getElementById('location').value = 'London, UK';
    document.getElementById('linkedin').value = 'linkedin.com/in/ameliabennett';
    document.getElementById('summary').value = 'Product designer with 8 years of experience leading end-to-end design for B2B SaaS products. Pairs rigorous research with fast prototyping to ship accessible, data-informed interfaces.';
    document.getElementById('skills').value = 'Figma, Design Systems, User Research, Prototyping, Accessibility, HTML/CSS';
    /* two experience items + one education item */
    addExperience();
    const items = document.querySelectorAll('#experienceList .dynamic-item');
    const e0 = items[items.length - 1];
    e0.querySelectorAll('input')[0].value = 'Senior Product Designer';
    e0.querySelectorAll('input')[1].value = 'Northwind Labs';
    e0.querySelectorAll('input')[2].value = 'Jan 2021 - Present';
    e0.querySelector('textarea').value = 'Lead designer for a design system used by 40+ engineers.\nIntroduced token-based theming, cutting QA time by 35%.';
    addExperience();
    const items2 = document.querySelectorAll('#experienceList .dynamic-item');
    const e1 = items2[items2.length - 1];
    e1.querySelectorAll('input')[0].value = 'Product Designer';
    e1.querySelectorAll('input')[1].value = 'Brightline Software';
    e1.querySelectorAll('input')[2].value = 'Mar 2018 - Dec 2020';
    e1.querySelector('textarea').value = 'Designed onboarding flows that lifted activation by 22%.';
    addEducation();
    const ed = document.querySelectorAll('#educationList .dynamic-item');
    const d0 = ed[ed.length - 1];
    d0.querySelectorAll('input')[0].value = 'BA (Hons) Graphic Communication';
    d0.querySelectorAll('input')[1].value = 'University of Leeds';
    d0.querySelectorAll('input')[2].value = '2012 - 2016';
    addLanguage();
    const lg = document.querySelectorAll('#languageList .dynamic-item');
    lg[lg.length - 1].querySelector('input').value = 'French';
    lg[lg.length - 1].querySelector('select').value = 'C1';
    setPreviewMode('document');
    updatePreview();
  });
  await page.waitForTimeout(600);
  for (const t of NEW) {
    await page.evaluate((tpl) => { changeTemplate(tpl); }, t); /* changeTemplate also swaps the wrapper's template class */
    await page.waitForTimeout(450);
    await page.screenshot({ path: `/tmp/render/v27-${t}.png` });
    console.log(t, 'shot');
  }
  await browser.close();
  console.log('done');
})();
