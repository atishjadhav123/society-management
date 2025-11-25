const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
    createResident,
    getAllResidents,
    getResidentStats,
    getResidentsBySociety,
    getResidentById,
    updateResident, deleteResident,
    residentLogin,
    getMyProfile
} = require('../controller/resident.controller');

router.post('/resident-login', residentLogin);

// resident.routes.js mein add karein
router.get('/profile/me', protect, authorize('resident'), getMyProfile);
// Protected routes (Community Admin only)
router.post('/create', protect, authorize('community_admin'), createResident);
router.get('/', protect, authorize('community_admin'), getAllResidents);
router.get('/stats/overview', protect, authorize('community_admin'), getResidentStats);
router.get('/society/:societyId', protect, authorize('community_admin'), getResidentsBySociety);
router.get('/:id', protect, authorize('community_admin'), getResidentById);
router.put('/:id', protect, authorize('community_admin'), updateResident);
router.delete('/:id', protect, authorize('community_admin'), deleteResident);

module.exports = router;