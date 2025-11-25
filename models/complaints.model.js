const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Complaint title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Complaint description is required'],
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: [
            'plumbing', 'electrical', 'cleaning', 'security',
            'parking', 'elevator', 'common-area', 'noise',
            'maintenance', 'other'
        ]
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'resolved', 'closed', 'rejected'],
        default: 'pending'
    },
    images: [{
        url: String,
        public_id: String
    }],
    // ✅ Support both user types
    raisedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'raisedByType' // Dynamic reference
    },
    raisedByType: {
        type: String,
        required: true,
        enum: ['resident', 'free_trial'] // Track user type
    },
    // For regular residents
    society: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Society'
    },
    // For free trial users (store society info directly)
    societyInfo: {
        name: String,
        city: String,
        type: String
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CommunityAdmin'
    },
    resolutionNotes: String,
    resolvedAt: Date
}, {
    timestamps: true
});

// Index for better performance
complaintSchema.index({ raisedBy: 1, createdAt: -1 });
complaintSchema.index({ society: 1, status: 1 });
complaintSchema.index({ category: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);