<script>
// ============ EXPORT ALL TEMPLATES ============
async function exportAllTemplates() {
  const formats = [];
  if (exportSel.serverPdf) formats.push('server-pdf');
  if (exportSel.clientPdf) formats.push('client-pdf');
  if (exportSel.serverDocx) formats.push('docx');
  if (exportSel.rtf) formats.push('rtf');
  if (formats.length === 0) formats.push('png');

  const orig = currentTemplate;
  const zip = new JSZip();
  const s = document.getElementById('exportStatus');
  s.style.display = 'block';
  let successCount = 0;
  const total = TEMPLATES.length * formats.length;

  for (const t of TEMPLATES) {
    const tIdx = TEMPLATES.indexOf(t) + 1;
    changeTemplate(t);
    await new Promise(r => setTimeout(r, 500));

    for (const fmt of formats) {
      s.textContent = 'Rendering ' + t + ' (' + fmt + ') — template ' + tIdx + '/' + TEMPLATES.length + '...';
      try {
        if (fmt === 'png') {
          const c = await html2canvas(document.getElementById('cvPreview'), { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
          zip.file('cv-genie-' + t + '.png', c.toDataURL('image/png').split(',')[1], { base64: true });
          successCount++;
        } else if (fmt === 'client-pdf') {
          const pdfBlob = await html2pdf().set({
            margin: [8, 8],
            filename: 'cv-genie-' + t + '.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          }).from(document.getElementById('cvPreview')).outputPdf('blob');
          zip.file('cv-genie-' + t + '.pdf', pdfBlob);
          successCount++;
        } else if (fmt === 'server-pdf') {
          const preview = document.getElementById('cvPreview');
          const cs = getComputedStyle(document.documentElement);
          const r = await fetch(PDF_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              html: preview.outerHTML,
              color: cs.getPropertyValue('--cv-color').trim() || '#2563eb',
              fontHeading: cs.getPropertyValue('--cv-font-heading').trim() || 'Georgia, serif',
              fontBody: cs.getPropertyValue('--cv-font-body').trim() || 'Georgia, serif'
            })
          });
          if (r.ok) {
            const b = await r.blob();
            if (b.size >= 1000) {
              zip.file('cv-genie-' + t + '-hq.pdf', b);
              successCount++;
            }
          }
        } else if (fmt === 'docx') {
          const data = {
            name: document.getElementById('fullName')?.value || 'Your Name',
            title: document.getElementById('title')?.value || '',
            contact: [document.getElementById('email')?.value, document.getElementById('phone')?.value, document.getElementById('linkedin')?.value, document.getElementById('location')?.value].filter(Boolean).join(' | '),
            summary: document.getElementById('summary')?.value || '',
            skills: document.getElementById('skills')?.value || '',
            experiences: getExperiences(),
            education: getEducation()
          };
          const r = await fetch(DOCX_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (r.ok) {
            const b = await r.blob();
            if (b.size >= 1000) {
              zip.file('cv-genie-' + t + '.docx', b);
              successCount++;
            }
          }
        } else if (fmt === 'rtf') {
          const name = document.getElementById('fullName')?.value || 'Your Name';
          const title = document.getElementById('title')?.value || '';
          const cp = [document.getElementById('email')?.value, document.getElementById('phone')?.value, document.getElementById('linkedin')?.value, document.getElementById('location')?.value].filter(Boolean);
          const summary = document.getElementById('summary')?.value || '';
          const skills = document.getElementById('skills')?.value || '';
          const exp = getExperiences();
          const edu = getEducation();

          const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\line ');
          let rtfStr = '{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\froman Georgia;}}\n{\colortbl;\\red0\\green0\\blue0;\\red85\\green85\\blue85;}\npaperw11906\\paperh16838\\margl1440\\margr1440\\margt1440\\margb1440\n';
          rtfStr += '\\pard\\qc\\sb100\\sa40{\\f1\\fs36\\b ' + esc(name) + '}\\par\n';
          if (title) rtfStr += '\\pard\\qc\\sb0\\sa60{\\f1\\fs22\\cf2 ' + esc(title) + '}\\par\n';
          if (cp.length) rtfStr += '\\pard\\qc\\sb0\\sa120{\\f0\\fs18 ' + esc(cp.join(' | ')) + '\\par\n';
          if (summary.trim()) { rtfStr += '\\pard\\sb120\\sa40{\\f1\\fs22\\b\\caps PROFESSIONAL SUMMARY}\\par\n\\pard\\sb0\\sa120{\\f1\\fs20 ' + esc(summary) + '\\par\n'; }
          if (exp.length) {
            rtfStr += '\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps EXPERIENCE}\\par\n';
            exp.forEach(x => {
              rtfStr += '\\pard\\sb60\\sa0{\\f1\\fs22\\b ' + esc(x.title || '') + '\\par\n';
              rtfStr += '\\pard\\sb0\\sa0{\\f1\\fs20\\cf2 ' + esc(x.company || '') + ' — ' + esc(x.dates || '') + '\\par\n';
              if (x.description) rtfStr += '\\pard\\li360\\sb0\\sa80{\\f1\\fs20 ' + esc(x.description) + '\\par\n';
            });
          }
          if (edu.length) {
            rtfStr += '\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps EDUCATION}\\par\n';
            edu.forEach(x => {
              rtfStr += '\\pard\\sb40\\sa0{\\f1\\fs22\\b ' + esc(x.degree || '') + '\\par\n';
              rtfStr += '\\pard\\sb0\\sa60{\\f1\\fs20\\cf2 ' + esc(x.institution || '') + ' — ' + esc(x.year || '') + '\\par\n';
            });
          }
          if (skills.trim()) { rtfStr += '\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps SKILLS}\\par\n\\pard\\sb0\\sa120{\\f1\\fs20 ' + esc(skills) + '\\par\n'; }
          rtfStr += '}';
          zip.file('cv-genie-' + t + '.rtf', rtfStr);
          successCount++;
        }
      } catch (err) {
        console.warn('Failed to export template ' + t + ' as ' + fmt + ':', err);
      }
    }
  }

  changeTemplate(orig);
  if (successCount === 0) {
    s.textContent = 'Export failed. Check browser console.';
    setTimeout(() => s.style.display = 'none', 5000);
    return;
  }
  s.textContent = 'Zipping ' + successCount + ' file(s)...';
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'cv-genie-all-templates.zip');
  s.textContent = '✅ Done! ' + successCount + '/' + total + ' files exported.';
  setTimeout(() => s.style.display = 'none', 3000);
}

// ============ MODALS ============
function openExportModal() { document.getElementById('exportModal').style.display = 'flex'; }
function closeExportModal() { document.getElementById('exportModal').style.display = 'none'; }

function openPhotoEditor() {
  if (!photoData) {
    document.getElementById('photoInput').click();
    return;
  }
  document.getElementById('photoCropperModal').style.display = 'flex';
  document.getElementById('cropperImage').src = photoData;
  document.getElementById('cropperImage').style.display = 'block';
  if (cropperInstance) cropperInstance.destroy();
  cropperInstance = new Cropper(document.getElementById('cropperImage'), {
    aspectRatio: 1,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 0.9
  });
}

function closePhotoEditor() {
  document.getElementById('photoCropperModal').style.display = 'none';
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
}

function rotatePhoto(deg) {
  if (cropperInstance) cropperInstance.rotate(deg);
}

function applyCrop() {
  if (!cropperInstance) return;
  const c = cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
  photoData = c.toDataURL('image/jpeg', 0.9);
  document.getElementById('photoPreview').src = photoData;
  document.getElementById('photoPreview').style.display = 'block';
  document.getElementById('photoPlaceholder').style.display = 'none';
  closePhotoEditor();
  updatePreview();
}

// ============ TEMPLATE GALLERY ============
function openTemplateGallery() {
  document.getElementById('templateGalleryModal').style.display = 'flex';
  document.getElementById('templateGalleryGrid').innerHTML = TEMPLATES.map(t =>
    `<div class="template-card${t === currentTemplate ? ' active' : ''}" onclick="selectTemplateFromGallery('${t}')">
      <div class="thumb">${TEMPLATE_META[t].icon}<span class="active-badge">Active</span></div>
      <div class="card-info"><strong>${TEMPLATE_META[t].name}</strong><small>${TEMPLATE_META[t].desc}</small></div>
    </div>`
  ).join('');
}

function closeTemplateGallery() {
  document.getElementById('templateGalleryModal').style.display = 'none';
}

function selectTemplateFromGallery(t) {
  changeTemplate(t);
  openTemplateGallery();
  setTimeout(closeTemplateGallery, 400);
}

function updateTemplateGallerySelection() {
  if (document.getElementById('templateGalleryModal').style.display === 'flex') {
    document.getElementById('templateGalleryGrid').innerHTML = TEMPLATES.map(t =>
      `<div class="template-card${t === currentTemplate ? ' active' : ''}" onclick="selectTemplateFromGallery('${t}')">
        <div class="thumb">${TEMPLATE_META[t].icon}<span class="active-badge">Active</span></div>
        <div class="card-info"><strong>${TEMPLATE_META[t].name}</strong><small>${TEMPLATE_META[t].desc}</small></div>
      </div>`
    ).join('');
  }
}

// ============ VERSION HISTORY ============
function saveVersion() {
  const s = {
    timestamp: new Date().toLocaleString(),
    state: getState(),
    preview: (document.getElementById('fullName')?.value || 'Untitled') + ' - ' + currentTemplate
  };
  versionSlots.unshift(s);
  if (versionSlots.length > 10) versionSlots.pop();
  try { localStorage.setItem('cvGenieVersions', JSON.stringify(versionSlots)); } catch (e) { }
  renderVersionSlots();
}

function loadVersion(i) {
  if (!versionSlots[i]) return;
  restoreState(versionSlots[i].state);
}

function deleteVersion(i) {
  versionSlots.splice(i, 1);
  try { localStorage.setItem('cvGenieVersions', JSON.stringify(versionSlots)); } catch (e) { }
  renderVersionSlots();
}

function renderVersionSlots() {
  const c = document.getElementById('versionSlots');
  if (!c) return;
  c.innerHTML = versionSlots.length === 0 ?
    '<p style="text-align:center;color:var(--text-secondary);font-size:0.65rem">No versions yet.</p>' :
    versionSlots.map((s, i) =>
      `<div class="version-slot">
        <div class="slot-date">${s.timestamp}</div>
        <div style="font-size:0.55rem;margin:0.12rem 0">${s.preview || ''}</div>
        <div class="slot-actions">
          <button class="btn btn-sm btn-primary" onclick="loadVersion(${i})">Load</button>
          <button class="btn btn-sm" onclick="deleteVersion(${i})" style="background:#fee2e2;color:#dc2626">×</button>
        </div>
      </div>`
    ).join('');
}

// ============ SHARE LINK ============
function generateShareLink() {
  try {
    const c = LZString.compressToEncodedURIComponent(JSON.stringify({ ...getState(), v: '1.0' }));
    const l = location.origin + location.pathname + '?load=' + c;
    document.getElementById('shareLinkBox').style.display = 'block';
    document.getElementById('shareLinkBox').textContent = l.length > 400 ? l.substring(0, 400) + '...' : l;
    document.getElementById('copyShareBtn').style.display = 'block';
    document.getElementById('shareLinkBox').dataset.fullLink = l;
  } catch (e) { }
}

function copyShareLink() {
  const l = document.getElementById('shareLinkBox')?.dataset?.fullLink;
  if (l) navigator.clipboard.writeText(l).then(() => showToast('Copied!'));
}

// ============ CUSTOM KEYWORDS ============
function renderCustomKWChips() {
  const c = document.getElementById('customKeywordChips');
  if (!c) return;
  c.innerHTML = customKWList.map((k, i) =>
    `<span style="display:inline-flex;align-items:center;gap:0.2rem;background:var(--primary);color:white;border-radius:20px;padding:0.15rem 0.5rem;font-size:0.6rem;font-weight:600;">${k}<button onclick="removeCustomKW(${i})" style="background:none;border:none;color:white;cursor:pointer;font-size:0.7rem;padding:0;line-height:1;opacity:0.8;">×</button></span>`
  ).join('');
}

function addCustomKeyword() {
  const inp = document.getElementById('customKeywordInput');
  if (!inp) return;
  const val = inp.value.trim().toLowerCase();
  if (!val) return;
  val.split(',').map(k => k.trim()).filter(k => k.length > 1 && !customKWList.includes(k)).forEach(k => customKWList.push(k));
  inp.value = '';
  renderCustomKWChips();
  runATSAnalysis();
}

function removeCustomKW(i) {
  customKWList.splice(i, 1);
  renderCustomKWChips();
  runATSAnalysis();
}

function addKWFromCloud(kw) {
  const k = kw.trim().toLowerCase();
  if (k && !customKWList.includes(k)) {
    customKWList.push(k);
    renderCustomKWChips();
    runATSAnalysis();
  }
}

function handleKWKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addCustomKeyword();
  }
}

