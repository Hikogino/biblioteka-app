const Book = require('../models/book');
const Goal = require('../models/goal');

exports.getGoals = async (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const userBooks = await Book.find({ userId: req.session.userId })
            .select('title author currentPage pages')
            .lean();

        const totalBooks   = await Book.countDocuments({ 
            userId: req.session.userId, 
            read: true 
        });
        const readingBooks = await Book.countDocuments({ 
            userId: req.session.userId, 
            read: false, 
            bookFile: { $ne: null } 
        });
        const allBooks     = await Book.countDocuments({ 
            userId: req.session.userId 
        });

        const allBooksWithHistory = await Book.find({
            userId: req.session.userId
        }).lean();

        const historyMap = {};
        allBooksWithHistory.forEach(book => {
            (book.readingHistory || []).forEach(entry => {
                if (!historyMap[entry.date]) historyMap[entry.date] = 0;
                historyMap[entry.date] += entry.pagesRead || 0;
            });
        });

        const weekStart      = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart2     = new Date(now.getFullYear(), 0, 1);

        const pagesThisWeek  = calcPagesInPeriod(historyMap, weekStart, now);
        const pagesThisMonth = calcPagesInPeriod(historyMap, monthStart, now);
        const pagesToday     = historyMap[today] || 0;

        const booksThisMonth = await Book.countDocuments({
            userId: req.session.userId, 
            read: true, 
            lastReadAt: { $gte: monthStart }
        });
        const booksThisYear = await Book.countDocuments({
            userId: req.session.userId, 
            read: true, 
            lastReadAt: { $gte: yearStart2 }
        });

        const goals = await Goal.find({ 
            userId: req.session.userId 
        }).lean();
        const goalsWithProgress = goals.map(goal => {
            let current = 0;

            if (goal.bookId) {
    const book = allBooksWithHistory.find(
        b => b._id.toString() === goal.bookId.toString()
    );
    if (book) {
        if (goal.period === 'dzień') {
            const todayEntry = (book.readingHistory || []).find(h => h.date === today);
            current = todayEntry?.pagesRead || 0;
        } else if (goal.period === 'tydzień') {
            current = calcBookPagesInPeriod(book, weekStart, now);
        } else if (goal.period === 'miesiąc') {
            current = calcBookPagesInPeriod(book, monthStart, now);
        }
    }
            } else {
                if (goal.type === 'książki') {
                    if (goal.period === 'rok')     current = booksThisYear;
                    if (goal.period === 'miesiąc') current = booksThisMonth;
                } else if (goal.type === 'strony') {
                    if (goal.period === 'rok')     current = calcPagesInPeriod(historyMap, yearStart2, now);
                    if (goal.period === 'miesiąc') current = pagesThisMonth;
                    if (goal.period === 'tydzień') current = pagesThisWeek;
                    if (goal.period === 'dzień')   current = pagesToday;
                }
            }

            let daysTotal = 1, daysPassed = 1;
            if (goal.period === 'rok') {
                daysTotal  = 365;
                daysPassed = Math.floor((now - yearStart2) / 86400000) + 1;
            } else if (goal.period === 'miesiąc') {
                daysTotal  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                daysPassed = now.getDate();
            } else if (goal.period === 'tydzień') {
                daysTotal  = 7;
                daysPassed = now.getDay() || 7;
            } else if (goal.period === 'dzień') {
                daysTotal  = 1;
                daysPassed = 1;
            }

            const dailyRate = current / daysPassed;
            const forecast  = Math.round(dailyRate * daysTotal);
            const progress  = goal.target > 0
                ? Math.min(Math.round((current / goal.target) * 100), 100)
                : 0;

            return {
                ...goal,
                current,
                progress,
                forecast,
                onTrack: forecast >= goal.target
            };
        });

        res.render('goals', {
            title: 'Moje cele',
            isGoals: true,
            totalBooks,
            readingBooks,
            allBooks,
            pagesToday,
            pagesThisWeek,
            pagesThisMonth,
            booksThisMonth,
            booksThisYear,
            goals: goalsWithProgress,
            userBooks  
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading goals');
    }
};

exports.postCreateGoal = async (req, res) => {
    try {
        const { goalKind, bookId } = req.body;
        const isBookGoal = goalKind === 'book';

        let target, period, type;

        if (isBookGoal) {
            target = parseInt(req.body.bookTarget);
            period = req.body.bookPeriod;
            type   = 'strony';
        } else {
            target = parseInt(Array.isArray(req.body.target) 
                ? req.body.target[0] 
                : req.body.target);
            period = Array.isArray(req.body.period) 
                ? req.body.period[0] 
                : req.body.period;
            type   = req.body.type;
        }

        let bookTitle = null;
        if (isBookGoal && bookId) {
            const book = await Book.findOne({ 
                _id: bookId, 
                userId: req.session.userId 
            });
            bookTitle = book ? book.title : null;
        }

        const goal = new Goal({
            userId:    req.session.userId,
            type,
            target,
            period,
            year:      new Date().getFullYear(),
            month:     period === 'miesiąc' ? new Date().getMonth() + 1 : null,
            bookId:    isBookGoal ? bookId : null,
            bookTitle: bookTitle
        });

        await goal.save();
        res.redirect('/goals');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error creating goal');
    }
};

exports.deleteGoal = async (req, res) => {
    try {
        await Goal.deleteOne({ 
            _id: req.params.id, 
            userId: req.session.userId 
        });
        res.redirect('/goals');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error deleting goal');
    }
};

function calcPagesInPeriod(historyMap, from, to) {
    let total = 0;
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        total += historyMap[dateStr] || 0;
        current.setDate(current.getDate() + 1);
    }
    return total;
}

function calcBookPagesInPeriod(book, from, to) {
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
        
        const entry = (book.readingHistory || []).find(h => h.date === dateStr);
        total += entry?.pagesRead || 0;
        current.setDate(current.getDate() + 1);
    }
    return total;
}