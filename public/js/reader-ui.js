const bookData      = document.getElementById('bookData');
const BOOK_ID       = bookData?.dataset.id;
const BOOK_FORMAT   = bookData?.dataset.format;
const savedProgress = parseFloat(bookData?.dataset.progress || '0');

const CHARS_PER_PAGE = 1800; 
let totalPages    = parseInt(bookData?.dataset.totalpages || '0');
let currentPage   = parseInt(bookData?.dataset.currentpage || '0');
let currentChapterTitle = '';

let fontSize = parseInt(localStorage.getItem('readerFontSize') || '18');
applyFontSize(fontSize);

const savedTheme = localStorage.getItem('readerTheme') || 'sepia';
applyTheme(savedTheme);

document.addEventListener('DOMContentLoaded', () => {
    const activeBtn = document.querySelector(`.theme-${savedTheme}`);
    if (activeBtn) {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
    }
    renderBookmarks();
    renderNotes();
});

function applyFontSize(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    const lbl = document.getElementById('fontSizeLabel');
    if (lbl) lbl.textContent = size + 'px';
}

function changeFontSize(delta) {
    fontSize = Math.min(28, Math.max(14, fontSize + delta));
    localStorage.setItem('readerFontSize', fontSize);
    applyFontSize(fontSize);
}

function applyTheme(theme) {
    document.body.classList.remove('dark', 'white');
    if (theme === 'dark') document.body.classList.add('dark');
    if (theme === 'white') document.body.classList.add('white');
}

function setTheme(theme, btn) {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    localStorage.setItem('readerTheme', theme);
    applyTheme(theme);
}

function toggleSettings() {
    const panel = document.getElementById('fontPanel');
    const btn   = document.getElementById('settingsBtn');
    panel.classList.toggle('open');
    btn.classList.toggle('active');
}

document.addEventListener('click', e => {
    const panel = document.getElementById('fontPanel');
    const btn   = document.getElementById('settingsBtn');
    if (panel && !panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('open');
        if (btn) btn.classList.remove('active');
    }
});

let tocOpen = true;

function toggleToc() {
    const sidebar = document.getElementById('tocSidebar');
    const btn     = document.getElementById('tocBtn');
    tocOpen = !tocOpen;
    sidebar.classList.toggle('hidden', !tocOpen);
    if (btn) btn.classList.toggle('active', tocOpen);
}

function switchTab(tab, btn) {
    document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
}
window.initPages = function() {
    const content = document.getElementById('bookContent');
    if (!content) return;

    const totalChars = content.textContent.length;
    totalPages = Math.max(1, Math.ceil(totalChars / CHARS_PER_PAGE));

    if (!bookData?.dataset.totalpages || bookData.dataset.totalpages === '0') {
        saveProgress(savedProgress);
    }

    updateStatusBar(savedProgress);
};

function calcCurrentPage(pct) {
    return Math.max(1, Math.round((pct / 100) * totalPages));
}

const readingArea  = document.getElementById('readingArea');
const progressFill = document.getElementById('progressFill');

window.restorePosition = function() {
    if (!readingArea || savedProgress <= 0) return;
    restoring = true;

    const doScroll = () => {
        const maxScroll = readingArea.scrollHeight - readingArea.clientHeight;
        if (maxScroll < 100) return false;
        readingArea.scrollTop = (savedProgress / 100) * maxScroll;
        return true;
    };

    const attempts = [200, 600, 1200, 2000];
    let done = false;

    attempts.forEach(delay => {
        setTimeout(() => {
            if (done) return;
            const success = doScroll();
            if (success) {
                done = true;
                setTimeout(() => { restoring = false; }, 1000);
            }
        }, delay);
    });
};

let saveTimer = null;
if (readingArea) {
    let restoring = false; 
readingArea.addEventListener('scroll', () => {
    if (restoring) return;
        const { scrollTop, scrollHeight, clientHeight } = readingArea;
        const pct = scrollHeight > clientHeight
            ? (scrollTop / (scrollHeight - clientHeight)) * 100
            : 0;

        currentPage = calcCurrentPage(pct);

        if (progressFill) progressFill.style.width = pct + '%';

        updateStatusBar(pct);
        updateCurrentChapter();

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveProgress(pct), 2000);
    });
}