// ============ LINKEDIN IMPORT ============
async function importLinkedInPDF(e) {
  const f = e.target.files[0];
  if (!f) return;
  document.getElementById('linkedInProgress').style.display = 'block';
  document.getElementById('linkedInProgressFill').style.width = '20%';
  document.getElementById('linkedInProgressText').textContent = 'Reading...';
  try {
    const b = await f.arrayBuffer();
    document.getElementById('linkedInProgressFill').style.width = '50%';
    const pdf = await pdfjsLib.getDocument({ data: b }).promise;
    let t = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const c = await pg.getTextContent();
      t += c.items.map(it => it.str).join(' ') + '\n';
    }
    document.getElementById('linkedInProgressFill').style.width = '80%';
    pendingLinkedInData = parseLinkedInText(t);
    const pv = [];
    if (pendingLinkedInData.name) pv.push(['Name', pendingLinkedInData.name]);
    if (pendingLinkedInData.title) pv.push(['Title', pendingLinkedInData.title]);
    if (pendingLinkedInData.email) pv.push(['Email', pendingLinkedInData.email]);
    if (pendingLinkedInData.phone) pv.push(['Phone', pendingLinkedInData.phone]);
    if (pendingLinkedInData.location) pv.push(['Location', pendingLinkedInData.location]);
    if (pendingLinkedInData.summary) pv.push(['Summary', pendingLinkedInData.summary.substring(0, 80) + '...']);
    if (pendingLinkedInData.experiences && pendingLinkedInData.experiences.length) pv.push(['Experience', pendingLinkedInData.experiences.length + ' position(s)']);
    if (pendingLinkedInData.education && pendingLinkedInData.education.length) pv.push(['Education', pendingLinkedInData.education.length + ' degree(s)']);
    if (pendingLinkedInData.skills) pv.push(['Skills', pendingLinkedInData.skills.substring(0, 80) + '...']);
    document.getElementById('linkedInPreviewTable').innerHTML = pv.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('');
    document.getElementById('linkedInPreview').style.display = 'block';
    document.getElementById('linkedInProgressFill').style.width = '100%';
    document.getElementById('linkedInProgressText').textContent = 'Review below';
    setTimeout(() => document.getElementById('linkedInProgress').style.display = 'none', 2000);
  } catch (e) {
    showToast('Error reading PDF');
    document.getElementById('linkedInProgress').style.display = 'none';
  }
}

