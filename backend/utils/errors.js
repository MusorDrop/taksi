/**
 * @file errors.js
 * Класс пользовательских ошибок сервисного слоя приложения.
 */

/**
 * Пользовательская ошибка сервиса с поддержкой HTTP статус-кода
 */
class ServiceError extends Error {
    /**
     * @param {string} message - Сообщение об ошибке
     * @param {number} [statusCode=400] - HTTP статус-код
     */
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ServiceError';
        this.statusCode = statusCode;
    }
}

module.exports = {
    ServiceError
};
