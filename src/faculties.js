'use strict';
// Контакты деканатов факультетов (вымышленные). Отсюда же берётся,
// где и когда забирать бумажные справки. Телефоны — несуществующие (000),
// почта — на зарезервированном для примеров домене example.edu.
// Часы приёма для записи: номер дня недели (1 — понедельник) → с какого по какое время.
const LUNCH = ['13:00', '14:00'];
const FIVE_DAYS = { 1: ['10:00', '17:00'], 2: ['10:00', '17:00'], 3: ['10:00', '17:00'], 4: ['10:00', '17:00'], 5: ['10:00', '17:00'] };

const DEANS = {
  'Факультет международных отношений': {
    short: 'ФМО',
    office: 'Деканат ФМО — корпус 1, кабинет 213',
    hours: 'Пн–пт 10:00–17:00, обед 13:00–14:00',
    reception: { place: 'корпус 1, каб. 213', days: FIVE_DAYS, lunch: LUNCH },
    phone: '+7 (495) 000-02-13',
    email: 'dekanat-fmo@example.edu',
  },
  'Факультет международных экономических отношений': {
    short: 'МЭО',
    office: 'Деканат МЭО — корпус 3, кабинет 405',
    hours: 'Пн–чт 10:00–17:00, пт 10:00–15:00, обед 13:00–14:00',
    reception: { place: 'корпус 3, каб. 405', days: { ...FIVE_DAYS, 5: ['10:00', '15:00'] }, lunch: LUNCH },
    phone: '+7 (495) 000-04-05',
    email: 'dekanat-meo@example.edu',
  },
};

const DEFAULT = {
  short: '',
  office: 'Кабинет уточняйте в учебной части',
  hours: 'Пн–пт 10:00–17:00',
  reception: { place: 'кабинет уточняйте в учебной части', days: FIVE_DAYS, lunch: null },
  phone: null,
  email: null,
};

function deanOffice(faculty) {
  return DEANS[faculty] || DEFAULT;
}

// Список факультетов с деканатами — для выбора у сотрудника.
function faculties() {
  return Object.entries(DEANS).map(([name, d]) => ({ name, short: d.short }));
}

module.exports = { deanOffice, faculties };
