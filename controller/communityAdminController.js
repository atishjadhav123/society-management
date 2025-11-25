const bcrypt = require('bcryptjs');
const SocietiModel = require('../models/Societi.model');
const CommunityAdminModel = require('../models/CommunityAdmin.model');
const jwt = require("jsonwebtoken");

// Simple response helper
const sendResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message
    };
    if (data) response.data = data;
    res.status(statusCode).json(response);
};

// @desc    Create Community Admin
// @route   POST /api/community-admin/create
// @access  Private (Super Admin only)
exports.createCommunityAdminModel = async (req, res) => {
    try {
        console.log('📝 Creating community admin...');
        if (!req.user || !req.user.userId) {
            console.log('❌ User not authenticated - req.user:', req.user);
            return sendResponse(res, 401, 'Authentication required');
        }
        const { name, email, phone, password, society, permissions } = req.body;
        const createdBy = req.user.userId; // From auth middleware

        // Check required fields
        if (!name || !email || !phone || !password || !society) {
            console.log('❌ Missing required fields');
            return sendResponse(res, 400, 'All fields are required');
        }

        // Check if email already exists
        const existingAdmin = await CommunityAdminModel.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            console.log('❌ Email already exists:', email);
            return sendResponse(res, 400, 'Email already registered');
        }

        // Check if society exists
        const societyExists = await SocietiModel.findById(society);
        if (!societyExists) {
            console.log('❌ Society not found:', society);
            return sendResponse(res, 400, 'Society not found');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log('🔐 Password hashed');

        // Create community admin
        const newCommunityAdmin = await CommunityAdminModel.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            society: society,
            permissions: permissions || ['manage_residents', 'manage_complaints', 'manage_notices'],
            createdBy: createdBy
        });

        console.log('✅ Community admin created:', newCommunityAdmin._id);

        // Don't send password in response
        const adminData = {
            id: newCommunityAdmin._id,
            name: newCommunityAdmin.name,
            email: newCommunityAdmin.email,
            phone: newCommunityAdmin.phone,
            role: newCommunityAdmin.role,
            society: newCommunityAdmin.society,
            permissions: newCommunityAdmin.permissions,
            isActive: newCommunityAdmin.isActive,
            createdAt: newCommunityAdmin.createdAt
        };

        sendResponse(res, 201, 'Community admin created successfully', adminData);

    } catch (error) {
        console.error('❌ Create community admin error:', error.message);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error during community admin creation');
    }
};
// @desc    Community Admin Login
// @route   POST /api/auth/community-admin-login
// @access  Public
exports.communityAdminLogin = async (req, res) => {
    try {
        console.log('🔐 Community Admin Login attempt...');
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return sendResponse(res, 400, 'Email and password are required');
        }

        // Find community admin by email
        const admin = await CommunityAdminModel.findOne({
            email: email.toLowerCase().trim(),
            isActive: true
        }).populate('society', 'name city state address');

        if (!admin) {
            console.log('❌ Community admin not found:', email);
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: admin._id,
                email: admin.email,
                role: admin.role,
                societyId: admin.society?._id
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '30d' }
        );

        console.log('✅ Community admin login successful:', admin.email);

        // Prepare response data
        const adminData = {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            phone: admin.phone,
            role: admin.role,
            society: admin.society,
            permissions: admin.permissions,
            isActive: admin.isActive,
            createdAt: admin.createdAt
        };

        sendResponse(res, 200, 'Login successful', {
            user: adminData,
            token: token
        });

    } catch (error) {
        console.error('❌ Community admin login error:', error.message);
        sendResponse(res, 500, 'Server error during login');
    }
};

// @desc    Get All Community Admins
// @route   GET /api/community-admin
// @access  Private (Super Admin only)
exports.getAllCommunityAdminModels = async (req, res) => {
    try {
        console.log('📋 Fetching all community admins...');

        const { page = 1, limit = 10 } = req.query;

        const admins = await CommunityAdminModel.find()
            .populate('society', 'name city state')
            .populate('createdBy', 'name email')
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalCount = await CommunityAdminModel.countDocuments();

        console.log('✅ Found', admins.length, 'community admins');

        sendResponse(res, 200, 'Community admins retrieved successfully', {
            admins,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });

    } catch (error) {
        console.error('❌ Get all community admins error:', error.message);
        sendResponse(res, 500, 'Server error while fetching community admins');
    }
};