function applyLinkedInData() {
  if (!pendingLinkedInData) return;
  const d = pendingLinkedInData;
  if (d.name) document.getElementById('fullName').value = d.name;
  if (d.title) document.getElementById('title').value = d.title;
  if (d.email) document.getElementById('email').value = d.email;
  if (d.phone) document.getElementById('phone').value = d.phone;
  if (d.location) document.getElementById('location').value = d.location;
  if (d.summary) document.getElementById('summary').value = d.summary.substring(0, 300);
  if (d.skills) document.getElementById('skills').value = d.skills;
  document.getElementById('experienceList').innerHTML = '';
  (d.experiences || []).forEach(e => {
    addExpSilent();
    const is = document.querySelectorAll('#experienceList .dynamic-item');
    const l = is[is.length - 1];
    if (l) {
      l.querySelectorAll('input')[0].value = e.title || '';
      l.querySelectorAll('input')[1].value = e.company || '';
      l.querySelectorAll('input')[2].value = e.dates || '';
      l.querySelector('textarea').value = e.description || '';
    }
  });
  if (!d.experiences || !d.experiences.length) addExpSilent();
  document.getElementById('educationList').innerHTML = '';
  (d.education || []).forEach(e => {
    addEduSilent();
    const is = document.querySelectorAll('#educationList .dynamic-item');
    const l = is[is.length - 1];
    if (l) {
      l.querySelectorAll('input')[0].value = e.degree || '';
      l.querySelectorAll('input')[1].value = e.institution || '';
      l.querySelectorAll('input')[2].value = e.year || '';
    }
  });
  if (!d.education || !d.education.length) addEduSilent();
  updatePreview();
  initDragDrop();
  document.getElementById('linkedInPreview').style.display = 'none';
  pendingLinkedInData = null;
  showToast('Profile applied!');
}

