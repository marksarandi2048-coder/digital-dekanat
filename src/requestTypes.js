'use strict';
// Типы заявок и их правила: поля, электронная версия, цепочка статусов.
// Всё про «какие бывают заявки» — здесь, в одном месте.

const TYPES = {
  study_certificate: {
    label: 'Справка об обучении',
    hint: 'Подтверждает, что вы учитесь в МГИМО',
    kind: 'document',
    electronic: true,
  },
  enrollment_certificate: {
    label: 'Справка о зачислении',
    hint: 'Подтверждает дату и приказ о зачислении',
    kind: 'document',
    electronic: false,
  },
  order_extract: {
    label: 'Выписка из приказа',
    hint: 'О зачислении, переводе, отпуске, стипендии',
    kind: 'document',
    electronic: false,
    needsOrder: true,
  },
  appeal: {
    label: 'Обращение в деканат',
    hint: 'Вопрос, просьба или проблема с оценками',
    kind: 'appeal',
    electronic: false,
  },
};

// Подсказки, чтобы заполнять форму касанием, а не набором текста.
const PURPOSE_HINTS = ['По месту требования', 'В визовый центр', 'По месту работы родителей', 'В военкомат', 'В банк'];
const ORDER_HINTS = ['О зачислении', 'О переводе на следующий курс', 'О назначении стипендии', 'Об академическом отпуске'];

const MAX_COPIES = 5;
const CERTIFICATE_DAYS = 30; // срок действия электронной справки

// Цепочка статусов зависит от заявки.
function chainFor(req) {
  if (req.type === 'appeal') return ['accepted', 'in_progress', 'answered'];
  if (req.format === 'electronic') return ['accepted', 'in_progress', 'ready'];
  return ['accepted', 'in_progress', 'ready', 'issued'];
}

function statusLabel(status, req) {
  const appeal = req.type === 'appeal';
  switch (status) {
    case 'accepted':
      return appeal ? 'Принято' : 'Принята';
    case 'in_progress':
      return 'В работе';
    case 'ready':
      return req.format === 'electronic' ? 'Готова' : 'Готова к выдаче';
    case 'issued':
      return 'Выдана';
    case 'answered':
      return 'Ответ дан';
    case 'rejected':
      return appeal ? 'Отклонено' : 'Отклонена';
    default:
      return status;
  }
}

// Пояснение к шагу на «трекере».
function statusHint(status, req) {
  switch (status) {
    case 'accepted':
      return 'Деканат получил заявку';
    case 'in_progress':
      return req.type === 'appeal' ? 'Сотрудник разбирается с вопросом' : 'Сотрудник готовит документ';
    case 'ready':
      return req.format === 'electronic' ? 'Справка доступна в личном кабинете' : 'Можно забрать в деканате';
    case 'issued':
      return 'Документ выдан';
    case 'answered':
      return 'Ответ — в переписке ниже';
    case 'rejected':
      return 'Причина указана ниже';
    default:
      return '';
  }
}

function nextStatus(req) {
  const chain = chainFor(req);
  const i = chain.indexOf(req.status);
  return i >= 0 && i < chain.length - 1 ? chain[i + 1] : null;
}

function canReject(req) {
  return req.status === 'accepted' || req.status === 'in_progress';
}

function isClosed(req) {
  const chain = chainFor(req);
  return req.status === 'rejected' || req.status === chain[chain.length - 1];
}

// Где и когда забирать бумажные документы (вымышленные кабинеты).
const PICKUP = {
  'Факультет международных отношений': {
    place: 'Деканат ФМО — корпус 1, кабинет 213',
    hours: 'Пн–пт 10:00–17:00, обед 13:00–14:00',
  },
  'Факультет международных экономических отношений': {
    place: 'Деканат МЭО — корпус 3, кабинет 405',
    hours: 'Пн–чт 10:00–17:00, пт 10:00–15:00',
  },
};
const PICKUP_DEFAULT = { place: 'Деканат факультета', hours: 'Пн–пт 10:00–17:00' };

function pickupFor(faculty) {
  return PICKUP[faculty] || PICKUP_DEFAULT;
}

// Для браузера: список типов с подсказками.
function publicTypes() {
  return Object.entries(TYPES).map(([id, t]) => ({ id, ...t }));
}

module.exports = {
  TYPES,
  PURPOSE_HINTS,
  ORDER_HINTS,
  MAX_COPIES,
  CERTIFICATE_DAYS,
  chainFor,
  statusLabel,
  statusHint,
  nextStatus,
  canReject,
  isClosed,
  pickupFor,
  publicTypes,
};
