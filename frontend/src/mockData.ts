import type { Ride, User } from './types';
import { getAiRecommendedPrice, isPeakTime } from './utils';

export const MOCK_USER: User = {
  id: 'u0',
  name: 'Алексей Морозов',
  telegram: 'alexmorozov',
};

// Prices below are driver-set, but seeded from the same AI recommendation
// model used in "Создать поездку" (see getAiRecommendedPrice in utils.ts) —
// so the demo data lines up with what a real driver would actually see and
// apply, instead of arbitrary fixed dummy numbers.
const RAW_RIDES: Array<Omit<Ride, 'price' | 'isPeak'>> = [
  {
    id: 'r1',
    driverId: 'u1',
    driverName: 'Софья Чен',
    from: 'Центральная библиотека',
    to: 'Северный кампус',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    time: '08:15',
    telegram: 'sophiechen',
    distanceKm: 6.2,
    createdAt: Date.now() - 100000,
  },
  {
    id: 'r2',
    driverId: 'u2',
    driverName: 'Дмитрий Парк',
    from: 'Общежитие «Риверсайд»',
    to: 'Инженерный корпус',
    days: ['Mon', 'Wed', 'Fri'],
    time: '09:00',
    telegram: 'dmitrypark',
    distanceKm: 4.5,
    createdAt: Date.now() - 90000,
  },
  {
    id: 'r3',
    driverId: 'u3',
    driverName: 'Мария Гарсия',
    from: 'Западные квартиры',
    to: 'Студенческий союз',
    days: ['Tue', 'Thu'],
    time: '10:30',
    telegram: 'mariagarcia',
    distanceKm: 3.1,
    createdAt: Date.now() - 80000,
  },
  {
    id: 'r4',
    driverId: 'u4',
    driverName: 'Давид Ким',
    from: 'Центр города',
    to: 'Южный кампус',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    time: '07:45',
    telegram: 'davidkim',
    distanceKm: 7.8,
    createdAt: Date.now() - 70000,
  },
  {
    id: 'r5',
    driverId: 'u5',
    driverName: 'Эмма Уилсон',
    from: 'Кафе «Холм»',
    to: 'Научный блок',
    days: ['Wed', 'Fri'],
    time: '14:00',
    telegram: 'emmawilson',
    distanceKm: 2.0,
    createdAt: Date.now() - 60000,
  },
  {
    id: 'r6',
    driverId: 'u6',
    driverName: 'Лиам Джонсон',
    from: 'Восточные ворота',
    to: 'Библиотека',
    days: ['Sat'],
    time: '11:00',
    telegram: 'liamjohnson',
    distanceKm: 3.8,
    createdAt: Date.now() - 50000,
  },
  {
    id: 'r7',
    driverId: 'u7',
    driverName: 'Оливия Браун',
    from: 'Университетская деревня',
    to: 'Медицинский факультет',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    time: '08:30',
    telegram: 'oliviabrown',
    distanceKm: 5.5,
    createdAt: Date.now() - 40000,
  },
  {
    id: 'r8',
    driverId: 'u8',
    driverName: 'Ной Дэвис',
    from: 'Спортивный комплекс',
    to: 'Главная площадь',
    days: ['Tue', 'Thu', 'Sat'],
    time: '18:00',
    telegram: 'noahdavis',
    distanceKm: 3.4,
    createdAt: Date.now() - 30000,
  },
];

export const MOCK_RIDES: Ride[] = RAW_RIDES.map((ride) => ({
  ...ride,
  price: getAiRecommendedPrice(ride.distanceKm, ride.time),
  isPeak: isPeakTime(ride.time),
}));
