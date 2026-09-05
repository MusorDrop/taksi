const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Конфигурация дискового хранилища для загрузки аватаров
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const userId = req.user?.id || 'user';
        const safeName = `avatar_${userId}_${Date.now()}${ext}`;
        cb(null, safeName);
    }
});

// Фильтрация допустимых форматов изображений
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый формат файла. Разрешены только изображения (JPEG, PNG, WEBP, GIF)'), false);
    }
};

const uploadAvatar = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 МБ
    }
});

module.exports = {
    uploadAvatar,
    uploadsDir
};