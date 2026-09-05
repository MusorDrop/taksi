/**
 * @file validation.js
 * Утилиты валидации идентификаторов, форматов строк и входных параметров.
 */

/**
 * Регулярное выражение для проверки соответствия формату UUID (v4 / стандартный RFC 4122).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Регулярное выражение для проверки международного формата номера телефона.
 * Допускает необязательный '+' и от 10 до 15 цифр.
 */
const PHONE_REGEX = /^\+?\d{10,15}$/;

/**
 * Валидация строки на соответствие формату UUID.
 * @param {any} id - Проверяемый идентификатор
 * @returns {boolean} true, если значение является корректной строкой UUID
 */
function isValidUuid(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Валидация строки на соответствие формату телефонного номера.
 * @param {any} phone - Проверяемый номер телефона
 * @returns {boolean} true, если значение соответствует формату телефона
 */
function isValidPhone(phone) {
    if (typeof phone !== 'string') {
        return false;
    }
    const cleanPhone = phone.trim().replace(/[\s\-()]/g, '');
    return PHONE_REGEX.test(cleanPhone);
}

module.exports = {
    UUID_REGEX,
    PHONE_REGEX,
    isValidUuid,
    isValidPhone
};
