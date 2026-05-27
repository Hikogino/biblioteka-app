(function loadFB2() {
    const bookFile = document.getElementById('bookData').dataset.file;

    fetch(bookFile)
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(xmlText => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, 'text/xml');
            renderFB2(xml);
        })
        .catch(err => {
            document.getElementById('bookContent').innerHTML =
                `<div class="error-msg"><h2>Błąd</h2><p>${err.message}</p></div>`;
        });
})();

function renderFB2(xml) {
    const container = document.getElementById('bookContent');
    const tocList   = document.getElementById('tocList');
    container.innerHTML = '';
    tocList.innerHTML = '';

    const bookTitle  = xml.querySelector('book-title')?.textContent?.trim() || '';
    const firstName  = xml.querySelector('author first-name')?.textContent?.trim() || '';
    const lastName   = xml.querySelector('author last-name')?.textContent?.trim() || '';
    const authorName = [firstName, lastName].filter(Boolean).join(' ');

    if (bookTitle) {
        const h1 = document.createElement('h1');
        h1.textContent = bookTitle;
        container.appendChild(h1);
    }
    if (authorName) {
        const p = document.createElement('p');
        p.className = 'book-author';
        p.textContent = authorName;
        container.appendChild(p);
    }

    let chapterIndex = 0;
    xml.querySelectorAll('body').forEach(body => {
        Array.from(body.children).forEach(node => {
            if (node.tagName === 'section') {
                renderSection(node, container, tocList, 1, ++chapterIndex);
            } else if (node.tagName === 'title') {
                const h = document.createElement('h2');
                h.className = 'chapter-title';
                h.textContent = node.textContent;
                container.appendChild(h);
            }
        });
    });

    if (tocList.children.length === 0) {
        const sidebar = document.getElementById('tocSidebar');
        if (sidebar) sidebar.classList.add('hidden');
    }
}

function renderSection(section, container, tocList, level, index) {
    const div = document.createElement('div');
    div.className = 'chapter';
    div.id = 'ch-' + index + '-' + level;

    const titleEl = section.querySelector(':scope > title');
    if (titleEl) {
        const titleText = titleEl.textContent.trim();
        const h = document.createElement(level === 1 ? 'h2' : 'h3');
        h.className = level === 1 ? 'chapter-title' : 'chapter-subtitle';
        h.textContent = titleText;
        div.appendChild(h);

        if (titleText && level <= 2) {
            const tocItem = document.createElement('div');
            tocItem.className = 'toc-item' + (level > 1 ? ' level-2' : '');
            tocItem.textContent = titleText;
            tocItem.onclick = () => {
                div.scrollIntoView({ behavior: 'smooth', block: 'start' });
                document.querySelectorAll('.toc-item').forEach(i => i.classList.remove('active'));
                tocItem.classList.add('active');
            };
            tocList.appendChild(tocItem);
        }
    }

    const epigraph = section.querySelector(':scope > epigraph');
    if (epigraph) {
        const bq = document.createElement('blockquote');
        bq.className = 'epigraph';
        bq.textContent = epigraph.textContent;
        div.appendChild(bq);
    }

    Array.from(section.children).forEach(child => {
        if (['title', 'epigraph'].includes(child.tagName)) return;

        if (child.tagName === 'section') {
            renderSection(child, div, tocList, level + 1, index * 100 + Math.random() * 99 | 0);
            return;
        }
        if (child.tagName === 'p') {
        const text = child.textContent.trim();
        if (!text) return;
        const p = document.createElement('p');
        p.innerHTML = convertInline(child);
    
        if (/^\[\d+\]/.test(text)) {
        p.className = 'footnote';
        p.innerHTML = p.innerHTML.replace(
            /^\[(\d+)\]/,
            '<span class="footnote-marker">[$1]</span>'
        );
        }
    
        div.appendChild(p);
        return;
        }
        if (child.tagName === 'empty-line') {
            div.appendChild(document.createElement('br'));
            return;
        }
        if (child.tagName === 'poem' || child.tagName === 'cite') {
            const bq = document.createElement('blockquote');
            bq.textContent = child.textContent;
            div.appendChild(bq);
            return;
        }
        if (child.tagName === 'subtitle') {
            const h = document.createElement('h3');
            h.className = 'chapter-subtitle';
            h.textContent = child.textContent.trim();
            div.appendChild(h);
            return;
        }
    });

    container.appendChild(div);
}

function convertInline(pNode) {
    let html = '';
    pNode.childNodes.forEach(node => {
        if (node.nodeType === 3) {
            html += escapeHtml(node.textContent);
        } else if (node.tagName === 'strong') {
            html += '<strong>' + escapeHtml(node.textContent) + '</strong>';
        } else if (node.tagName === 'emphasis') {
            html += '<em>' + escapeHtml(node.textContent) + '</em>';
        } else if (node.tagName === 'strikethrough') {
            html += '<s>' + escapeHtml(node.textContent) + '</s>';
        } else {
            html += escapeHtml(node.textContent);
        }
    });
    return html;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

setTimeout(() => {
    window.initPages?.();
}, 2000);

setTimeout(() => {
    window.restorePosition?.();
}, 2000);

