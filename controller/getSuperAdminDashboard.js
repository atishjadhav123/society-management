// controllers/dashboardController.js
const Society = require('../models/societies');
const Resident = require('../models/residents');
// const Complaint = require('../models/complaints');
const CommunityAdmin = require('../models/communityadmins');
const SecurityGuard = require('../models/securityguards');
const complaintsModel = require('../models/complaints.model');

// @desc    Get Super Admin Dashboard Stats
// @route   GET /api/dashboard/super-admin
// @access  Private (Super Admin only)
exports.getSuperAdminDashboard = async (req, res) => {
    try {
        const superAdminId = req.user.userId;

        // Get all counts in parallel for better performance
        const [
            totalSocieties,
            totalResidents,
            totalCommunityAdmins,
            totalSecurityGuards,
            pendingComplaints,
            activeSocieties,
            recentComplaints,
            monthlyRevenue
        ] = await Promise.all([
            // Total Societies
            Society.countDocuments({ createdBy: superAdminId }),

            // Total Residents
            Resident.countDocuments({ isActive: true }),

            // Total Community Admins
            CommunityAdmin.countDocuments({ isActive: true }),

            // Total Security Guards
            SecurityGuard.countDocuments({ isActive: true }),

            // Pending Complaints
            complaintsModel.countDocuments({ status: 'pending' }),

            // Active Societies
            Society.countDocuments({ status: 'Active', isActive: true }),

            // Recent Complaints (last 7 days)
            Complaint.find({
                createdAt: {
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            })
                .populate('raisedBy', 'name flatNumber')
                .populate('society', 'name')
                .sort({ createdAt: -1 })
                .limit(5),

            // Monthly Revenue (example calculation)
            calculateMonthlyRevenue()
        ]);

        // Recent Activities
        const recentActivities = await getRecentActivities();

        const dashboardData = {
            stats: {
                totalSocieties,
                totalResidents,
                totalCommunityAdmins,
                totalSecurityGuards,
                pendingComplaints,
                activeSocieties,
                monthlyRevenue
            },
            recentComplaints,
            recentActivities
        };

        res.status(200).json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard data'
        });
    }
};

// Calculate monthly revenue (example logic)
const calculateMonthlyRevenue = async () => {
    // This is a simplified calculation
    // You might want to calculate based on actual payments
    const totalSocieties = await Society.countDocuments({ status: 'Active' });
    const baseRevenue = totalSocieties * 5000; // Example: ₹5000 per society
    return baseRevenue;
};

// Get recent activities from different models
const getRecentActivities = async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
        newSocieties,
        newResidents,
        resolvedComplaints,
        newAdmins
    ] = await Promise.all([
        Society.find({ createdAt: { $gte: oneDayAgo } })
            .select('name createdAt')
            .sort({ createdAt: -1 })
            .limit(3),

        Resident.find({ createdAt: { $gte: oneDayAgo } })
            .select('name flatNumber createdAt')
            .populate('society', 'name')
            .sort({ createdAt: -1 })
            .limit(3),

        Complaint.find({
            status: 'resolved',
            resolvedAt: { $gte: oneDayAgo }
        })
            .select('title resolvedAt')
            .populate('raisedBy', 'name')
            .sort({ resolvedAt: -1 })
            .limit(3),

        CommunityAdmin.find({ createdAt: { $gte: oneDayAgo } })
            .select('name createdAt')
            .populate('society', 'name')
            .sort({ createdAt: -1 })
            .limit(3)
    ]);

    const activities = [];

    // Format society activities
    newSocieties.forEach(society => {
        activities.push({
            action: `New society registered: ${society.name}`,
            time: formatTimeAgo(society.createdAt),
            type: 'success',
            icon: '🏘️'
        });
    });

    // Format resident activities
    newResidents.forEach(resident => {
        activities.push({
            action: `New resident joined: ${resident.name} (${resident.flatNumber})`,
            time: formatTimeAgo(resident.createdAt),
            type: 'info',
            icon: '👤'
        });
    });

    // Format complaint activities
    resolvedComplaints.forEach(complaint => {
        activities.push({
            action: `Complaint resolved: ${complaint.title}`,
            time: formatTimeAgo(complaint.resolvedAt),
            type: 'success',
            icon: '✅'
        });
    });

    // Format admin activities
    newAdmins.forEach(admin => {
        activities.push({
            action: `New community admin added: ${admin.name}`,
            time: formatTimeAgo(admin.createdAt),
            type: 'warning',
            icon: '👨‍💼'
        });
    });

    // Sort by time and return top 6
    return activities
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 6);
};

// Helper function to format time ago
const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
};