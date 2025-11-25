
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const UserModel = require('../models/User.model');
const SocietiModel = require('../models/Societi.model');
const CommunityAdminModel = require('../models/CommunityAdmin.model');
const ResidentModel = require('../models/Resident.model');
const SecurityGardModel = require('../models/SecurityGard.model');
const complaintsModel = require('../models/complaints.model');

// Generate JWT Token
const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
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

// @desc    Register Super Admin (First Time Setup)
// @route   POST /api/auth/register-super-admin
// @access  Public (Only for initial setup)
exports.registerSuperAdmin = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate required fields
        if (!name || !email || !password || !phone) {
            return sendResponse(res, 400, 'All fields are required');
        }

        // Check if super admin already exists
        const existingSuperAdmin = await UserModel.findOne();
        if (existingSuperAdmin) {
            return sendResponse(res, 400, 'Super admin already exists. Only one super admin is allowed.');
        }

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendResponse(res, 400, 'Invalid email format');
        }

        // Check password strength
        if (password.length < 6) {
            return sendResponse(res, 400, 'Password must be at least 6 characters long');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create super admin
        const superAdmin = await UserModel.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            phone
        });

        // Generate JWT token
        const token = generateToken(superAdmin._id, 'super_admin');

        sendResponse(res, 201, 'Super admin registered successfully', {
            id: superAdmin._id,
            name: superAdmin.name,
            email: superAdmin.email,
            phone: superAdmin.phone,
            role: 'super_admin',
            isActive: superAdmin.isActive,
            createdAt: superAdmin.createdAt
        }, token);

    } catch (error) {
        console.error('Super Admin Registration Error:', error);

        if (error.code === 11000) {
            return sendResponse(res, 400, 'Email already exists');
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error during registration');
    }
};

// @desc    Super Admin Login
// @route   POST /api/auth/super-admin-login
// @access  Public
exports.superAdminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return sendResponse(res, 400, 'Email and password are required');
        }

        // Check if super admin exists and is active
        const superAdmin = await UserModel.findOne({
            email: email.toLowerCase(),
            isActive: true
        });

        if (!superAdmin) {
            return sendResponse(res, 401, 'Invalid credentials');
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
        if (!isPasswordValid) {
            return sendResponse(res, 401, 'Invalid credentials');
        }

        // Generate JWT token
        const token = generateToken(superAdmin._id, 'super_admin');

        sendResponse(res, 200, 'Login successful', {
            id: superAdmin._id,
            name: superAdmin.name,
            email: superAdmin.email,
            phone: superAdmin.phone,
            role: 'super_admin',
            isActive: superAdmin.isActive
        }, token);

    } catch (error) {
        console.error('Super Admin Login Error:', error);
        sendResponse(res, 500, 'Server error during login');
    }
};




// @desc    Get Super Admin Dashboard Stats
// @route   GET /api/dashboard/super-admin
// @access  Private (Super Admin only)
exports.getSuperAdminDashboard = async (req, res) => {
    try {
        const superAdminId = req.user.userId;

        // Get all counts in parallel for better performance
        const [
            totalSocieties,
            totalResidents,
            totalCommunityAdmins,
            totalSecurityGuards,
            pendingComplaints,
            activeSocieties,
            recentComplaints,
            monthlyRevenue
        ] = await Promise.all([
            // Total Societies
            SocietiModel.countDocuments({ createdBy: superAdminId }),

            // Total Residents
            ResidentModel.countDocuments({ isActive: true }),

            // Total Community Admins
            CommunityAdminModel.countDocuments({ isActive: true }),

            // Total Security Guards
            SecurityGardModel.countDocuments({ isActive: true }),

            // Pending Complaints
            complaintsModel.countDocuments({ status: 'pending' }),

            // Active Societies
            SocietiModel.countDocuments({ status: 'Active', isActive: true }),

            // Recent Complaints (last 7 days)
            complaintsModel.find({
                createdAt: {
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            })
                .populate('raisedBy', 'name flatNumber')
                .populate('society', 'name')
                .sort({ createdAt: -1 })
                .limit(5),

            // Monthly Revenue (example calculation)
            calculateMonthlyRevenue()
        ]);

        // Recent Activities
        const recentActivities = await getRecentActivities();

        const dashboardData = {
            stats: {
                totalSocieties,
                totalResidents,
                totalCommunityAdmins,
                totalSecurityGuards,
                pendingComplaints,
                activeSocieties,
                monthlyRevenue
            },
            recentComplaints,
            recentActivities
        };

        res.status(200).json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard data'
        });
    }
};

