const bcrypt = require('bcryptjs');
const SocietiModel = require('../models/Societi.model');
const ResidentModel = require('../models/Resident.model');
const FreetrailModel = require('../models/Freetrail.model');


// Response helper
const sendResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message
    };
    if (data) response.data = data;
    res.status(statusCode).json(response);
};

// @desc    Create Resident
// @route   POST /api/residents/create
// @access  Private (Community Admin only)
exports.createResident = async (req, res) => {
    try {
        console.log('🏠 Creating resident...');
        console.log("Incoming Body:", req.body); // 👈 debug


        const { name, email, phone, password, flatNumber, block, society, communityadmin, isOwner, superadmin } = req.body;

        // Check required fields
        if (!name || !email || !phone || !password || !flatNumber || !society) {
            return sendResponse(res, 400, 'All fields are required');
        }

        // Check if email already exists
        const existingResident = await ResidentModel.findOne({ email: email.toLowerCase() });
        if (existingResident) {
            return sendResponse(res, 400, 'Email already registered');
        }

        // Check if society exists
        const societyExists = await SocietiModel.findById(society);
        if (!societyExists) {
            return sendResponse(res, 400, 'Society not found');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create resident
        const newResident = await ResidentModel.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            flatNumber: flatNumber.trim(),
            block: block?.trim() || '',
            society: society,
            superadmin,
            communityadmin,
            isOwner: isOwner
        });

        console.log('✅ ResidentModel created:', newResident._id);

        // Don't send password in response
        const residentData = {
            _id: newResident._id,
            name: newResident.name,
            email: newResident.email,
            phone: newResident.phone,
            flatNumber: newResident.flatNumber,
            block: newResident.block,
            society: newResident.society,
            superadmin,
            communityadmin,
            role: newResident.role,
            isOwner: newResident.isOwner,
            isActive: newResident.isActive,
            createdAt: newResident.createdAt
        };

        sendResponse(res, 201, 'ResidentModel created successfully', residentData);

    } catch (error) {
        console.error('❌ Create resident error:', error.message);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error during resident creation');
    }
};

// @desc    Get All Residents
// @route   GET /api/residents
// @access  Private (Community Admin only)
exports.getAllResidents = async (req, res) => {
    try {
        console.log('📋 Fetching all residents...');

        const { page = 1, limit = 10, society, search } = req.query;

        // Build filter
        let filter = {};
        if (society) filter.society = society;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { flatNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const residents = await ResidentModel.find(filter)
            .populate('society', 'name address city')
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalCount = await ResidentModel.countDocuments(filter);

        console.log('✅ Found', residents.length, 'residents');

        sendResponse(res, 200, 'Residents retrieved successfully', {
            residents,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });

    } catch (error) {
        console.error('❌ Get all residents error:', error.message);
        sendResponse(res, 500, 'Server error while fetching residents');
    }
};

// @desc    Get Resident Profile (works for both regular and free trial residents)
// @route   GET /api/resident/profile/me
// @access  Private (Resident only)
exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const isFreeTrial = req.user.isFreeTrial;

        console.log('🔍 Fetching resident profile:', { userId, userRole, isFreeTrial });

        let residentData;

        if (isFreeTrial) {
            // Handle Free Trial User
            const freeTrialUser = await FreetrailModel.findById(userId)
                .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

            if (!freeTrialUser) {
                return sendResponse(res, 404, 'Free trial user not found');
            }

            // Format free trial user as resident profile
            residentData = {
                _id: freeTrialUser._id,
                name: freeTrialUser.fullName,
                email: freeTrialUser.email,
                phone: freeTrialUser.phone,
                flatNumber: 'Trial User',
                block: '',
                role: 'resident',
                isOwner: true,
                isActive: freeTrialUser.isActive,
                isFreeTrial: true,
                society: {
                    name: freeTrialUser.societyName,
                    city: freeTrialUser.city,
                    type: freeTrialUser.societyType
                },
                trialInfo: {
                    trialEndsAt: freeTrialUser.trialEndsAt,
                    trialDaysRemaining: freeTrialUser.trialDaysRemaining,
                    emailVerified: freeTrialUser.emailVerified
                },
                createdAt: freeTrialUser.createdAt,
                updatedAt: freeTrialUser.updatedAt
            };

        } else {
            // Handle Regular Resident
            const resident = await ResidentModel.findById(userId)
                .populate('society', 'name address city state pincode')
                .populate('communityadmin', 'name email')
                .select('-password');

            if (!resident) {
                return sendResponse(res, 404, 'Resident not found');
            }

            residentData = {
                _id: resident._id,
                name: resident.name,
                email: resident.email,
                phone: resident.phone,
                flatNumber: resident.flatNumber,
                block: resident.block,
                role: resident.role,
                isOwner: resident.isOwner,
                isActive: resident.isActive,
                isFreeTrial: false,
                society: resident.society,
                profileImage: resident.profileImage,
                dues: resident.dues,
                createdAt: resident.createdAt,
                updatedAt: resident.updatedAt
            };
        }

        console.log('✅ Resident profile found:', residentData.name);
        sendResponse(res, 200, 'Profile retrieved successfully', residentData);

    } catch (error) {
        console.error('❌ Get profile error:', error.message);
        sendResponse(res, 500, 'Server error while fetching profile');
    }
};

// @desc    Get ResidentModel by ID
// @route   GET /api/residents/:id
// @access  Private (Community Admin only)
exports.getResidentById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 Fetching resident by ID:', id);

        const resident = await ResidentModel.findById(id)
            .populate('society', 'name address city state')
            .populate('complaints')
            .select('-password');

        if (!resident) {
            return sendResponse(res, 404, 'ResidentModel not found');
        }

        console.log('✅ ResidentModel found:', resident.name);
        sendResponse(res, 200, 'ResidentModel retrieved successfully', resident);

    } catch (error) {
        console.error('❌ Get resident error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid resident ID');
        }

        sendResponse(res, 500, 'Server error while fetching resident');
    }
};

