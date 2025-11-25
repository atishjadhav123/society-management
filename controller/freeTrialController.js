// const FreetrailModel = require('../models/FreetrailModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const FreetrailModel = require('../models/Freetrail.model');
const { sendEmail } = require('../utils/emailService');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign(
        { userId, role: 'free_trial_user' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
};

// Send Response Utility
const sendResponse = (res, statusCode, message, data = null, token = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message
    };

    if (data) response.data = data;
    if (token) response.token = token;

    res.status(statusCode).json(response);
};

// Generate random token for email verification
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// @desc    Register for free trial
// @route   POST /api/free-trial/register
// @access  Public
exports.registerFreeTrial = async (req, res) => {
    try {
        const {
            fullName,
            email,
            phone,
            societyName,
            societyType,
            totalFlats,
            city,
            role,
            password,
            confirmPassword,
            agreeTerms,
            receiveUpdates
        } = req.body;

        console.log('📝 Free trial registration attempt:', { email, societyName });

        // Validate required fields
        const requiredFields = [
            'fullName', 'email', 'phone', 'societyName',
            'societyType', 'totalFlats', 'city', 'role',
            'password', 'confirmPassword'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return sendResponse(res, 400, `Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return sendResponse(res, 400, 'Passwords do not match');
        }

        // Check if user agreed to terms
        if (!agreeTerms) {
            return sendResponse(res, 400, 'You must agree to terms and conditions');
        }

        // Check if email already exists
        const existingUser = await FreetrailModel.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingUser) {
            return sendResponse(res, 400, 'User already exists with this email');
        }

        // Create free trial user
        const freeTrialUser = await FreetrailModel.create({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            societyName: societyName.trim(),
            societyType,
            totalFlats,
            city: city.trim(),
            role,
            password,
            agreeTerms,
            receiveUpdates
        });

        // Generate verification token
        const verificationToken = generateVerificationToken();
        freeTrialUser.verificationToken = verificationToken;
        await freeTrialUser.save();

        // Send welcome email with verification link
        try {
            await sendEmail({
                to: freeTrialUser.email,
                subject: 'Welcome to SocietyPro - Verify Your Email',
                template: 'welcome-free-trial',
                context: {
                    name: freeTrialUser.fullName,
                    verificationLink: `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`,
                    trialDays: 14,
                    societyName: freeTrialUser.societyName
                }
            });
            console.log('✅ Welcome email sent to:', freeTrialUser.email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Continue even if email fails
        }

        // Generate JWT token (user can login after email verification)
        const token = generateToken(freeTrialUser._id);

        console.log('✅ Free trial user created:', freeTrialUser._id);

        sendResponse(res, 201, 'Free trial account created successfully! Check your email for verification.', {
            user: {
                id: freeTrialUser._id,
                fullName: freeTrialUser.fullName,
                email: freeTrialUser.email,
                societyName: freeTrialUser.societyName,
                trialEndsAt: freeTrialUser.trialEndsAt,
                emailVerified: freeTrialUser.emailVerified
            },
            token
        });

    } catch (error) {
        console.error('❌ Free trial registration error:', error);

        // Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, messages.join(', '));
        }

        // Duplicate key error
        if (error.code === 11000) {
            return sendResponse(res, 400, 'Email already exists');
        }

        sendResponse(res, 500, 'Server error during registration');
    }
};

// @desc    Verify email for free trial user
// @route   POST /api/free-trial/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return sendResponse(res, 400, 'Verification token is required');
        }

        const freeTrialUser = await FreetrailModel.findOne({
            verificationToken: token
        });

        if (!freeTrialUser) {
            return sendResponse(res, 400, 'Invalid or expired verification token');
        }

        // Update user as verified
        freeTrialUser.emailVerified = true;
        freeTrialUser.verificationToken = undefined;
        await freeTrialUser.save();

        console.log('✅ Email verified for:', freeTrialUser.email);

        sendResponse(res, 200, 'Email verified successfully. You can now login to your account.');

    } catch (error) {
        console.error('❌ Email verification error:', error);
        sendResponse(res, 500, 'Server error during email verification');
    }
};

// @desc    Login free trial user
// @route   POST /api/free-trial/login
// @access  Public
// @desc    Login free trial user
// @route   POST /api/free-trial/login
// @access  Public
exports.loginFreeTrial = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Free trial login attempt:', email);
        console.log('📧 Email received:', email);

        // Validate required fields
        if (!email || !password) {
            return sendResponse(res, 400, 'Email and password are required');
        }

        // Find user by email
        const freeTrialUser = await FreetrailModel.findOne({
            email: email.toLowerCase().trim()
        });

        console.log('🔍 User found:', freeTrialUser ? 'Yes' : 'No');

        if (!freeTrialUser) {
            console.log('❌ No free trial user found with email:', email);
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Check if user is active
        if (!freeTrialUser.isActive) {
            console.log('❌ User account is inactive');
            return sendResponse(res, 401, 'Account is deactivated. Please contact support.');
        }

        // ✅ TEMPORARY: Allow unverified users to login during development
        // Check if email is verified
        if (!freeTrialUser.emailVerified) {
            console.log('⚠️ Email not verified, but allowing login for development');
            // Auto-verify for development
            freeTrialUser.emailVerified = true;
            await freeTrialUser.save();
        }

        // Check if trial period is still active
        if (!freeTrialUser.isTrialActive()) {
            console.log('❌ Trial period ended');
            return sendResponse(res, 403, 'Your free trial has ended. Please upgrade to continue using SocietyPro.');
        }

        console.log('✅ All checks passed, verifying password...');

        // Check password
        const isPasswordValid = await freeTrialUser.comparePassword(password);
        console.log('🔑 Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('❌ Invalid password');
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Update login info
        freeTrialUser.lastLoginAt = new Date();
        freeTrialUser.loginCount += 1;
        await freeTrialUser.save();

        // ✅ IMPORTANT: Generate JWT token with 'resident' role for dashboard access
        const token = jwt.sign(
            {
                userId: freeTrialUser._id,
                email: freeTrialUser.email,
                role: 'resident', // Set as resident to use resident dashboard
                name: freeTrialUser.fullName,
                isFreeTrial: true
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '30d' }
        );

        console.log('✅ Free trial login successful:', freeTrialUser.email);

        // Prepare response in resident format for dashboard compatibility
        const userResponse = {
            id: freeTrialUser._id,
            name: freeTrialUser.fullName,
            email: freeTrialUser.email,
            phone: freeTrialUser.phone,
            flatNumber: 'Trial User',
            block: '',
            role: 'resident', // Set as resident
            isOwner: true,
            isActive: freeTrialUser.isActive,
            isFreeTrial: true,
            society: {
                name: freeTrialUser.societyName,
                city: freeTrialUser.city
            },
            trialEndsAt: freeTrialUser.trialEndsAt,
            trialDaysRemaining: freeTrialUser.trialDaysRemaining,
            emailVerified: freeTrialUser.emailVerified
        };

        sendResponse(res, 200, 'Login successful', {
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('❌ Free trial login error:', error);
        sendResponse(res, 500, 'Server error during login');
    }
};

// @desc    Get free trial user profile
// @route   GET /api/free-trial/profile
// @access  Private (Free Trial User only)
exports.getProfile = async (req, res) => {
    try {
        const freeTrialUser = await FreetrailModel.findById(req.user.userId)
            .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

        if (!freeTrialUser) {
            return sendResponse(res, 404, 'User not found');
        }

        sendResponse(res, 200, 'Profile retrieved successfully', {
            user: freeTrialUser
        });

    } catch (error) {
        console.error('❌ Get profile error:', error);
        sendResponse(res, 500, 'Server error retrieving profile');
    }
};

// @desc    Update free trial user profile
// @route   PUT /api/free-trial/profile
// @access  Private (Free Trial User only)
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phone, receiveUpdates } = req.body;
        const updates = {};

        if (fullName) updates.fullName = fullName.trim();
        if (phone) updates.phone = phone.trim();
        if (typeof receiveUpdates === 'boolean') updates.receiveUpdates = receiveUpdates;

        const freeTrialUser = await FreetrailModel.findByIdAndUpdate(
            req.user.userId,
            updates,
            { new: true, runValidators: true }
        ).select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

        if (!freeTrialUser) {
            return sendResponse(res, 404, 'User not found');
        }

        sendResponse(res, 200, 'Profile updated successfully', {
            user: freeTrialUser
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error updating profile');
    }
};

// @desc    Change password for free trial user
// @route   PUT /api/free-trial/change-password
// @access  Private (Free Trial User only)
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return sendResponse(res, 400, 'Current password and new password are required');
        }

        if (newPassword.length < 8) {
            return sendResponse(res, 400, 'New password must be at least 8 characters long');
        }

        const freeTrialUser = await FreetrailModel.findById(req.user.userId);
        if (!freeTrialUser) {
            return sendResponse(res, 404, 'User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await freeTrialUser.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return sendResponse(res, 400, 'Current password is incorrect');
        }

        // Update password
        freeTrialUser.password = newPassword;
        await freeTrialUser.save();

        sendResponse(res, 200, 'Password changed successfully');

    } catch (error) {
        console.error('❌ Change password error:', error);
        sendResponse(res, 500, 'Server error changing password');
    }
};

// @desc    Check trial status
// @route   GET /api/free-trial/status
// @access  Private (Free Trial User only)
exports.getTrialStatus = async (req, res) => {
    try {
        const freeTrialUser = await FreetrailModel.findById(req.user.userId)
            .select('trialEndsAt isActive emailVerified');

        if (!freeTrialUser) {
            return sendResponse(res, 404, 'User not found');
        }

        const trialStatus = {
            isTrialActive: freeTrialUser.isTrialActive(),
            trialEndsAt: freeTrialUser.trialEndsAt,
            trialDaysRemaining: freeTrialUser.trialDaysRemaining,
            isActive: freeTrialUser.isActive,
            emailVerified: freeTrialUser.emailVerified,
            canLogin: freeTrialUser.canLogin()
        };

        sendResponse(res, 200, 'Trial status retrieved successfully', trialStatus);

    } catch (error) {
        console.error('❌ Get trial status error:', error);
        sendResponse(res, 500, 'Server error retrieving trial status');
    }
};

// @desc    Resend verification email
// @route   POST /api/free-trial/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return sendResponse(res, 400, 'Email is required');
        }

        const freeTrialUser = await FreetrailModel.findOne({
            email: email.toLowerCase().trim()
        });

        if (!freeTrialUser) {
            return sendResponse(res, 404, 'User not found with this email');
        }

        if (freeTrialUser.emailVerified) {
            return sendResponse(res, 400, 'Email is already verified');
        }

        // Generate new verification token
        const verificationToken = generateVerificationToken();
        freeTrialUser.verificationToken = verificationToken;
        await freeTrialUser.save();

        // Send verification email
        try {
            await sendEmail({
                to: freeTrialUser.email,
                subject: 'Verify Your Email - SocietyPro',
                template: 'resend-verification',
                context: {
                    name: freeTrialUser.fullName,
                    verificationLink: `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`
                }
            });
            console.log('✅ Verification email resent to:', FreetrailModel.email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            return sendResponse(res, 500, 'Failed to send verification email');
        }

        sendResponse(res, 200, 'Verification email sent successfully');

    } catch (error) {
        console.error('❌ Resend verification error:', error);
        sendResponse(res, 500, 'Server error resending verification email');
    }
};