function discardLinkedInData() {
  document.getElementById('linkedInPreview').style.display = 'none';
  pendingLinkedInData = null;
  showToast('Discarded');
}

function parseLinkedInText(t) {
  const ls = t.split('\n').map(l => l.trim()).filter(l => l);
  const r = { name: ls[0] || '', title: ls[1] || '', email: '', phone: '', summary: '', skills: '', experiences: [], education: [] };
  const em = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (em) r.email = em[0];
  const ph = t.match(/\+?[\d\s()-]{7,}/);
  if (ph) r.phone = ph[0];
  const si = ls.findIndex(l => /summary|about/i.test(l));
  if (si >= 0 && si + 1 < ls.length) r.summary = ls[si + 1];
  const es = t.split(/experience/i)[1];
  if (es) {
    const el = es.split('\n').filter(l => l.trim());
    for (let i = 0; i < Math.min(el.length, 20); i += 4) r.experiences.push({ title: el[i] || '', company: el[i + 1] || '', dates: el[i + 2] || '', description: el[i + 3] || '' });
  }
  const ed = t.split(/education/i)[1];
  if (ed) {
    const dl = ed.split('\n').filter(l => l.trim());
    for (let i = 0; i < Math.min(dl.length, 12); i += 3) r.education.push({ degree: dl[i] || '', institution: dl[i + 1] || '', year: dl[i + 2] || '' });
  }
  const sm = t.match(/skills?[:\s]+([^\n]+)/i);
  if (sm) r.skills = sm[1];
  return r;
}

