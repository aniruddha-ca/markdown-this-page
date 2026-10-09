const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const workspace = document.getElementById('workspace');
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const toastEl = document.getElementById('toast');
const emptyState = document.getElementById('emptyState');
const emptyMessage = document.getElementById('emptyMessage');
const pageFavicon = document.getElementById('pageFavicon');

let pageMeta = { title: 'Untitled', url: '' };
let toastTimer = null;

marked.setOptions({ gfm: true, breaks: false });

function setStatus(text) {
  statusEl.textContent = text;
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function updateStats() {
  const text = editor.value;
  const words = (text.match(/\S+/g) || []).length;
  statsEl.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} chars · ${(
    text.split('\n').length || 0
  ).toLocaleString()} lines`;
}

function absolutize(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const resolve = (value) => {
    try {
      return new URL(value, baseUrl).href;
    } catch (err) {
      return value;
    }
  };
  doc.querySelectorAll('[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && !/^(#|javascript:|mailto:|tel:)/i.test(href)) {
      el.setAttribute('href', resolve(href));
    }
  });
  doc.querySelectorAll('[src]').forEach((el) => {
    const src = el.getAttribute('src');
    if (src) el.setAttribute('src', resolve(src));
  });
  doc.querySelectorAll('[srcset]').forEach((el) => {
    const srcset = el
      .getAttribute('srcset')
      .split(',')
      .map((part) => {
        const [url, ...rest] = part.trim().split(/\s+/);
        return [resolve(url), ...rest].join(' ');
      })
      .join(', ');
    el.setAttribute('srcset', srcset);
  });
  return doc;
}

const CHROME_SELECTOR =
  'nav, aside, footer, .sidebar, #sidebar, ' +
  '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
  '[role="complementary"], [role="search"]';

function extractMainContent(doc) {
  if (typeof Readability !== 'undefined') {
    try {
      const article = new Readability(doc.cloneNode(true)).parse();
      if (article && article.content) {
        const extracted = new DOMParser().parseFromString(
          article.content,
          'text/html'
        );
        if (
          article.title &&
          !extracted.body.querySelector('h1, h2, h3, h4, h5, h6')
        ) {
          const h1 = extracted.createElement('h1');
          h1.textContent = article.title;
          extracted.body.insertBefore(h1, extracted.body.firstChild);
        }
        return extracted.body;
      }
    } catch (err) {
      // fall through to selector-based extraction
    }
  }
  doc.querySelectorAll(CHROME_SELECTOR).forEach((el) => el.remove());
  const topHeader = doc.body.querySelector(':scope > header');
  if (topHeader) topHeader.remove();
  return doc.body;
}

function toMarkdown(html, baseUrl) {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined'
  });
  if (typeof turndownPluginGfm !== 'undefined') {
    service.use(turndownPluginGfm.gfm);
    service.addRule('gfmStrikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => '~~' + content + '~~'
    });
  }
  service.remove(['script', 'style', 'noscript', 'template', 'form', 'button']);
  return (
    service
      .turndown(extractMainContent(absolutize(html, baseUrl)))
      .replace(/^([*+-]|\d+\.)[ \t]+(\[[ xX]\])[ \t]+/gm, '$1 $2 ')
      .trim() + '\n'
  );
}

function renderPreview() {
  const raw = marked.parse(editor.value);
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target']
  });
  preview.innerHTML = clean;
  preview.querySelectorAll('a[href]').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
}

let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    try {
      renderPreview();
      setStatus('Preview updated');
    } catch (err) {
      setStatus('Preview error: ' + err.message);
    }
    updateStats();
  }, 150);
}

function slugify(text) {
  return (
    (text || 'page')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'page'
  );
}

function download() {
  const blob = new Blob([editor.value], {
    type: 'text/markdown;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(pageMeta.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Downloaded ${anchor.download}`);
  setStatus('File downloaded');
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(editor.value);
    showToast('Markdown copied to clipboard');
    setStatus('Copied to clipboard');
  } catch (err) {
    editor.focus();
    editor.select();
    showToast('Press Ctrl/Cmd+C to copy');
  }
}

function showEmpty(message) {
  emptyMessage.textContent = message;
  emptyState.hidden = false;
  setStatus('No page captured');
}

function initControls() {
  document.querySelectorAll('.segmented button').forEach((button) => {
    button.addEventListener('click', () => {
      document
        .querySelectorAll('.segmented button')
        .forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      workspace.dataset.view = button.dataset.view;
    });
  });

  document.getElementById('btnCopy').addEventListener('click', copyMarkdown);
  document
    .getElementById('btnDownload')
    .addEventListener('click', download);

  editor.addEventListener('input', () => {
    setStatus('Editing…');
    schedulePreview();
  });

  editor.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      download();
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart, selectionEnd, value } = editor;
      editor.value =
        value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
      editor.selectionStart = editor.selectionEnd = selectionStart + 2;
      schedulePreview();
    }
  });
}

async function init() {
  initControls();

  const data = await chrome.storage.session.get('capture');
  const capture = data && data.capture;

  if (!capture) {
    showEmpty(
      'Open a normal web page (not a browser internal page) and click the extension icon.'
    );
    return;
  }

  if (capture.error) {
    showEmpty(`Could not read this page: ${capture.error}`);
    return;
  }

  pageMeta = {
    title: capture.title || 'Untitled',
    url: capture.url || ''
  };
  document.title = `${pageMeta.title} · Markdown This Page`;
  pageTitle.textContent = pageMeta.title;
  pageTitle.title = pageMeta.title;
  pageUrl.textContent = pageMeta.url;
  pageUrl.href = pageMeta.url;

  if (capture.favicon) {
    pageFavicon.hidden = false;
    pageFavicon.onload = () => {
      pageFavicon.hidden = false;
    };
    pageFavicon.onerror = () => {
      pageFavicon.hidden = true;
    };
    pageFavicon.src = capture.favicon;
  }

  setStatus('Converting…');
  let markdown;
  try {
    markdown = toMarkdown(capture.html || '', pageMeta.url);
  } catch (err) {
    showEmpty(`Conversion failed: ${err.message}`);
    return;
  }

  editor.value = markdown;
  renderPreview();
  updateStats();
  setStatus('Converted from ' + pageMeta.url);
}

init();
