const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { createSociety, getAllSocieties } = require('../controller/society.controller');

router.use(authMiddleware);
router.use(roleMiddleware(['super_admin']));


router.post('/create', createSociety);


router.get('/', getAllSocieties);


// router.get('/:id', societyController.getSocietyById);


// router.put('/:id', societyController.updateSociety);


// router.delete('/:id', societyController.deleteSociety);


// router.get('/stats/overview', societyController.getSocietyStats);

module.exports = router;