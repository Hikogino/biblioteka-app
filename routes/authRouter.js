const express    = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');

authRouter.get('/landing', authController.getLanding);
authRouter.get('/login',    authController.getLogin);
authRouter.post('/login',   authController.postLogin);
authRouter.get('/register', authController.getRegister);
authRouter.post('/register', authController.postRegister);
authRouter.get('/logout',   authController.logout);

module.exports = authRouter;