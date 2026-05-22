import { describe, it, expect } from 'vitest';
import {
  mdToHtml, mdToPlain, slugify, uniqueFileName,
  fileExt, isModelFile, isProfile, isImageFile, formatBytes, escapeHtml,
} from './format';

describe('slugify', () => {
  it('lowercases and dashes', () => expect(slugify('Articulating Desk Dragon')).toBe('articulating-desk-dragon'));
  it('strips leading/trailing separators', () => expect(slugify('  !!Hello!!  ')).toBe('hello'));
  it('falls back to "untitled" for empty/symbol-only input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('日本語')).toBe('untitled');
    expect(slugify(null)).toBe('untitled');
  });
});

describe('uniqueFileName', () => {
  it('returns the name when not taken', () => {
    expect(uniqueFileName('part.stl', new Set())).toBe('part.stl');
  });
  it('suffixes before the extension on collision', () => {
    expect(uniqueFileName('part.stl', new Set(['part.stl']))).toBe('part-2.stl');
  });
  it('increments past multiple collisions', () => {
    expect(uniqueFileName('part.stl', new Set(['part.stl', 'part-2.stl']))).toBe('part-3.stl');
  });
  it('handles names with no extension', () => {
    expect(uniqueFileName('README', new Set(['readme']))).toBe('README-2');
  });
  it('is case-insensitive', () => {
    expect(uniqueFileName('Part.STL', new Set(['part.stl']))).toBe('Part-2.STL');
  });
});

describe('file type detection', () => {
  it('classifies model files', () => {
    expect(isModelFile('a.stl')).toBe(true);
    expect(isModelFile('a.3mf')).toBe(true);
    expect(isModelFile('a.png')).toBe(false);
  });
  it('classifies 3mf as profile', () => {
    expect(isProfile('dragon.3mf')).toBe(true);
    expect(isProfile('dragon.stl')).toBe(false);
  });
  it('classifies images incl webp/gif', () => {
    expect(isImageFile('cover.webp')).toBe(true);
    expect(isImageFile('clip.gif')).toBe(true);
    expect(isImageFile('model.stl')).toBe(false);
  });
  it('fileExt is lowercase and tail-only', () => {
    expect(fileExt('My.Model.STL')).toBe('stl');
    expect(fileExt('noext')).toBe('noext');
  });
});

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});

describe('mdToHtml', () => {
  it('returns empty string for empty input', () => expect(mdToHtml('')).toBe(''));
  it('renders headings, bold and lists', () => {
    const html = mdToHtml('# Title\n\n**bold** text\n\n- one\n- two');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });
  it('renders fenced code blocks and escapes inside them', () => {
    const html = mdToHtml('```\n<tag>\n```');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('&lt;tag&gt;');
  });
});

describe('mdToPlain', () => {
  it('strips markdown syntax', () => {
    const plain = mdToPlain('# Title\n\n**bold** and [link](http://x)\n\n- item');
    expect(plain).not.toContain('#');
    expect(plain).not.toContain('**');
    expect(plain).toContain('bold');
    expect(plain).toContain('link (http://x)');
    expect(plain).toContain('• item');
  });
});
