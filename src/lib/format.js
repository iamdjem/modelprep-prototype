// Pure formatting / file helpers — no React, no DOM. Extracted from App.jsx so
// they can be unit-tested in isolation (see format.test.js) and reused.

export function escapeHtml(s) {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function inlineFormat(t) {
  return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
          .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function mdToHtml(md) {
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

export function mdToPlain(md) {
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

export function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }

export function isModelFile(name) {
  return ['stl', '3mf', 'obj', 'step', 'stp', 'amf', 'gcode', 'scad', 'dxf', 'svg', 'glb', 'fbx', 'blend'].includes(fileExt(name));
}

export function isProfile(name) { return fileExt(name) === '3mf'; }

export function isImageFile(name) { return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt(name)); }

export function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

// Make `name` unique against a Set of taken (lowercased) names by suffixing
// "-2", "-3", … before the extension. Prevents silent collisions in the zip.
export function uniqueFileName(name, taken) {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = ext ? name.slice(0, -ext.length) : name;
  let n = 2;
  let candidate;
  do { candidate = `${base}-${n}${ext}`; n++; } while (taken.has(candidate.toLowerCase()));
  return candidate;
}
