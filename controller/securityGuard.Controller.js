const bcrypt = require('bcryptjs');
const SecurityGardModel = require('../models/SecurityGard.model');
const CommunityAdminModel = require('../models/CommunityAdmin.model');
const SocietiModel = require('../models/Societi.model');


// Response helper
const sendResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message
    };
    if (data) response.data = data;
    res.status(statusCode).json(response);
};

// @desc    Create Security Guard
// @route   POST /api/security-guards/create
// @access  Private (Community Admin only)
exports.createSecurityGuard = async (req, res) => {
    try {
        console.log('🛡️ Creating security guard...');

        const {
            name,
            email,
            phone,
            password,
            employeeId,
            society,
            shift = 'general',
            shiftTiming = { start: '08:00', end: '20:00' },
            duties = ['gate_security'],
            salary = 0,
            address,
            aadharNumber,
            joiningDate,
            emergencyContact
        } = req.body;

        const createdBy = req.user.userId; // From auth middleware

        // Check required fields
        if (!name || !email || !phone || !password || !society) {
            return sendResponse(res, 400, 'Name, email, phone, password, and society are required');
        }

        // Check if email already exists
        const existingGuard = await SecurityGardModel.findOne({ email: email.toLowerCase() });
        if (existingGuard) {
            return sendResponse(res, 400, 'Email already registered');
        }

        // Check if phone already exists
        const existingPhone = await SecurityGardModel.findOne({ phone });
        if (existingPhone) {
            return sendResponse(res, 400, 'Phone number already registered');
        }

        // Check if society exists
        const societyExists = await SocietiModel.findById(society);
        if (!societyExists) {
            return sendResponse(res, 400, 'SocietiModel not found');
        }

        // Check if createdBy (community admin) exists
        const adminExists = await CommunityAdminModel.findById(createdBy);
        if (!adminExists) {
            return sendResponse(res, 400, 'Community admin not found');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create security guard
        const newSecurityGuard = await SecurityGardModel.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password: hashedPassword,
            employeeId: employeeId?.trim(),
            society: society,
            createdBy: createdBy,
            shift: shift,
            shiftTiming: shiftTiming,
            duties: duties,
            salary: salary,
            address: address,
            aadharNumber: aadharNumber,
            joiningDate: joiningDate,
            emergencyContact: emergencyContact
        });

        console.log('✅ Security guard created:', newSecurityGuard._id);

        // Don't send password in response
        const guardData = {
            _id: newSecurityGuard._id,
            name: newSecurityGuard.name,
            email: newSecurityGuard.email,
            phone: newSecurityGuard.phone,
            employeeId: newSecurityGuard.employeeId,
            role: newSecurityGuard.role,
            society: newSecurityGuard.society,
            shift: newSecurityGuard.shift,
            shiftTiming: newSecurityGuard.shiftTiming,
            duties: newSecurityGuard.duties,
            salary: newSecurityGuard.salary,
            address: newSecurityGuard.address,
            joiningDate: newSecurityGuard.joiningDate,
            emergencyContact: newSecurityGuard.emergencyContact,
            isActive: newSecurityGuard.isActive,
            createdAt: newSecurityGuard.createdAt
        };

        sendResponse(res, 201, 'Security guard created successfully', guardData);

    } catch (error) {
        console.error('❌ Create security guard error:', error.message);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        if (error.code === 11000) {
            if (error.keyPattern.email) {
                return sendResponse(res, 400, 'Email already exists');
            }
            if (error.keyPattern.employeeId) {
                return sendResponse(res, 400, 'Employee ID already exists');
            }
        }

        sendResponse(res, 500, 'Server error during security guard creation');
    }
};

// @desc    Get All Security Guards
// @route   GET /api/security-guards
// @access  Private (Community Admin only)
exports.getAllSecurityGuards = async (req, res) => {
    try {
        console.log('📋 Fetching all security guards...');

        const { page = 1, limit = 10, society, shift, search } = req.query;

        // Build filter
        let filter = {};
        if (society) filter.society = society;
        if (shift) filter.shift = shift;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } }
            ];
        }

        const guards = await SecurityGardModel.find(filter)
            .populate('society', 'name address city')
            .populate('createdBy', 'name email')
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalCount = await SecurityGardModel.countDocuments(filter);

        console.log('✅ Found', guards.length, 'security guards');

        sendResponse(res, 200, 'Security guards retrieved successfully', {
            guards,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount
            }
        });

    } catch (error) {
        console.error('❌ Get all security guards error:', error.message);
        sendResponse(res, 500, 'Server error while fetching security guards');
    }
};

// @desc    Get Security Guard by ID
// @route   GET /api/security-guards/:id
// @access  Private (Community Admin only)
exports.getSecurityGuardById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 Fetching security guard by ID:', id);

        const guard = await SecurityGardModel.findById(id)
            .populate('society', 'name address city state')
            .populate('createdBy', 'name email')
            .select('-password');

        if (!guard) {
            return sendResponse(res, 404, 'Security guard not found');
        }

        console.log('✅ Security guard found:', guard.name);
        sendResponse(res, 200, 'Security guard retrieved successfully', guard);

    } catch (error) {
        console.error('❌ Get security guard error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid security guard ID');
        }

        sendResponse(res, 500, 'Server error while fetching security guard');
    }
};