function updateStatusBar(pct) {
    const percentEl = document.getElementById('statusPercent');
    const timeEl    = document.getElementById('statusTime');
    const chapEl    = document.getElementById('statusChapter');
    const pageEl    = document.getElementById('statusPage');

    if (percentEl) percentEl.textContent = Math.round(pct) + '%';

    if (pageEl && totalPages > 0) {
        pageEl.textContent = `Str. ${currentPage} / ${totalPages}`;
    }

    if (timeEl) {
        const content    = document.getElementById('bookContent');
        const totalChars = content ? content.textContent.length : 0;
        const remaining  = totalChars * (1 - pct / 100);
        const minutes    = Math.round(remaining / 1500);

        if (minutes > 60) {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            timeEl.textContent = `~${h}h ${m}min do końca`;
        } else if (minutes > 0) {
            timeEl.textContent = `~${minutes} min do końca`;
        } else {
            timeEl.textContent = 'Prawie koniec!';
        }
    }

    if (chapEl && currentChapterTitle) {
        chapEl.textContent = currentChapterTitle;
    }
}

function updateCurrentChapter() {
    const chapters = document.querySelectorAll('.chapter');
    if (!chapters.length || !readingArea) return;

    const scrollTop = readingArea.scrollTop + 80;
    let current = null;

    chapters.forEach(ch => {
        if (ch.offsetTop <= scrollTop) current = ch;
    });

    if (current) {
        const titleEl = current.querySelector('.chapter-title');
        if (titleEl) {
            const newTitle = titleEl.textContent;
            if (newTitle !== currentChapterTitle) {
                currentChapterTitle = newTitle;
                const chapEl = document.getElementById('statusChapter');
                if (chapEl) chapEl.textContent = currentChapterTitle;

                document.querySelectorAll('.toc-item').forEach(item => {
                    item.classList.toggle('active', item.textContent === currentChapterTitle);
                });
            }
        }
    }
}

async function saveProgress(pct) {
    if (!BOOK_ID) return;
    
    const safePage = Math.min(calcCurrentPage(pct), totalPages);
    const safePct  = Math.min(pct, 100);
    
    try {
        await fetch(`/api/books/${BOOK_ID}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scrollPercent: safePct,
                currentPage:   safePage,
                totalPages:    totalPages
            })
        });
    } catch (e) {
        console.warn('Nie udało się zapisać postępu:', e);
    }
}

window.addEventListener('beforeunload', () => {
    if (!BOOK_ID || !readingArea) return;
    const { scrollTop, scrollHeight, clientHeight } = readingArea;
    const pct = scrollHeight > clientHeight
        ? (scrollTop / (scrollHeight - clientHeight)) * 100
        : 0;
    navigator.sendBeacon(
        `/api/books/${BOOK_ID}/progress`,
        JSON.stringify({
            scrollPercent: pct,
            currentPage: calcCurrentPage(pct),
            totalPages: totalPages
        })
    );
});

let bookmarks = [];
try {
    bookmarks = JSON.parse(bookData?.dataset.bookmarks || '[]');
} catch { bookmarks = []; }

const addBookmarkBtn = document.createElement('button');
addBookmarkBtn.className = 'add-bookmark-btn';
addBookmarkBtn.title = 'Dodaj zakładkę';
addBookmarkBtn.textContent = '🔖';
addBookmarkBtn.onclick = addBookmark;
if (BOOK_FORMAT !== 'pdf') document.body.appendChild(addBookmarkBtn);

async function addBookmark() {
    if (!readingArea) return;
    const { scrollTop, scrollHeight, clientHeight } = readingArea;
    const pct = scrollHeight > clientHeight
        ? (scrollTop / (scrollHeight - clientHeight)) * 100
        : 0;
    const page = calcCurrentPage(pct);

    try {
        const res = await fetch(`/api/books/${BOOK_ID}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chapterTitle: currentChapterTitle || '',
                scrollPercent: pct,
                currentPage: page
            })
        });
        const data = await res.json();
        bookmarks = data.bookmarks || [];
        renderBookmarks();

        const tab = document.querySelector('.sidebar-tab:nth-child(2)');
        if (tab) switchTab('bookmarks', tab);

        addBookmarkBtn.textContent = '✓';
        setTimeout(() => addBookmarkBtn.textContent = '🔖', 1500);
    } catch (e) {
        console.warn('Błąd dodawania zakładki:', e);
    }
}

