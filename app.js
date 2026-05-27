const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const multer = require('multer');
const session      = require('express-session');
const MongoStore = require('connect-mongo')(session);
const expressLayouts = require('express-ejs-layouts');
const bookR = require('./routes/bookRouter');
const authR = require('./routes/authRouter');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 4002;
const DB_USER =process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_NAME = process.env.DB_NAME


async function start() {
    try {
      await mongoose.connect(
        `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.ajobvj9.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`
        
      )
      app.listen(PORT, () => {
        console.log(`Server started on ${PORT}`);
      })
      console.log("Connected to MongoDB successfully!");
    } catch (e) {
        console.log(e)
    }
}

start()

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/books/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedFormats = [
            'application/pdf',
            'application/epub+zip',
            'application/x-fictionbook+xml',
            'application/x-mobipocket-ebook'
        ];
        
        const ext = file.originalname.toLowerCase().split('.').pop();
        const allowedExtensions = ['pdf', 'epub', 'fb2', 'mobi'];
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, EPUB, FB2, MOBI files allowed!'), false);
        }
    }
});

app.locals.upload = upload;

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use('/chartjs', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(bodyParser.json())

app.set('view engine', 'ejs')
app.set('views', 'views')

app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))

app.use(session({
    secret: process.env.SESSION_SECRET || 'fantasy-forest-secret',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    }),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.username
        ? { username: req.session.username }
        : null;
    next();
});

app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/landing');
    }
});

app.use(authR);
app.use(bookR);

app.use(function (req,res,next){
    res.status(404).send("Not Found");
});






