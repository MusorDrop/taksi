const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Разрешенные MIME-типы и соответствующие им расширения
const ALLOWED_MIME_EXT_MAP = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif']
};

const MIME_TO_CANONICAL_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

// Регулярное выражение для безопасных идентификаторов пользователей
const SAFE_USER_ID_REGEX = /^[0-9a-fA-F-]{1,64}$/;

// Конфигурация дискового хранилища для загрузки аватаров с защитой от Directory Traversal
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Защита от Directory Traversal: санитизируем userId, исключаем любые спецсимволы и точки
        const rawUserId = req.user?.id ? String(req.user.id).trim() : 'user';
        const sanitizedUserId = SAFE_USER_ID_REGEX.test(rawUserId)
            ? rawUserId
            : rawUserId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) || 'user';

        // Расширение берется строго из доверенной канонической карты по MIME-типу,
        // а не слепо из оригинального имени файла, переданного клиентом
        const safeExt = MIME_TO_CANONICAL_EXT[file.mimetype] || '.png';

        // Формирование уникального безопасного имени файла
        const randomSuffix = crypto.randomBytes(8).toString('hex');
        const safeName = `avatar_${sanitizedUserId}_${Date.now()}_${randomSuffix}${safeExt}`;

        // Дополнительная проверка на выход за пределы директории uploads
        const resolvedPath = path.resolve(uploadsDir, safeName);
        if (!resolvedPath.startsWith(path.resolve(uploadsDir) + path.sep)) {
            return cb(new Error('Недопустимый путь к файлу (Directory Traversal)'));
        }

        cb(null, safeName);
    }
});

// Строгая фильтрация допустимых форматов файлов
const fileFilter = (req, file, cb) => {
    const allowedMimes = Object.keys(ALLOWED_MIME_EXT_MAP);
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Недопустимый формат файла. Разрешены только изображения (JPEG, PNG, WEBP, GIF)'), false);
    }

    // Проверка расширения в имени файла на соответствие разрешенным для данного MIME-типа
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const allowedExtsForMime = ALLOWED_MIME_EXT_MAP[file.mimetype];
    if (originalExt && !allowedExtsForMime.includes(originalExt)) {
        return cb(new Error('Расширение файла не соответствует заявленному MIME-типу'), false);
    }

    cb(null, true);
};

const uploadAvatar = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 МБ
    }
});

/**
 * Валидация сигнатуры файла (Magic Bytes) на диске
 * @param {string} filePath - Абсолютный путь к файлу
 * @param {string} mimetype - Заявленный MIME-тип
 * @returns {boolean} true, если сигнатура совпадает с MIME-типом
 */
function validateMagicBytes(filePath, mimetype) {
    try {
        if (!fs.existsSync(filePath)) {
            return false;
        }

        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        if (bytesRead < 4) {
            return false;
        }

        switch (mimetype) {
            case 'image/jpeg':
                return bytesRead >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
            case 'image/png':
                return bytesRead >= 8 &&
                    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
                    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
            case 'image/gif':
                return bytesRead >= 6 &&
                    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
                    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61;
            case 'image/webp':
                return bytesRead >= 12 &&
                    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
                    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
            default:
                return false;
        }
    } catch {
        return false;
    }
}

/**
 * Express middleware для безопасной загрузки аватара с проверкой magic bytes
 */
function handleAvatarUpload(req, res, next) {
    uploadAvatar.single('avatar')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Размер файла превышает допустимый лимит (5 МБ)' });
            }
            return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Файл аватара не предоставлен' });
        }

        // Проверка Magic Bytes
        const isSignatureValid = validateMagicBytes(req.file.path, req.file.mimetype);
        if (!isSignatureValid) {
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            } catch (_) {}
            return res.status(400).json({
                error: 'Недопустимое содержимое файла. Сигнатура файла не соответствует заявленному типу изображения'
            });
        }

        next();
    });
}

module.exports = {
    uploadAvatar,
    handleAvatarUpload,
    validateMagicBytes,
    uploadsDir
};