// @desc    Update Security Guard
// @route   PUT /api/security-guards/:id
// @access  Private (Community Admin only)
exports.updateSecurityGuard = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        console.log('✏️ Updating security guard:', id);

        const guard = await SecurityGardModel.findById(id);
        if (!guard) {
            return sendResponse(res, 404, 'Security guard not found');
        }

        // Check if email is being updated and if it already exists
        if (updateData.email && updateData.email !== guard.email) {
            const existingGuard = await SecurityGardModel.findOne({
                email: updateData.email.toLowerCase(),
                _id: { $ne: id }
            });
            if (existingGuard) {
                return sendResponse(res, 400, 'Email already registered');
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== 'password') {
                guard[key] = updateData[key];
            }
        });

        // Handle password update separately
        if (updateData.password) {
            guard.password = await bcrypt.hash(updateData.password, 12);
            console.log('🔐 Password updated');
        }

        await guard.save();
        console.log('✅ Security guard updated successfully');

        // Don't send password in response
        const guardData = guard.toObject();
        delete guardData.password;

        sendResponse(res, 200, 'Security guard updated successfully', guardData);

    } catch (error) {
        console.error('❌ Update security guard error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid security guard ID');
        }

        sendResponse(res, 500, 'Server error while updating security guard');
    }
};

// @desc    Delete Security Guard (Soft Delete)
// @route   DELETE /api/security-guards/:id
// @access  Private (Community Admin only)
exports.deleteSecurityGuard = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🗑️ Deleting security guard:', id);

        const guard = await SecurityGardModel.findById(id);
        if (!guard) {
            return sendResponse(res, 404, 'Security guard not found');
        }

        // Soft delete - set isActive to false
        guard.isActive = false;
        await guard.save();

        console.log('✅ Security guard deleted (soft delete)');
        sendResponse(res, 200, 'Security guard deleted successfully');

    } catch (error) {
        console.error('❌ Delete security guard error:', error.message);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid security guard ID');
        }

        sendResponse(res, 500, 'Server error while deleting security guard');
    }
};

// @desc    Get Security Guards by SocietiModel
// @route   GET /api/security-guards/society/:societyId
// @access  Private (Community Admin only)
exports.getGuardsBySociety = async (req, res) => {
    try {
        const { societyId } = req.params;
        console.log('🏢 Fetching guards for society:', societyId);

        const guards = await SecurityGardModel.find({
            society: societyId,
            isActive: true
        })
            .populate('society', 'name city')
            .populate('createdBy', 'name email')
            .select('-password')
            .sort({ shift: 1, name: 1 });

        console.log('✅ Found', guards.length, 'guards for society');
        sendResponse(res, 200, 'SocietiModel guards retrieved successfully', guards);

    } catch (error) {
        console.error('❌ Get society guards error:', error.message);
        sendResponse(res, 500, 'Server error while fetching society guards');
    }
};

// @desc    Security Guard Login
// @route   POST /api/auth/security-guard-login
// @access  Public
exports.securityGuardLogin = async (req, res) => {
    try {
        console.log('🔐 Security Guard Login attempt...');
        const { email, password, employeeId } = req.body;

        // Check required fields
        if ((!email && !employeeId) || !password) {
            return sendResponse(res, 400, 'Email/Employee ID and password are required');
        }

        // Find security guard by email or employeeId
        let guard;
        if (email) {
            guard = await SecurityGardModel.findOne({
                email: email.toLowerCase().trim(),
                isActive: true
            }).populate('society', 'name address city');
        } else {
            guard = await SecurityGardModel.findOne({
                employeeId: employeeId.trim(),
                isActive: true
            }).populate('society', 'name address city');
        }

        if (!guard) {
            return sendResponse(res, 401, 'Invalid credentials');
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, guard.password);
        if (!isPasswordValid) {
            return sendResponse(res, 401, 'Invalid credentials');
        }

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                userId: guard._id,
                email: guard.email,
                role: guard.role,
                societyId: guard.society?._id
            },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '30d' }
        );

        console.log('✅ Security guard login successful:', guard.email);

        // Prepare response data
        const guardData = {
            _id: guard._id,
            name: guard.name,
            email: guard.email,
            phone: guard.phone,
            employeeId: guard.employeeId,
            role: guard.role,
            society: guard.society,
            shift: guard.shift,
            shiftTiming: guard.shiftTiming,
            duties: guard.duties,
            isActive: guard.isActive,
            createdAt: guard.createdAt
        };

        sendResponse(res, 200, 'Login successful', {
            user: guardData,
            token: token
        });

    } catch (error) {
        console.error('❌ Security guard login error:', error.message);
        sendResponse(res, 500, 'Server error during login');
    }
};

// @desc    Get Security Guard Statistics
// @route   GET /api/security-guards/stats/overview
// @access  Private (Community Admin only)
exports.getSecurityGuardStats = async (req, res) => {
    try {
        const { societyId } = req.query;

        let filter = { isActive: true };
        if (societyId) filter.society = societyId;

        const totalGuards = await SecurityGardModel.countDocuments(filter);
        const morningShift = await SecurityGardModel.countDocuments({ ...filter, shift: 'morning' });
        const eveningShift = await SecurityGardModel.countDocuments({ ...filter, shift: 'evening' });
        const nightShift = await SecurityGardModel.countDocuments({ ...filter, shift: 'night' });
        const generalShift = await SecurityGardModel.countDocuments({ ...filter, shift: 'general' });

        const stats = {
            totalGuards,
            shiftDistribution: {
                morning: morningShift,
                evening: eveningShift,
                night: nightShift,
                general: generalShift
            },
            activeGuards: totalGuards
        };

        sendResponse(res, 200, 'Security guard statistics retrieved successfully', stats);

    } catch (error) {
        console.error('❌ Get security guard stats error:', error.message);
        sendResponse(res, 500, 'Server error while fetching security guard statistics');
    }
};