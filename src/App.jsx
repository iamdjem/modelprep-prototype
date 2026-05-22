import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload, Download, Copy, Image as ImageIcon, FileText, Check, Sparkles,
  Folder, Send, Star, X, Plus, Trash2, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, Layers, FileCheck, Loader, Save, Bookmark, Search,
  Globe, DollarSign, Info, Edit3, ArrowRight
} from 'lucide-react';

// =====================================================================
// PLATFORM CONFIGURATION (from research report, May 2026)
// =====================================================================

const UPLOAD_URLS = {
  makerworld:  'https://makerworld.com/en/my/upload',
  printables:  'https://www.printables.com/model/new',
  cults:       'https://cults3d.com/en/upload',
  mmf:         'https://www.myminifactory.com/object/new',
  thingiverse: 'https://www.thingiverse.com/upload',
  thangs:      'https://thangs.com/3d-model/upload',
  nexprint:    'https://www.nexprint.com/en/upload',
  creality:    'https://www.crealitycloud.com/createWork',
};

// How each platform expects tags pasted into its UI
const TAG_FORMATS = {
  makerworld:  { sep: ', ', hashtag: false },
  printables:  { sep: ', ', hashtag: false },
  cults:       { sep: ', ', hashtag: false },
  mmf:         { sep: ', ', hashtag: false },
  thingiverse: { sep: ' ',  hashtag: false }, // historically space-separated single words
  thangs:      { sep: ', ', hashtag: false },
  nexprint:    { sep: ', ', hashtag: false },
  creality:    { sep: ', ', hashtag: false },
};