// LinkedIn drop zone setup
const dz = document.getElementById('linkedInDropZone');
if (dz) {
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--primary)'; });
  dz.addEventListener('dragleave', e => { e.preventDefault(); dz.style.borderColor = 'var(--border)'; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = 'var(--border)';
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') {
      const dt = new DataTransfer();
      dt.items.add(f);
      document.getElementById('linkedInFile').files = dt.files;
      importLinkedInPDF({ target: { files: dt.files } });
    }
  });
}

// ============ JSON IMPORT/EXPORT ============
function exportJSON() {
  const d = { version: '1.0', ...getState() };
  saveAs(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'cv-genie-backup.json');
}

function importJSON(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try { restoreState(JSON.parse(ev.target.result)); } catch (ex) { showToast('Invalid file'); }
  };
  r.readAsText(f);
}

// ============ ATS ANALYSIS ============
function getAllText() {
  const parts = [
    document.getElementById('fullName')?.value || '',
    document.getElementById('title')?.value || '',
    document.getElementById('summary')?.value || '',
    document.getElementById('skills')?.value || '',
    ...getExperiences().map(e => [e.title, e.company, e.description].join(' ')),
    ...getEducation().map(e => [e.degree, e.institution].join(' '))
  ];
  return parts.join(' ').toLowerCase();
}

