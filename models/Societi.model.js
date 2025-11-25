const mongoose = require("mongoose");

const societySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Society name is required'],
        trim: true,
        maxlength: [100, 'Society name cannot exceed 100 characters']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    },
    state: {
        type: String,
        required: [true, 'State is required'],
        trim: true
    },
    pincode: {
        type: String,
        required: [true, 'PIN code is required'],
        match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code']
    },
    totalFlats: {
        type: Number,
        required: [true, 'Total flats is required'],
        min: [1, 'Total flats must be at least 1']
    },
    contactPerson: {
        type: String,
        required: [true, 'Contact person name is required'],
        trim: true
    },
    contactEmail: {
        type: String,
        required: [true, 'Contact email is required'],
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    contactPhone: {
        type: String,
        required: [true, 'Contact phone is required'],
        match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
    },
    amenities: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Pending'],
        default: 'Active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuperAdmin',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for better query performance
societySchema.index({ name: 1 });
societySchema.index({ city: 1 });
societySchema.index({ status: 1 });
societySchema.index({ createdBy: 1 });

// Virtual for formatted address
societySchema.virtual('formattedAddress').get(function () {
    return `${this.address}, ${this.city}, ${this.state} - ${this.pincode}`;
});

// Method to check if society is active
societySchema.methods.isSocietyActive = function () {
    return this.status === 'Active' && this.isActive;
};

// Static method to get active societies
societySchema.statics.getActiveSocieties = function () {
    return this.find({ status: 'Active', isActive: true });
};

module.exports = mongoose.model("Society", societySchema);