// @desc    Update ResidentModel
// @route   PUT /api/residents/:id
// @access  Private (Community Admin only)
exports.updateResident = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('✏️ Updating resident:', id);

        const resident = await ResidentModel.findById(id);
        if (!resident) {
            return sendResponse(res, 404, 'ResidentModel not found');
        }

        // Check if email is being updated and if it already exists
        if (updateData.email && updateData.email !== resident.email) {
            const existingResident = await ResidentModel.findOne({
                email: updateData.email.toLowerCase(),
                _id: { $ne: id }
            });
            if (existingResident) {
                return sendResponse(res, 400, 'Email already registered');
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== 'password') {
                resident[key] = updateData[key];
            }
        });

        // Handle password update separately
        if (updateData.password) {
            resident.password = await bcrypt.hash(updateData.password, 12);
            console.log('🔐 Password updated');
        }

        await resident.save();
        console.log('✅ ResidentModel updated successfully');

        // Don't send password in response
        const residentData = resident.toObject();
        delete residentData.password;

        sendResponse(res, 200, 'ResidentModel updated successfully', residentData);

    } catch (error) {
        console.error('❌ Update resident error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid resident ID');
        }

        sendResponse(res, 500, 'Server error while updating resident');
    }
};

// @desc    Delete ResidentModel (Soft Delete)
// @route   DELETE /api/residents/:id
// @access  Private (Community Admin only)
exports.deleteResident = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting resident:', id);

        const resident = await ResidentModel.findById(id);
        if (!resident) {
            return sendResponse(res, 404, 'ResidentModel not found');
        }

        // Soft delete - set isActive to false
        resident.isActive = false;
        await resident.save();

        console.log('✅ ResidentModel deleted (soft delete)');
        sendResponse(res, 200, 'ResidentModel deleted successfully');

    } catch (error) {
        console.error('❌ Delete resident error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid resident ID');
        }

        sendResponse(res, 500, 'Server error while deleting resident');
    }
};

// @desc    Get Residents by Society
// @route   GET /api/residents/society/:societyId
// @access  Private (Community Admin only)
exports.getResidentsBySociety = async (req, res) => {
    try {
        const { societyId } = req.params;
        console.log('🏢 Fetching residents for society:', societyId);

        const residents = await ResidentModel.find({
            society: societyId,
            isActive: true
        })
            .populate('society', 'name city')
            .select('-password')
            .sort({ flatNumber: 1 });

        console.log('✅ Found', residents.length, 'residents for society');
        sendResponse(res, 200, 'Society residents retrieved successfully', residents);

    } catch (error) {
        console.error('❌ Get society residents error:', error.message);
        sendResponse(res, 500, 'Server error while fetching society residents');
    }
};

// @desc    ResidentModel Login
// @route   POST /api/auth/resident-login
// @access  Public
exports.residentLogin = async (req, res) => {
    try {
        console.log('🔐 ResidentModel Login attempt...');
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return sendResponse(res, 400, 'Email and password are required');
        }

        // Find resident by email
        const resident = await ResidentModel.findOne({
            email: email.toLowerCase().trim(),
            isActive: true
        }).populate('society', 'name address city');

        if (!resident) {
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, resident.password);
        if (!isPasswordValid) {
            return sendResponse(res, 401, 'Invalid email or password');
        }

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                userId: resident._id,
                email: resident.email,
                role: resident.role,
                societyId: resident.society?._id
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '30d' }
        );

        console.log('✅ ResidentModel login successful:', resident.email);

        // Prepare response data
        const residentData = {
            _id: resident._id,
            name: resident.name,
            email: resident.email,
            phone: resident.phone,
            flatNumber: resident.flatNumber,
            block: resident.block,
            role: resident.role,
            society: resident.society,
            isOwner: resident.isOwner,
            isActive: resident.isActive,
            createdAt: resident.createdAt
        };

        sendResponse(res, 200, 'Login successful', {
            user: residentData,
            token: token
        });

    } catch (error) {
        console.error('❌ ResidentModel login error:', error.message);
        sendResponse(res, 500, 'Server error during login');
    }
};

// @desc    Get ResidentModel Statistics
// @route   GET /api/residents/stats/overview
// @access  Private (Community Admin only)
exports.getResidentStats = async (req, res) => {
    try {
        const { societyId } = req.query;

        let filter = { isActive: true };
        if (societyId) filter.society = societyId;

        const totalResidents = await ResidentModel.countDocuments(filter);
        const owners = await ResidentModel.countDocuments({ ...filter, isOwner: true });
        const tenants = await ResidentModel.countDocuments({ ...filter, isOwner: false });

        // Residents with dues (example logic)
        const residentsWithDues = await ResidentModel.countDocuments({
            ...filter,
            dues: { $gt: 0 }
        });

        const stats = {
            totalResidents,
            owners,
            tenants,
            residentsWithDues,
            ownerPercentage: totalResidents > 0 ? Math.round((owners / totalResidents) * 100) : 0,
            tenantPercentage: totalResidents > 0 ? Math.round((tenants / totalResidents) * 100) : 0
        };

        sendResponse(res, 200, 'ResidentModel statistics retrieved successfully', stats);

    } catch (error) {
        console.error('❌ Get resident stats error:', error.message);
        sendResponse(res, 500, 'Server error while fetching resident statistics');
    }
};