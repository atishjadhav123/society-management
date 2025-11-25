// middleware/multer.js
const multer = require('multer');

// Store files in memory for Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5 // Max 5 images per complaint
    },
    fileFilter: fileFilter
});

module.exports = upload;