/**
 * @file geometry.js
 * Геометрические функции и вспомогательные алгоритмы для работы с координатами и полилиниями маршрутов.
 */

/**
 * Генерация плавной полилинии маршрута кривой Безье между двумя точками
 * @param {number} startLon - Долгота начальной точки
 * @param {number} startLat - Широта начальной точки
 * @param {number} endLon - Долгота конечной точки
 * @param {number} endLat - Широта конечной точки
 * @param {number} [numPoints=18] - Количество точек интерполяции
 * @returns {Array<[number, number]>} Массив координат [lon, lat]
 */
function generateRoutePolyline(startLon, startLat, endLon, endLat, numPoints = 18) {
    const points = [];
    const dx = endLon - startLon;
    const dy = endLat - startLat;
    const midX = (startLon + endLon) / 2;
    const midY = (startLat + endLat) / 2;
    const devX = -dy * 0.12;
    const devY = dx * 0.12;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const oneMinusT = 1 - t;
        const lon = oneMinusT * oneMinusT * startLon + 2 * oneMinusT * t * (midX + devX) + t * t * endLon;
        const lat = oneMinusT * oneMinusT * startLat + 2 * oneMinusT * t * (midY + devY) + t * t * endLat;
        points.push([
            Math.round(lon * 100000) / 100000,
            Math.round(lat * 100000) / 100000
        ]);
    }
    return points;
}

module.exports = {
    generateRoutePolyline
};