const ROLE_KW = {
  'software engineer': ['javascript', 'python', 'react', 'node.js', 'aws', 'agile', 'git', 'api', 'database', 'testing', 'docker', 'typescript', 'sql', 'rest', 'ci/cd'],
  'frontend developer': ['javascript', 'react', 'css', 'html', 'typescript', 'webpack', 'responsive design', 'accessibility', 'vue', 'angular', 'performance'],
  'backend developer': ['python', 'java', 'node.js', 'sql', 'api', 'microservices', 'docker', 'kubernetes', 'database', 'rest', 'graphql', 'authentication'],
  'fullstack developer': ['javascript', 'react', 'node.js', 'sql', 'api', 'docker', 'git', 'typescript', 'html', 'css', 'database', 'cloud'],
  'engineer': ['problem solving', 'technical design', 'debugging', 'testing', 'documentation', 'collaboration', 'systems design', 'version control'],
  'developer': ['javascript', 'python', 'git', 'api', 'database', 'testing', 'agile', 'documentation', 'code review'],
  'devops': ['docker', 'kubernetes', 'ci/cd', 'terraform', 'aws', 'linux', 'monitoring', 'ansible', 'jenkins', 'cloud', 'automation'],
  'data scientist': ['machine learning', 'python', 'sql', 'tensorflow', 'statistics', 'nlp', 'deep learning', 'pandas', 'data analysis', 'scikit-learn'],
  'data analyst': ['sql', 'excel', 'tableau', 'power bi', 'python', 'data visualisation', 'reporting', 'analytics', 'statistics'],
  'data engineer': ['sql', 'python', 'spark', 'etl', 'data pipeline', 'cloud', 'aws', 'bigquery', 'airflow', 'kafka'],
  'machine learning': ['python', 'tensorflow', 'pytorch', 'scikit-learn', 'deep learning', 'nlp', 'statistics', 'model deployment', 'neural networks'],
  'cybersecurity': ['network security', 'penetration testing', 'siem', 'firewalls', 'incident response', 'compliance', 'vulnerability', 'encryption', 'iso 27001'],
  'cloud engineer': ['aws', 'azure', 'gcp', 'terraform', 'kubernetes', 'docker', 'cloud', 'networking', 'security', 'devops'],
  'mobile developer': ['ios', 'android', 'swift', 'kotlin', 'react native', 'flutter', 'mobile', 'api', 'ui/ux', 'app store'],
  'qa engineer': ['testing', 'automation', 'selenium', 'cypress', 'jest', 'bug tracking', 'test cases', 'agile', 'regression', 'quality assurance'],
  'product manager': ['roadmap', 'stakeholder', 'agile', 'scrum', 'user stories', 'kpi', 'strategy', 'analytics', 'mvp', 'prioritisation', 'go-to-market'],
  'ux designer': ['figma', 'user research', 'wireframing', 'prototyping', 'usability testing', 'information architecture', 'design system', 'accessibility'],
  'ui designer': ['figma', 'adobe xd', 'visual design', 'typography', 'colour theory', 'design system', 'prototype', 'css', 'responsive design'],
  'designer': ['figma', 'adobe', 'ui/ux', 'wireframe', 'prototype', 'user research', 'typography', 'design system', 'creative'],
  'project manager': ['pmp', 'agile', 'stakeholder management', 'risk management', 'budgeting', 'resource planning', 'delivery', 'reporting', 'change management'],
  'business analyst': ['requirements gathering', 'process mapping', 'stakeholder', 'user stories', 'gap analysis', 'sql', 'documentation', 'agile'],
  'consultant': ['analysis', 'strategy', 'stakeholder', 'deliverables', 'project management', 'presentation', 'problem solving', 'client management'],
  'manager': ['leadership', 'stakeholder management', 'budgeting', 'kpi', 'strategy', 'team management', 'performance review', 'coaching'],
  'operations manager': ['process improvement', 'lean', 'six sigma', 'kpi', 'supply chain', 'budgeting', 'vendor management', 'workflow'],
  'sales': ['crm', 'revenue', 'pipeline', 'negotiation', 'prospecting', 'quota', 'salesforce', 'client relations', 'b2b', 'account management'],
  'account manager': ['client relations', 'crm', 'upselling', 'retention', 'salesforce', 'negotiation', 'revenue', 'account growth'],
  'marketing manager': ['seo', 'content strategy', 'social media', 'google analytics', 'email marketing', 'ppc', 'brand', 'campaigns', 'roi', 'hubspot'],
  'digital marketing': ['seo', 'sem', 'google ads', 'social media', 'analytics', 'email marketing', 'content marketing', 'conversion rate', 'ab testing'],
  'accountant': ['financial reporting', 'tax', 'audit', 'excel', 'quickbooks', 'reconciliation', 'budgeting', 'forecasting', 'ifrs', 'gaap'],
  'finance': ['financial modelling', 'excel', 'forecasting', 'budgeting', 'variance analysis', 'financial reporting', 'p&l'],
  'financial analyst': ['financial modelling', 'excel', 'valuation', 'forecasting', 'sql', 'tableau', 'variance analysis', 'bloomberg'],
  'hr': ['recruitment', 'onboarding', 'performance management', 'hris', 'employee relations', 'talent acquisition', 'compliance', 'learning & development'],
  'recruiter': ['talent acquisition', 'sourcing', 'linkedin recruiter', 'interviewing', 'applicant tracking', 'employer branding', 'negotiation'],
  'teacher': ['curriculum design', 'lesson planning', 'classroom management', 'student assessment', 'differentiation', 'safeguarding', 'sen', 'behaviour management'],
  'educator': ['curriculum design', 'lesson planning', 'classroom management', 'student assessment', 'differentiation', 'safeguarding', 'sen'],
  'nurse': ['patient care', 'clinical assessment', 'medication administration', 'triage', 'documentation', 'hipaa', 'ehr', 'safeguarding', 'iv therapy'],
  'default': ['leadership', 'communication', 'teamwork', 'problem solving', 'project management', 'analytical', 'strategic', 'collaboration', 'attention to detail']
};

