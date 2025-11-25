// controller/complaint.controller.js
// const complaintsModel = require('../models/complaints.model');
const complaintsModel = require('../models/complaints.model');
const FreetrailModel = require('../models/Freetrail.model');
const ResidentModel = require('../models/Resident.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// Response helper
const sendResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message,
    };
    if (data) response.data = data;
    res.status(statusCode).json(response);
};

// --------------------- Create Complaint (Both Free Trial & Regular Residents) ---------------------
// --------------------- Create Complaint (Both Free Trial & Regular Residents) ---------------------
exports.createComplaint = async (req, res) => {
    try {
        console.log('📝 Creating new complaint...');
        console.log('👤 User:', req.user); // Debug user info

        // Body fields
        const { title, description, category, priority } = req.body;
        const userId = req.user.userId; // from auth middleware
        const isFreeTrial = req.user.isFreeTrial; // Check if free trial user

        // Basic validation
        if (!title || !description || !category) {
            return sendResponse(res, 400, 'Title, description and category are required');
        }

        let residentInfo;
        let societyInfo;

        // ✅ Handle both free trial and regular residents
        if (isFreeTrial) {
            // Free Trial User
            console.log('🔍 Fetching free trial user:', userId);
            const freeTrialUser = await FreetrailModel.findById(userId);

            if (!freeTrialUser) {
                return sendResponse(res, 404, 'Free trial user not found');
            }

            // Check if trial is still active
            if (!freeTrialUser.isTrialActive()) {
                return sendResponse(res, 403, 'Your free trial has ended. Please upgrade to create complaints.');
            }

            residentInfo = {
                _id: freeTrialUser._id,
                name: freeTrialUser.fullName,
                flatNumber: 'Trial User'
            };

            // ✅ FIX: Store society info as STRING, not object
            societyInfo = `${freeTrialUser.societyName}, ${freeTrialUser.city}`;

            console.log('✅ Free trial user found:', freeTrialUser.fullName);

        } else {
            // Regular Resident
            console.log('🔍 Fetching regular resident:', userId);
            const resident = await ResidentModel.findById(userId);

            if (!resident) {
                return sendResponse(res, 404, 'Resident not found');
            }

            residentInfo = {
                _id: resident._id,
                name: resident.name,
                flatNumber: resident.flatNumber
            };

            societyInfo = resident.society; // This is ObjectId, will be populated later

            console.log('✅ Regular resident found:', resident.name);
        }

        // Upload images (if any) using Cloudinary util
        let uploadedImages = [];
        if (req.files && req.files.length > 0) {
            uploadedImages = await uploadToCloudinary(req.files);
            // uploadedImages is array of { secure_url, public_id }
        }

        // Map to schema shape
        const imagesForDb = uploadedImages.map((u) => ({ url: u.secure_url, public_id: u.public_id }));

        // Create complaint data
        const complaintData = {
            title: title.trim(),
            description: description.trim(),
            category,
            priority: priority || 'medium',
            images: imagesForDb,
            raisedBy: userId,
            raisedByType: isFreeTrial ? 'free_trial' : 'resident', // Track user type
            status: 'pending',
        };

        // Add society information based on user type
        if (isFreeTrial) {
            // ✅ FIX: For free trial users, store society info as STRING
            complaintData.societyInfo = societyInfo; // This is now a string
        } else {
            // For regular residents, use society reference
            complaintData.society = societyInfo;
        }

        console.log('📋 Complaint data:', complaintData);

        // Create complaint
        const newComplaint = await complaintsModel.create(complaintData);

        // Populate for response based on user type
        let populatedComplaint;
        if (isFreeTrial) {
            populatedComplaint = await complaintsModel.findById(newComplaint._id);
            // Manually add resident and society info for free trial users
            populatedComplaint = {
                ...populatedComplaint.toObject(),
                raisedBy: residentInfo,
                society: { name: societyInfo } // Convert back to object for response
            };
        } else {
            populatedComplaint = await complaintsModel.findById(newComplaint._id)
                .populate('raisedBy', 'name flatNumber')
                .populate('society', 'name');
        }

        console.log('✅ Complaint created by', isFreeTrial ? 'free trial user' : 'regular resident', ':', newComplaint._id);
        return sendResponse(res, 201, 'Complaint raised successfully', populatedComplaint);
    } catch (error) {
        console.error('❌ Create complaint error:', error);

        // If images uploaded but DB create failed, delete the uploaded images (rollback)
        if (error && error.uploadedPublicIds && Array.isArray(error.uploadedPublicIds)) {
            await deleteFromCloudinary(error.uploadedPublicIds);
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map((err) => err.message);
            return sendResponse(res, 400, errors.join(', '));
        }

        sendResponse(res, 500, 'Server error during complaint creation');
    }
};

