// routes/complaint.routes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const { createComplaint, getMyComplaints, getComplaintById, updateComplaint } = require('../controller/Complaint.controller');
const upload = require('../middleware/multer');


// Resident routes
router.post('/create', protect, authorize('resident'), upload.array('images', 5), createComplaint);
router.get('/my-complaints', protect, authorize('resident'), getMyComplaints);
router.get('/:id', protect, getComplaintById);

// Admin routes
router.put('/:id/status', protect, upload.array('images', 5), authorize('community_admin', 'super_admin'), updateComplaint);

module.exports = router;