function runATSAnalysis() {
  const cvText = getAllText();
  const role = (document.getElementById('targetRole')?.value || '').toLowerCase().trim();

  const matchedRole = Object.keys(ROLE_KW)
    .filter(k => k !== 'default' && role.length >= 2 && (role.includes(k) || k.includes(role)))
    .sort((a, b) => b.length - a.length)[0] || 'default';

  const roleKW = ROLE_KW[matchedRole];
  const allKW = [...roleKW, ...customKWList.filter(k => !roleKW.includes(k))];

  const results = allKW.map(kw => ({
    keyword: kw,
    present: cvText.includes(kw.toLowerCase()),
    custom: customKWList.includes(kw)
  }));

  const found = results.filter(r => r.present).length;
  const total = results.length;
  const score = total > 0 ? Math.round((found / total) * 100) : 0;
  const col = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  const checks = [
    { label: 'Contact', pass: !!((document.getElementById('email')?.value || '').trim() || (document.getElementById('phone')?.value || '').trim()) },
    { label: 'Summary', pass: (document.getElementById('summary')?.value || '').trim().length > 20 },
    { label: 'Skills', pass: (document.getElementById('skills')?.value || '').trim().length > 5 },
    { label: 'Experience', pass: getExperiences().length > 0 },
    { label: 'Education', pass: getEducation().length > 0 },
    { label: `Keywords ${found}/${total}`, pass: score >= 50 }
  ];

  const C = 175.93;
  const ring = document.getElementById('atsRingFill');
  if (ring) {
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C - (C * score / 100);
    ring.style.stroke = col;
  }
  const sn = document.getElementById('atsScoreNum');
  if (sn) { sn.textContent = score; sn.style.color = col; }

  const ab = document.getElementById('atsBreakdown');
  if (ab) {
    ab.innerHTML = checks.map(b => `
      <div style="padding:0.25rem 0.3rem;border-radius:4px;font-size:0.65rem;display:flex;justify-content:space-between;align-items:center;${b.pass ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">
        <span>${b.label}</span><span style="font-size:0.8rem;">${b.pass ? '✓' : '✗'}</span>
      </div>`).join('');
  }

  const kc = document.getElementById('keywordCloud');
  if (kc) {
    kc.innerHTML = results.map(r => {
      const isCustom = r.custom;
      const clickable = !r.present && !isCustom;
      const bg = r.present ? (isCustom ? 'background:#ede9fe;color:#5b21b6' : 'background:#d1fae5;color:#065f46') : (isCustom ? 'background:#f5f3ff;color:#7c3aed' : 'background:#fee2e2;color:#991b1b');
      const cursor = clickable ? 'cursor:pointer;' : '';
      const onclick = clickable ? `onclick="addKWFromCloud('${r.keyword.replace(/'/g, "\\'")}')"` : '';
      const title = clickable ? `title="Click to add '${r.keyword}' to your custom keywords"` : '';
      return `<span ${onclick} ${title} style="display:inline-flex;align-items:center;gap:0.15rem;padding:0.15rem 0.4rem;border-radius:8px;font-size:0.6rem;font-weight:600;${bg};${cursor}${clickable ? 'border:1.5px dashed currentColor;' : ''}">${r.keyword}${isCustom ? '<span style="font-size:0.5rem;margin-left:1px">★</span>' : ''}${clickable ? '<span style="font-size:0.55rem;opacity:0.7">+</span>' : ''}</span>`;
    }).join('');
  }

  const C2 = 150.8;
  const pr = document.getElementById('atsPreviewRing');
  if (pr) { pr.style.strokeDasharray = C2; pr.style.strokeDashoffset = C2 - (C2 * score / 100); pr.style.stroke = col; }
  const pn = document.getElementById('atsPreviewNum');
  if (pn) { pn.textContent = score; pn.style.color = col; }
  const pc = document.getElementById('atsPreviewChecks');
  if (pc) {
    pc.innerHTML = checks.map(b => `<div class="ats-chk ${b.pass ? 'pass' : 'fail'}"><span>${b.label}</span><span>${b.pass ? '✓' : '✗'}</span></div>`).join('');
  }
}