// --------------------- Get Resident's Complaints (Both Types) ---------------------
exports.getMyComplaints = async (req, res) => {
    try {
        const userId = req.user.userId;
        const isFreeTrial = req.user.isFreeTrial;
        const { status = 'all', page = 1, limit = 10 } = req.query;

        console.log('📋 Fetching complaints for user:', { userId, isFreeTrial });

        let filter = { raisedBy: userId };
        if (status && status !== 'all') filter.status = status;

        const complaints = await complaintsModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        // Manually populate based on user type
        const populatedComplaints = complaints.map(complaint => {
            const complaintObj = complaint.toObject();

            if (complaint.raisedByType === 'free_trial') {
                // For free trial complaints, use stored societyInfo
                return {
                    ...complaintObj,
                    society: complaint.societyInfo || { name: 'Demo Society' }
                };
            } else {
                // For regular residents, we need to populate society
                // This is a simplified version - you might want to actually populate
                return complaintObj;
            }
        });

        const totalCount = await complaintsModel.countDocuments(filter);

        sendResponse(res, 200, 'Complaints retrieved successfully', {
            complaints: populatedComplaints,
            userType: isFreeTrial ? 'free_trial' : 'resident',
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalCount,
            },
        });
    } catch (error) {
        console.error('❌ Get complaints error:', error);
        sendResponse(res, 500, 'Server error while fetching complaints');
    }
};

// --------------------- Get Complaint by ID (Both Types) ---------------------
exports.getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        const isFreeTrial = req.user.isFreeTrial;

        console.log('🔍 Fetching complaint:', id);

        const complaint = await complaintsModel.findById(id);

        if (!complaint) return sendResponse(res, 404, 'Complaint not found');

        // Permission check for residents
        if (userRole === 'resident' && complaint.raisedBy.toString() !== userId) {
            return sendResponse(res, 403, 'Access denied');
        }

        // Populate based on complaint type
        let populatedComplaint = complaint.toObject();

        if (complaint.raisedByType === 'free_trial') {
            // Get free trial user info
            const freeTrialUser = await FreetrailModel.findById(complaint.raisedBy)
                .select('fullName phone');

            populatedComplaint.raisedBy = freeTrialUser ? {
                _id: freeTrialUser._id,
                name: freeTrialUser.fullName,
                flatNumber: 'Trial User',
                phone: freeTrialUser.phone
            } : { name: 'Free Trial User', flatNumber: 'Trial User' };

            populatedComplaint.society = complaint.societyInfo || {
                name: 'Demo Society',
                address: 'Demo Address'
            };

        } else {
            // For regular residents, populate normally
            const resident = await ResidentModel.findById(complaint.raisedBy)
                .select('name flatNumber phone')
                .populate('society', 'name address city');

            if (resident) {
                populatedComplaint.raisedBy = {
                    _id: resident._id,
                    name: resident.name,
                    flatNumber: resident.flatNumber,
                    phone: resident.phone
                };
                populatedComplaint.society = resident.society;
            }
        }

        sendResponse(res, 200, 'Complaint retrieved successfully', populatedComplaint);
    } catch (error) {
        console.error('❌ Get complaint error:', error);
        if (error.name === 'CastError') return sendResponse(res, 400, 'Invalid complaint ID');
        sendResponse(res, 500, 'Server error while fetching complaint');
    }
};

