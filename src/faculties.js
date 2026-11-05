'use strict';
// Контакты деканатов факультетов (вымышленные). Отсюда же берётся,
// где и когда забирать бумажные справки. Телефоны — несуществующие (000),
// почта — на зарезервированном для примеров домене example.edu.
const DEANS = {
  'Факультет международных отношений': {
    short: 'ФМО',
    office: 'Деканат ФМО — корпус 1, кабинет 213',
    hours: 'Пн–пт 10:00–17:00, обед 13:00–14:00',
    phone: '+7 (495) 000-02-13',
    email: 'dekanat-fmo@example.edu',
  },
  'Факультет международных экономических отношений': {
    short: 'МЭО',
    office: 'Деканат МЭО — корпус 3, кабинет 405',
    hours: 'Пн–чт 10:00–17:00, пт 10:00–15:00',
    phone: '+7 (495) 000-04-05',
    email: 'dekanat-meo@example.edu',
  },
};

const DEFAULT = {
  short: '',
  office: 'Деканат факультета',
  hours: 'Пн–пт 10:00–17:00',
  phone: null,
  email: null,
};

function deanOffice(faculty) {
  return DEANS[faculty] || DEFAULT;
}

module.exports = { deanOffice };
