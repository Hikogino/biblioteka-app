const express    = require('express');
const bookRouter = express.Router();
const bookControllers  = require('../controllers/bookControllers');
const statsController  = require('../controllers/statsController');
const dashboardController = require('../controllers/dashboardController');
const goalsController  = require('../controllers/goalsController');
const { ensureAuthenticated } = require('../middleware/auth');

bookRouter.use(ensureAuthenticated);

bookRouter.get('/dashboard', dashboardController.getDashboard);

bookRouter.get('/books', bookControllers.getBooks);
bookRouter.post('/read/:id', bookControllers.Read);
bookRouter.get('/read/:id', bookControllers.getReader);
bookRouter.get('/create', bookControllers.getCreate);

bookRouter.post('/create', (req, res, next) => {
    req.app.locals.upload.single('bookFile')(req, res, next);
}, bookControllers.postCreate);

bookRouter.delete('/delete/:id', bookControllers.deleteBook);
bookRouter.get('/change/:id', bookControllers.getChange);
bookRouter.put('/change/:id', bookControllers.putChange);

bookRouter.post('/api/books/:id/progress',           bookControllers.saveProgress);
bookRouter.post('/api/books/:id/bookmarks',          bookControllers.addBookmark);
bookRouter.delete('/api/books/:id/bookmarks/:bookmarkId', bookControllers.deleteBookmark);
bookRouter.post('/api/books/:id/notes',              bookControllers.addNote);
bookRouter.delete('/api/books/:id/notes/:noteId',    bookControllers.deleteNote);

bookRouter.get('/stats', statsController.getStats);

bookRouter.get('/goals', goalsController.getGoals);
bookRouter.post('/goals/create', goalsController.postCreateGoal);
bookRouter.delete('/goals/delete/:id', goalsController.deleteGoal);

module.exports = bookRouter;


