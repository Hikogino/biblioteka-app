const User = require('../models/user');
const bcrypt = require('bcryptjs');

exports.getLogin = (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('auth/login', {
        title: 'Zaloguj się',
        layout: 'layouts/auth',
        error: null
    });
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.render('auth/login', {
                title: 'Zaloguj się',
                layout: 'layouts/auth',
                error: 'Nie znaleziono użytkownika'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Zaloguj się',
                layout: 'layouts/auth',
                error: 'Nieprawidłowe hasło'
            });
        }

        req.session.userId   = user._id;
        req.session.username = user.username;
        res.redirect('/');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error logging in');
    }
};

exports.getRegister = (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('auth/register', {
        title: 'Rejestracja',
        layout: 'layouts/auth',
        error: null
    });
};

exports.postRegister = async (req, res) => {
    try {
        const { username, email, password, password2 } = req.body;

        if (password !== password2) {
            return res.render('auth/register', {
                title: 'Rejestracja',
                layout: 'layouts/auth',
                error: 'Hasła nie są zgodne'
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', {
                title: 'Rejestracja',
                layout: 'layouts/auth',
                error: 'Hasło musi mieć co najmniej 6 znaków'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('auth/register', {
                title: 'Rejestracja',
                layout: 'layouts/auth',
                error: 'Ten email jest już zajęty'
            });
        }

        const salt           = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        res.redirect('/login');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error registering user');
    }
};

exports.getLanding = (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/dashboard');
    res.render('landing', {
        title: 'Biblioteka',
        layout: 'layouts/auth'
    });
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/landing');  
    });
};