// Calculate monthly revenue (example logic)
const calculateMonthlyRevenue = async () => {
    // This is a simplified calculation
    // You might want to calculate based on actual payments
    const totalSocieties = await SocietiModel.countDocuments({ status: 'Active' });
    const baseRevenue = totalSocieties * 5000; // Example: ₹5000 per society
    return baseRevenue;
};

// Get recent activities from different models
const getRecentActivities = async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
        newSocieties,
        newResidents,
        resolvedComplaints,
        newAdmins
    ] = await Promise.all([
        SocietiModel.find({ createdAt: { $gte: oneDayAgo } })
            .select('name createdAt')
            .sort({ createdAt: -1 })
            .limit(3),

        ResidentModel.find({ createdAt: { $gte: oneDayAgo } })
            .select('name flatNumber createdAt')
            .populate('society', 'name')
            .sort({ createdAt: -1 })
            .limit(3),

        complaintsModel.find({
            status: 'resolved',
            resolvedAt: { $gte: oneDayAgo }
        })
            .select('title resolvedAt')
            .populate('raisedBy', 'name')
            .sort({ resolvedAt: -1 })
            .limit(3),

        CommunityAdminModel.find({ createdAt: { $gte: oneDayAgo } })
            .select('name createdAt')
            .populate('society', 'name')
            .sort({ createdAt: -1 })
            .limit(3)
    ]);

    const activities = [];

    // Format society activities
    newSocieties.forEach(society => {
        activities.push({
            action: `New society registered: ${society.name}`,
            time: formatTimeAgo(society.createdAt),
            type: 'success',
            icon: '🏘️'
        });
    });

    // Format resident activities
    newResidents.forEach(resident => {
        activities.push({
            action: `New resident joined: ${resident.name} (${resident.flatNumber})`,
            time: formatTimeAgo(resident.createdAt),
            type: 'info',
            icon: '👤'
        });
    });

    // Format complaint activities
    resolvedComplaints.forEach(complaint => {
        activities.push({
            action: `Complaint resolved: ${complaint.title}`,
            time: formatTimeAgo(complaint.resolvedAt),
            type: 'success',
            icon: '✅'
        });
    });

    // Format admin activities
    newAdmins.forEach(admin => {
        activities.push({
            action: `New community admin added: ${admin.name}`,
            time: formatTimeAgo(admin.createdAt),
            type: 'warning',
            icon: '👨‍💼'
        });
    });

    // Sort by time and return top 6
    return activities
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 6);
};

const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

// @desc    Get Super Admin Profile
// @access  Private (Super Admin only)
// exports.getSuperAdminProfile = async (req, res) => {
//     try {
//         const superAdmin = await SuperAdmin.findById(req.user.userId).select('-password');

//         if (!superAdmin) {
//             return sendResponse(res, 404, 'Super admin not found');
//         }

//         sendResponse(res, 200, 'Profile retrieved successfully', {
//             id: superAdmin._id,
//             name: superAdmin.name,
//             email: superAdmin.email,
//             phone: superAdmin.phone,
//             role: 'super_admin',
//             isActive: superAdmin.isActive,
//             createdAt: superAdmin.createdAt,
//             updatedAt: superAdmin.updatedAt
//         });

//     } catch (error) {
//         console.error('Get Profile Error:', error);
//         sendResponse(res, 500, 'Server error retrieving profile');
//     }
// };

// @desc    Update Super Admin Profile
// @route   PUT /api/auth/super-admin/profile
// @access  Private (Super Admin only)
// exports.updateSuperAdminProfile = async (req, res) => {
//     try {
//         const { name, phone } = req.body;
//         const updates = {};

//         if (name) updates.name = name;
//         if (phone) updates.phone = phone;

//         const superAdmin = await SuperAdmin.findByIdAndUpdate(
//             req.user.userId,
//             updates,
//             { new: true, runValidators: true }
//         ).select('-password');

//         if (!superAdmin) {
//             return sendResponse(res, 404, 'Super admin not found');
//         }

//         sendResponse(res, 200, 'Profile updated successfully', {
//             id: superAdmin._id,
//             name: superAdmin.name,
//             email: superAdmin.email,
//             phone: superAdmin.phone,
//             role: 'super_admin',
//             isActive: superAdmin.isActive
//         });

//     } catch (error) {
//         console.error('Update Profile Error:', error);

//         if (error.name === 'ValidationError') {
//             const errors = Object.values(error.errors).map(err => err.message);
//             return sendResponse(res, 400, errors.join(', '));
//         }

//         sendResponse(res, 500, 'Server error updating profile');
//     }
// };

