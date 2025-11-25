const mongoose = require("mongoose");

const communityAdminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Community admin name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    role: {
        type: String,
        enum: ['community_admin'],
        default: 'community_admin'
    },
    society: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        default: [true, 'Society reference is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmin',
        // required: [true, 'Created by SuperAdmin is required']
    },
    permissions: {
        type: [String],
        enum: [
            'manage_residents',
            'manage_complaints',
            'manage_notices',
            'manage_payments',
            'manage_amenities',
            'view_reports',
            'manage_staff',
            'manage_events'
        ],
        default: ['manage_residents', 'manage_complaints', 'manage_notices']
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for better query performance
communityAdminSchema.index({ email: 1 });
communityAdminSchema.index({ society: 1 });
communityAdminSchema.index({ createdBy: 1 });

// Method to check active admin
communityAdminSchema.methods.isAdminActive = function () {
    return this.isActive;
};

// Static method to get all active community admins
communityAdminSchema.statics.getActiveAdmins = function () {
    return this.find({ isActive: true });
};

module.exports = mongoose.model("CommunityAdmin", communityAdminSchema);
