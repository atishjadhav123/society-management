const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const freeTrialUserSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    societyName: {
        type: String,
        required: [true, 'Society name is required'],
        trim: true,
        maxlength: [200, 'Society name cannot be more than 200 characters']
    },
    societyType: {
        type: String,
        required: [true, 'Society type is required'],
        enum: [
            'Residential Apartment',
            'Gated Community',
            'Co-operative Housing',
            'Township',
            'Other'
        ]
    },
    totalFlats: {
        type: String,
        required: [true, 'Total flats is required'],
        enum: ['1-50', '51-100', '101-200', '201-500', '501+']
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City cannot be more than 100 characters']
    },
    role: {
        type: String,
        required: [true, 'Role is required'],
        enum: [
            'Secretary',
            'Treasurer',
            'Chairman',
            'Committee Member',
            'resident',
            'Property Manager'
        ]
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long']
    },
    agreeTerms: {
        type: Boolean,
        required: [true, 'You must agree to terms and conditions'],
        default: false,
        validate: {
            validator: function (value) {
                return value === true;
            },
            message: 'You must agree to terms and conditions'
        }
    },
    receiveUpdates: {
        type: Boolean,
        default: true
    },
    trialEndsAt: {
        type: Date,
        default: function () {
            const date = new Date();
            date.setDate(date.getDate() + 14); // 14 days from now
            return date;
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lastLoginAt: Date,
    loginCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Hash password before saving
freeTrialUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
freeTrialUserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if trial is active
freeTrialUserSchema.methods.isTrialActive = function () {
    return new Date() < this.trialEndsAt;
};

// Virtual for trial days remaining
freeTrialUserSchema.virtual('trialDaysRemaining').get(function () {
    const now = new Date();
    const diffTime = this.trialEndsAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
});

// Method to check if user can login
freeTrialUserSchema.methods.canLogin = function () {
    return this.isActive && this.isTrialActive() && this.emailVerified;
};

module.exports = mongoose.model('FreeTrialUser', freeTrialUserSchema);