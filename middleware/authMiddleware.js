// const jwt = require('jsonwebtoken');
// const UserModel = require('../models/User.model'); // ✅ Use same model as authController

// const authMiddleware = async (req, res, next) => {
//     try {
//         const token = req.header('Authorization')?.replace('Bearer ', '');

//         if (!token) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Access denied. No token provided.'
//             });
//         }

//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         console.log('🔍 Decoded token:', decoded);

//         let user;

//         // ✅ Use UserModel (same as your authController)
//         if (decoded.role === 'super_admin') {
//             user = await UserModel.findById(decoded.userId).select('-password');
//         } else {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Only super admin access is supported'
//             });
//         }

//         if (!user) {
//             console.log('❌ User not found in database');
//             return res.status(401).json({
//                 success: false,
//                 message: 'User not found'
//             });
//         }

//         if (user.isActive === false) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Account is deactivated'
//             });
//         }

//         // ✅ PROPERLY SET req.user
//         req.user = {
//             userId: user._id.toString(),
//             role: decoded.role,
//             email: user.email,
//             name: user.name
//         };

//         console.log('✅ Auth successful - User:', req.user);
//         next();

//     } catch (error) {
//         console.error('Auth Middleware Error:', error);

//         if (error.name === 'JsonWebTokenError') {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Invalid token'
//             });
//         }

//         if (error.name === 'TokenExpiredError') {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Token expired'
//             });
//         }

//         res.status(500).json({
//             success: false,
//             message: 'Server error in authentication'
//         });
//     }
// };

// module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User.model');
const CommunityAdmin = require('../models/CommunityAdmin.model');
const Resident = require('../models/Resident.model');
const FreetrailModel = require('../models/Freetrail.model');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        console.log('🔍 Decoded token:', decoded);

        let user;
        let isFreeTrial = false;

        // ✅ Handle free trial users as residents
        if (decoded.role === 'resident' && decoded.isFreeTrial) {
            isFreeTrial = true;
            user = await FreetrailModel.findById(decoded.userId).select('-password');
            if (user) {
                // Check if trial is still active
                if (user.trialEndsAt && new Date() > user.trialEndsAt) {
                    return res.status(401).json({
                        success: false,
                        message: 'Your free trial has ended'
                    });
                }
            }
        } else {
            // Regular user lookup
            switch (decoded.role) {
                case 'super_admin':
                    user = await UserModel.findById(decoded.userId).select('-password');
                    break;
                case 'community_admin':
                    user = await CommunityAdmin.findById(decoded.userId).select('-password');
                    break;
                case 'resident':
                    user = await Resident.findById(decoded.userId).select('-password');
                    break;
                default:
                    return res.status(401).json({
                        success: false,
                        message: 'Unsupported user role'
                    });
            }
        }

        if (!user) {
            console.log('❌ User not found in database');
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isActive === false) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // ✅ PROPERLY SET req.user with isFreeTrial flag
        req.user = {
            userId: user._id.toString(),
            role: decoded.role,
            email: user.email,
            name: user.fullName || user.name,
            isFreeTrial: isFreeTrial, // Important flag for profile handling
            ...(user.society && { societyId: user.society.toString() })
        };

        console.log('✅ Auth successful - User:', req.user);
        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        // ... error handling
    }
};

module.exports = authMiddleware;