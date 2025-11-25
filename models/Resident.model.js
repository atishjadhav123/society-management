const mongoose = require("mongoose");

const residentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Resident name is required'],
        trim: true,
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
    flatNumber: {
        type: String,
        required: [true, 'Flat / Unit number is required'],
        trim: true
    },
    block: {
        type: String,
        trim: true,
        default: ''
    },
    role: {
        type: String,
        enum: ['resident'],
        default: 'resident'
    },
    society: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: [true, 'Society reference is required']
    },
    superadmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmin',
        // required: false
    },
    communityadmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityAdmin',
        // required: [true, 'Society reference is required']
    },
    // complaints: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Complaint'
    // }],
    dues: {
        type: Number,
        default: 0
    },
    isOwner: {
        type: Boolean,
        default: true // if tenant, set to false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profileImage: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Indexes for performance
residentSchema.index({ email: 1 });
residentSchema.index({ phone: 1 });
residentSchema.index({ society: 1 });

// Method to check if resident is active
residentSchema.methods.isResidentActive = function () {
    return this.isActive;
};

// Static method to get all residents of a society
residentSchema.statics.getResidentsBySociety = function (societyId) {
    return this.find({ society: societyId });
};

module.exports = mongoose.model("Resident", residentSchema);