function formatTagsFor(platformId, tags) {
  const fmt = TAG_FORMATS[platformId] || { sep: ', ', hashtag: false };
  return tags.map(t => fmt.hashtag ? `#${t}` : t).join(fmt.sep);
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Platforms whose description box is a rich-text/WYSIWYG editor (not a raw-HTML
// or markdown field). Pasting HTML *source* into these shows literal tags, so we
// copy rendered content as rich text instead — paste keeps the formatting.
const RICH_TEXT_PLATFORMS = ['makerworld'];
function isRichTextPlatform(id) { return RICH_TEXT_PLATFORMS.includes(id); }

// Copy rendered HTML to the clipboard as rich text (with a plain-text fallback),
// so pasting into a WYSIWYG editor preserves headings/bold/lists.
async function copyRichText(html, plain) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch (e) { /* fall through to plain text */ }
  try { await navigator.clipboard.writeText(plain); return true; } catch (e) { return false; }
}

const PLATFORMS = [
  {
    id: 'makerworld', name: 'MakerWorld', org: 'Bambu Lab', dot: '#FF6900',
    covers: [
      { id: 'web', label: 'Web cover', w: 1920, h: 1440, aspect: '4:3' },
      { id: 'app', label: 'App cover', w: 1500, h: 1500, aspect: '1:1' },
    ],
    descFormat: 'html', maxImages: 16, maxFileMb: 150, maxTotalMb: 250,
    formats: ['3mf', 'stl', 'step', 'obj'], hasApi: false, apiSupport: 'manual',
    fields: ['remix'], note: 'Largest audience. Real photo of print required. Connects Printables/Thingiverse for import.',
  },
  {
    id: 'printables', name: 'Printables', org: 'Prusa Research', dot: '#FA6831',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'markdown', maxImages: 25, maxFileMb: 500, maxTotalMb: 2000,
    formats: ['stl', '3mf', 'obj', 'step', 'zip'], hasApi: false, apiSupport: 'manual',
    fields: [], note: 'High file limits. Markdown description. Active contests.',
  },
  {
    id: 'cults', name: 'Cults3D', org: 'Independent', dot: '#F79E2E',
    covers: [{ id: 'cover', label: 'Cover', w: 1500, h: 1500, aspect: '1:1' }],
    descFormat: 'markdown', maxImages: 20, maxFileMb: 100, maxTotalMb: 500,
    formats: ['stl', 'obj', '3mf', 'step', 'zip', 'svg', 'dxf'], hasApi: true, apiSupport: 'oneclick',
    fields: ['price'], note: 'GraphQL API supports full upload. Paid marketplace.',
  },
  {
    id: 'mmf', name: 'MyMiniFactory', org: 'SoulCrafted', dot: '#4FB286',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'html', maxImages: 20, maxFileMb: 100, maxTotalMb: 500,
    formats: ['stl', 'obj', '3mf', 'zip'], hasApi: true, apiSupport: 'oneclick',
    fields: ['price'], note: 'REST + OAuth2. Curated, test print before publish.',
  },
  {
    id: 'thingiverse', name: 'Thingiverse', org: 'MyMiniFactory', dot: '#248BFB',
    covers: [{ id: 'cover', label: 'Cover', w: 1600, h: 1200, aspect: '4:3' }],
    descFormat: 'plain', maxImages: 20, maxFileMb: 100, maxTotalMb: 250,
    formats: ['stl', '3mf', 'obj', 'scad', 'dxf', 'svg', 'pdf'], hasApi: true, apiSupport: 'oneclick',
    fields: [], note: 'OAuth2 REST API. Largest legacy library.',
  },
  {
    id: 'thangs', name: 'Thangs', org: 'Physna', dot: '#3A86FF',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'html', maxImages: 15, maxFileMb: 100, maxTotalMb: 500,
    formats: ['stl', '3mf', 'obj', 'step', 'blend', 'fbx', 'glb'], hasApi: false, apiSupport: 'addon',
    fields: [], note: 'Search engine + repo. Ships Blender addon for upload.',
  },
  {
    id: 'nexprint', name: 'Nexprint', org: 'Elegoo', dot: '#FFB627',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'markdown', maxImages: 12, maxFileMb: 100, maxTotalMb: 250,
    formats: ['3mf', 'stl', 'obj', 'step', 'amf'], hasApi: false, apiSupport: 'manual',
    fields: ['contestEntry'], note: 'New (Aug 2025), $1M creator fund, $5 per approved model.',
  },
  {
    id: 'creality', name: 'Creality Cloud', org: 'Creality', dot: '#E63946',
    covers: [{ id: 'cover', label: 'Cover', w: 1600, h: 1200, aspect: '4:3' }],
    descFormat: 'html', maxImages: 15, maxFileMb: 100, maxTotalMb: 300,
    formats: ['stl', '3mf', 'obj', 'step'], hasApi: false, apiSupport: 'manual',
    fields: [], note: 'Manufacturer-tied, large Creality user base.',
  },
];

const CATEGORIES = [
  'Home & Living', 'Tools', 'Toys & Games', 'Hobby & DIY', 'Art & Decor',
  'Fashion & Jewelry', 'Electronics & Tech', 'Outdoor & Garden', 'Educational',
  'Miniatures & Tabletop', 'Cosplay & Props', 'Holiday & Seasonal', 'Other',
];

const LICENSES = [
  { id: 'cc0', name: 'CC0 — Public Domain', commercial: true, derivatives: true },
  { id: 'ccby', name: 'CC BY — Attribution', commercial: true, derivatives: true },
  { id: 'ccbysa', name: 'CC BY-SA — Attribution, ShareAlike', commercial: true, derivatives: true },
  { id: 'ccbync', name: 'CC BY-NC — Attribution, NonCommercial', commercial: false, derivatives: true },
  { id: 'ccbyncsa', name: 'CC BY-NC-SA — NonCommercial, ShareAlike', commercial: false, derivatives: true },
  { id: 'ccbynd', name: 'CC BY-ND — Attribution, NoDerivatives', commercial: true, derivatives: false },
  { id: 'standard', name: 'Standard Digital License (paid)', commercial: true, derivatives: false },
];

const SECTIONS = [
  { id: 'files',     label: 'Files',     icon: Folder,    description: 'Upload your STL and 3MF files' },
  { id: 'details',   label: 'Details',   icon: FileText,  description: 'Title, description, tags, category, license' },
  { id: 'images',    label: 'Images',    icon: ImageIcon, description: 'Cover and gallery photos with per-platform crops' },
  { id: 'profiles',  label: 'Profiles',  icon: Layers,    description: 'Print profile per 3MF, with own description' },
  { id: 'platforms', label: 'Platforms', icon: Globe,     description: 'Choose where to publish and platform-specific options' },
  { id: 'publish',   label: 'Publish',   icon: Send,      description: 'Review and (mock) upload to each platform' },
];

const SAMPLE_DESCRIPTION = `# Articulating Desk Dragon

A snap-fit dragon that prints in place.

No supports, no glue, no shame.

## What's included

- STL files for both sizes (S, M)
- A 3MF with my recommended Bambu profile
- Print orientation diagram

## Print settings

**Layer height:** 0.2mm
**Infill:** 15% gyroid
**Supports:** None needed
**Wall loops:** 3

## Tips

If the joints are too tight after printing, give them a gentle wiggle. The clearance is tuned for a 0.4mm nozzle. For 0.6mm nozzles, scale to 105%.`;

// =====================================================================
// HELPERS
// =====================================================================

function escapeHtml(s) {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
function inlineFormat(t) {
  return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
          .replace(/`(.+?)`/g, '<code>$1</code>');
}
function mdToHtml(md) {
  if (!md) return '';
  const lines = md.split('\n'); const out = []; let inList = false, inCode = false;
  let codeBuf = [], paraBuf = [];
  const flushPara = () => { if (paraBuf.length) { const t = paraBuf.join(' ').trim(); if (t) out.push(`<p>${inlineFormat(t)}</p>`); paraBuf = []; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushPara(); closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(escapeHtml(line)); continue; }
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) { flushPara(); closeList(); out.push(`<h${h[1].length}>${inlineFormat(h[2])}</h${h[1].length}>`); continue; }
    const li = line.match(/^[-*]\s+(.+)$/);
    if (li) { flushPara(); if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inlineFormat(li[1])}</li>`); continue; }
    if (line.trim() === '') { flushPara(); closeList(); continue; }
    closeList(); paraBuf.push(line);
  }
  flushPara(); closeList();
  return out.join('\n');
}
function mdToPlain(md) {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ');
}
function cropToCanvas(img, targetW, targetH, focal) {
  const c = document.createElement('canvas');
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext('2d');
  const srcA = img.naturalWidth / img.naturalHeight;
  const tgtA = targetW / targetH;
  let sx, sy, sw, sh;
  if (srcA > tgtA) { sh = img.naturalHeight; sw = sh * tgtA; sy = 0; sx = (img.naturalWidth - sw) * focal.x; }
  else { sw = img.naturalWidth; sh = sw / tgtA; sx = 0; sy = (img.naturalHeight - sh) * focal.y; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return c;
}
function downloadCanvas(c, filename) {
  c.toBlob(b => {
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }, 'image/jpeg', 0.92);
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function isModelFile(name) {
  const x = fileExt(name);
  return ['stl', '3mf', 'obj', 'step', 'stp', 'amf', 'gcode', 'scad', 'dxf', 'svg', 'glb', 'fbx', 'blend'].includes(x);
}
function isProfile(name) { return fileExt(name) === '3mf'; }

// Mock 3MF parser: real parsing needs JSZip; for prototype we generate believable profiles
function mockParseThreeMF(filename) {
  const printers = ['Bambu A1 Mini', 'Bambu P1S', 'Bambu X1C', 'Prusa MK4', 'Elegoo Centauri Carbon'];
  const materials = ['PLA', 'PETG', 'PLA Silk', 'ABS', 'PLA Matte'];
  const layers = ['0.08mm', '0.12mm', '0.16mm', '0.2mm', '0.28mm'];
  const seed = filename.length;
  return {
    printer: printers[seed % printers.length],
    material: materials[(seed + 1) % materials.length],
    layerHeight: layers[(seed + 2) % layers.length],
    plates: 1 + (seed % 3),
    estimatedTime: `${1 + (seed % 8)}h ${(seed * 7) % 60}min`,
    filamentGrams: 20 + (seed % 80),
  };
}

function makeSampleImage(label = 'SAMPLE', tint = ['#FF5722', '#FFB627', '#1A1A1A']) {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1800;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, tint[0]); g.addColorStop(0.5, tint[1]); g.addColorStop(1, tint[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(c.width * (0.15 + i * 0.1), c.height * (0.3 + (i % 3) * 0.15), 120 + i * 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 260px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, c.width / 2, c.height / 2 - 50);
  ctx.font = '60px monospace';
  ctx.fillText('2400 × 1800', c.width / 2, c.height / 2 + 160);
  return c.toDataURL('image/jpeg', 0.9);
}

function loadImageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Lazy-load JSZip from CDN on first use. Cached after first load.
let _jszipPromise = null;
function loadJSZip() {
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.JSZip) return resolve(window.JSZip);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => { _jszipPromise = null; reject(new Error('Could not load JSZip from CDN. Check internet connection.')); };
    document.head.appendChild(script);
  });
  return _jszipPromise;
}

function canvasToBlob(canvas, quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function generateMetadataText(platform, project, platformState, tagString) {
  const license = (typeof LICENSES !== 'undefined'
    ? LICENSES.find(l => l.id === project.license)?.name
    : project.license) || project.license;
  const descExt = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
  const lines = [
    `# Upload package for ${platform.name}`,
    `# Generated by ModelPrep`,
    `# ${new Date().toISOString()}`,
    ``,
    `TITLE`,
    project.title,
    ``,
    `CATEGORY`,
    project.category,
    ``,
    `LICENSE`,
    license,
    ``,
    `TAGS (${platform.id === 'thingiverse' ? 'space-separated' : 'comma-separated'})`,
    tagString,
    ``,
    `DESCRIPTION (${platform.descFormat})`,
    `// see description.${descExt} for the full text`,
    ``,
  ];
  if (platformState.price !== undefined) {
    lines.push(`PRICE`, platformState.free ? 'Free' : `$${platformState.price.toFixed(2)} USD`, ``);
  }
  if (platformState.contestEntry) {
    lines.push(`CONTEST ENTRY`, platformState.contestEntry, ``);
  }
  if (platformState.remix) {
    lines.push(`REMIX`, 'YES: link the original in the description', ``);
  }
  return lines.join('\n');
}

function generateReadme(platform, project, descExt, imageCount, fileCount) {
  const uploadUrl = (typeof UPLOAD_URLS !== 'undefined' ? UPLOAD_URLS[platform.id] : '') || '';
  const lines = [
    `${platform.name.toUpperCase()} UPLOAD PACKAGE`,
    '='.repeat(40),
    '',
    `Generated by ModelPrep / MakerStats Studio`,
    new Date().toISOString(),
    '',
    `MODEL:       ${project.title}`,
    `TARGET:      ${platform.name} (${platform.org})`,
    `UPLOAD URL:  ${uploadUrl}`,
    '',
    `WHAT IS IN THIS FOLDER`,
    '-'.repeat(40),
    `- ${platform.covers.length} cover image(s), named 01_cover_*.jpg`,
    `- ${Math.max(0, imageCount - 1)} gallery image(s), named 02_gallery_*.jpg, 03_gallery_*.jpg, ...`,
    isRichTextPlatform(platform.id)
      ? `- description.html (rendered — open in a browser, select all, copy, then paste into ${platform.name}'s visual editor; do NOT paste the raw HTML)`
      : `- description.${descExt} (in ${platform.descFormat} format, ready to paste)`,
    `- metadata.txt (title, category, tags, license, all paste-ready)`,
    `- files/ folder with ${fileCount} model file(s)`,
    '',
    `UPLOAD STEPS`,
    '-'.repeat(40),
    `1. Open ${uploadUrl} in your browser.`,
    `2. Drag the contents of the files/ folder into the model files slot.`,
    `3. Drag 01_cover_*.jpg into the cover image slot.`,
    `4. Drag the gallery images (02_*, 03_*, ...) into the gallery, in order.`,
    `5. Open metadata.txt, copy and paste the title field.`,
    isRichTextPlatform(platform.id)
      ? `6. Open description.html in a browser, select all, copy, paste into the description editor — formatting is preserved. (Do NOT paste raw HTML; ${platform.name}'s editor shows the tags.)`
      : `6. Open description.${descExt}, select all, copy, paste into description.`,
    `7. Copy tags from metadata.txt into the tags field.`,
    `8. Pick the closest category match and the license listed.`,
  ];
  if (platform.id === 'makerworld') {
    lines.push('9. MakerWorld requires at least one image of an actual printed object.');
  }
  if (platform.id === 'mmf') {
    lines.push('9. MyMiniFactory will test-print before publishing. Expect 1 to 3 day delay.');
  }
  if (platform.id === 'nexprint') {
    lines.push('9. Submit to a contest in the Contests section if applicable.');
  }
  if (platform.id === 'cults' || platform.id === 'mmf') {
    lines.push('10. Set price (free or paid) per the value listed in metadata.txt.');
  }
  lines.push('', 'Final step: click Submit / Publish on the platform.');
  return lines.join('\n');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================

const initialProject = {
  name: 'Untitled Project',
  files: [],
  images: [],
  coverImageId: null,
  title: '',
  description: '',
  category: '',
  tags: [],
  license: 'ccbync',
  profiles: [],
  platforms: {
    makerworld: { enabled: true, remix: false },
    printables: { enabled: true },
    cults: { enabled: true, price: 0, free: true },
    mmf: { enabled: true, price: 0, free: true },
    thingiverse: { enabled: true },
    thangs: { enabled: true },
    nexprint: { enabled: false, contestEntry: '' },
    creality: { enabled: false },
  },
};

export default function App() {
  const [project, setProject] = useState(initialProject);
  const [currentSection, setCurrentSection] = useState('files');
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const updateProject = (patch) => setProject(p => ({ ...p, ...patch }));

  // Auto-generate profile entries when 3MF files are added
  useEffect(() => {
    const threeMFs = project.files.filter(f => isProfile(f.name));
    const profileIds = new Set(project.profiles.map(p => p.fileId));
    const newProfiles = threeMFs
      .filter(f => !profileIds.has(f.id))
      .map(f => ({
        id: 'prof_' + f.id,
        fileId: f.id,
        name: f.name.replace(/\.3mf$/i, ''),
        description: '',
        useMainCover: true,
        coverImageId: null,
        parsed: mockParseThreeMF(f.name),
      }));
    if (newProfiles.length) {
      updateProject({ profiles: [...project.profiles, ...newProfiles] });
    }
    // Remove profiles whose files were deleted
    const liveFileIds = new Set(project.files.map(f => f.id));
    const liveProfiles = project.profiles.filter(p => liveFileIds.has(p.fileId));
    if (liveProfiles.length !== project.profiles.length) {
      updateProject({ profiles: liveProfiles });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.files]);

  // Section completion logic
  const completion = useMemo(() => ({
    files: project.files.length > 0,
    details: project.title.trim() && project.description.trim() && project.category && project.tags.length > 0,
    images: project.images.length > 0 && project.coverImageId !== null,
    profiles: project.profiles.length === 0 || project.profiles.every(p => p.name.trim()),
    platforms: Object.values(project.platforms).some(p => p.enabled),
    publish: false,
  }), [project]);

  const allReady = completion.files && completion.details && completion.images && completion.profiles && completion.platforms;

  const saveAsTemplate = () => {
    const name = prompt('Template name?');
    if (!name) return;
    setTemplates(t => [...t, {
      id: 't_' + Date.now(), name,
      data: { description: project.description, category: project.category, tags: project.tags, license: project.license },
    }]);
  };
  const loadTemplate = (t) => {
    updateProject({ description: t.data.description, category: t.data.category, tags: t.data.tags, license: t.data.license });
    setShowTemplates(false);
  };
  const newProject = () => {
    if (project.files.length || project.title || project.description) {
      if (!confirm('Discard current project and start fresh?')) return;
    }
    setProject({ ...initialProject, name: 'Untitled Project' });
    setCurrentSection('files');
  };

  return (
    <div className="min-h-screen w-full" style={{ background: '#EDE9DE', color: '#15171C', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <GlobalStyles />

      {/* Background workshop pattern: subtle layer lines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(21,23,28,0.022) 0px, rgba(21,23,28,0.022) 1px, transparent 1px, transparent 7px)',
        zIndex: 0,
      }} />
      <div className="relative z-10">

      <TopHeader
        project={project}
        updateProject={updateProject}
        templates={templates}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        onSaveTemplate={saveAsTemplate}
        onLoadTemplate={loadTemplate}
        onNewProject={newProject}
      />

      <div className="flex max-w-[1400px] mx-auto" style={{ minHeight: 'calc(100vh - 81px - 32px)' }}>
        <Sidebar
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          completion={completion}
        />

        <main className="flex-1 p-8 overflow-x-hidden pb-16">
          {currentSection === 'files' && (
            <FilesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
          )}
          {currentSection === 'details' && (
            <DetailsSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
          )}
          {currentSection === 'images' && (
            <ImagesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
          )}
          {currentSection === 'profiles' && (
            <ProfilesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
          )}
          {currentSection === 'platforms' && (
            <PlatformsSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
          )}
          {currentSection === 'publish' && (
            <PublishSection
              project={project}
              allReady={allReady}
              completion={completion}
              setCurrentSection={setCurrentSection}
            />
          )}
        </main>
      </div>

      <StatusBar project={project} completion={completion} currentSection={currentSection} />
      </div>
    </div>
  );
}

function StatusBar({ project, completion, currentSection }) {
  const totalSize = project.files.reduce((s, f) => s + f.size, 0);
  const enabledCount = Object.values(project.platforms).filter(p => p.enabled).length;
  const doneCount = Object.values(completion).filter(Boolean).length;
  const totalSteps = Object.keys(completion).length - 1; // publish doesn't count
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t" style={{
      background: '#15171C',
      color: '#EDE9DE',
      borderColor: '#15171C',
      height: 32,
    }}>
      <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-5 mp-mono text-[10px] uppercase tracking-[0.15em]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5" style={{ background: '#4FB286' }} />
            READY
          </span>
          <span style={{ color: 'rgba(237,233,222,0.5)' }}>│</span>
          <span>SECTION /{currentSection.toUpperCase()}</span>
          <span style={{ color: 'rgba(237,233,222,0.5)' }}>│</span>
          <span>{doneCount}/{totalSteps} STEPS COMPLETE</span>
        </div>
        <div className="flex items-center gap-5 mp-mono text-[10px] uppercase tracking-[0.15em]">
          <span>FILES <span style={{ color: '#FF5722' }}>{project.files.length}</span></span>
          <span>IMG <span style={{ color: '#FF5722' }}>{project.images.length}</span></span>
          <span>SIZE <span style={{ color: '#FF5722' }}>{formatBytes(totalSize)}</span></span>
          <span>TARGETS <span style={{ color: '#FF5722' }}>{enabledCount}/{PLATFORMS.length}</span></span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// GLOBAL STYLES
// =====================================================================

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

      /* Industrial / workshop type system */
      .mp-display { font-family: 'Big Shoulders Display', 'Impact', sans-serif; font-weight: 800; letter-spacing: -0.005em; line-height: 0.95; text-transform: uppercase; }
      .mp-body { font-family: 'Space Grotesk', system-ui, sans-serif; }
      .mp-mono { font-family: 'JetBrains Mono', 'Courier New', monospace; font-feature-settings: "ss01", "zero"; }

      /* Layer-line background (subtle horizontal stripes like 3D print layers) */
      .mp-grid {
        background-image: repeating-linear-gradient(0deg, rgba(21,23,28,0.04) 0px, rgba(21,23,28,0.04) 1px, transparent 1px, transparent 8px);
      }
      .mp-blueprint {
        background-image:
          linear-gradient(to right, rgba(43,58,85,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(43,58,85,0.06) 1px, transparent 1px),
          linear-gradient(to right, rgba(43,58,85,0.12) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(43,58,85,0.12) 1px, transparent 1px);
        background-size: 8px 8px, 8px 8px, 80px 80px, 80px 80px;
      }

      /* Dimension-line decoration for section headers (CAD drawing style) */
      .mp-dimline { position: relative; display: inline-block; padding: 0 14px; }
      .mp-dimline::before, .mp-dimline::after {
        content: ''; position: absolute; top: 50%; width: 10px; height: 1px; background: currentColor;
      }
      .mp-dimline::before { left: 0; box-shadow: 0 -4px 0 0 currentColor, 0 4px 0 0 currentColor; }
      .mp-dimline::after  { right: 0; box-shadow: 0 -4px 0 0 currentColor, 0 4px 0 0 currentColor; }

      /* Tick rule (for project name underline etc.) */
      .mp-tickrule {
        background-image: repeating-linear-gradient(to right, currentColor 0px, currentColor 1px, transparent 1px, transparent 6px);
        height: 1px; opacity: 0.4;
      }

      .mp-textarea::placeholder { color: rgba(21,23,28,0.3); }
      .mp-prose h1,.mp-prose h2,.mp-prose h3 { font-family: 'Big Shoulders Display'; font-weight: 800; margin: 0.7em 0 0.25em; line-height: 1.05; text-transform: uppercase; letter-spacing: -0.005em; }
      .mp-prose h1 { font-size: 1.6em; } .mp-prose h2 { font-size: 1.35em; } .mp-prose h3 { font-size: 1.15em; }
      .mp-prose p { margin: 0.55em 0; line-height: 1.6; font-family: 'Space Grotesk'; }
      .mp-prose ul { margin: 0.4em 0; padding-left: 1.2em; font-family: 'Space Grotesk'; }
      .mp-prose li { margin: 0.15em 0; line-height: 1.5; }
      .mp-prose code { font-family: 'JetBrains Mono'; font-size: 0.88em; background: rgba(21,23,28,0.06); padding: 0.12em 0.35em; }
      .mp-prose a { color: #FF5722; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
      .mp-pre { white-space: pre-wrap; word-break: break-word; }

      .mp-input { background: #FFFFFF; border: 1px solid rgba(21,23,28,0.18); padding: 0.625rem 0.875rem; font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 0.9rem; width: 100%; color: #15171C; }
      .mp-input:focus { outline: none; border-color: #FF5722; box-shadow: inset 0 0 0 1px #FF5722; }

      .mp-btn { font-family: 'Big Shoulders Display'; font-weight: 800; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.625rem 1.125rem; background: #15171C; color: #EDE9DE; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 0.5rem; border: 1px solid #15171C; }
      .mp-btn:hover:not(:disabled) { background: #FF5722; border-color: #FF5722; }
      .mp-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .mp-btn-ghost { background: transparent; color: #15171C; border: 1px solid rgba(21,23,28,0.25); }
      .mp-btn-ghost:hover:not(:disabled) { background: #15171C; color: #EDE9DE; border-color: #15171C; }

      .mp-card { background: #FFFFFF; border: 1px solid rgba(21,23,28,0.12); }

      /* Workshop-style status pill */
      .mp-pill { font-family: 'JetBrains Mono'; font-size: 9px; text-transform: uppercase; letter-spacing: 0.15em; padding: 2px 6px; border-radius: 0; }

      @keyframes mp-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .mp-spin { animation: mp-spin 1s linear infinite; }
      @keyframes mp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .mp-pulse { animation: mp-pulse 1.5s ease-in-out infinite; }
      @keyframes mp-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
      .mp-scan { animation: mp-scan 2s linear infinite; }

      /* Global body font */
      body, [class*="mp-"] { font-family: 'Space Grotesk', system-ui, sans-serif; }
    `}</style>
  );
}

// =====================================================================
// TOP HEADER
// =====================================================================

function TopHeader({ project, updateProject, templates, showTemplates, setShowTemplates, onSaveTemplate, onLoadTemplate, onNewProject }) {
  const [editingName, setEditingName] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: 'rgba(21,23,28,0.1)', background: 'rgba(237,233,222,0.92)' }}>
      <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative" style={{ background: '#15171C' }}>
            {/* Layer-stack icon: 4 horizontal bars stacked, mimicking print layers */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="3"  width="16" height="2" fill="#FF5722" />
              <rect x="3" y="7"  width="16" height="2" fill="#EDE9DE" opacity="0.4" />
              <rect x="3" y="11" width="16" height="2" fill="#EDE9DE" opacity="0.6" />
              <rect x="3" y="15" width="16" height="2" fill="#EDE9DE" opacity="0.85" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="mp-display text-[26px] leading-none">ModelPrep</h1>
              <span className="mp-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.45)' }}>v0.3 · build 04</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {editingName ? (
                <input
                  autoFocus
                  value={project.name}
                  onChange={(e) => updateProject({ name: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                  className="mp-mono text-[11px] bg-transparent outline-none border-b"
                  style={{ borderColor: '#FF5722', width: 220 }}
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="mp-mono text-[11px] flex items-center gap-1 group"
                  style={{ color: 'rgba(21,23,28,0.6)' }}
                >
                  ▸ {project.name}
                  <Edit3 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowTemplates(s => !s)} className="mp-btn mp-btn-ghost text-xs py-2 px-3">
              <Bookmark size={13} /> Templates
              {templates.length > 0 && (
                <span className="ml-1 mp-mono text-[10px]" style={{ color: '#FF5722' }}>{templates.length}</span>
              )}
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-72 mp-card z-30" onMouseLeave={() => setShowTemplates(false)}>
                <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
                  <button onClick={() => { onSaveTemplate(); setShowTemplates(false); }} className="w-full text-left text-xs flex items-center gap-2 py-1" style={{ color: '#FF5722' }}>
                    <Save size={12} /> Save current as template
                  </button>
                </div>
                {templates.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center" style={{ color: 'rgba(21,23,28,0.4)' }}>
                    No templates yet. Save your current setup as a reusable template (Marjan's "Sjabloon").
                  </div>
                ) : (
                  templates.map(t => (
                    <button key={t.id} onClick={() => onLoadTemplate(t)} className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition flex justify-between items-center">
                      <span>{t.name}</span>
                      <span className="mp-mono text-[10px]" style={{ color: 'rgba(21,23,28,0.4)' }}>{t.data.tags?.length || 0} tags</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button onClick={onNewProject} className="mp-btn mp-btn-ghost text-xs py-2 px-3">
            <Plus size={13} /> New
          </button>
        </div>
      </div>
    </header>
  );
}

// =====================================================================
// SIDEBAR
// =====================================================================

function Sidebar({ currentSection, setCurrentSection, completion }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r" style={{ borderColor: 'rgba(21,23,28,0.15)', minHeight: '100%' }}>
      <nav className="py-6 px-3 sticky top-[81px]">
        <div className="mp-mono text-[9px] uppercase tracking-[0.25em] px-3 mb-3 flex items-center gap-2" style={{ color: 'rgba(21,23,28,0.45)' }}>
          <span>┌─ JOB SHEET</span>
          <div className="flex-1 mp-tickrule" />
        </div>
        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          const done = completion[s.id];
          const active = currentSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setCurrentSection(s.id)}
              className="w-full text-left p-3 mb-0.5 flex items-start gap-3 transition-colors group relative"
              style={{
                background: active ? '#15171C' : 'transparent',
                color: active ? '#EDE9DE' : '#15171C',
              }}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: '#FF5722' }} />
              )}
              <div className="flex-shrink-0 mt-0.5 relative">
                <Icon size={16} strokeWidth={2.25} />
                {done && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center" style={{ background: '#FF5722' }}>
                    <Check size={8} strokeWidth={3.5} color="#fff" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="mp-mono text-[9px] tracking-[0.15em] opacity-50">{String(i + 1).padStart(2, '0')}/</span>
                  <span className="mp-display text-[17px] leading-none">{s.label}</span>
                </div>
                <div className="mp-body text-[11px] mt-1 leading-tight" style={{ color: active ? 'rgba(237,233,222,0.6)' : 'rgba(21,23,28,0.5)' }}>
                  {s.description}
                </div>
              </div>
            </button>
          );
        })}
        <div className="mp-mono text-[9px] uppercase tracking-[0.25em] px-3 mt-3 flex items-center gap-2" style={{ color: 'rgba(21,23,28,0.45)' }}>
          <span>└─</span>
          <div className="flex-1 mp-tickrule" />
        </div>
      </nav>
    </aside>
  );
}

// =====================================================================
// SECTION: FILES
// =====================================================================

// Largest "total package" allowance across platforms — anything over this is
// rejected everywhere, so we block the upload outright rather than just warn.
const MAX_BUILD_FILE_MB = 500;

function isImageFile(name) { return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt(name)); }

function FilesSection({ project, updateProject, setCurrentSection }) {
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null); // { kind: 'image' | 'toobig', detail }

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    const supported = arr.filter(f => isModelFile(f.name) || ['pdf', 'txt', 'md', 'png', 'jpg', 'jpeg', 'zip'].includes(fileExt(f.name)));

    // #1 — reject single files larger than any platform will accept.
    const tooBig = supported.filter(f => f.size / 1024 / 1024 > MAX_BUILD_FILE_MB);
    const withinLimit = supported.filter(f => f.size / 1024 / 1024 <= MAX_BUILD_FILE_MB);

    const additions = withinLimit.map(f => ({
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: f.name,
      size: f.size,
      type: f.type,
      isModel: isModelFile(f.name),
      isProfile: isProfile(f.name),
      isImage: isImageFile(f.name),
      blob: f,  // keep the actual File so we can include it in ZIP exports
    }));

    if (tooBig.length) {
      setNotice({ kind: 'toobig', detail: tooBig.map(f => `${f.name} (${formatBytes(f.size)})`).join(', ') });
    } else if (additions.some(a => a.isImage)) {
      // #3 — images are accepted as reference files, but gallery photos belong in step 03.
      setNotice({ kind: 'image', detail: null });
    } else {
      setNotice(null);
    }

    if (additions.length === 0) {
      if (!tooBig.length) alert('No supported files in your drop. Try .stl, .3mf, .obj, .step, or .amf.');
      return;
    }
    updateProject({ files: [...project.files, ...additions] });
  };

  const removeFile = (id) => updateProject({ files: project.files.filter(f => f.id !== id) });

  const renameFile = (id, newName) => updateProject({
    files: project.files.map(f => f.id === id ? { ...f, name: newName } : f),
  });

  const totalSize = project.files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="max-w-4xl">
      <SectionHeader
        number="01"
        title="Drop your files"
        subtitle="STL for raw geometry, 3MF for print profiles, plus optional PDFs or images. Each 3MF will become a print profile in step 04."
      />

      <div
        className="mp-blueprint border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-colors mt-6"
        style={{ borderColor: 'rgba(21,23,28,0.25)' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF5722'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(21,23,28,0.25)'}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".stl,.3mf,.obj,.step,.stp,.amf,.scad,.dxf,.svg,.pdf,.zip,.png,.jpg,.jpeg"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
          <Upload size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
        </div>
        <h2 className="mp-display text-[36px] leading-none mb-2">Load build files</h2>
        <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>drag &amp; drop · or click anywhere in the work area · max {MAX_BUILD_FILE_MB}MB per file</p>
        <div className="inline-flex items-center gap-1.5 mp-mono text-[10px] uppercase tracking-[0.2em] flex-wrap justify-center" style={{ color: 'rgba(21,23,28,0.5)' }}>
          {['stl', '3mf', 'obj', 'step', 'amf', 'scad', 'svg', 'dxf', 'pdf'].map(ext => (
            <span key={ext} className="mp-pill" style={{ background: 'rgba(21,23,28,0.06)' }}>.{ext}</span>
          ))}
        </div>
      </div>

      {notice && (
        <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
          <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs flex-1">
            {notice.kind === 'toobig' ? (
              <>
                <div className="mp-display font-bold mb-1">File too large — not added</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  {notice.detail} exceeds the {MAX_BUILD_FILE_MB}MB per-file ceiling that platforms accept. Decimate the mesh or split it before uploading.
                </div>
              </>
            ) : (
              <>
                <div className="mp-display font-bold mb-1">Added an image as a build file</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  Kept it (handy for print diagrams). But if these are gallery photos, add them in <strong>step 03 · Images</strong> instead — that's where per-platform crops happen.
                </div>
              </>
            )}
          </div>
          <button onClick={() => setNotice(null)} className="p-0.5 opacity-50 hover:opacity-100 transition" aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {project.files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
              {project.files.length} file{project.files.length === 1 ? '' : 's'} · {formatBytes(totalSize)} total
            </span>
            <button onClick={() => updateProject({ files: [] })} className="mp-mono text-[10px] uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition">
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {project.files.map(f => (
              <FileRow key={f.id} file={f} onRemove={() => removeFile(f.id)} onRename={(name) => renameFile(f.id, name)} />
            ))}
          </div>
        </div>
      )}

      <FileSizeWarnings files={project.files} totalSize={totalSize} />

      <SectionNav
        backLabel={null}
        nextLabel="Continue to Details"
        nextDisabled={project.files.length === 0}
        onNext={() => setCurrentSection('details')}
      />
    </div>
  );
}

function FileRow({ file, onRemove, onRename }) {
  const isProf = file.isProfile;
  const isImg = file.isImage;
  const ext = fileExt(file.name);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseName);

  const startEdit = () => { setDraft(baseName); setEditing(true); };
  const commit = () => {
    const clean = draft.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.+$/, '');
    if (clean && clean !== baseName) onRename(`${clean}.${ext}`);
    setEditing(false);
  };

  return (
    <div className="mp-card p-3 flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: isProf ? '#FF5722' : isImg ? 'rgba(21,23,28,0.4)' : '#15171C' }}>
        {isProf ? <Layers size={16} color="#fff" /> : isImg ? <ImageIcon size={16} color="#EDE9DE" /> : <FileCheck size={16} color="#EDE9DE" />}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="mp-mono text-sm bg-transparent outline-none border-b flex-1 min-w-0"
              style={{ borderColor: '#FF5722' }}
            />
            <span className="mp-mono text-sm flex-shrink-0" style={{ color: 'rgba(21,23,28,0.45)' }}>.{ext}</span>
          </div>
        ) : (
          <button onClick={startEdit} className="mp-display font-bold text-sm truncate flex items-center gap-1.5 group/name max-w-full" title="Click to rename">
            <span className="truncate">{file.name}</span>
            <Edit3 size={11} className="opacity-0 group-hover/name:opacity-50 transition flex-shrink-0" />
          </button>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="mp-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
            .{ext} · {formatBytes(file.size)}
          </span>
          {isProf && (
            <span className="mp-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#FF5722', color: '#fff' }}>
              Print profile
            </span>
          )}
          {isImg && (
            <span className="mp-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: 'rgba(21,23,28,0.4)', color: '#fff' }}>
              Reference image
            </span>
          )}
        </div>
      </div>
      <button onClick={startEdit} className="p-1.5 opacity-40 hover:opacity-100 transition" aria-label="Rename file">
        <Edit3 size={14} />
      </button>
      <button onClick={onRemove} className="p-1.5 opacity-40 hover:opacity-100 transition" aria-label="Remove file">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function FileSizeWarnings({ files, totalSize }) {
  const totalMb = totalSize / 1024 / 1024;
  const warnings = [];
  if (totalMb > 250) warnings.push({ platform: 'MakerWorld', limit: '250MB total', current: `${totalMb.toFixed(0)}MB` });
  files.filter(f => f.isProfile).forEach(f => {
    if (f.size / 1024 / 1024 > 150) {
      warnings.push({ platform: 'MakerWorld', limit: '150MB per profile', current: `${(f.size / 1024 / 1024).toFixed(0)}MB (${f.name})` });
    }
  });
  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
      <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
      <div className="text-xs">
        <div className="mp-display font-bold mb-1">Size warnings</div>
        {warnings.map((w, i) => (
          <div key={i}>
            <span className="mp-mono text-[10px] uppercase tracking-wider">{w.platform}</span>: {w.limit} exceeded ({w.current})
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// SECTION: DETAILS
// =====================================================================

const AI_TAG_SUGGESTIONS = {
  'dragon':    ['articulated', 'flexi', 'fidget', 'no-supports', 'print-in-place', 'figurine', 'fantasy'],
  'phone':     ['stand', 'holder', 'desk', 'organizer', 'accessory', 'tech'],
  'planter':   ['plant', 'pot', 'garden', 'home-decor', 'succulent', 'indoor'],
  'box':       ['storage', 'container', 'organizer', 'modular', 'gridfinity', 'functional'],
  'figure':    ['figurine', 'collectible', 'display', 'detailed', 'miniature'],
  'desk':      ['organizer', 'office', 'workspace', 'functional', 'productivity'],
  'default':   ['functional', 'easy-print', 'no-supports', '3d-print', 'useful', 'design'],
};

function aiSuggestTags(title) {
  const t = title.toLowerCase();
  for (const k of Object.keys(AI_TAG_SUGGESTIONS)) {
    if (k !== 'default' && t.includes(k)) return AI_TAG_SUGGESTIONS[k];
  }
  return AI_TAG_SUGGESTIONS.default;
}

function CategorySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="mp-input flex items-center justify-between text-left"
        style={{ color: value ? '#15171C' : 'rgba(21,23,28,0.45)' }}
      >
        <span className="truncate">{value || 'Choose a category…'}</span>
        <ChevronDown size={14} style={{ color: 'rgba(21,23,28,0.45)' }} className="flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 mp-card shadow-lg" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
            <Search size={13} style={{ color: 'rgba(21,23,28,0.45)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="bg-transparent outline-none text-xs flex-1"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: 'rgba(21,23,28,0.5)' }}>No match for “{query}”.</div>
            )}
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[rgba(255,87,34,0.08)] transition flex items-center justify-between"
                style={{ background: value === o ? 'rgba(255,87,34,0.06)' : 'transparent' }}
              >
                <span>{o}</span>
                {value === o && <Check size={12} style={{ color: '#FF5722' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const LICENSE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'commercial', label: '$ Commercial OK' },
  { id: 'noncommercial', label: 'Non-commercial' },
  { id: 'remix', label: '↻ Remix OK' },
  { id: 'noderiv', label: 'No derivatives' },
];

function matchesLicenseFilter(l, f) {
  if (f === 'commercial') return l.commercial;
  if (f === 'noncommercial') return !l.commercial;
  if (f === 'remix') return l.derivatives;
  if (f === 'noderiv') return !l.derivatives;
  return true;
}

function DetailsSection({ project, updateProject, setCurrentSection }) {
  const [tagInput, setTagInput] = useState('');
  const [previewMode, setPreviewMode] = useState('write'); // write | preview | formats
  const [licenseFilter, setLicenseFilter] = useState('all');

  const visibleLicenses = LICENSES.filter(l => matchesLicenseFilter(l, licenseFilter));

  const addTag = (raw) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || project.tags.includes(t)) return;
    updateProject({ tags: [...project.tags, t] });
  };
  const removeTag = (t) => updateProject({ tags: project.tags.filter(x => x !== t) });

  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); addTag(tagInput); setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && project.tags.length) {
      removeTag(project.tags[project.tags.length - 1]);
    }
  };

  const suggestTags = () => {
    const suggestions = aiSuggestTags(project.title || 'thing');
    const newTags = suggestions.filter(t => !project.tags.includes(t)).slice(0, 5);
    updateProject({ tags: [...project.tags, ...newTags] });
  };

  return (
    <div className="max-w-4xl">
      <SectionHeader
        number="02"
        title="Project details"
        subtitle="Title, description, tags, category, and license. These get formatted three ways for the different platforms."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <Label>Title</Label>
            <input
              className="mp-input"
              placeholder="e.g. Articulating Desk Dragon"
              value={project.title}
              onChange={(e) => updateProject({ title: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="mb-0">Description (markdown)</Label>
              <div className="flex items-center gap-1">
                {['write', 'preview', 'formats'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPreviewMode(m)}
                    className="mp-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 transition"
                    style={{
                      background: previewMode === m ? '#15171C' : 'transparent',
                      color: previewMode === m ? '#EDE9DE' : 'rgba(21,23,28,0.5)',
                    }}
                  >
                    {m}
                  </button>
                ))}
                {!project.description && (
                  <button
                    onClick={() => updateProject({ description: SAMPLE_DESCRIPTION })}
                    className="mp-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 ml-1"
                    style={{ color: '#FF5722' }}
                  >
                    <Sparkles size={10} className="inline" /> Sample
                  </button>
                )}
              </div>
            </div>

            {previewMode === 'write' && (
              <textarea
                className="mp-textarea mp-mono mp-input text-sm leading-relaxed resize-none"
                style={{ minHeight: 320 }}
                placeholder={"# Your model title\n\nA hook about what's special.\n\n## Print settings\n\n**Layer height:** 0.2mm"}
                value={project.description}
                onChange={(e) => updateProject({ description: e.target.value })}
              />
            )}
            {previewMode === 'preview' && (
              <div className="mp-card p-5 mp-prose text-sm" style={{ minHeight: 320 }} dangerouslySetInnerHTML={{ __html: mdToHtml(project.description) || '<p style="color: rgba(21,23,28,0.3)">Preview shows once you write something</p>' }} />
            )}
            {previewMode === 'formats' && (
              <FormatTabs description={project.description} />
            )}

            <div className="flex items-center justify-between mt-1.5">
              <span className="mp-mono text-[10px]" style={{ color: 'rgba(21,23,28,0.4)' }}>
                {project.description.length} chars
              </span>
              <span className="mp-mono text-[10px]" style={{ color: 'rgba(21,23,28,0.4)' }}>
                Markdown for Printables/Cults/Nexprint · HTML for MakerWorld/MMF/Thangs/Creality · Plain for Thingiverse
              </span>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="mp-card p-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {project.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 mp-mono text-[10px] uppercase tracking-[0.15em]" style={{ background: '#15171C', color: '#EDE9DE' }}>
                    {t}
                    <button onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100 transition"><X size={10} /></button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => { if (tagInput) { addTag(tagInput); setTagInput(''); } }}
                  placeholder={project.tags.length ? '+ tag' : 'type and press Enter'}
                  className="bg-transparent outline-none text-xs flex-1 min-w-[100px]"
                />
              </div>
              <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                <span className="mp-mono uppercase tracking-[0.15em]">{project.tags.length}/20 tags</span>
                <button onClick={suggestTags} className="mp-mono uppercase tracking-[0.15em] flex items-center gap-1 hover:text-[#FF5722] transition">
                  <Sparkles size={10} /> AI suggest (mock)
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label>Category</Label>
            <CategorySelect value={project.category} onChange={(c) => updateProject({ category: c })} options={CATEGORIES} />
            <p className="text-[10px] mt-1.5" style={{ color: 'rgba(21,23,28,0.4)' }}>
              Each platform has its own category tree. We pick a close match for each.
            </p>
          </div>

          <div>
            <Label>License</Label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {LICENSE_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setLicenseFilter(f.id)}
                  className="mp-mono text-[9px] uppercase tracking-[0.15em] px-2 py-1 transition"
                  style={{
                    background: licenseFilter === f.id ? '#15171C' : 'rgba(21,23,28,0.06)',
                    color: licenseFilter === f.id ? '#EDE9DE' : 'rgba(21,23,28,0.65)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {visibleLicenses.length === 0 && (
                <p className="text-[11px] py-2" style={{ color: 'rgba(21,23,28,0.5)' }}>No license matches that combination.</p>
              )}
              {visibleLicenses.map(l => (
                <label key={l.id} className="flex items-start gap-2.5 mp-card p-2.5 cursor-pointer transition" style={{
                  borderColor: project.license === l.id ? '#FF5722' : 'rgba(21,23,28,0.1)',
                  background: project.license === l.id ? 'rgba(255,87,34,0.04)' : '#FFFFFF',
                }}>
                  <input type="radio" name="license" value={l.id} checked={project.license === l.id} onChange={() => updateProject({ license: l.id })} className="mt-0.5" style={{ accentColor: '#FF5722' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-tight">{l.name}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="mp-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: l.commercial ? '#4FB286' : 'rgba(21,23,28,0.4)' }}>
                        {l.commercial ? '$ commercial' : 'non-commercial'}
                      </span>
                      <span className="mp-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: l.derivatives ? '#4FB286' : 'rgba(21,23,28,0.4)' }}>
                        {l.derivatives ? '↻ remix ok' : 'no derivatives'}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionNav
        backLabel="Back to Files"
        nextLabel="Continue to Images"
        nextDisabled={!project.title || !project.description || !project.category || project.tags.length === 0}
        onBack={() => setCurrentSection('files')}
        onNext={() => setCurrentSection('images')}
      />
    </div>
  );
}

function Label({ children, className = '' }) {
  return <label className={`mp-mono text-[10px] uppercase tracking-[0.2em] block mb-2 ${className}`} style={{ color: 'rgba(21,23,28,0.55)' }}>{children}</label>;
}

function FormatTabs({ description }) {
  const [active, setActive] = useState('md');
  const [copied, setCopied] = useState(null);
  const html = mdToHtml(description);
  const plain = mdToPlain(description);
  const outputs = { md: description, rich: html, html, plain };
  const copy = async (k) => {
    if (k === 'rich') { const ok = await copyRichText(html, plain); if (!ok) return; }
    else { navigator.clipboard.writeText(outputs[k]); }
    setCopied(k); setTimeout(() => setCopied(null), 1500);
  };
  const tabs = [
    { k: 'md',    label: 'Markdown',  platforms: ['Printables', 'Cults3D', 'Nexprint'] },
    { k: 'rich',  label: 'Formatted', platforms: ['MakerWorld'] },
    { k: 'html',  label: 'HTML',      platforms: ['MyMiniFactory', 'Thangs', 'Creality'] },
    { k: 'plain', label: 'Plain',     platforms: ['Thingiverse'] },
  ];
  const copyLabel = active === 'rich' ? 'Copy formatted' : `Copy ${active}`;
  return (
    <div className="mp-card">
      <div className="flex border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
        {tabs.map(({ k, label, platforms }) => (
          <button
            key={k}
            onClick={() => setActive(k)}
            className="flex-1 px-3 py-2.5 mp-display font-bold text-xs transition border-r last:border-r-0"
            style={{
              background: active === k ? '#15171C' : 'transparent',
              color: active === k ? '#EDE9DE' : '#15171C',
              borderColor: 'rgba(21,23,28,0.1)',
            }}
          >
            {label}
            <div className="text-[9px] font-normal opacity-60 mt-0.5">
              {platforms.join(', ')}
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 flex items-center justify-between border-b gap-2" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
        <span className="mp-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.45)' }}>
          {active === 'rich' ? 'Rendered — paste into the visual editor, keeps formatting' : active === 'html' ? 'Raw HTML source' : active === 'md' ? 'Markdown source' : 'Plain text'}
        </span>
        <button onClick={() => copy(active)} className="mp-mono text-[10px] uppercase tracking-[0.2em] flex items-center gap-1.5 hover:text-[#FF5722] transition flex-shrink-0">
          {copied === active ? <><Check size={11} /> Copied</> : <><Copy size={11} /> {copyLabel}</>}
        </button>
      </div>
      {active === 'rich' ? (
        <div className="mp-prose p-4 text-sm max-h-64 overflow-auto"
          dangerouslySetInnerHTML={{ __html: html || '<span style="color:rgba(21,23,28,0.3)">Write something in markdown to see the formatted output</span>' }} />
      ) : (
        <pre className="mp-pre mp-mono p-4 text-xs leading-relaxed max-h-64 overflow-auto" style={{ color: 'rgba(21,23,28,0.85)' }}>
          {outputs[active] || <span style={{ color: 'rgba(21,23,28,0.3)' }}>Write something in markdown to see formatted outputs</span>}
        </pre>
      )}
    </div>
  );
}

// =====================================================================
// SECTION: IMAGES
// =====================================================================

function ImagesSection({ project, updateProject, setCurrentSection }) {
  const fileInputRef = useRef(null);
  const [activeImageId, setActiveImageId] = useState(null);
  const [showPlatformPreviews, setShowPlatformPreviews] = useState(true);

  const handleImageFiles = async (fileList) => {
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const additions = [];
    for (const file of arr) {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      try {
        const img = await loadImageFromDataUrl(dataUrl);
        additions.push({
          id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          dataUrl,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          focal: { x: 0.5, y: 0.5 },
          alt: file.name.replace(/\.[^.]+$/, ''),
        });
      } catch (e) { /* skip */ }
    }
    if (!additions.length) return;
    const newImages = [...project.images, ...additions];
    const patch = { images: newImages };
    if (!project.coverImageId && newImages.length) patch.coverImageId = newImages[0].id;
    updateProject(patch);
    if (!activeImageId) setActiveImageId(additions[0].id);
  };

  const addSample = async (label, tint) => {
    const dataUrl = makeSampleImage(label, tint);
    const img = await loadImageFromDataUrl(dataUrl);
    const newImg = {
      id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight, focal: { x: 0.5, y: 0.5 }, alt: 'Sample',
    };
    const newImages = [...project.images, newImg];
    const patch = { images: newImages };
    if (!project.coverImageId) patch.coverImageId = newImg.id;
    updateProject(patch);
    if (!activeImageId) setActiveImageId(newImg.id);
  };

  const removeImage = (id) => {
    const next = project.images.filter(i => i.id !== id);
    const patch = { images: next };
    if (project.coverImageId === id) patch.coverImageId = next[0]?.id || null;
    updateProject(patch);
    if (activeImageId === id) setActiveImageId(next[0]?.id || null);
  };

  const updateImageFocal = (id, focal) => {
    updateProject({ images: project.images.map(i => i.id === id ? { ...i, focal } : i) });
  };

  const setAsCover = (id) => updateProject({ coverImageId: id });

  const moveImage = (id, dir) => {
    const imgs = [...project.images];
    const idx = imgs.findIndex(i => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= imgs.length) return;
    [imgs[idx], imgs[swap]] = [imgs[swap], imgs[idx]];
    updateProject({ images: imgs });
  };

  const activeImage = project.images.find(i => i.id === activeImageId) || project.images[0];

  return (
    <div className="max-w-6xl">
      <SectionHeader
        number="03"
        title="Cover and gallery images"
        subtitle={<>Drop images, set the focal point so every platform's crop keeps what matters in frame.<br />Up to 16 for MakerWorld; most platforms cap at 10-25.</>}
      />

      {project.images.length === 0 ? (
        <ImageDropZone
          onDrop={handleImageFiles}
          inputRef={fileInputRef}
          onSamples={() => {
            addSample('SAMPLE 1', ['#FF5722', '#FFB627', '#1A1A1A']);
            setTimeout(() => addSample('SAMPLE 2', ['#3A86FF', '#4FB286', '#1A1A1A']), 100);
            setTimeout(() => addSample('SAMPLE 3', ['#FF6900', '#F79E2E', '#1A1A1A']), 200);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="mp-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                {project.images.length}/16 images
              </span>
              <button onClick={() => fileInputRef.current?.click()} className="mp-mono text-[10px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition flex items-center gap-1">
                <Plus size={11} /> Add
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleImageFiles(e.target.files)} className="hidden" />
            </div>

            <p className="mp-mono text-[9px] uppercase tracking-[0.15em] mb-1" style={{ color: 'rgba(21,23,28,0.4)' }}>
              Order = gallery order on every platform. Reorder with ↑ ↓.
            </p>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {project.images.map((img, idx) => {
                const active = activeImageId === img.id;
                return (
                  <div
                    key={img.id}
                    className="w-full flex items-center gap-2 p-1.5 transition relative group"
                    style={{
                      background: active ? '#15171C' : '#FFFFFF',
                      color: active ? '#EDE9DE' : '#15171C',
                      border: '1px solid rgba(21,23,28,0.1)',
                    }}
                  >
                    <button
                      onClick={() => setActiveImageId(img.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      style={{ color: 'inherit' }}
                    >
                      <div className="w-14 h-14 flex-shrink-0 overflow-hidden" style={{ background: '#15171C' }}>
                        <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mp-mono text-[9px] uppercase tracking-[0.15em] opacity-60">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="text-[11px] truncate">{img.alt || 'Image'}</div>
                        {project.coverImageId === img.id && (
                          <div className="mp-mono text-[8px] uppercase tracking-[0.15em] mt-0.5 inline-flex items-center gap-1" style={{ color: '#FF5722' }}>
                            <Star size={8} fill="#FF5722" /> Cover
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-col flex-shrink-0">
                      <button
                        onClick={() => moveImage(img.id, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                        className="p-0.5 transition disabled:opacity-20 disabled:cursor-not-allowed hover:text-[#FF5722]"
                        style={{ color: 'inherit' }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveImage(img.id, 1)}
                        disabled={idx === project.images.length - 1}
                        aria-label="Move down"
                        className="p-0.5 transition disabled:opacity-20 disabled:cursor-not-allowed hover:text-[#FF5722]"
                        style={{ color: 'inherit' }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {project.images.length >= 9 && (
              <div className="mt-3 p-2.5 text-[10px]" style={{ background: 'rgba(255,87,34,0.08)', borderLeft: '2px solid #FF5722' }}>
                <strong>Heads up:</strong> images above #9 only show on MakerWorld (max 16). Others typically display 9-12.
              </div>
            )}
          </div>

          <div className="lg:col-span-9">
            {activeImage && (
              <>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Image · {activeImage.naturalW} × {activeImage.naturalH} · drag the dot to set focal point
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAsCover(activeImage.id)} className="mp-mono text-[10px] uppercase tracking-[0.15em] py-1.5 px-2.5 flex items-center gap-1.5 transition" style={{
                      background: project.coverImageId === activeImage.id ? '#FF5722' : '#15171C',
                      color: '#EDE9DE',
                    }}>
                      <Star size={11} fill={project.coverImageId === activeImage.id ? '#fff' : 'none'} />
                      {project.coverImageId === activeImage.id ? 'Cover' : 'Set as cover'}
                    </button>
                    <button onClick={() => removeImage(activeImage.id)} className="p-1.5 hover:text-[#FF5722] transition opacity-60 hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <FocalPicker
                  image={activeImage}
                  onUpdate={(focal) => updateImageFocal(activeImage.id, focal)}
                />

                <div className="flex items-center justify-between mt-6 mb-3">
                  <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Per-platform preview · {showPlatformPreviews ? PLATFORMS.length : 0} crops
                  </span>
                  <button onClick={() => setShowPlatformPreviews(s => !s)} className="mp-mono text-[10px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition flex items-center gap-1">
                    {showPlatformPreviews ? <><ChevronDown size={11} /> Hide</> : <><ChevronRight size={11} /> Show</>}
                  </button>
                </div>

                {showPlatformPreviews && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PLATFORMS.flatMap(p => p.covers.map(c => ({ ...c, p }))).map((co, i) => (
                      <PlatformCropPreview key={i} image={activeImage} platform={co.p} cover={co} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <SectionNav
        backLabel="Back to Details"
        nextLabel={project.profiles.length ? 'Continue to Profiles' : 'Continue to Platforms'}
        nextDisabled={project.images.length === 0 || !project.coverImageId}
        onBack={() => setCurrentSection('details')}
        onNext={() => setCurrentSection(project.profiles.length ? 'profiles' : 'platforms')}
      />
    </div>
  );
}

function ImageDropZone({ onDrop, inputRef, onSamples }) {
  return (
    <>
      <div
        className="mp-blueprint border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-colors mt-6"
        style={{ borderColor: 'rgba(21,23,28,0.25)' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF5722'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(21,23,28,0.25)'}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={(e) => onDrop(e.target.files)} className="hidden" />
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
          <ImageIcon size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
        </div>
        <h2 className="mp-display text-[36px] leading-none mb-2">Load renders &amp; photos</h2>
        <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>jpg, png, webp · first image becomes the cover</p>
        <p className="mp-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.4)' }}>
          ◯ min recommended 2000 × 1500 px
        </p>
      </div>
      <div className="text-center mt-3">
        <button onClick={onSamples} className="mp-mono text-[10px] uppercase tracking-[0.2em] py-2 px-3 hover:text-[#FF5722] transition inline-flex items-center gap-1.5">
          <Sparkles size={11} /> Load 3 sample images
        </button>
      </div>
    </>
  );
}

function FocalPicker({ image, onUpdate }) {
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const move = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
    onUpdate({ x, y });
  };
  return (
    <div className="relative w-full select-none" style={{ background: '#15171C', textAlign: 'center' }}>
      <div
        className="relative inline-block cursor-crosshair"
        style={{ maxWidth: '100%', verticalAlign: 'top' }}
        onMouseDown={(e) => { setDragging(true); move(e); }}
        onMouseMove={(e) => dragging && move(e)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={(e) => { setDragging(true); move(e); }}
        onTouchMove={(e) => dragging && move(e)}
        onTouchEnd={() => setDragging(false)}
      >
        <img ref={imgRef} src={image.dataUrl} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '55vh', userSelect: 'none' }} />
        {/* Calibration crosshair, like a print bed leveling target */}
        <div className="absolute pointer-events-none" style={{ left: `${image.focal.x * 100}%`, top: `${image.focal.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' }}>
            {/* Outer corner brackets */}
            <path d="M 4 14 L 4 4 L 14 4" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 30 4 L 40 4 L 40 14" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 40 30 L 40 40 L 30 40" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 14 40 L 4 40 L 4 30" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            {/* Crosshair ticks */}
            <line x1="22" y1="10" x2="22" y2="18" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="22" y1="26" x2="22" y2="34" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="10" y1="22" x2="18" y2="22" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="26" y1="22" x2="34" y2="22" stroke="#FF5722" strokeWidth="1.5" />
            {/* Center dot */}
            <circle cx="22" cy="22" r="2" fill="#FF5722" />
          </svg>
        </div>
        <div className="absolute bottom-2 left-2 mp-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 pointer-events-none" style={{ background: 'rgba(0,0,0,0.75)', color: '#FF5722' }}>
          ◉ FOCAL {(image.focal.x * 100).toFixed(0)}.{Math.floor((image.focal.x * 100 % 1) * 10)} × {(image.focal.y * 100).toFixed(0)}.{Math.floor((image.focal.y * 100 % 1) * 10)}
        </div>
      </div>
    </div>
  );
}

function PlatformCropPreview({ image, platform, cover }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !image) return;
    const img = document.createElement('img');
    img.onload = () => {
      const c = canvasRef.current; if (!c) return;
      const aspect = cover.w / cover.h;
      const dispW = 320, dispH = dispW / aspect;
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      const srcA = img.naturalWidth / img.naturalHeight;
      let sx, sy, sw, sh;
      if (srcA > aspect) { sh = img.naturalHeight; sw = sh * aspect; sy = 0; sx = (img.naturalWidth - sw) * image.focal.x; }
      else { sw = img.naturalWidth; sh = sw / aspect; sx = 0; sy = (img.naturalHeight - sh) * image.focal.y; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dispW, dispH);
    };
    img.src = image.dataUrl;
  }, [image, cover]);
  return (
    <div className="mp-card">
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        <canvas ref={canvasRef} className="w-full block" />
      </div>
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: platform.dot }} />
          <div className="min-w-0">
            <div className="mp-display font-bold text-[11px] leading-tight truncate">
              {platform.name}{cover.label !== 'Cover' ? ` · ${cover.label}` : ''}
            </div>
            <div className="mp-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
              {cover.w}×{cover.h} ({cover.aspect})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SECTION: PROFILES (per 3MF)
// =====================================================================

function ProfilesSection({ project, updateProject, setCurrentSection }) {
  const [activeProfileId, setActiveProfileId] = useState(project.profiles[0]?.id);

  const updateProfile = (id, patch) => {
    updateProject({ profiles: project.profiles.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  if (project.profiles.length === 0) {
    return (
      <div className="max-w-4xl">
        <SectionHeader number="04" title="Print profiles" subtitle="Each 3MF file becomes a print profile here. You haven't added any 3MF files yet, so this step is skipped." />
        <div className="mt-6 p-8 text-center mp-card">
          <Layers size={32} className="mx-auto mb-3 opacity-30" />
          <h3 className="mp-display font-bold text-lg mb-1">No 3MF files yet</h3>
          <p className="text-sm mb-4" style={{ color: 'rgba(21,23,28,0.6)' }}>Add 3MF files in step 01 to define print profiles. STL-only models skip this step.</p>
          <button onClick={() => setCurrentSection('files')} className="mp-btn mp-btn-ghost text-xs">
            <ChevronRight size={12} className="rotate-180" /> Back to Files
          </button>
        </div>
        <SectionNav
          backLabel="Back to Images"
          nextLabel="Continue to Platforms"
          onBack={() => setCurrentSection('images')}
          onNext={() => setCurrentSection('platforms')}
        />
      </div>
    );
  }

  const active = project.profiles.find(p => p.id === activeProfileId) || project.profiles[0];

  return (
    <div className="max-w-6xl">
      <SectionHeader
        number="04"
        title="Print profiles"
        subtitle="One profile per 3MF file. Add a name and a per-profile description. Profile data was extracted from the 3MF (mocked in this prototype)."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-3 space-y-1.5">
          {project.profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className="w-full text-left p-2.5 transition-colors"
              style={{
                background: active?.id === p.id ? '#15171C' : '#FFFFFF',
                color: active?.id === p.id ? '#EDE9DE' : '#15171C',
                border: '1px solid rgba(21,23,28,0.1)',
              }}
            >
              <div className="flex items-start gap-2">
                <Layers size={14} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mp-display font-bold text-xs truncate">{p.name || 'Untitled profile'}</div>
                  <div className="mp-mono text-[9px] uppercase tracking-[0.15em] mt-0.5 opacity-60">
                    {p.parsed?.printer || ''}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-5">
          {active && (
            <>
              <div>
                <Label>Profile name</Label>
                <input
                  className="mp-input"
                  value={active.name}
                  onChange={(e) => updateProfile(active.id, { name: e.target.value })}
                />
              </div>

              {active.parsed && (
                <div className="mp-card p-4">
                  <div className="mp-mono text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Detected from 3MF (mocked)
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Stat label="Printer" value={active.parsed.printer} />
                    <Stat label="Material" value={active.parsed.material} />
                    <Stat label="Layer height" value={active.parsed.layerHeight} />
                    <Stat label="Plates" value={active.parsed.plates} />
                    <Stat label="Print time" value={active.parsed.estimatedTime} />
                    <Stat label="Filament" value={`${active.parsed.filamentGrams}g`} />
                  </div>
                </div>
              )}

              <div>
                <Label>Profile description (optional)</Label>
                <textarea
                  className="mp-input mp-textarea text-sm"
                  style={{ minHeight: 120, resize: 'vertical' }}
                  placeholder="What's specific about this profile? e.g. 'Calibrated for Bambu A1 Mini with 0.4mm nozzle. Use Matte PLA for best surface finish.'"
                  value={active.description}
                  onChange={(e) => updateProfile(active.id, { description: e.target.value })}
                />
              </div>

              <div>
                <Label>Cover image for this profile</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 mp-card p-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={active.useMainCover}
                      onChange={() => updateProfile(active.id, { useMainCover: true })}
                      style={{ accentColor: '#FF5722' }}
                    />
                    <span className="text-xs">Use the main project cover image</span>
                  </label>
                  <label className="flex items-center gap-2.5 mp-card p-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!active.useMainCover}
                      onChange={() => updateProfile(active.id, { useMainCover: false })}
                      style={{ accentColor: '#FF5722' }}
                    />
                    <span className="text-xs">Pick a specific image from the gallery</span>
                  </label>
                  {!active.useMainCover && (
                    <div className="grid grid-cols-4 gap-2 ml-7">
                      {project.images.map(img => (
                        <button
                          key={img.id}
                          onClick={() => updateProfile(active.id, { coverImageId: img.id })}
                          className="aspect-square overflow-hidden transition"
                          style={{
                            border: active.coverImageId === img.id ? '2px solid #FF5722' : '1px solid rgba(21,23,28,0.15)',
                            outline: active.coverImageId === img.id ? '2px solid rgba(255,87,34,0.2)' : 'none',
                            outlineOffset: -2,
                          }}
                        >
                          <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <SectionNav
        backLabel="Back to Images"
        nextLabel="Continue to Platforms"
        onBack={() => setCurrentSection('images')}
        onNext={() => setCurrentSection('platforms')}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="mp-mono text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(21,23,28,0.5)' }}>{label}</div>
      <div className="mp-display font-bold text-sm">{value}</div>
    </div>
  );
}

// =====================================================================
// SECTION: PLATFORMS
// =====================================================================

function PlatformsSection({ project, updateProject, setCurrentSection }) {
  const togglePlatform = (id) => {
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], enabled: !project.platforms[id].enabled } },
    });
  };
  const updatePlatformField = (id, field, value) => {
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], [field]: value } },
    });
  };

  const enabledCount = Object.values(project.platforms).filter(p => p.enabled).length;

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="05"
        title="Choose your platforms"
        subtitle={`Toggle each platform on or off. Set per-platform options like price (Cults, MMF) or contest entry (Nexprint). ${enabledCount} of ${PLATFORMS.length} enabled.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        {PLATFORMS.map(p => (
          <PlatformCard
            key={p.id}
            platform={p}
            state={project.platforms[p.id]}
            onToggle={() => togglePlatform(p.id)}
            onUpdate={(field, value) => updatePlatformField(p.id, field, value)}
          />
        ))}
      </div>

      <SectionNav
        backLabel={project.profiles.length ? 'Back to Profiles' : 'Back to Images'}
        nextLabel="Continue to Publish"
        nextDisabled={enabledCount === 0}
        onBack={() => setCurrentSection(project.profiles.length ? 'profiles' : 'images')}
        onNext={() => setCurrentSection('publish')}
      />
    </div>
  );
}

function PlatformCard({ platform, state, onToggle, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mp-card" style={{ borderColor: state.enabled ? 'rgba(21,23,28,0.2)' : 'rgba(21,23,28,0.08)', opacity: state.enabled ? 1 : 0.65 }}>
      <div className="p-3.5 flex items-start gap-3">
        <button onClick={onToggle} className="flex-shrink-0 mt-0.5 mp-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 transition" style={{
          background: state.enabled ? '#FF5722' : 'transparent',
          color: state.enabled ? '#fff' : 'rgba(21,23,28,0.5)',
          border: `1px solid ${state.enabled ? '#FF5722' : 'rgba(21,23,28,0.2)'}`,
          minWidth: 52,
        }}>
          {state.enabled ? '▣ ON' : '▢ OFF'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 flex-shrink-0" style={{ background: platform.dot }} />
              <h3 className="mp-display font-bold text-base">{platform.name}</h3>
              {platform.apiSupport === 'oneclick' && (
                <span className="mp-mono text-[8px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded" style={{ background: '#4FB286', color: '#fff' }}>
                  API
                </span>
              )}
              {platform.apiSupport === 'manual' && (
                <span className="mp-mono text-[8px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.6)' }}>
                  manual
                </span>
              )}
              {platform.apiSupport === 'addon' && (
                <span className="mp-mono text-[8px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>
                  addon
                </span>
              )}
            </div>
            <button onClick={() => setExpanded(s => !s)} className="text-[10px] opacity-50 hover:opacity-100 transition flex-shrink-0">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
          <div className="mp-mono text-[10px] uppercase tracking-[0.15em] mt-0.5" style={{ color: 'rgba(21,23,28,0.55)' }}>
            {platform.org} · {platform.descFormat}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(21,23,28,0.65)' }}>{platform.note}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
          <div className="grid grid-cols-3 gap-2 my-3 text-[10px]">
            <Stat label="Max images" value={platform.maxImages} />
            <Stat label="File size cap" value={`${platform.maxFileMb}MB`} />
            <Stat label="Total cap" value={`${platform.maxTotalMb}MB`} />
          </div>

          <div className="mb-3">
            <Label>Accepted formats</Label>
            <div className="flex flex-wrap gap-1">
              {platform.formats.map(f => (
                <span key={f} className="mp-mono text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'rgba(21,23,28,0.06)' }}>
                  .{f}
                </span>
              ))}
            </div>
          </div>

          {platform.fields.includes('price') && state.enabled && (
            <div className="mt-3">
              <Label>Price (USD)</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    checked={state.free}
                    onChange={() => onUpdate('free', true)}
                    style={{ accentColor: '#FF5722' }}
                  /> Free
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    checked={!state.free}
                    onChange={() => onUpdate('free', false)}
                    style={{ accentColor: '#FF5722' }}
                  /> Paid
                </label>
                {!state.free && (
                  <div className="flex items-center gap-1">
                    <DollarSign size={12} className="opacity-50" />
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={state.price}
                      onChange={(e) => onUpdate('price', parseFloat(e.target.value) || 0)}
                      className="mp-input"
                      style={{ width: 80, padding: '0.25rem 0.5rem' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {platform.fields.includes('contestEntry') && state.enabled && (
            <div className="mt-3">
              <Label>Submit to contest (optional)</Label>
              <select
                className="mp-input"
                value={state.contestEntry || ''}
                onChange={(e) => onUpdate('contestEntry', e.target.value)}
              >
                <option value="">No contest</option>
                <option value="creator-fund">$1M Creator Fund (ongoing)</option>
                <option value="elegoo-summer">Elegoo Summer Showcase</option>
                <option value="best-functional">Best Functional Print 2026</option>
              </select>
              {state.contestEntry && (
                <div className="mt-2 p-2.5 flex items-start gap-2 text-[11px]" style={{ background: 'rgba(255,182,39,0.12)', border: '1px solid rgba(255,182,39,0.5)' }}>
                  <AlertCircle size={14} style={{ color: '#FF9500' }} className="flex-shrink-0 mt-0.5" />
                  <span style={{ color: 'rgba(21,23,28,0.8)' }}>
                    <strong>{platform.name} contest entries must be opted in during upload.</strong> This package can't enter you automatically — when you upload, tick the contest checkbox on {platform.name}'s page. You can't add an entry after the model is published.
                  </span>
                </div>
              )}
            </div>
          )}

          {platform.fields.includes('remix') && state.enabled && (
            <div className="mt-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={state.remix || false}
                  onChange={(e) => onUpdate('remix', e.target.checked)}
                  style={{ accentColor: '#FF5722' }}
                />
                This is a remix (will require linking original)
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SECTION: PREPARE FOR UPLOAD (real exports, no fake publishing)
// =====================================================================

function PublishSection({ project, allReady, completion, setCurrentSection }) {
  const enabled = PLATFORMS.filter(p => project.platforms[p.id]?.enabled);
  const cover = project.images.find(i => i.id === project.coverImageId);

  if (!allReady) {
    return (
      <div className="max-w-4xl">
        <SectionHeader number="06" title="Prepare upload packages" subtitle="Finish the missing steps below to generate platform-ready exports." />
        <div className="mt-6 space-y-2">
          {SECTIONS.slice(0, -1).map(s => (
            <button key={s.id} onClick={() => setCurrentSection(s.id)} className="w-full p-3.5 mp-card flex items-center gap-3 text-left transition hover:border-[#FF5722]">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: completion[s.id] ? '#4FB286' : 'rgba(21,23,28,0.08)' }}>
                {completion[s.id] ? <Check size={14} color="#fff" /> : <AlertCircle size={14} style={{ color: '#FF5722' }} />}
              </div>
              <div className="flex-1">
                <div className="mp-display text-[18px] leading-none">{s.label}</div>
                <div className="mp-body text-[11px] mt-1" style={{ color: 'rgba(21,23,28,0.55)' }}>
                  {completion[s.id] ? 'Complete' : 'Missing or incomplete'}
                </div>
              </div>
              <ChevronRight size={14} className="opacity-50" />
            </button>
          ))}
        </div>
        <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <SectionHeader
        number="06"
        title="Prepare upload packages"
        subtitle="One .zip per platform with everything inside: cropped cover at the right dimensions, gallery images, description in the right format, paste-ready metadata, and your model files. Open the platform's upload page, drop the folder contents in, paste the text fields, submit."
      />

      <div className="mt-5 mp-card p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Info size={14} style={{ color: '#FF5722' }} />
            <span className="mp-display text-[15px] leading-none">One .zip per platform</span>
          </div>
          <p className="mp-body text-xs leading-relaxed" style={{ color: 'rgba(21,23,28,0.7)' }}>
            "Download .zip" packs the cover at exact dimensions, gallery images cropped for that platform, your description in the right format (md / html / txt), a metadata.txt with paste-ready fields, a README with upload steps, and a /files folder with your model files. Open the upload page and drop the folder contents in. Cults3D, MyMiniFactory and Thingiverse (green <span className="mp-pill" style={{ background: '#4FB286', color: '#fff' }}>API</span>) get one-click upload in a future build.
          </p>
        </div>
        <BatchZipButton enabled={enabled} project={project} cover={cover} />
      </div>

      <div className="mt-5 space-y-4">
        {enabled.map(p => (
          <PlatformPackageCard
            key={p.id}
            platform={p}
            project={project}
            cover={cover}
            platformState={project.platforms[p.id]}
          />
        ))}
      </div>

      <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
    </div>
  );
}

function BatchZipButton({ enabled, project, cover }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileNamePrefix = slugify(project.title);

  const downloadAllPlatforms = async () => {
    if (busy || !cover) return;
    setBusy(true);
    try {
      const JSZip = await loadJSZip();

      for (let pIdx = 0; pIdx < enabled.length; pIdx++) {
        const platform = enabled[pIdx];
        const platformState = project.platforms[platform.id];
        setMsg(`[${pIdx + 1}/${enabled.length}] ${platform.name}`);

        const zip = new JSZip();
        let counter = 1;

        // Cover(s)
        const coverImg = await loadImageFromDataUrl(cover.dataUrl);
        for (const c of platform.covers) {
          const canvas = cropToCanvas(coverImg, c.w, c.h, cover.focal);
          const blob = await canvasToBlob(canvas);
          const label = platform.covers.length > 1 ? `cover_${c.id}` : 'cover';
          zip.file(`${String(counter++).padStart(2, '0')}_${label}_${c.w}x${c.h}.jpg`, blob);
        }

        // Gallery
        const others = project.images.filter(i => i.id !== project.coverImageId);
        const limit = Math.min(others.length, platform.maxImages - 1);
        const main = platform.covers[0];
        for (let i = 0; i < limit; i++) {
          const galImg = await loadImageFromDataUrl(others[i].dataUrl);
          const canvas = cropToCanvas(galImg, main.w, main.h, others[i].focal);
          const blob = await canvasToBlob(canvas);
          zip.file(`${String(counter++).padStart(2, '0')}_gallery_${String(i + 1).padStart(2, '0')}_${main.w}x${main.h}.jpg`, blob);
        }

        // Texts
        const descFormat = platform.descFormat;
        const descExt = descFormat === 'markdown' ? 'md' : descFormat === 'html' ? 'html' : 'txt';
        const desc = descFormat === 'markdown' ? project.description : descFormat === 'html' ? mdToHtml(project.description) : mdToPlain(project.description);
        const tagString = formatTagsFor(platform.id, project.tags);
        zip.file(`description.${descExt}`, desc);
        zip.file('metadata.txt', generateMetadataText(platform, project, platformState, tagString));
        zip.file('README.txt', generateReadme(platform, project, descExt, project.images.length, project.files.length));

        // Model files
        if (project.files.length) {
          const folder = zip.folder('files');
          for (const f of project.files) {
            if (f.blob) folder.file(f.name, f.blob);
          }
        }

        const zipBlob = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (m) => setMsg(`[${pIdx + 1}/${enabled.length}] ${platform.name} ${m.percent.toFixed(0)}%`)
        );

        triggerDownload(zipBlob, `${fileNamePrefix}_${platform.id}.zip`);
        // Brief gap between downloads to keep browser happy
        await new Promise(r => setTimeout(r, 600));
      }

      setMsg(`Done: ${enabled.length} zip(s)`);
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setMsg(`Error: ${e.message}`);
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={downloadAllPlatforms}
      disabled={busy || !cover || enabled.length === 0}
      className="mp-btn text-[12px] py-2.5 px-4 whitespace-nowrap disabled:opacity-40"
      title={!cover ? 'Add at least one image first' : `Download ${enabled.length} zip(s), one per platform`}
    >
      {busy ? (
        <><Loader size={13} className="mp-spin" /> <span className="mp-mono text-[11px] tracking-normal normal-case">{msg || 'Working'}</span></>
      ) : (
        <><Download size={13} /> {enabled.length} .zip files</>
      )}
    </button>
  );
}

function PlatformPackageCard({ platform, project, cover, platformState }) {
  const [expanded, setExpanded] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progressMsg, setProgressMsg] = useState(null);

  const desc = useMemo(() => {
    if (platform.descFormat === 'markdown') return project.description;
    if (platform.descFormat === 'html')     return mdToHtml(project.description);
    return mdToPlain(project.description);
  }, [platform.descFormat, project.description]);

  const tagString = formatTagsFor(platform.id, project.tags);
  const uploadUrl = UPLOAD_URLS[platform.id];
  const fileNamePrefix = (project.title || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model';

  const downloadImage = async (image, w, h, suffix) => {
    const img = await loadImageFromDataUrl(image.dataUrl);
    const canvas = cropToCanvas(img, w, h, image.focal);
    downloadCanvas(canvas, `${fileNamePrefix}_${platform.id}_${suffix}_${w}x${h}.jpg`);
  };

  const downloadAllCovers = async () => {
    if (!cover) return;
    setDownloading(true);
    for (let i = 0; i < platform.covers.length; i++) {
      const c = platform.covers[i];
      await downloadImage(cover, c.w, c.h, c.id);
      await new Promise(r => setTimeout(r, 350));
    }
    setDownloading(false);
  };

  const downloadAllGallery = async () => {
    setDownloading(true);
    const others = project.images.filter(i => i.id !== project.coverImageId);
    const limit = Math.min(others.length, platform.maxImages - 1);
    const main = platform.covers[0];
    for (let i = 0; i < limit; i++) {
      await downloadImage(others[i], main.w, main.h, `gallery${String(i + 2).padStart(2, '0')}`);
      await new Promise(r => setTimeout(r, 300));
    }
    setDownloading(false);
  };

  const downloadDescriptionFile = () => {
    const ext = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
    downloadTextFile(desc, `${fileNamePrefix}_${platform.id}_description.${ext}`);
  };

  const downloadEverything = async () => {
    if (downloading) return;
    setDownloading(true);
    setProgressMsg('Loading ZIP library');
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();

      let counter = 1;

      // 1. Cover image(s) cropped to platform's exact dimensions
      if (cover) {
        setProgressMsg('Cropping cover');
        const coverImg = await loadImageFromDataUrl(cover.dataUrl);
        for (const c of platform.covers) {
          const canvas = cropToCanvas(coverImg, c.w, c.h, cover.focal);
          const blob = await canvasToBlob(canvas);
          const label = platform.covers.length > 1 ? `cover_${c.id}` : 'cover';
          zip.file(`${String(counter++).padStart(2, '0')}_${label}_${c.w}x${c.h}.jpg`, blob);
        }
      }

      // 2. Gallery images cropped to platform's main cover aspect
      const others = project.images.filter(i => i.id !== project.coverImageId);
      const limit = Math.min(others.length, platform.maxImages - 1);
      const main = platform.covers[0];
      for (let i = 0; i < limit; i++) {
        setProgressMsg(`Cropping gallery ${i + 1}/${limit}`);
        const galImg = await loadImageFromDataUrl(others[i].dataUrl);
        const canvas = cropToCanvas(galImg, main.w, main.h, others[i].focal);
        const blob = await canvasToBlob(canvas);
        zip.file(`${String(counter++).padStart(2, '0')}_gallery_${String(i + 1).padStart(2, '0')}_${main.w}x${main.h}.jpg`, blob);
      }

      // 3. Description in the right format
      setProgressMsg('Writing description');
      const descExt = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
      zip.file(`description.${descExt}`, desc);

      // 4. Metadata (paste-ready fields)
      zip.file('metadata.txt', generateMetadataText(platform, project, platformState, tagString));

      // 5. README with step-by-step upload instructions
      zip.file('README.txt', generateReadme(platform, project, descExt, project.images.length, project.files.length));

      // 6. Model files in a subfolder
      if (project.files.length > 0) {
        setProgressMsg('Packing model files');
        const filesFolder = zip.folder('files');
        for (const f of project.files) {
          if (f.blob) {
            filesFolder.file(f.name, f.blob);
          }
        }
      }

      // 7. Compress
      setProgressMsg('Compressing 0%');
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (m) => setProgressMsg(`Compressing ${m.percent.toFixed(0)}%`)
      );

      // 8. Download
      triggerDownload(zipBlob, `${fileNamePrefix}_${platform.id}.zip`);
      setProgressMsg(`Done: ${formatBytes(zipBlob.size)}`);
      setTimeout(() => setProgressMsg(null), 2500);
    } catch (e) {
      console.error('ZIP generation failed', e);
      setProgressMsg(`Error: ${e.message}`);
      setTimeout(() => setProgressMsg(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mp-card">
      {/* Header row */}
      <div className="p-4 flex items-start gap-3 border-b" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
        <div className="w-2.5 h-2.5 mt-1.5 flex-shrink-0" style={{ background: platform.dot }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="mp-display text-[22px] leading-none">{platform.name}</h3>
            {platform.apiSupport === 'oneclick' && (
              <span className="mp-pill" style={{ background: '#4FB286', color: '#fff' }}>API soon</span>
            )}
            {platform.apiSupport === 'manual' && (
              <span className="mp-pill" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.6)' }}>manual</span>
            )}
            {platform.apiSupport === 'addon' && (
              <span className="mp-pill" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>addon</span>
            )}
          </div>
          <div className="mp-mono text-[10px] uppercase tracking-[0.15em] mt-1" style={{ color: 'rgba(21,23,28,0.55)' }}>
            {platform.org} · {platform.descFormat} description · {platform.maxImages} img max
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={downloadEverything}
            disabled={downloading || !cover}
            className="mp-btn mp-btn-ghost text-[12px] py-2 px-3 disabled:opacity-40"
            title={!cover ? 'Add at least one image first' : 'Download a ZIP containing everything for this platform'}
          >
            {downloading ? (
              <><Loader size={12} className="mp-spin" /> <span className="mp-mono text-[11px] normal-case tracking-normal" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{progressMsg || 'Working'}</span></>
            ) : (
              <><Download size={12} /> {progressMsg ? progressMsg : 'Download .zip'}</>
            )}
          </button>
          <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className="mp-btn text-[12px] py-2 px-3">
            <Send size={12} /> Open upload page
          </a>
          <button onClick={() => setExpanded(s => !s)} className="p-2 opacity-60 hover:opacity-100 transition">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Title + category + license row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PackageField label="Title" value={project.title} />
            <PackageField label="Category" value={project.category} />
            <PackageField label="License" value={LICENSES.find(l => l.id === project.license)?.name.split(' — ')[0] || project.license} />
          </div>

          {/* Platform-specific fields */}
          {(platformState.price !== undefined || platformState.contestEntry || platformState.remix) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {platformState.price !== undefined && (
                <PackageField label="Price" value={platformState.free ? 'Free' : `$${platformState.price.toFixed(2)}`} />
              )}
              {platformState.contestEntry && (
                <PackageField label="Contest entry" value={platformState.contestEntry} />
              )}
              {platformState.remix && (
                <PackageField label="Remix" value="Yes — link the original in description" />
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <PackageLabel label="Tags" hint={`${project.tags.length} · ${platform.id === 'thingiverse' ? 'space-separated' : 'comma-separated'}`}>
              <CopyButton text={tagString} />
            </PackageLabel>
            <div className="mp-card mp-mono text-xs p-2.5" style={{ background: 'rgba(21,23,28,0.03)' }}>{tagString || <span style={{ color: 'rgba(21,23,28,0.4)' }}>(no tags)</span>}</div>
          </div>

          {/* Description */}
          <div>
            {isRichTextPlatform(platform.id) ? (
              <>
                <PackageLabel label="Description (rich text)" hint={`${platform.name} uses a visual editor — paste keeps formatting`}>
                  <RichCopyButton html={mdToHtml(project.description)} plain={mdToPlain(project.description)} />
                  <button onClick={downloadDescriptionFile} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                    <Download size={10} /> .html
                  </button>
                </PackageLabel>
                <div className="mp-card mp-prose p-4 text-[13px] max-h-56 overflow-auto" style={{ background: '#FFFFFF' }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(project.description) || '<span style="color:rgba(21,23,28,0.4)">(no description)</span>' }} />
                <p className="text-[10px] mt-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.45)' }}>
                  Don't paste raw HTML into {platform.name} — it shows the tags. Hit <strong>Copy formatted</strong>, then paste into the description box. (The .html download is a backup: open it in a browser, select all, copy.)
                </p>
              </>
            ) : (
              <>
                <PackageLabel label={`Description (${platform.descFormat})`} hint={`${desc.length} chars`}>
                  <CopyButton text={desc} />
                  <button onClick={downloadDescriptionFile} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                    <Download size={10} /> .{platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt'}
                  </button>
                </PackageLabel>
                <pre className="mp-pre mp-mono text-[11px] leading-relaxed mp-card p-3 max-h-48 overflow-auto" style={{ background: 'rgba(21,23,28,0.03)', color: 'rgba(21,23,28,0.85)' }}>
                  {desc || <span style={{ color: 'rgba(21,23,28,0.4)' }}>(no description)</span>}
                </pre>
              </>
            )}
          </div>

          {/* Cover image(s) */}
          {cover && (
            <div>
              <PackageLabel label={`Cover image${platform.covers.length > 1 ? 's' : ''}`} hint={platform.covers.map(c => `${c.w}×${c.h}`).join(' · ')}>
                <button onClick={downloadAllCovers} disabled={downloading} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                  <Download size={10} /> {platform.covers.length > 1 ? `Both covers` : 'JPG'}
                </button>
              </PackageLabel>
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${platform.covers.length}, minmax(0, 1fr))` }}>
                {platform.covers.map((c) => (
                  <CoverPreview key={c.id} image={cover} cover={c} onDownload={() => downloadImage(cover, c.w, c.h, c.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Gallery images */}
          {project.images.length > 1 && (
            <div>
              <PackageLabel
                label="Gallery images"
                hint={`${Math.min(project.images.length - 1, platform.maxImages - 1)} of ${project.images.length - 1} additional (cap ${platform.maxImages})`}
              >
                <button onClick={downloadAllGallery} disabled={downloading} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                  <Download size={10} /> All gallery
                </button>
              </PackageLabel>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {project.images
                  .filter(i => i.id !== project.coverImageId)
                  .slice(0, platform.maxImages - 1)
                  .map((img, i) => (
                    <GalleryThumb
                      key={img.id}
                      image={img}
                      mainCover={platform.covers[0]}
                      onDownload={() => downloadImage(img, platform.covers[0].w, platform.covers[0].h, `gallery${String(i + 2).padStart(2, '0')}`)}
                    />
                  ))}
              </div>
              {project.images.length - 1 > platform.maxImages - 1 && (
                <div className="mt-2 mp-mono text-[10px]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                  /// {project.images.length - 1 - (platform.maxImages - 1)} image(s) skipped, {platform.name} caps at {platform.maxImages}
                </div>
              )}
            </div>
          )}

          {/* Files to upload */}
          {project.files.length > 0 && (
            <div>
              <PackageLabel label="Model files" hint={`${project.files.length} file${project.files.length === 1 ? '' : 's'}, uploaded directly to ${platform.name}`} />
              <div className="space-y-1.5">
                {project.files.map(f => {
                  const ext = fileExt(f.name);
                  const accepted = platform.formats.includes(ext);
                  return (
                    <div key={f.id} className="mp-card p-2 flex items-center gap-2 text-xs" style={{ opacity: accepted ? 1 : 0.55 }}>
                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: f.isProfile ? '#FF5722' : '#15171C', color: '#fff' }}>
                        {f.isProfile ? <Layers size={11} /> : <FileCheck size={11} />}
                      </div>
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="mp-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                        {formatBytes(f.size)}
                      </span>
                      {accepted ? (
                        <span className="mp-pill" style={{ background: 'rgba(79,178,134,0.15)', color: '#3a8d68' }}>accepted</span>
                      ) : (
                        <span className="mp-pill" style={{ background: 'rgba(255,87,34,0.15)', color: '#c83f10' }}>not supported</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* One-click upload (demo) — only platforms with a real upload API */}
          {platform.hasApi && <MockUploadFlow platform={platform} project={project} />}

          {/* Workflow hint */}
          <div className="border-t pt-3 flex items-start gap-2 text-[11px]" style={{ borderColor: 'rgba(21,23,28,0.08)', color: 'rgba(21,23,28,0.6)' }}>
            <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#FF5722' }} />
            <div>
              <strong className="mp-display tracking-wide" style={{ color: '#15171C' }}>{platform.hasApi ? 'MANUAL UPLOAD (WORKS TODAY)' : 'WORKFLOW'}</strong>{' '}
              <span>1) Click "Open upload page". 2) Drag model files into the form. 3) Copy → paste title and description. 4) Drop the downloaded cover image. 5) Drop gallery images in order. 6) Paste tags. 7) Pick the closest category. Done.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageLabel({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <span className="mp-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>{label}</span>
        {hint && <span className="mp-mono text-[10px] uppercase tracking-[0.15em] ml-2" style={{ color: 'rgba(21,23,28,0.35)' }}>· {hint}</span>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function PackageField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value || ''); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return (
    <div className="mp-card p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="mp-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.5)' }}>{label}</span>
        <button onClick={copy} className="opacity-60 hover:opacity-100 transition" aria-label={`Copy ${label}`}>
          {copied ? <Check size={11} style={{ color: '#4FB286' }} /> : <Copy size={11} />}
        </button>
      </div>
      <div className="mp-display text-[14px] leading-tight truncate">{value || <span style={{ color: 'rgba(21,23,28,0.4)' }} className="mp-body">—</span>}</div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text || ''); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return (
    <button onClick={copy} disabled={!text} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1 disabled:opacity-30">
      {copied ? <><Check size={11} style={{ color: '#4FB286' }} /> Copied</> : <><Copy size={10} /> Copy</>}
    </button>
  );
}

// Copy button for rich-text editors: puts formatted content on the clipboard so
// pasting into a WYSIWYG box (e.g. MakerWorld) keeps headings/bold/lists.
function RichCopyButton({ html, plain, label = 'Copy formatted' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyRichText(html, plain);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1200); }
  };
  return (
    <button onClick={copy} disabled={!plain} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1 disabled:opacity-30">
      {copied ? <><Check size={11} style={{ color: '#4FB286' }} /> Copied</> : <><Copy size={10} /> {label}</>}
    </button>
  );
}

// Simulated one-click upload for platforms with a real upload API (Cults3D,
// MyMiniFactory, Thingiverse). This is a DEMO — no network calls, no real upload.
// It previews the UX that a backend-backed v0.3 would deliver.
function MockUploadFlow({ platform, project }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | uploading | done
  const [stepMsg, setStepMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const fileCount = project.files.length;
  const imgCount = project.images.length;

  const connect = async () => {
    setStatus('connecting');
    await sleep(1100);
    if (cancelled.current) return;
    setStatus('connected');
  };

  const publish = async () => {
    setStatus('uploading');
    const steps = [
      `Authenticating with ${platform.name}…`,
      `Uploading ${fileCount} model file${fileCount === 1 ? '' : 's'}…`,
      `Uploading ${imgCount} image${imgCount === 1 ? '' : 's'}…`,
      `Submitting title, description, tags, license…`,
      platform.id === 'mmf' ? `Queuing for curation (test print)…` : `Publishing…`,
    ];
    for (const s of steps) {
      if (cancelled.current) return;
      setStepMsg(s);
      await sleep(850);
    }
    if (cancelled.current) return;
    const slug = (project.title || 'untitled-model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model';
    const urls = {
      cults: `https://cults3d.com/en/3d-model/${slug}`,
      mmf: `https://www.myminifactory.com/object/${slug}`,
      thingiverse: `https://www.thingiverse.com/thing:${slug}`,
    };
    setResultUrl(urls[platform.id] || '#');
    setStatus('done');
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(58,134,255,0.05)', border: '1px solid rgba(58,134,255,0.35)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="mp-display tracking-wide text-[13px]" style={{ color: '#15171C' }}>ONE-CLICK UPLOAD</span>
          <span className="mp-mono text-[8px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#3A86FF', color: '#fff' }}>Demo</span>
          <span className="mp-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.45)' }}>{platform.name} has an upload API</span>
        </div>

        {status === 'idle' && (
          <>
            <p className="text-[11px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.65)' }}>
              {platform.name} supports publishing via API. Connect your account once, then publish straight from here — no manual upload page.
            </p>
            <button onClick={connect} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect {platform.name}</button>
          </>
        )}

        {status === 'connecting' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> Opening {platform.name} authorization…
          </div>
        )}

        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}>
              <Check size={14} /> Connected as <span className="mp-mono">@your-handle</span> <span style={{ color: 'rgba(21,23,28,0.4)' }}>(demo)</span>
            </div>
            <button onClick={publish} className="mp-btn text-xs py-2 px-3"><Send size={13} /> Publish to {platform.name}</button>
          </>
        )}

        {status === 'uploading' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> {stepMsg}
          </div>
        )}

        {status === 'done' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: '#3a8d68' }}>
              <Check size={14} /> {platform.id === 'mmf' ? 'Submitted — queued for curation' : 'Published (simulated)'}
            </div>
            <div className="mp-card mp-mono text-[11px] p-2 mb-2 break-all" style={{ background: 'rgba(21,23,28,0.04)', color: 'rgba(21,23,28,0.7)' }}>{resultUrl}</div>
            {platform.id === 'mmf' && (
              <p className="text-[10px] mb-2 leading-snug" style={{ color: 'rgba(21,23,28,0.55)' }}>MyMiniFactory test-prints before publishing, so it won't be live immediately.</p>
            )}
            <button onClick={() => { setStatus('connected'); setStepMsg(''); }} className="mp-mono text-[10px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
              <ArrowRight size={11} /> Publish again
            </button>
          </>
        )}

        <p className="text-[9px] mt-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.4)' }}>
          Simulation only — nothing is uploaded yet. Real API upload to Cults3D, MyMiniFactory & Thingiverse is the next build phase. For now, use the manual steps below.
        </p>
      </div>
    </div>
  );
}

function CoverPreview({ image, cover, onDownload }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !image) return;
    const img = document.createElement('img');
    img.onload = () => {
      const c = canvasRef.current; if (!c) return;
      const aspect = cover.w / cover.h;
      const dispW = 400, dispH = dispW / aspect;
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      const srcA = img.naturalWidth / img.naturalHeight;
      let sx, sy, sw, sh;
      if (srcA > aspect) { sh = img.naturalHeight; sw = sh * aspect; sy = 0; sx = (img.naturalWidth - sw) * image.focal.x; }
      else { sw = img.naturalWidth; sh = sw / aspect; sx = 0; sy = (img.naturalHeight - sh) * image.focal.y; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dispW, dispH);
    };
    img.src = image.dataUrl;
  }, [image, cover]);
  return (
    <div className="relative group">
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        <canvas ref={canvasRef} className="w-full block" />
      </div>
      <div className="absolute top-2 left-2 mp-mono text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
        {cover.label} · {cover.w}×{cover.h}
      </div>
      <button
        onClick={onDownload}
        className="absolute bottom-2 right-2 mp-mono text-[10px] uppercase tracking-[0.2em] py-1.5 px-2 flex items-center gap-1.5 transition"
        style={{ background: '#15171C', color: '#fff' }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#FF5722'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#15171C'}
      >
        <Download size={11} /> JPG
      </button>
    </div>
  );
}

function GalleryThumb({ image, mainCover, onDownload }) {
  return (
    <div className="relative group aspect-square overflow-hidden" style={{ background: '#15171C' }}>
      <img
        src={image.dataUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{ objectPosition: `${image.focal.x * 100}% ${image.focal.y * 100}%` }}
      />
      <button
        onClick={onDownload}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        style={{ background: 'rgba(21,23,28,0.7)' }}
      >
        <div className="mp-mono text-[10px] uppercase tracking-[0.2em] flex items-center gap-1" style={{ color: '#fff' }}>
          <Download size={11} /> JPG
        </div>
      </button>
    </div>
  );
}


// =====================================================================
// SHARED UI BITS
// =====================================================================

function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="border-b pb-6" style={{ borderColor: 'rgba(21,23,28,0.15)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="mp-mono text-[10px] tracking-[0.3em]" style={{ color: '#FF5722' }}>
          <span className="mp-dimline">STEP {number}</span>
        </span>
        <div className="flex-1 mp-tickrule" />
        <span className="mp-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.4)' }}>
          /// modelprep
        </span>
      </div>
      <h2 className="mp-display text-[44px] leading-[0.92] mb-3" style={{ color: '#15171C' }}>{title}</h2>
      <p className="mp-body text-[14px] max-w-2xl leading-relaxed" style={{ color: 'rgba(21,23,28,0.65)' }}>{subtitle}</p>
    </div>
  );
}

function SectionNav({ backLabel, nextLabel, nextDisabled, onBack, onNext }) {
  return (
    <div className="mt-10 pt-5 border-t flex items-center justify-between" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
      <div>
        {backLabel && (
          <button onClick={onBack} className="mp-btn mp-btn-ghost text-xs">
            <ChevronRight size={12} className="rotate-180" /> {backLabel}
          </button>
        )}
      </div>
      <div>
        {nextLabel && (
          <button onClick={onNext} disabled={nextDisabled} className="mp-btn">
            {nextLabel} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
