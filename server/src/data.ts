import type { EventData, Participant, Shot } from './types.js';

function shot(n: number, teiler: number, day: string, hour = 10, minute = 0): Shot {
  const ts = new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  return { shotNumber: n, teiler, timestamp: ts.toISOString() };
}

const day1 = '2026-07-10';
const day2 = '2026-07-11';
const day3 = '2026-07-12';

const participants: Participant[] = [
  {
    id: 'P-1001',
    firstName: 'Anna',
    lastName: 'Berger',
    club: 'BSC Augsburg',
    shotsByDay: {
      [day1]: [shot(1, 12.4, day1, 9, 0), shot(2, 18.7, day1, 9, 5), shot(3, 7.2, day1, 9, 10), shot(4, 22.1, day1, 9, 15)],
      [day2]: [shot(1, 9.1, day2, 9, 0), shot(2, 15.3, day2, 9, 5), shot(3, 11.0, day2, 9, 10)],
      [day3]: [shot(1, 5.4, day3, 9, 0), shot(2, 8.9, day3, 9, 5), shot(3, 14.2, day3, 9, 10), shot(4, 6.7, day3, 9, 15), shot(5, 10.1, day3, 9, 20)],
    },
  },
  {
    id: 'P-1002',
    firstName: 'Markus',
    lastName: 'Hoffmann',
    club: 'BSC München',
    shotsByDay: {
      [day1]: [shot(1, 15.0, day1, 9, 0), shot(2, 11.8, day1, 9, 5), shot(3, 19.4, day1, 9, 10)],
      [day2]: [shot(1, 8.6, day2, 9, 0), shot(2, 13.2, day2, 9, 5), shot(3, 17.0, day2, 9, 10), shot(4, 9.9, day2, 9, 15)],
      [day3]: [shot(1, 12.3, day3, 9, 0), shot(2, 6.4, day3, 9, 5)],
    },
  },
  {
    id: 'P-1003',
    firstName: 'Sophie',
    lastName: 'Keller',
    club: 'BSC Nürnberg',
    shotsByDay: {
      [day1]: [shot(1, 6.9, day1, 9, 0), shot(2, 14.2, day1, 9, 5), shot(3, 21.0, day1, 9, 10), shot(4, 8.3, day1, 9, 15), shot(5, 11.6, day1, 9, 20)],
      [day2]: [shot(1, 7.1, day2, 9, 0), shot(2, 10.5, day2, 9, 5), shot(3, 16.8, day2, 9, 10)],
      [day3]: [shot(1, 9.0, day3, 9, 0), shot(2, 12.4, day3, 9, 5), shot(3, 4.8, day3, 9, 10)],
    },
  },
  {
    id: 'P-1004',
    firstName: 'Jonas',
    lastName: 'Weber',
    club: 'BSC Stuttgart',
    shotsByDay: {
      [day1]: [shot(1, 22.1, day1, 9, 0), shot(2, 17.5, day1, 9, 5), shot(3, 14.0, day1, 9, 10)],
      [day2]: [shot(1, 10.2, day2, 9, 0), shot(2, 8.4, day2, 9, 5), shot(3, 13.6, day2, 9, 10), shot(4, 11.1, day2, 9, 15)],
      [day3]: [shot(1, 7.7, day3, 9, 0), shot(2, 9.2, day3, 9, 5)],
    },
  },
  {
    id: 'P-1005',
    firstName: 'Laura',
    lastName: 'Schmidt',
    club: 'BSC Frankfurt',
    shotsByDay: {
      [day1]: [shot(1, 9.8, day1, 9, 0), shot(2, 13.1, day1, 9, 5)],
      [day2]: [shot(1, 6.2, day2, 9, 0), shot(2, 11.7, day2, 9, 5), shot(3, 15.4, day2, 9, 10)],
      [day3]: [shot(1, 8.5, day3, 9, 0), shot(2, 12.0, day3, 9, 5), shot(3, 10.6, day3, 9, 10), shot(4, 14.9, day3, 9, 15)],
    },
  },
  {
    id: 'P-1006',
    firstName: 'Felix',
    lastName: 'Bauer',
    club: 'BSC Köln',
    shotsByDay: {
      [day1]: [shot(1, 19.3, day1, 9, 0), shot(2, 12.6, day1, 9, 5), shot(3, 8.0, day1, 9, 10)],
      [day2]: [shot(1, 15.8, day2, 9, 0), shot(2, 9.4, day2, 9, 5)],
      [day3]: [shot(1, 11.2, day3, 9, 0), shot(2, 7.5, day3, 9, 5), shot(3, 13.8, day3, 9, 10)],
    },
  },
  {
    id: 'P-1007',
    firstName: 'Marie',
    lastName: 'Wagner',
    club: 'BSC Hamburg',
    shotsByDay: {
      [day1]: [shot(1, 5.1, day1, 9, 0), shot(2, 16.4, day1, 9, 5), shot(3, 12.0, day1, 9, 10)],
      [day2]: [shot(1, 14.5, day2, 9, 0), shot(2, 8.7, day2, 9, 5), shot(3, 10.3, day2, 9, 10), shot(4, 7.6, day2, 9, 15)],
      [day3]: [shot(1, 6.3, day3, 9, 0), shot(2, 9.9, day3, 9, 5)],
    },
  },
  {
    id: 'P-1008',
    firstName: 'Tobias',
    lastName: 'Fischer',
    club: 'BSC Berlin',
    shotsByDay: {
      [day1]: [shot(1, 13.2, day1, 9, 0), shot(2, 18.9, day1, 9, 5)],
      [day2]: [shot(1, 11.4, day2, 9, 0), shot(2, 7.8, day2, 9, 5), shot(3, 16.1, day2, 9, 10)],
      [day3]: [shot(1, 8.1, day3, 9, 0), shot(2, 12.7, day3, 9, 5), shot(3, 15.3, day3, 9, 10), shot(4, 9.4, day3, 9, 15)],
    },
  },
];

export const eventData: EventData = {
  eventName: 'BSC ScoreBoard',
  rangeName: 'Schießanlage BSC',
  days: [
    { date: day1, label: 'Tag 1 - 10.07.2026' },
    { date: day2, label: 'Tag 2 - 11.07.2026' },
    { date: day3, label: 'Tag 3 - 12.07.2026' },
  ],
  participants,
};
