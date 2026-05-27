const Book = require('../models/book');
const mongoose = require('mongoose');

exports.getStats = async (req, res) => {
    try {
        const now = new Date();

        const totalBooks = await Book.countDocuments({ 
            userId: req.session.userId, 
            read: true 
        });
        const readingBooks = await Book.countDocuments({ 
            userId: req.session.userId, 
            read: false, 
            bookFile: { $ne: null } 
        });
        const allBooks = await Book.countDocuments({ 
            userId: req.session.userId 
        });

        const genreStats = await Book.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.session.userId) } },
        { $group: { _id: '$genre', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
        ]);

        const authorStats = await Book.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(req.session.userId) } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
        ]);

        const allBooksWithHistory = await Book.find({
        userId: req.session.userId,
        readingHistory: { $exists: true, $ne: [] }
        }).lean();

        const historyMap = {};
        allBooksWithHistory.forEach(book => {
            (book.readingHistory || []).forEach(entry => {
                if (!historyMap[entry.date]) historyMap[entry.date] = 0;
                historyMap[entry.date] += entry.pagesRead || 0;
            });
        });

        const last30Days = [];
        for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        last30Days.push({
        date: dateStr,
        label: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
        pages: historyMap[dateStr] || 0
    });
}

        const last7Days = last30Days.slice(-7);

        const avgPagesPerDay7  = Math.round(last7Days.reduce((s, d) => s + d.pages, 0) / 7);
        const avgPagesPerDay30 = Math.round(last30Days.reduce((s, d) => s + d.pages, 0) / 30);

        const weekStart      = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        const lastWeekStart  = new Date(weekStart);
        lastWeekStart.setDate(weekStart.getDate() - 7);
        const lastWeekEnd    = new Date(weekStart);

        const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

        const pagesThisWeek  = calcPagesInPeriod(historyMap, weekStart, now);
        const pagesLastWeek  = calcPagesInPeriod(historyMap, lastWeekStart, lastWeekEnd);
        const pagesThisMonth = calcPagesInPeriod(historyMap, monthStart, now);
        const pagesLastMonth = calcPagesInPeriod(historyMap, lastMonthStart, lastMonthEnd);
        
        const booksThisMonth = await Book.countDocuments({
        userId: req.session.userId,
        read: true, 
        lastReadAt: { $gte: monthStart }
        });
        const booksLastMonth = await Book.countDocuments({
        userId: req.session.userId,
        read: true, 
        lastReadAt: { $gte: lastMonthStart, $lt: lastMonthEnd }
        });
        const booksThisYear = await Book.countDocuments({
        userId: req.session.userId,
        read: true, 
        lastReadAt: { $gte: new Date(now.getFullYear(), 0, 1) }
        });

        res.render('stats', {
            title: 'Analityka',
            isStats: true,
            totalBooks,
            readingBooks,
            allBooks,
            genreStats,
            authorStats,
            avgPagesPerDay7,
            avgPagesPerDay30,
            pagesThisWeek,
            pagesLastWeek,
            pagesThisMonth,
            pagesLastMonth,
            booksThisMonth,
            booksLastMonth,
            booksThisYear,
            chartData: JSON.stringify(last30Days)
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading statistics');
    }
};

function calcPagesInPeriod(historyMap, from, to) {
    let total = 0;
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        total += historyMap[dateStr] || 0;
        current.setDate(current.getDate() + 1);
    }
    return total;
}