async function deleteBookmark(id) {
    try {
        await fetch(`/api/books/${BOOK_ID}/bookmarks/${id}`, { method: 'DELETE' });
        bookmarks = bookmarks.filter(b => b._id !== id);
        renderBookmarks();
    } catch (e) {
        console.warn('Błąd usuwania zakładki:', e);
    }
}

function renderBookmarks() {
    const list = document.getElementById('bookmarksList');
    if (!list) return;

    if (!bookmarks.length) {
        list.innerHTML = '<p class="sidebar-empty">Brak zakładek</p>';
        return;
    }

    list.innerHTML = bookmarks.map(b => `
        <div class="bookmark-item" onclick="jumpToPercent(${b.scrollPercent})">
            <div class="bookmark-item-title">
                 Str. ${b.currentPage || Math.round(b.scrollPercent) + '%'}
                ${b.chapterTitle ? `<span style="opacity:0.6; font-size:11px"> · ${b.chapterTitle}</span>` : ''}
            </div>
            <div class="bookmark-item-meta">
                <span>${new Date(b.createdAt).toLocaleString('pl-PL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                <button class="bookmark-delete" onclick="event.stopPropagation(); deleteBookmark('${b._id}')">✕</button>
            </div>
        </div>
    `).join('');
}

function jumpToPercent(pct) {
    if (!readingArea) return;
    const maxScroll = readingArea.scrollHeight - readingArea.clientHeight;
    readingArea.scrollTo({ top: (pct / 100) * maxScroll, behavior: 'smooth' });
}

let notes = [];
try {
    notes = JSON.parse(bookData?.dataset.notes || '[]');
} catch { notes = []; }

let selectedTextForNote = '';

document.addEventListener('mouseup', e => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 3 && BOOK_FORMAT !== 'pdf') {
        selectedTextForNote = text;
        showNotePopup(text);
    }
});

function showNotePopup(text) {
    const popup = document.getElementById('notePopup');
    const textEl = document.getElementById('noteSelectedText');
    const input  = document.getElementById('noteTextInput');
    if (!popup) return;
    textEl.textContent = '"' + text.substring(0, 200) + (text.length > 200 ? '...' : '') + '"';
    input.value = '';
    popup.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}

function closeNotePopup() {
    const popup = document.getElementById('notePopup');
    if (popup) popup.style.display = 'none';
    selectedTextForNote = '';
    window.getSelection()?.removeAllRanges();
}

async function saveNote() {
    const noteText = document.getElementById('noteTextInput')?.value.trim();
    if (!noteText) return;

    try {
        const res = await fetch(`/api/books/${BOOK_ID}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedText: selectedTextForNote,
                noteText: noteText
            })
        });

        if (!res.ok) {
            const err = await res.json();
            console.warn('Serwer error:', err);
            return;
        }

        const data = await res.json();
        notes = data.notes || [];
        renderNotes();
        closeNotePopup();

        const tab = document.querySelector('.sidebar-tab:nth-child(3)');
        if (tab) switchTab('notes', tab);
    } catch (e) {
        console.warn('Błąd zapisywania notatki:', e);
    }
}

async function deleteNote(id) {
    try {
        await fetch(`/api/books/${BOOK_ID}/notes/${id}`, { method: 'DELETE' });
        notes = notes.filter(n => n._id !== id);
        renderNotes();
    } catch (e) {
        console.warn('Błąd usuwania notatki:', e);
    }
}

function renderNotes() {
    const list = document.getElementById('notesList');
    if (!list) return;

    if (!notes.length) {
        list.innerHTML = '<p class="sidebar-empty">Brak notatek</p>';
        return;
    }

    list.innerHTML = notes.map(n => `
        <div class="note-item">
            <div class="note-item-quote">${n.selectedText || ''}</div>
            <div class="note-item-text">${n.noteText}</div>
            <div class="note-item-meta">
                <span>${new Date(n.createdAt).toLocaleDateString('pl-PL')}</span>
                <button class="note-delete" onclick="deleteNote('${n._id}')">✕</button>
            </div>
        </div>
    `).join('');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeNotePopup();
});