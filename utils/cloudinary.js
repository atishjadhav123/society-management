// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload multiple files (in-memory buffers) to Cloudinary.
 * Returns array of { secure_url, public_id }.
 */
const uploadToCloudinary = async (files = []) => {
    try {
        const uploadPromises = files.map((file) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: 'complaints',
                        transformation: [
                            { width: 1600, height: 1200, crop: 'limit' },
                            { quality: 'auto' },
                            { format: 'jpg' },
                        ],
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve({ secure_url: result.secure_url, public_id: result.public_id });
                    }
                );
                stream.end(file.buffer);
            });
        });

        const results = await Promise.all(uploadPromises);
        return results;
    } catch (error) {
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
};

/**
 * Delete images from Cloudinary by public_id array.
 * Accepts array of public_ids (strings). Ignores failures but logs them.
 */
const deleteFromCloudinary = async (publicIds = []) => {
    if (!Array.isArray(publicIds) || publicIds.length === 0) return;
    try {
        const deletePromises = publicIds.map((publicId) => cloudinary.uploader.destroy(publicId));
        const results = await Promise.all(deletePromises);
        // results contain objects with result: 'ok' or 'not found' etc.
        return results;
    } catch (error) {
        console.error('Error deleting images from Cloudinary:', error);
        // do not throw to avoid cascade failure - but caller can decide
    }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
