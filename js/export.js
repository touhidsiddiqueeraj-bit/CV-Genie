/* Exports — all fully local: print-dialog PDF, instant PDF, in-browser
 * DOCX writer, RTF, Markdown, plain text, bulk all-templates ZIP. */

import { activeDoc, currentColor, currentTemplate } from './app-state.js';
import { changeTemplate } from './carousel.js';
import { TEMPLATES, TEMPLATE_META } from './config.js';
import { getEducation, getExperiences, getLanguages, getProjects, getPublications, getVolunteering } from './cvdata.js';
import { buildLetterMarkdown, buildLetterPlain, buildLetterRTF, letterEnvelope } from './letter.js';
import { scaleCVToFit } from './preview.js';
import { uiAnimateClose } from './ui.js';

export const exportSel={printPdf:true,clientPdf:false,docx:true,rtf:false,markdown:false,txt:false}; /* bound to the export-modal checkboxes through inline handlers */

/* PDF + DOCX are generated entirely in the browser — CV Genie has no export server.
   (Constants kept for reference/documentation only.) */

// ============ EXPORT ============
export async function executeExport(){
    const s=document.getElementById('exportStatus');s.style.display='block';
    try{
        if(exportSel.printPdf){s.textContent='Opening print dialog…';await exportPrintPDF();}
        if(exportSel.clientPdf){s.textContent='Rendering browser PDF…';await exportClientPDF();}
        if(exportSel.docx){s.textContent='Building DOCX…';await exportDocx();}
        if(exportSel.rtf){s.textContent='Building RTF…';exportRTF();}
        if(exportSel.markdown){s.textContent='Building Markdown…';exportMarkdown();}
        if(exportSel.txt){s.textContent='Building plain text…';exportTXT();}
        s.textContent='Done — check your downloads.';setTimeout(()=>s.style.display='none',2000);
    }catch(e){s.textContent='Export failed: '+e.message;setTimeout(()=>s.style.display='none',5000);}
}
export function exportPrintPDF(){
    /* The print stylesheet turns the page into just the active document — pick
       “Save as PDF” as the printer and you get crisp, selectable vector text. */
    closeExportModal();
    return new Promise(res=>setTimeout(()=>{
        try{window.print();}catch(e){/* printing unsupported (headless test env) */}
        const s=document.getElementById('exportStatus');s.style.display='none';
        res();
    },300));
}
export async function exportClientPDF(){
    /* the carousel can hide the document — force it visible for the capture, then restore */
    const panel=document.getElementById('previewPanel');
    const forced=panel&&panel.classList.contains('show-gallery');
    if(forced)panel.classList.remove('show-gallery');
    try{
      scaleCVToFit();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const el=activeDoc==='letter'?document.getElementById('clPreview'):document.getElementById('cvPreview');
      await html2pdf().set({margin:[8,8],filename:'cv-genie-'+(activeDoc==='letter'?'cover-letter':currentTemplate)+'.pdf',image:{type:'jpeg',quality:0.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(el).save();
    } finally {
      if(forced)panel.classList.add('show-gallery');
    }
}
/* ── Client-side DOCX writer — the app's own Word generator, no server, no network.
   Builds a minimal, valid OOXML package (WordprocessingML) with JSZip, which the app
   already bundles. Content order mirrors buildRTF() so every instant format agrees,
   and the accent colour / font pair follow the Design tab. Works for the CV and the
   cover letter alike. ── */
export function docxEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function docxHex(hex,fallback){const c=String(hex||'').replace('#','').trim();return /^[0-9a-fA-F]{6}$/.test(c)?c.toUpperCase():(fallback||'2563EB');}
export function docxFonts(){
    const cs=getComputedStyle(document.documentElement);
    const pick=v=>{const f=String(v||'').split(',')[0].replace(/["']/g,'').trim();return f&&/^[A-Za-z][A-Za-z0-9 .-]*$/.test(f)?f:null;};
    return{head:pick(cs.getPropertyValue('--cv-font-heading'))||'Georgia',body:pick(cs.getPropertyValue('--cv-font-body'))||'Calibri'};
}
export function docxP(runs,o){
    /* runs: [{t,b,i,sz,color,font}]  |  o: {align,before,after,indent,style,border} */
    o=o||{};
    const pPr=[];
    if(o.style)pPr.push('<w:pStyle w:val="'+o.style+'"/>');
    if(o.border)pPr.push('<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="2" w:color="'+o.border+'"/></w:pBdr>');
    const sp=[];if(o.before!=null)sp.push('w:before="'+o.before+'"');if(o.after!=null)sp.push('w:after="'+o.after+'"');
    if(o.line!=null)sp.push('w:line="'+o.line+'" w:lineRule="auto"');
    if(sp.length)pPr.push('<w:spacing '+sp.join(' ')+'/>');
    if(o.indent!=null)pPr.push('<w:ind w:left="'+o.indent+'"/>');
    if(o.align)pPr.push('<w:jc w:val="'+o.align+'"/>');
    const xml=runs.filter(r=>r&&r.t&&String(r.t).length).map(r=>{
        const rp=[];if(r.b)rp.push('<w:b/>');if(r.i)rp.push('<w:i/>');
        if(r.font)rp.push('<w:rFonts w:ascii="'+r.font+'" w:hAnsi="'+r.font+'"/>');
        if(r.color)rp.push('<w:color w:val="'+r.color+'"/>');
        if(r.sz)rp.push('<w:sz w:val="'+r.sz+'"/><w:szCs w:val="'+r.sz+'"/>');
        return '<w:r>'+(rp.length?'<w:rPr>'+rp.join('')+'</w:rPr>':'')+'<w:t xml:space="preserve">'+docxEsc(r.t)+'</w:t></w:r>';
    }).join('');
    return '<w:p>'+(pPr.length?'<w:pPr>'+pPr.join('')+'</w:pPr>':'')+xml+'</w:p>';
}
export function docxSection(parts,label,accent){parts.push(docxP([{t:label.toUpperCase(),b:1,sz:22,color:accent}],{before:280,after:80,border:accent}));}
export function docxCvParts(){
    const accent=docxHex(currentColor),grey='6B7280',dark='111827';
    const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
    const contact=[document.getElementById('email')?.value,document.getElementById('phone')?.value,document.getElementById('linkedin')?.value,document.getElementById('location')?.value].filter(Boolean).join(' | ');
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'';
    const exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    const out=[];
    out.push(docxP([{t:name,b:1,sz:40,color:accent}],{align:'center',after:40}));
    if(title)out.push(docxP([{t:title,sz:24,color:grey}],{align:'center',after:60}));
    if(contact)out.push(docxP([{t:contact,sz:18,color:grey}],{align:'center',after:160}));
    if(summary.trim()){docxSection(out,'Professional Summary',accent);String(summary).split('\n').filter(l=>l.trim()).forEach(l=>out.push(docxP([{t:l.trim(),sz:21,color:dark}],{after:60,line:264})));}
    if(exp.length){docxSection(out,'Experience',accent);exp.forEach(x=>{
        out.push(docxP([{t:x.title||'',b:1,sz:22,color:dark}],{before:120,after:20}));
        if(x.company||x.dates)out.push(docxP([{t:[x.company,x.dates].filter(Boolean).join(' — '),sz:20,color:grey}],{after:40}));
        String(x.description||'').split('\n').filter(l=>l.trim()).forEach(l=>out.push(docxP([{t:'•  '+l.trim(),sz:21,color:dark}],{indent:280,after:40,line:264})));
    });}
    if(edu.length){docxSection(out,'Education',accent);edu.forEach(x=>{
        out.push(docxP([{t:x.degree||'',b:1,sz:22,color:dark}],{before:100,after:20}));
        if(x.institution||x.year)out.push(docxP([{t:[x.institution,x.year].filter(Boolean).join(' — '),sz:20,color:grey}],{after:40}));
    });}
    if(pubs.length){docxSection(out,'Publications',accent);pubs.forEach(x=>{
        out.push(docxP([{t:x.title||'',b:1,sz:22,color:dark}],{before:120,after:20}));
        if(x.venue||x.dates)out.push(docxP([{t:[x.venue,x.dates].filter(Boolean).join(' — '),sz:20,color:grey}],{after:30}));
        if(x.status)out.push(docxP([{t:x.status,sz:20,color:grey}],{after:30}));
        if(x.link)out.push(docxP([{t:(x.link.includes('doi.org')?'DOI: ':'')+x.link,sz:18,color:accent}],{after:40}));
    });}
    if(projs.length){docxSection(out,'Projects',accent);projs.forEach(x=>{
        out.push(docxP([{t:x.name||'',b:1,sz:22,color:dark}],{before:100,after:20}));
        if(x.description)out.push(docxP([{t:x.description,sz:21,color:dark}],{after:30}));
        if(x.link)out.push(docxP([{t:x.link,sz:18,color:accent}],{after:40}));
    });}
    if(vols.length){docxSection(out,'Volunteering',accent);vols.forEach(x=>{
        out.push(docxP([{t:x.organization||x.role||'',b:1,sz:22,color:dark}],{before:100,after:20}));
        if(x.organization&&x.role)out.push(docxP([{t:x.role,sz:20,color:grey}],{after:30}));
        if(x.description)out.push(docxP([{t:x.description,sz:21,color:dark}],{after:30,line:264}));
    });}
    if(langs.length){docxSection(out,'Languages',accent);langs.forEach(x=>out.push(docxP([{t:[x.language,x.level].filter(Boolean).join(' — '),sz:21,color:dark}],{after:30})));}
    if(skills.trim()){docxSection(out,'Skills',accent);out.push(docxP([{t:skills,sz:21,color:dark}],{after:60,line:264}));}
    if(interests.trim()){docxSection(out,'Interests',accent);out.push(docxP([{t:interests,sz:21,color:dark}],{after:60,line:264}));}
    return out.join('');
}
export function docxLetterParts(){
    const accent=docxHex(currentColor),grey='6B7280',dark='111827';
    const E=letterEnvelope();
    const out=[];
    out.push(docxP([{t:E.name,b:1,sz:30,color:accent}],{after:20}));
    if(E.title)out.push(docxP([{t:E.title,sz:21,color:grey}],{after:20}));
    if(E.contacts.length)out.push(docxP([{t:E.contacts.join(' | '),sz:18,color:grey}],{after:200}));
    out.push(docxP([{t:E.date,sz:21,color:dark}],{after:200}));
    E.recipientLines.forEach((l,i)=>out.push(docxP([{t:l,sz:21,color:dark}],{after:i===E.recipientLines.length-1?200:20})));
    out.push(docxP([{t:E.subject,b:1,sz:22,color:dark}],{after:200}));
    out.push(docxP([{t:E.salutation,sz:21,color:dark}],{after:160}));
    E.paragraphs.forEach(p=>{String(p).split('\n').filter(l=>l.trim()).forEach(l=>out.push(docxP([{t:l.trim(),sz:21,color:dark}],{after:160,line:288})));});
    out.push(docxP([{t:E.signoff,sz:21,color:dark}],{before:120,after:240}));
    out.push(docxP([{t:E.signature,b:1,sz:21,color:dark}],{after:0}));
    return out.join('');
}
export async function buildDocx(){
    const f=docxFonts(),accent=docxHex(currentColor);
    const name=document.getElementById('fullName')?.value||'Your Name';
    const bodyXml=activeDoc==='letter'?docxLetterParts():docxCvParts();
    const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+bodyXml+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1021" w:right="1021" w:bottom="1021" w:left="1021" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="'+f.body+'" w:hAnsi="'+f.body+'"/><w:color w:val="111827"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
    const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    const docRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const core='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+(activeDoc==='letter'?'Cover letter':'Curriculum Vitae')+'</dc:title><dc:creator>'+docxEsc(name)+'</dc:creator><cp:lastModifiedBy>CV Genie</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">'+new Date().toISOString()+'</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'+new Date().toISOString()+'</dcterms:modified></cp:coreProperties>';
    const app='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>CV Genie</Application></Properties>';
    const zip=new JSZip();
    zip.file('[Content_Types].xml',contentTypes);
    zip.folder('_rels').file('.rels',rels);
    zip.folder('docProps').file('core.xml',core).file('app.xml',app);
    const w=zip.folder('word');
    w.file('document.xml',documentXml);w.file('styles.xml',styles);
    zip.folder('word/_rels').file('document.xml.rels',docRels);
    return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
}
export async function exportDocx(){
    const b=await buildDocx();
    if(b.size<1000)throw new Error('DOCX too small');
    saveAs(b,'cv-genie-'+(activeDoc==='letter'?'cover-letter':currentTemplate)+'.docx');
}
export function buildRTF(){
    const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
    const cp=[document.getElementById('email')?.value,document.getElementById('phone')?.value,document.getElementById('linkedin')?.value,document.getElementById('location')?.value].filter(Boolean);
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'',exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    const e=s=>String(s).replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}').replace(/\n/g,'\\line ');
    let r='{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0\\fswiss Helvetica;}{\\f1\\froman Georgia;}}\n{\\colortbl;\\red0\\green0\\blue0;\\red85\\green85\\blue85;}\n\\paperw11906\\paperh16838\\margl1440\\margr1440\\margt1440\\margb1440\n';
    r+='\\pard\\qc\\sb100\\sa40{\\f1\\fs36\\b '+e(name)+'}\\par\n';
    if(title)r+='\\pard\\qc\\sb0\\sa60{\\f1\\fs22\\cf2 '+e(title)+'}\\par\n';
    if(cp.length)r+='\\pard\\qc\\sb0\\sa120{\\f0\\fs18 '+e(cp.join(' | '))+'}\\par\n';
    if(summary.trim()){r+='\\pard\\sb120\\sa40{\\f1\\fs22\\b\\caps PROFESSIONAL SUMMARY}\\par\n\\pard\\sb0\\sa120{\\f1\\fs20 '+e(summary)+'}\\par\n';}
    if(exp.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps EXPERIENCE}\\par\n';exp.forEach(x=>{r+='\\pard\\sb60\\sa0{\\f1\\fs22\\b '+e(x.title||'')+'}\\par\n\\pard\\sb0\\sa0{\\f1\\fs20\\cf2 '+e(x.company||'')+' — '+e(x.dates||'')+'}\\par\n';if(x.description)r+='\\pard\\li360\\sb0\\sa80{\\f1\\fs20 '+e(x.description)+'}\\par\n';});}
    if(edu.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps EDUCATION}\\par\n';edu.forEach(x=>{r+='\\pard\\sb40\\sa0{\\f1\\fs22\\b '+e(x.degree||'')+'}\\par\n\\pard\\sb0\\sa60{\\f1\\fs20\\cf2 '+e(x.institution||'')+' — '+e(x.year||'')+'}\\par\n';});}
    if(pubs.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps PUBLICATIONS}\\par\n';pubs.forEach(x=>{r+='\\pard\\sb60\\sa0{\\f1\\fs22\\b '+e(x.title||'')+'}\\par\n';if(x.venue||x.dates)r+='\\pard\\sb0\\sa0{\\f1\\fs20\\cf2 '+e([x.venue,x.dates].filter(Boolean).join(' — '))+'}\\par\n';if(x.status)r+='\\pard\\sb0\\sa0{\\f1\\fs20\\cf2 '+e(x.status)+'}\\par\n';if(x.link)r+='\\pard\\sb0\\sa60{\\f0\\fs18 '+e((x.link.includes('doi.org')?'DOI: ':'')+x.link)+'}\\par\n';});}
    if(projs.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps PROJECTS}\\par\n';projs.forEach(x=>{r+='\\pard\\sb60\\sa0{\\f1\\fs22\\b '+e(x.name||'')+'}\\par\n';if(x.description)r+='\\pard\\sb0\\sa0{\\f1\\fs20\\cf2 '+e(x.description)+'}\\par\n';if(x.link)r+='\\pard\\sb0\\sa60{\\f0\\fs18 '+e(x.link)+'}\\par\n';});}
    if(vols.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps VOLUNTEERING}\\par\n';vols.forEach(x=>{r+='\\pard\\sb60\\sa0{\\f1\\fs22\\b '+e(x.organization||x.role||'')+'}\\par\n';if(x.organization&&x.role)r+='\\pard\\sb0\\sa60{\\f1\\fs20\\cf2 '+e(x.role)+'}\\par\n';});}
    if(langs.length){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps LANGUAGES}\\par\n';langs.forEach(x=>{r+='\\pard\\sb20\\sa0{\\f1\\fs20 '+e(x.language||'')+(x.level?' — '+e(x.level):'')+'}\\par\n';});}
    if(skills.trim()){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps SKILLS}\\par\n\\pard\\sb0\\sa120{\\f1\\fs20 '+e(skills)+'}\\par\n';}
    if(interests.trim()){r+='\\pard\\sb200\\sa60{\\f1\\fs22\\b\\caps INTERESTS}\\par\n\\pard\\sb0\\sa120{\\f1\\fs20 '+e(interests)+'}\\par\n';}
    r+='}';
    return r;
}
export function exportRTF(){saveAs(new Blob([activeDoc==='letter'?buildLetterRTF():buildRTF()],{type:'application/rtf'}),'cv-genie-'+(activeDoc==='letter'?'cover-letter':currentTemplate)+'.rtf');}

/* ============ MARKDOWN / PLAIN-TEXT EXPORT ============ */
export function buildMarkdownCV(){
    const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
    const email=document.getElementById('email')?.value||'',phone=document.getElementById('phone')?.value||'',li=document.getElementById('linkedin')?.value||'',loc=document.getElementById('location')?.value||'';
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'';
    const exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    let m=`# ${name}\n`;
    if(title)m+=`**${title}**\n\n`;
    const cl=[email,phone,li,loc].filter(Boolean).join(' · ');if(cl)m+=`${cl}\n`;
    m+='\n';
    if(summary.trim())m+=`## Summary\n\n${summary.trim()}\n\n`;
    if(skills.trim())m+=`## Skills\n\n${skills.split(',').map(s=>s.trim()).filter(Boolean).map(s=>`- ${s}`).join('\n')}\n\n`;
    if(exp.length){m+=`## Experience\n\n`;exp.forEach(x=>{m+=`### ${x.title||''}${x.company?` — ${x.company}`:''}\n\n${x.dates||''}\n\n`;if(x.description)m+=`${x.description.split('\n').filter(Boolean).map(d=>`- ${d.trim()}`).join('\n')}\n\n`;});}
    if(edu.length){m+=`## Education\n\n`;edu.forEach(x=>{m+=`### ${x.degree||''}${x.institution?` — ${x.institution}`:''}\n\n${x.year||''}\n\n`;});}
    if(pubs.length){m+=`## Publications\n\n`;pubs.forEach(x=>{m+=`### ${x.title||''}\n\n${[x.venue,x.dates].filter(Boolean).join(' \u00b7 ')}\n\n`;if(x.status)m+=`${x.status}\n\n`;if(x.link)m+=`${x.link.includes('doi.org')?'DOI: '+x.link:x.link}\n\n`;});}
    if(projs.length){m+=`## Projects\n\n`;projs.forEach(x=>{m+=`### ${x.name||''}\n\n${x.description||''}\n\n`;if(x.link)m+=`${x.link}\n\n`;});}
    if(vols.length){m+=`## Volunteering\n\n`;vols.forEach(x=>{m+=`- **${x.organization||''}**${x.role?` \u2014 ${x.role}`:''}\n`;});m+='\n';}
    if(langs.length){m+=`## Languages\n\n`;langs.forEach(l=>{m+=`- ${l.language}${l.level?` (${l.level})`:''}\n`;});m+='\n';}
    return m;    if(interests.trim())m+=`## Interests\n\n${interests.trim()}\n\n`;
    return m;
}
export function buildPlainCV(){
    const name=document.getElementById('fullName')?.value||'Your Name',title=document.getElementById('title')?.value||'';
    const email=document.getElementById('email')?.value||'',phone=document.getElementById('phone')?.value||'',li=document.getElementById('linkedin')?.value||'',loc=document.getElementById('location')?.value||'';
    const summary=document.getElementById('summary')?.value||'',skills=document.getElementById('skills')?.value||'';
    const exp=getExperiences(),edu=getEducation(),langs=getLanguages();
    const pubs=getPublications(),projs=getProjects(),vols=getVolunteering();
    const interests=document.getElementById('interests')?.value||'';
    let t=`${name.toUpperCase()}\n${title?title+'\n':''}${[email,phone,li,loc].filter(Boolean).join(' | ')}\n\n`;
    if(summary.trim())t+=`SUMMARY\n${summary.trim()}\n\n`;
    if(skills.trim())t+=`SKILLS\n${skills.split(',').map(s=>s.trim()).filter(Boolean).join(', ')}\n\n`;
    if(exp.length){t+=`EXPERIENCE\n`;exp.forEach(x=>{t+=`${x.title||''}${x.company?' - '+x.company:''} (${x.dates||''})\n`;if(x.description)t+=x.description.split('\n').filter(Boolean).map(d=>'  * '+d.trim()).join('\n')+'\n';t+='\n';});}
    if(edu.length){t+=`EDUCATION\n`;edu.forEach(x=>{t+=`${x.degree||''}${x.institution?' - '+x.institution:''} (${x.year||''})\n`;});t+='\n';}
    if(pubs.length){t+=`PUBLICATIONS\n`;pubs.forEach(x=>{t+=`${x.title||''}${x.dates?' ('+x.dates+')':''}\n`;if(x.venue)t+='  '+x.venue+'\n';if(x.status)t+='  '+x.status+'\n';if(x.link)t+='  '+(x.link.includes('doi.org')?'DOI: '+x.link:x.link)+'\n';t+='\n';});}
    if(projs.length){t+=`PROJECTS\n`;projs.forEach(x=>{t+=`${x.name||''}${x.description?' - '+x.description:''}\n`;if(x.link)t+='  '+(x.link.includes('doi.org')?'DOI: '+x.link:x.link)+'\n';});t+='\n';}
    if(vols.length){t+=`VOLUNTEERING\n`;vols.forEach(x=>{t+=`${x.organization||''}${x.role?' - '+x.role:''}\n`;});t+='\n';}
    if(langs.length){t+=`LANGUAGES\n`;langs.forEach(l=>{t+=`  ${l.language}${l.level?' ('+l.level+')':''}\n`;});}
    return t;    if(interests.trim())t+=`\nINTERESTS\n${interests.trim()}\n`;
    return t;
}
export function exportMarkdown(){saveAs(new Blob([activeDoc==='letter'?buildLetterMarkdown():buildMarkdownCV()],{type:'text/markdown'}),'cv-genie-'+(activeDoc==='letter'?'cover-letter':currentTemplate)+'.md');}
export function exportTXT(){saveAs(new Blob([activeDoc==='letter'?buildLetterPlain():buildPlainCV()],{type:'text/plain'}),'cv-genie-'+(activeDoc==='letter'?'cover-letter':currentTemplate)+'.txt');}

// Export all templates as ZIP — uses whichever formats the user has selected
export async function exportAllTemplates(){
    const formats=[];
    if(exportSel.printPdf||exportSel.clientPdf)formats.push('client-pdf'); /* ZIP mode can't open 18 print dialogs */
    if(exportSel.docx)formats.push('docx');
    if(exportSel.rtf)formats.push('rtf');
    if(formats.length===0)formats.push('png');
    const orig=currentTemplate,zip=new JSZip(),s=document.getElementById('exportStatus');
    s.style.display='block';
    let successCount=0;
    const total=TEMPLATES.length*formats.length;
    const docxBlob=formats.includes('docx')?await buildDocx():null; /* content-only: identical across templates */
    for(const t of TEMPLATES){
        const tIdx=TEMPLATES.indexOf(t)+1;
        changeTemplate(t);
        await new Promise(r=>setTimeout(r,500));
        for(const fmt of formats){
            s.textContent='Rendering '+TEMPLATE_META[t].name+' ('+fmt+') — template '+tIdx+'/'+TEMPLATES.length+'…';
            try{
                if(fmt==='png'){
                    const c=await html2canvas(document.getElementById('cvPreview'),{scale:1.5,useCORS:true,logging:false,backgroundColor:'#ffffff'});
                    zip.file('cv-genie-'+t+'.png',c.toDataURL('image/png').split(',')[1],{base64:true});
                    successCount++;
                } else if(fmt==='client-pdf'){
                    const pdfBlob=await html2pdf().set({margin:[8,8],filename:'cv-genie-'+t+'.pdf',image:{type:'jpeg',quality:0.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.getElementById('cvPreview')).outputPdf('blob');
                    zip.file('cv-genie-'+t+'.pdf',pdfBlob);
                    successCount++;
                } else if(fmt==='docx'){
                    if(docxBlob&&docxBlob.size>=1000){zip.file('cv-genie-'+t+'.docx',docxBlob);successCount++;}
                } else if(fmt==='rtf'){
                    zip.file('cv-genie-'+t+'.rtf',buildRTF());
                    successCount++;
                }
            }catch(err){
                console.warn('Failed to export template '+t+' as '+fmt+':',err);
            }
        }
    }
    changeTemplate(orig);
    if(successCount===0){
        s.textContent='Export failed. Check browser console.';
        setTimeout(()=>s.style.display='none',5000);
        return;
    }
    s.textContent='Zipping '+successCount+' file(s)…';
    const blob=await zip.generateAsync({type:'blob'});
    saveAs(blob,'cv-genie-all-templates.zip');
    s.textContent='Done — '+successCount+'/'+total+' files exported.';
    setTimeout(()=>s.style.display='none',3000);
}
export function openExportModal(){
  const m=document.getElementById('exportModal');
  const isLetter=activeDoc==='letter';
  document.getElementById('exportModalTitle').childNodes[0].textContent=isLetter?'Export cover letter':'Export CV';
  document.getElementById('exportAllBtn').style.display=isLetter?'none':'';
  m.style.display='flex';
}
export function closeExportModal(){uiAnimateClose('exportModal');}

