(function loadEPUB() {
    const bookFile = document.getElementById('bookData').dataset.file;

    fetch(bookFile)
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.arrayBuffer();
        })
        .then(buf => JSZip.loadAsync(buf))
        .then(zip => renderEPUB(zip))
        .catch(err => {
            document.getElementById('bookContent').innerHTML =
                `<div class="error-msg"><h2>Błąd EPUB</h2><p>${err.message}</p></div>`;
        });
})();

async function renderEPUB(zip) {
    const container = document.getElementById('bookContent');
    const tocList   = document.getElementById('tocList');
    container.innerHTML = '';
    tocList.innerHTML = '';

    const parser = new DOMParser();

    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) throw new Error('Brak META-INF/container.xml');
    const cDoc   = parser.parseFromString(containerXml, 'text/xml');
    const opfPath = cDoc.querySelector('rootfile')?.getAttribute('full-path');
    if (!opfPath) throw new Error('Brak OPF');

    const opfText = await zip.file(opfPath)?.async('text');
    const opfDoc  = parser.parseFromString(opfText, 'text/xml');
    const opfDir  = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    const manifest = {};
    opfDoc.querySelectorAll('manifest item').forEach(item => {
        manifest[item.getAttribute('id')] = item.getAttribute('href');
    });

    const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref'))
        .map(ref => manifest[ref.getAttribute('idref')])
        .filter(Boolean);

    const ncxId   = opfDoc.querySelector('spine')?.getAttribute('toc');
    const ncxHref = ncxId ? manifest[ncxId] : null;
    if (ncxHref) {
        const ncxText = await zip.file(opfDir + ncxHref)?.async('text');
        if (ncxText) {
            const ncxDoc = parser.parseFromString(ncxText, 'text/xml');
            ncxDoc.querySelectorAll('navPoint').forEach((np, i) => {
                const label = np.querySelector('navLabel text')?.textContent?.trim();
                if (!label) return;
                const item = document.createElement('div');
                item.className = 'toc-item';
                item.textContent = label;
                item.onclick = () => {
                    const chEl = document.getElementById('epub-ch-' + i);
                    if (chEl) chEl.scrollIntoView({ behavior: 'smooth' });
                    document.querySelectorAll('.toc-item').forEach(t => t.classList.remove('active'));
                    item.classList.add('active');
                };
                tocList.appendChild(item);
            });
        }
    }

    for (let i = 0; i < spineItems.length; i++) {
        const text = await zip.file(opfDir + spineItems[i])?.async('text');
        if (!text) continue;

        const doc  = parser.parseFromString(text, 'text/html');
        doc.querySelectorAll('script, style, link').forEach(el => el.remove());

        const chDiv = document.createElement('div');
        chDiv.className = 'chapter';
        chDiv.id = 'epub-ch-' + i;

        Array.from(doc.body?.children || []).forEach(el => {
            const converted = convertEpubElement(el);
            if (converted) chDiv.appendChild(converted);
        });

        if (chDiv.children.length > 0) container.appendChild(chDiv);
    }

    if (!container.children.length) {
        container.innerHTML = '<div class="error-msg"><h2>Pusty EPUB</h2></div>';
    }
}

function convertEpubElement(el) {
    const tag = el.tagName?.toLowerCase();
    if (!tag) return null;

    if (['h1','h2','h3','h4'].includes(tag)) {
        const h = document.createElement(tag === 'h1' ? 'h2' : tag);
        h.className = tag === 'h1' || tag === 'h2' ? 'chapter-title' : 'chapter-subtitle';
        h.textContent = el.textContent.trim();
        return h;
    }
    if (tag === 'p') {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML;
        return p;
    }
    if (tag === 'blockquote') {
        const bq = document.createElement('blockquote');
        bq.textContent = el.textContent;
        return bq;
    }
    if (['div','section','article'].includes(tag)) {
        const wrapper = document.createElement('div');
        Array.from(el.children).forEach(child => {
            const c = convertEpubElement(child);
            if (c) wrapper.appendChild(c);
        });
        if (!wrapper.children.length && el.textContent.trim()) {
            const p = document.createElement('p');
            p.textContent = el.textContent.trim();
            wrapper.appendChild(p);
        }
        return wrapper.children.length ? wrapper : null;
    }

    const text = el.textContent.trim();
    if (text) {
        const p = document.createElement('p');
        p.textContent = text;
        return p;
    }
    return null;
}

setTimeout(() => {
    window.initPages?.();
    window.restorePosition?.();
}, 2000);