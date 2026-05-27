const Book = require('../models/book');
const Goal = require('../models/goal');

exports.getDashboard = async (req, res) => {
    try {
        const now       = new Date();
        const today     = now.toISOString().split('T')[0];
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const lastReadBook = await Book.findOne({
            userId:          req.session.userId,
            bookFile:        { $ne: null },
            readingProgress: { $gt: 0 }
        }).sort({ 
            lastReadAt: -1 
        }).lean();

        const totalBooks = await Book.countDocuments({
            userId: req.session.userId,
            read:   true
        });

        const allBooks = await Book.countDocuments({
            userId: req.session.userId
        });

        const allBooksWithHistory = await Book.find({
            userId:          req.session.userId,
            readingHistory:  { 
                $exists: true, 
                $ne: [] 
            }
        }).lean();

        let pagesToday = 0;
        allBooksWithHistory.forEach(book => {
            const todayEntry = (book.readingHistory || []).find(h => h.date === today);
            if (todayEntry) pagesToday += todayEntry.pagesRead || 0;
        });

        const booksThisYear = await Book.countDocuments({
            userId:    req.session.userId,
            read:      true,
            lastReadAt: { $gte: yearStart }
        });

        const mainGoal = await Goal.findOne({
            userId: req.session.userId,
            type:   'książki',
            period: 'rok'
        }).lean();

        const mainGoalProgress = mainGoal
            ? Math.min(Math.round((booksThisYear / mainGoal.target) * 100), 100)
            : 0;

        const recentBooks = await Book.find({ userId: req.session.userId })
            .sort({ _id: -1 })
            .limit(4)
            .lean();
        const achievements = [];

        if (allBooks >= 1) achievements.push({
            title: 'Pierwsza książka',
            desc:  'Dodano pierwszą książkę',
            done:  true
        });

        if (totalBooks >= 1) achievements.push({
            title: 'Pierwszy sukces',
            desc:  'Pierwsza książka przeczytana',
            done:  true
        });

        if (totalBooks >= 5) achievements.push({
            title: 'Czytelnik',
            desc:  'Przeczytano 5 książek',
            done:  true
        });

        if (totalBooks >= 10) achievements.push({
            title: 'Bibliotekarz',
            desc:  'Przeczytano 10 książek',
            done:  true
        });

        if (mainGoal && mainGoalProgress >= 100) achievements.push({
            title: 'Cel osiągnięty',
            desc:  'Roczny cel został osiągnięty!',
            done:  true
        });

        if (allBooks < 1) achievements.push({
            title: 'Pierwsza książka',
            desc:  'Dodaj swoją pierwszą książkę',
            done:  false
        });

        if (totalBooks < 1) achievements.push({
            title: 'Pierwszy sukces',
            desc:  'Przeczytaj swoją pierwszą książkę',
            done:  false
        });

        if (totalBooks < 5) achievements.push({
            title: 'Czytelnik',
            desc:  `Przeczytaj 5 książek (${totalBooks}/5)`,
            done:  false
        });

        res.render('dashboard', {
            title:             'Strona główna',
            isDashboard:       true,
            lastReadBook,
            totalBooks,
            allBooks,
            booksThisYear,
            pagesToday,
            mainGoal,
            mainGoalProgress,
            recentBooks,
            achievements
        });
    } catch (e) {
        console.log(e);
        res.status(500).send('Error loading dashboard');
    }
};