import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
    register,
    signIn,
    verifyOTP,
    resendOTP,
    enable2FA,
    verify2FASetup,
    verify2FALogin,
    disable2FA,
    forgotPassword,
    resetPassword
} from '../controllers/authController.js';
import userAuth from '../middlewares/authMiddleware.js';

// ip rate limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', limiter, register);
router.post('/signin', signIn);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/verify-2fa-login', verify2FALogin);

// Protected routes (authentication required)
router.post('/enable-2fa', userAuth, enable2FA);
router.post('/verify-2fa-setup', userAuth, verify2FASetup);
router.post('/disable-2fa', userAuth, disable2FA);

export default router;