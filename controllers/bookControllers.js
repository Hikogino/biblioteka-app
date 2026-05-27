const Book = require('../models/book');
const fs = require('fs');
const path = require('path');

async function parseFB2(file) {
    const xml = fs.readFileSync(file.path, 'utf8');
    const { DOMParser } = require('xmldom');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    const result = {};

    result.title  = doc.getElementsByTagName('book-title')[0]?.textContent?.trim() || '';
    result.genre  = doc.getElementsByTagName('genre')[0]?.textContent?.trim() || '';

    const firstName = doc.getElementsByTagName('first-name')[0]?.textContent?.trim() || '';
    const lastName  = doc.getElementsByTagName('last-name')[0]?.textContent?.trim() || '';
    result.author   = [firstName, lastName].filter(Boolean).join(' ') || '';

    const dateEl = doc.getElementsByTagName('date')[0];
    const dateVal = dateEl?.getAttribute('value') || dateEl?.textContent?.trim() || '';
    result.year = parseInt(dateVal) || new Date().getFullYear();

    const coverpage = doc.getElementsByTagName('coverpage')[0];
    if (coverpage) {
        const imageEl = coverpage.getElementsByTagName('image')[0];
        const href    = imageEl?.getAttribute('l:href') || imageEl?.getAttribute('xlink:href');
        if (href) {
            const coverId  = href.replace('#', '');
            const binaries = doc.getElementsByTagName('binary');
            for (let i = 0; i < binaries.length; i++) {
                const binary = binaries[i];
                if (binary.getAttribute('id') === coverId) {
                    const base64      = binary.textContent.trim();
                    const contentType = binary.getAttribute('content-type') || 'image/jpeg';
                    const ext         = contentType.split('/')[1] || 'jpg';
                    const filename    = Date.now() + '-cover.' + ext;
                    const savePath    = path.join('public', 'uploads', 'covers', filename);
                    fs.mkdirSync(path.join('public', 'uploads', 'covers'), { recursive: true });
                    fs.writeFileSync(savePath, Buffer.from(base64, 'base64'));
                    result.coverImage = '/uploads/covers/' + filename;
                    break;
                }
            }
        }
    }

    return result;
}

async function parseEPUB(file) {
    const JSZip = require('jszip');
    const { DOMParser } = require('xmldom');
    const data   = fs.readFileSync(file.path);
    const zip    = await JSZip.loadAsync(data);
    const parser = new DOMParser();
    const result = {};

    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) return result;

    const containerDoc = parser.parseFromString(containerXml, 'text/xml');
    const opfPath      = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
    if (!opfPath) return result;

    const opfText = await zip.file(opfPath)?.async('text');
    if (!opfText) return result;

    const opfDoc = parser.parseFromString(opfText, 'text/xml');
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    result.title  = opfDoc.getElementsByTagName('dc:title')[0]?.textContent?.trim() || '';
    result.author = opfDoc.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || '';
    result.genre  = opfDoc.getElementsByTagName('dc:subject')[0]?.textContent?.trim() || '';

    const dateStr = opfDoc.getElementsByTagName('dc:date')[0]?.textContent?.trim() || '';
    result.year   = parseInt(dateStr) || new Date().getFullYear();

    const items = opfDoc.getElementsByTagName('item');
    let coverHref = null;

    for (let i = 0; i < items.length; i++) {
        const item       = items[i];
        const id         = item.getAttribute('id') || '';
        const mediaType  = item.getAttribute('media-type') || '';
        const properties = item.getAttribute('properties') || '';

        if (
            properties.includes('cover-image') ||
            (id.toLowerCase().includes('cover') && mediaType.startsWith('image/'))
        ) {
            coverHref = item.getAttribute('href');
            break;
        }
    }

    if (coverHref) {
        const coverData = await zip.file(opfDir + coverHref)?.async('nodebuffer');
        if (coverData) {
            const ext      = coverHref.split('.').pop() || 'jpg';
            const filename = Date.now() + '-cover.' + ext;
            const savePath = path.join('public', 'uploads', 'covers', filename);
            fs.mkdirSync(path.join('public', 'uploads', 'covers'), { recursive: true });
            fs.writeFileSync(savePath, coverData);
            result.coverImage = '/uploads/covers/' + filename;
        }
    }

    return result;
}

async function fetchGoogleBooks(title, author) {
    try {
        const query = encodeURIComponent(`${title} ${author}`);
        const url   = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;
        const res   = await fetch(url);
        const data  = await res.json();
        const item  = data.items?.[0]?.volumeInfo;
        if (!item) return {};

        return {
            coverImage: item.imageLinks?.thumbnail
                ?.replace('http://', 'https://')
                ?.replace('&zoom=1', '&zoom=2') || null,
            year:   parseInt(item.publishedDate) || null,
            genre:  item.categories?.[0] || null
        };
    } catch (e) {
        console.warn('Google Books API error:', e.message);
        return {};
    }
}


exports.getBooks = async (req, res) => {
    try {
        const books = await Book.find({ userId: req.session.userId }).lean();
        res.render('books', {
            title: 'Moje książki',
            isBooks: true,
            books
        });
    } catch (e) {
        console.log(e);
    }
};

exports.Read = async (req, res) => {
    try {
        const readStatus = req.body.read === 'on';
        await Book.findByIdAndUpdate(req.params.id, { read: readStatus });
        res.redirect('/books');
    } catch (e) {
        res.status(500).send(e);
    }
};

