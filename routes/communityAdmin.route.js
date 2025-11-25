const {
    createCommunityAdminModel,
    getAllCommunityAdminModels,
    getCommunityAdminModelById,
    updateCommunityAdminModel,
    deleteCommunityAdminModel,
    getAdminsBySociety,
    communityAdminLogin } = require("../controller/communityAdminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = require("express").Router()

router.post('/create', authMiddleware, roleMiddleware(['super_admin']), createCommunityAdminModel);
router.post('/community-admin-login', communityAdminLogin);

router.get('/', getAllCommunityAdminModels);
router.get('/:id', getCommunityAdminModelById);
router.put('/:id', updateCommunityAdminModel);
router.delete('/:id', deleteCommunityAdminModel);
router.get('/society/:societyId', getAdminsBySociety);

module.exports = router