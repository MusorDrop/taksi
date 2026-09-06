/**
 * @file locations.js
 * Единый справочник ключевых географических точек и координат Екатеринбурга.
 * Устраняет дублирование KNOWN_LOCATIONS между контроллерами и сервисами карт.
 */

// Границы Екатеринбурга по умолчанию (долгота lon, широта lat)
const EKATERINBURG_BOUNDS = {
    minLon: 60.20,
    minLat: 56.60,
    maxLon: 61.05,
    maxLat: 57.05,
    bbox: '60.20,56.60~61.05,57.05',
    boundedBy: [
        [56.60, 60.20],
        [57.05, 61.05]
    ]
};

// Словарь известных локаций Екатеринбурга (очищен, используется Yandex Search API)
const KNOWN_LOCATIONS = {};


const DEFAULT_COORDS = { lon: 60.6057, lat: 56.8389, name: 'Центр' };
const DEFAULT_START = { lon: 60.5975, lat: 56.8885, name: 'Уралмаш' };
const DEFAULT_END = { lon: 60.7712, lat: 56.7686, name: 'Новокольцовский' };

module.exports = {
    EKATERINBURG_BOUNDS,
    KNOWN_LOCATIONS,
    DEFAULT_COORDS,
    DEFAULT_START,
    DEFAULT_END
};