exports.getCreate = (req, res) => {
    res.render('create', {
        title: 'Dodaj książkę',
        isBooks: true
    });
};

exports.postCreate = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Plik jest wymagany');
        }

        const ext = req.file.originalname.toLowerCase().split('.').pop();
        let meta = {};
        if (ext === 'fb2') {
            meta = await parseFB2(req.file);
        } else if (ext === 'epub') {
            meta = await parseEPUB(req.file);
        }
        if (!meta.title) {
            meta.title = req.file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        }
        if (!meta.coverImage && meta.title) {
            const google = await fetchGoogleBooks(meta.title, meta.author || '');
            if (google.coverImage) meta.coverImage = google.coverImage;
            if (!meta.year && google.year)   meta.year  = google.year;
            if (!meta.genre && google.genre) meta.genre = google.genre;
        }

        const bookData = {
            userId:     req.session.userId,
            title:     meta.title     || 'Nieznany tytuł',
            author:    meta.author    || 'Nieznany autor',
            genre:     meta.genre     || 'Inne',
            year:      meta.year      || new Date().getFullYear(),
            notes:     '',
            bookFile:  '/uploads/books/' + req.file.filename,
            fileFormat: ext,
            coverImage: meta.coverImage || null
        };

        const book = new Book(bookData);
        await book.save();
        res.redirect('/books');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error creating book');
    }
};

exports.getChange = async (req, res) => {
    try {
        const book = await Book.findOne({ 
            _id: req.params.id, 
            userId: req.session.userId 
        });
        if (!book) return res.status(404).send('Book not found');
        res.render('change', {
            title: 'Zmień książkę',
            isBooks: true,
            book
        });
    } catch (e) {
        console.error(e);
    }
};

exports.putChange = async (req, res) => {
    try {
        const { title, author, genre, year, notes } = req.body;
        await Book.findOneAndUpdate(
            { _id: req.params.id, userId: req.session.userId },
            { title, author, genre, year, notes },
            { new: true }
        );
        res.redirect('/books');
    } catch (e) {
        console.error(e);
    }
};

exports.Change = async (req, res) => {
    try {
        const book = await Book.findOne({ 
            bookId: req.params.id 
        });
        res.render('change', {
            title: 'Zmień książkę',
            isBooks: true,
            book
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving book');
    }
};

exports.deleteBook = async (req, res) => {
    try {
        await Book.deleteOne({ 
            _id: req.params.id, 
            userId: req.session.userId 
        });
        res.redirect('/books');
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to delete the book');
    }
};

exports.getReader = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send('Not found');
        }

        const book = await Book.findOne({ 
            _id: req.params.id, 
            userId: req.session.userId 
        });
        if (!book) return res.status(404).send('Book not found');
        if (!book.bookFile) return res.status(404).send('Book file not found');
        res.render('reader', {
            title: book.title,
            book: book,
            layout: false
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading reader');
    }
};
exports.saveProgress = async (req, res) => {
    try {
        let body = req.body;

        if (!body || Object.keys(body).length === 0) {
            let raw = '';
            await new Promise(resolve => {
                req.on('data', chunk => raw += chunk);
                req.on('end', resolve);
            });
            try { body = JSON.parse(raw); } catch { body = {}; }
        }

        const { scrollPercent, currentPage, totalPages } = body;
        const today = new Date().toISOString().split('T')[0];
        const book  = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: 'Book not found' });

        const history    = book.readingHistory || [];
        const todayEntry = history.find(h => h.date === today);

        if (todayEntry) {
            const newPage = Math.min(currentPage, totalPages || 99999);
            if (newPage > todayEntry.pageEnd) {
                todayEntry.pageEnd   = newPage;
                todayEntry.pagesRead = Math.min(
                    todayEntry.pageEnd - todayEntry.pageStart,
                    totalPages || 99999
                );
            }
        } else {
            history.push({
                date:      today,
                pagesRead: 0,
                pageStart: currentPage || 0,
                pageEnd:   currentPage || 0
            });
        }

        await Book.findByIdAndUpdate(req.params.id, {
            readingProgress: scrollPercent || 0,
            currentPage:     currentPage   || 0,
            pages:           totalPages    || book.pages,
            lastReadAt:      new Date(),
            readingHistory:  history
        });

        if (!res.headersSent) res.json({ ok: true });
    } catch (e) {
        console.error('saveProgress ERROR:', e.message);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
};

exports.addBookmark = async (req, res) => {
    try {
        const { chapterTitle, scrollPercent, currentPage } = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $push: { readerBookmarks: { chapterTitle, scrollPercent, currentPage } } },
            { new: true }
        );
        res.json({ ok: true, bookmarks: book.readerBookmarks });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteBookmark = async (req, res) => {
    try {
        await Book.findByIdAndUpdate(req.params.id, {
            $pull: { readerBookmarks: { _id: req.params.bookmarkId } }
        });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.addNote = async (req, res) => {
    try {
        const { selectedText, noteText } = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { $push: { readerNotes: { selectedText, noteText } } },
            { new: true }
        );
        res.json({ ok: true, notes: book.readerNotes });
    } catch (e) {
        console.error('addNote ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        await Book.findByIdAndUpdate(req.params.id, {
            $pull: { readerNotes: { _id: req.params.noteId } }
        });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