// @desc    Change Super Admin Password
// @route   PUT /api/auth/super-admin/change-password
// @access  Private (Super Admin only)
// exports.changeSuperAdminPassword = async (req, res) => {
//     try {
//         const { currentPassword, newPassword } = req.body;

//         // Validate required fields
//         if (!currentPassword || !newPassword) {
//             return sendResponse(res, 400, 'Current password and new password are required');
//         }

//         // Check new password length
//         if (newPassword.length < 6) {
//             return sendResponse(res, 400, 'New password must be at least 6 characters long');
//         }

//         // Find super admin
//         const superAdmin = await SuperAdmin.findById(req.user.userId);
//         if (!superAdmin) {
//             return sendResponse(res, 404, 'Super admin not found');
//         }

//         // Verify current password
//         const isCurrentPasswordValid = await bcrypt.compare(currentPassword, superAdmin.password);
//         if (!isCurrentPasswordValid) {
//             return sendResponse(res, 400, 'Current password is incorrect');
//         }

//         // Hash new password
//         const hashedNewPassword = await bcrypt.hash(newPassword, 12);

//         // Update password
//         superAdmin.password = hashedNewPassword;
//         await superAdmin.save();

//         sendResponse(res, 200, 'Password changed successfully');

//     } catch (error) {
//         console.error('Change Password Error:', error);
//         sendResponse(res, 500, 'Server error changing password');
//     }
// };

// @desc    Create Society (by Super Admin)
// @route   POST /api/auth/super-admin/create-society
// @access  Private (Super Admin only)
// exports.createSociety = async (req, res) => {
//     try {
//         const {
//             name,
//             address,
//             city,
//             state,
//             pincode,
//             totalFlats,
//             totalWings,
//             maintenanceFee,
//             contactEmail,
//             contactPhone
//         } = req.body;

//         // Validate required fields
//         if (!name || !address || !city || !state || !pincode || !totalFlats || !totalWings || !contactEmail || !contactPhone) {
//             return sendResponse(res, 400, 'All fields are required');
//         }

//         // Check if society with same name and city already exists
//         const existingSociety = await Society.findOne({
//             name: { $regex: new RegExp(name, 'i') },
//             city: { $regex: new RegExp(city, 'i') }
//         });

//         if (existingSociety) {
//             return sendResponse(res, 400, 'Society with this name already exists in the same city');
//         }

//         // Create society
//         const society = await Society.create({
//             name,
//             address,
//             city,
//             state,
//             pincode,
//             totalFlats,
//             totalWings,
//             maintenanceFee: maintenanceFee || 0,
//             contactEmail: contactEmail.toLowerCase(),
//             contactPhone,
//             superAdminId: req.user.userId
//         });

//         sendResponse(res, 201, 'Society created successfully', {
//             id: society._id,
//             name: society.name,
//             address: society.address,
//             city: society.city,
//             state: society.state,
//             pincode: society.pincode,
//             totalFlats: society.totalFlats,
//             totalWings: society.totalWings,
//             maintenanceFee: society.maintenanceFee,
//             contactEmail: society.contactEmail,
//             contactPhone: society.contactPhone,
//             registrationDate: society.registrationDate
//         });

//     } catch (error) {
//         console.error('Create Society Error:', error);

//         if (error.name === 'ValidationError') {
//             const errors = Object.values(error.errors).map(err => err.message);
//             return sendResponse(res, 400, errors.join(', '));
//         }

//         sendResponse(res, 500, 'Server error creating society');
//     }
// };

// @desc    Get All Societies (by Super Admin)
// @route   GET /api/auth/super-admin/societies
// @access  Private (Super Admin only)
// exports.getAllSocieties = async (req, res) => {
//     try {
//         const { page = 1, limit = 10, search = '' } = req.query;

//         const query = {};
//         if (search) {
//             query.$or = [
//                 { name: { $regex: search, $options: 'i' } },
//                 { city: { $regex: search, $options: 'i' } },
//                 { state: { $regex: search, $options: 'i' } }
//             ];
//         }

//         const societies = await Society.find(query)
//             .sort({ createdAt: -1 })
//             .limit(limit * 1)
//             .skip((page - 1) * limit)
//             .select('-__v');

//         const totalCount = await Society.countDocuments(query);

//         sendResponse(res, 200, 'Societies retrieved successfully', {
//             societies,
//             totalPages: Math.ceil(totalCount / limit),
//             currentPage: parseInt(page),
//             totalCount
//         });

//     } catch (error) {
//         console.error('Get Societies Error:', error);
//         sendResponse(res, 500, 'Server error retrieving societies');
//     }
// };