// ============ AUTO SAVE ============
setInterval(() => {
  try { localStorage.setItem('cvGenie_v2.0', JSON.stringify(getState())); } catch (e) { }
}, 300000);

// ============ LOAD SAVED STATE ============
function loadSaved() {
  const p = new URLSearchParams(location.search);
  if (p.get('load')) {
    try {
      restoreState(JSON.parse(LZString.decompressFromEncodedURIComponent(p.get('load'))));
      history.replaceState({}, document.title, location.pathname);
      return;
    } catch (e) { }
  }
  const old = localStorage.getItem('cvGenie_v1.0');
  const s = localStorage.getItem('cvGenie_v2.0') || old;
  if (old) { try { localStorage.removeItem('cvGenie_v1.0'); } catch (e) { } }
  if (s) {
    try { restoreState(JSON.parse(s)); return; } catch (e) { }
  }
  addExpSilent();
  addEduSilent();
  buildAll();
  updatePreview();
  initDragDrop();
  initSectionSortable();
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isInput) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !isInput) { e.preventDefault(); redo(); }
});

loadSaved();

// Mobile init
if (window.innerWidth <= 900) {
  document.getElementById('formPanel').classList.add('active');
  document.getElementById('mobileNav').classList.add('nav-hidden');
  document.getElementById('mnav-edit').classList.add('active');
}