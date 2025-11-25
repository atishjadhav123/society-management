const mongoose = require("mongoose");

const securityGuardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Security guard name is required'],
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
    employeeId: {
        type: String,
        required: [true, 'Employee ID is required'],
        unique: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['security_guard'],
        default: 'security_guard'
    },
    society: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society',
        required: [true, 'Society reference is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityAdmin',
        required: [true, 'Created by Community Admin is required']
    },
    shift: {
        type: String,
        enum: ['morning', 'evening', 'night', 'general'],
        default: 'general'
    },
    shiftTiming: {
        start: { type: String, default: '08:00' },
        end: { type: String, default: '20:00' }
    },
    duties: {
        type: [String],
        enum: [
            'gate_security',
            'patrolling',
            'cctv_monitoring',
            'visitor_management',
            'emergency_response',
            'parking_management'
        ],
        default: ['gate_security']
    },
    salary: {
        type: Number,
        default: 0
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    aadharNumber: {
        type: String,
        match: [/^\d{12}$/, 'Please enter a valid 12-digit Aadhar number']
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profileImage: {
        type: String,
        default: ''
    },
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    }
}, {
    timestamps: true
});

// Indexes for performance
securityGuardSchema.index({ email: 1 });
securityGuardSchema.index({ phone: 1 });
securityGuardSchema.index({ employeeId: 1 });
securityGuardSchema.index({ society: 1 });
securityGuardSchema.index({ createdBy: 1 });
securityGuardSchema.index({ isActive: 1 });

// Method to check if security guard is active
securityGuardSchema.methods.isGuardActive = function () {
    return this.isActive;
};

// Static method to get all active security guards of a society
securityGuardSchema.statics.getGuardsBySociety = function (societyId) {
    return this.find({ society: societyId, isActive: true });
};

// Static method to get guards by shift
securityGuardSchema.statics.getGuardsByShift = function (shift) {
    return this.find({ shift: shift, isActive: true });
};

// Generate employee ID before saving
securityGuardSchema.pre('save', async function (next) {
    if (!this.employeeId) {
        const count = await this.constructor.countDocuments();
        this.employeeId = `SG${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model("SecurityGuard", securityGuardSchema);