// @desc    Get Community Admin by ID
// @route   GET /api/community-admin/:id
// @access  Private (Super Admin only)
exports.getCommunityAdminModelById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 Fetching community admin by ID:', id);

        const admin = await CommunityAdminModel.findById(id)
            .populate('society', 'name address city state')
            .populate('createdBy', 'name email')
            .select('-password');

        if (!admin) {
            console.log('❌ Community admin not found');
            return sendResponse(res, 404, 'Community admin not found');
        }

        console.log('✅ Community admin found:', admin.name);
        sendResponse(res, 200, 'Community admin retrieved successfully', admin);

    } catch (error) {
        console.error('❌ Get community admin error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid community admin ID');
        }

        sendResponse(res, 500, 'Server error while fetching community admin');
    }
};

// @desc    Update Community Admin
// @route   PUT /api/community-admin/:id
// @access  Private (Super Admin only)
exports.updateCommunityAdminModel = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('✏️ Updating community admin:', id);

        const admin = await CommunityAdminModel.findById(id);
        if (!admin) {
            console.log('❌ Community admin not found');
            return sendResponse(res, 404, 'Community admin not found');
        }

        // Check if email is being updated and if it already exists
        if (updateData.email && updateData.email !== admin.email) {
            const existingAdmin = await CommunityAdminModel.findOne({
                email: updateData.email.toLowerCase(),
                _id: { $ne: id }
            });
            if (existingAdmin) {
                console.log('❌ Email already exists:', updateData.email);
                return sendResponse(res, 400, 'Email already registered');
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== 'password') {
                admin[key] = updateData[key];
            }
        });

        // Handle password update separately
        if (updateData.password) {
            admin.password = await bcrypt.hash(updateData.password, 12);
            console.log('🔐 Password updated');
        }

        await admin.save();
        console.log('✅ Community admin updated successfully');

        // Don't send password in response
        const adminData = admin.toObject();
        delete adminData.password;

        sendResponse(res, 200, 'Community admin updated successfully', adminData);

    } catch (error) {
        console.error('❌ Update community admin error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid community admin ID');
        }

        sendResponse(res, 500, 'Server error while updating community admin');
    }
};

// @desc    Delete Community Admin (Soft Delete)
// @route   DELETE /api/community-admin/:id
// @access  Private (Super Admin only)
exports.deleteCommunityAdminModel = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting community admin:', id);

        const admin = await CommunityAdminModel.findById(id);
        if (!admin) {
            console.log('❌ Community admin not found');
            return sendResponse(res, 404, 'Community admin not found');
        }

        // Soft delete - set isActive to false
        admin.isActive = false;
        await admin.save();

        console.log('✅ Community admin deleted (soft delete)');
        sendResponse(res, 200, 'Community admin deleted successfully');

    } catch (error) {
        console.error('❌ Delete community admin error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid community admin ID');
        }

        sendResponse(res, 500, 'Server error while deleting community admin');
    }
};

// @desc    Get Community Admins by Society
// @route   GET /api/community-admin/society/:societyId
// @access  Private (Super Admin only)
exports.getAdminsBySociety = async (req, res) => {
    try {
        const { societyId } = req.params;
        console.log('🏢 Fetching admins for society:', societyId);

        const admins = await CommunityAdminModel.find({ society: societyId, isActive: true })
            .populate('society', 'name city')
            .select('-password')
            .sort({ createdAt: -1 });

        console.log('✅ Found', admins.length, 'admins for society');
        sendResponse(res, 200, 'Society admins retrieved successfully', admins);

    } catch (error) {
        console.error('❌ Get society admins error:', error.message);
        sendResponse(res, 500, 'Server error while fetching society admins');
    }
};