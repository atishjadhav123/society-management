const { registerSuperAdmin, superAdminLogin, getSuperAdminDashboard } = require("../controller/authController");
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

const router = require("express").Router()


// @route   POST /api/auth/register-super-admin
// @desc    Register Super Admin (First time setup)
// @access  Public
router.post("/register-super-admin", registerSuperAdmin);

// @route   POST /api/auth/super-admin-login
// @desc    Super Admin Login
// @access  Public
router.post("/super-admin-login", superAdminLogin);
router.get('/super-admin', protect, authorize('super_admin'), getSuperAdminDashboard);


// @route   GET /api/auth/super-admin/profile
// @desc    Get Super Admin Profile
// @access  Private (Super Admin only)
// router.get(
//     "/super-admin/profile",
//     authMiddleware,
//     roleMiddleware(["super_admin"]),
//     authController.getSuperAdminProfile
// );

// // @route   PUT /api/auth/super-admin/profile
// // @desc    Update Super Admin Profile
// // @access  Private (Super Admin only)
// router.put(
//     "/super-admin/profile",
//     authMiddleware,
//     roleMiddleware(["super_admin"]),
//     authController.updateSuperAdminProfile
// );

// // @route   PUT /api/auth/super-admin/change-password
// // @desc    Change Super Admin Password
// // @access  Private (Super Admin only)
// router.put(
//     "/super-admin/change-password",
//     authMiddleware,
//     roleMiddleware(["super_admin"]),
//     authController.changeSuperAdminPassword
// );

// // @route   POST /api/auth/super-admin/create-society
// // @desc    Create Society
// // @access  Private (Super Admin only)
// router.post(
//     "/super-admin/create-society",
//     authMiddleware,
//     roleMiddleware(["super_admin"]),
//     authController.createSociety
// );

// // @route   GET /api/auth/super-admin/societies
// // @desc    Get All Societies
// // @access  Private (Super Admin only)
// router.get(
//     "/super-admin/societies",
//     authMiddleware,
//     roleMiddleware(["super_admin"]),
//     authController.getAllSocieties
// );

module.exports = router;