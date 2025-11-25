// const SocietyModel = require('../models/Society.model');

const SocietiModel = require("../models/Societi.model");

// Send Response Utility
const sendResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message
    };

    if (data) response.data = data;

    res.status(statusCode).json(response);
};

// @desc    Create New Society
// @route   POST /api/societies/create
// @access  Private (Super Admin only)
exports.createSociety = async (req, res) => {
    try {
        const {
            name,
            address,
            city,
            state,
            pincode,
            totalFlats,
            contactPerson,
            contactEmail,
            contactPhone,
            amenities,
            status
        } = req.body;

        // Validate required fields
        const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'totalFlats', 'contactPerson', 'contactEmail', 'contactPhone'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return sendResponse(res, 400, `Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check if society with same name already exists in the same city
        const existingSociety = await SocietiModel.findOne({
            name: name.trim(),
            city: city.trim(),
            isActive: true
        });

        if (existingSociety) {
            return sendResponse(res, 400, 'A society with this name already exists in the same city');
        }

        // Check if contact email already exists
        const existingEmail = await SocietiModel.findOne({
            contactEmail: contactEmail.toLowerCase(),
            isActive: true
        });

        if (existingEmail) {
            return sendResponse(res, 400, 'A society with this contact email already exists');
        }

        // Check if contact phone already exists
        const existingPhone = await SocietiModel.findOne({
            contactPhone,
            isActive: true
        });

        if (existingPhone) {
            return sendResponse(res, 400, 'A society with this contact phone already exists');
        }

        // Create new society
        const society = await SocietiModel.create({
            name: name.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            pincode: pincode.trim(),
            totalFlats: parseInt(totalFlats),
            contactPerson: contactPerson.trim(),
            contactEmail: contactEmail.toLowerCase().trim(),
            contactPhone: contactPhone.trim(),
            amenities: amenities ? (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : [],
            status: status || 'Active',
            createdBy: req.user.userId // From auth middleware
        });

        // Populate createdBy field
        await society.populate('createdBy', 'name email');

        sendResponse(res, 201, 'Society created successfully', {
            id: society._id,
            name: society.name,
            address: society.address,
            city: society.city,
            state: society.state,
            pincode: society.pincode,
            totalFlats: society.totalFlats,
            contactPerson: society.contactPerson,
            contactEmail: society.contactEmail,
            contactPhone: society.contactPhone,
            amenities: society.amenities,
            status: society.status,
            formattedAddress: society.formattedAddress,
            createdBy: society.createdBy,
            createdAt: society.createdAt
        });

    } catch (error) {
        console.error('Create Society Error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        if (error.code === 11000) {
            return sendResponse(res, 400, 'Society with similar details already exists');
        }

        sendResponse(res, 500, 'Server error during society creation');
    }
};

// @desc    Get All Societies
// @route   GET /api/societies
// @access  Private (Super Admin only)
exports.getAllSocieties = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Build filter object
        const filter = { isActive: true };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } },
                { contactEmail: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            filter.status = status;
        }

        // Sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const societies = await SocietiModel.find(filter)
            .populate('createdBy', 'name email')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v');

        // Get total count for pagination
        const totalCount = await SocietiModel.countDocuments(filter);

        sendResponse(res, 200, 'Societies retrieved successfully', {
            societies,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get All Societies Error:', error);
        sendResponse(res, 500, 'Server error while fetching societies');
    }
};

// @desc    Get Society by ID
// @route   GET /api/societies/:id
// @access  Private (Super Admin only)
exports.getSocietyById = async (req, res) => {
    try {
        const { id } = req.params;

        const society = await SocietiModel.findById(id)
            .populate('createdBy', 'name email')
            .select('-__v');

        if (!society) {
            return sendResponse(res, 404, 'Society not found');
        }

        if (!society.isActive) {
            return sendResponse(res, 404, 'Society has been deleted');
        }

        sendResponse(res, 200, 'Society retrieved successfully', society);

    } catch (error) {
        console.error('Get Society Error:', error);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid society ID');
        }

        sendResponse(res, 500, 'Server error while fetching society');
    }
};

// @desc    Update Society
// @route   PUT /api/societies/:id
// @access  Private (Super Admin only)
exports.updateSociety = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Find society
        const society = await SocietiModel.findById(id);

        if (!society) {
            return sendResponse(res, 404, 'Society not found');
        }

        if (!society.isActive) {
            return sendResponse(res, 404, 'Society has been deleted');
        }

        // Check for duplicate name in same city
        if (updateData.name && updateData.city) {
            const existingSociety = await SocietiModel.findOne({
                name: updateData.name.trim(),
                city: updateData.city.trim(),
                _id: { $ne: id },
                isActive: true
            });

            if (existingSociety) {
                return sendResponse(res, 400, 'A society with this name already exists in the same city');
            }
        }

        // Check for duplicate contact email
        if (updateData.contactEmail) {
            const existingEmail = await SocietiModel.findOne({
                contactEmail: updateData.contactEmail.toLowerCase(),
                _id: { $ne: id },
                isActive: true
            });

            if (existingEmail) {
                return sendResponse(res, 400, 'A society with this contact email already exists');
            }
        }

        // Check for duplicate contact phone
        if (updateData.contactPhone) {
            const existingPhone = await SocietiModel.findOne({
                contactPhone: updateData.contactPhone,
                _id: { $ne: id },
                isActive: true
            });

            if (existingPhone) {
                return sendResponse(res, 400, 'A society with this contact phone already exists');
            }
        }

        // Update society
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                society[key] = updateData[key];
            }
        });

        await society.save();
        await society.populate('createdBy', 'name email');

        sendResponse(res, 200, 'Society updated successfully', society);

    } catch (error) {
        console.error('Update Society Error:', error);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid society ID');
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error while updating society');
    }
};

// @desc    Delete Society (Soft Delete)
// @route   DELETE /api/societies/:id
// @access  Private (Super Admin only)
exports.deleteSociety = async (req, res) => {
    try {
        const { id } = req.params;

        const society = await SocietiModel.findById(id);

        if (!society) {
            return sendResponse(res, 404, 'Society not found');
        }

        if (!society.isActive) {
            return sendResponse(res, 404, 'Society already deleted');
        }

        // Soft delete
        society.isActive = false;
        await society.save();

        sendResponse(res, 200, 'Society deleted successfully');

    } catch (error) {
        console.error('Delete Society Error:', error);

        if (error.name === 'CastError') {
            return sendResponse(res, 400, 'Invalid society ID');
        }

        sendResponse(res, 500, 'Server error while deleting society');
    }
};

// @desc    Get Society Statistics
// @route   GET /api/societies/stats/overview
// @access  Private (Super Admin only)
exports.getSocietyStats = async (req, res) => {
    try {
        const totalSocieties = await SocietyModel.countDocuments({ isActive: true });
        const activeSocieties = await SocietyModel.countDocuments({ status: 'Active', isActive: true });
        const inactiveSocieties = await SocietyModel.countDocuments({ status: 'Inactive', isActive: true });
        const pendingSocieties = await SocietyModel.countDocuments({ status: 'Pending', isActive: true });

        // Recent societies (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentSocieties = await SocietyModel.countDocuments({
            createdAt: { $gte: sevenDaysAgo },
            isActive: true
        });

        sendResponse(res, 200, 'Statistics retrieved successfully', {
            totalSocieties,
            activeSocieties,
            inactiveSocieties,
            pendingSocieties,
            recentSocieties
        });

    } catch (error) {
        console.error('Get Society Stats Error:', error);
        sendResponse(res, 500, 'Server error while fetching statistics');
    }
};