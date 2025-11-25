const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const {
    createSecurityGuard,
    getAllSecurityGuards,
    getSecurityGuardStats,
    getGuardsBySociety,
    getSecurityGuardById,
    updateSecurityGuard,
    deleteSecurityGuard,
    securityGuardLogin
} = require('../controller/securityGuard.Controller');

// Public routes
router.post('/auth/security-guard-login', securityGuardLogin);

// TEST ROUTE - No auth required (remove in production)
router.post('/test-create', createSecurityGuard);

// Protected routes (Community Admin only)
router.post('/create', protect, authorize(['community_admin']), createSecurityGuard);
router.get('/', protect, authorize(['community_admin']), getAllSecurityGuards);
router.get('/stats/overview', protect, authorize(['community_admin']), getSecurityGuardStats);
router.get('/society/:societyId', protect, authorize(['community_admin']), getGuardsBySociety);
router.get('/:id', protect, authorize(['community_admin']), getSecurityGuardById);
router.put('/:id', protect, authorize(['community_admin']), updateSecurityGuard);
router.delete('/:id', protect, authorize(['community_admin']), deleteSecurityGuard);

module.exports = router;