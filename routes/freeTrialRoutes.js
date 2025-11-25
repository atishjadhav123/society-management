const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { registerFreeTrial, verifyEmail, loginFreeTrial, resendVerification, getProfile, updateProfile, changePassword, getTrialStatus } = require('../controller/freeTrialController');

// Public routes
router.post('/register', registerFreeTrial);
router.post('/verify-email', verifyEmail);
router.post('/login', loginFreeTrial);
router.post('/resend-verification', resendVerification);
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password', resetPassword);
// router.get('/check-email/:email', checkEmail);

// Protected routes (Free Trial Users only)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/status', protect, getTrialStatus);

module.exports = router;