// --------------------- Update Complaint (Both Types) ---------------------
exports.updateComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const updaterId = req.user.userId;
        const updaterRole = req.user.role;
        const isFreeTrial = req.user.isFreeTrial;

        const complaint = await complaintsModel.findById(id);
        if (!complaint) return sendResponse(res, 404, 'Complaint not found');

        // Permission check:
        if (updaterRole === 'resident' && complaint.raisedBy.toString() !== updaterId) {
            return sendResponse(res, 403, 'Access denied');
        }

        // Free trial users can only update their own complaints and only certain fields
        if (isFreeTrial && complaint.raisedBy.toString() !== updaterId) {
            return sendResponse(res, 403, 'Access denied');
        }

        // Process deletion of specified images
        let removedPublicIds = [];
        if (req.body.removeImageIds) {
            let toRemove;
            try {
                toRemove = typeof req.body.removeImageIds === 'string' ? JSON.parse(req.body.removeImageIds) : req.body.removeImageIds;
            } catch (err) {
                toRemove = req.body.removeImageIds;
            }
            if (Array.isArray(toRemove) && toRemove.length > 0) {
                await deleteFromCloudinary(toRemove);
                removedPublicIds = toRemove;
                complaint.images = complaint.images.filter((img) => !toRemove.includes(img.public_id));
            }
        }

        // Upload new images
        if (req.files && req.files.length > 0) {
            const uploaded = await uploadToCloudinary(req.files);
            const uploadedForDb = uploaded.map((u) => ({ url: u.secure_url, public_id: u.public_id }));
            complaint.images = complaint.images.concat(uploadedForDb);
        }

        // Update fields - restrict free trial users to certain fields
        const updatableFields = ['title', 'description', 'category', 'priority'];

        // Admins can update more fields
        if (updaterRole !== 'resident') {
            updatableFields.push('status', 'resolutionNotes', 'assignedTo', 'resolvedAt');
        }

        updatableFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                complaint[field] = req.body[field];
            }
        });

        // Auto-set resolvedAt for admins
        if (req.body.status === 'resolved' && !complaint.resolvedAt && updaterRole !== 'resident') {
            complaint.resolvedAt = new Date();
        }

        await complaint.save();

        sendResponse(res, 200, 'Complaint updated successfully', complaint);
    } catch (error) {
        console.error('❌ Update complaint error:', error);
        return sendResponse(res, 500, 'Server error while updating complaint');
    }
};

// --------------------- Delete Complaint (Both Types) ---------------------
exports.deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.user.userId;
        const requesterRole = req.user.role;
        const isFreeTrial = req.user.isFreeTrial;

        const complaint = await complaintsModel.findById(id);
        if (!complaint) return sendResponse(res, 404, 'Complaint not found');

        // Permissions:
        if (requesterRole === 'resident' && complaint.raisedBy.toString() !== requesterId) {
            return sendResponse(res, 403, 'Access denied');
        }

        // Free trial users can only delete their own complaints
        if (isFreeTrial && complaint.raisedBy.toString() !== requesterId) {
            return sendResponse(res, 403, 'Access denied');
        }

        // Delete images from Cloudinary
        const publicIds = complaint.images.map((img) => img.public_id).filter(Boolean);
        if (publicIds.length > 0) {
            await deleteFromCloudinary(publicIds);
        }

        await complaintsModel.findByIdAndDelete(id);
        return sendResponse(res, 200, 'Complaint deleted successfully');
    } catch (error) {
        console.error('❌ Delete complaint error:', error);
        return sendResponse(res, 500, 'Server error while deleting complaint');
    }
};