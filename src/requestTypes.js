'use strict';
const { tr } = require('./i18n');
const { deanOffice } = require('./faculties');
// Типы заявок и их правила: поля, электронная версия, цепочка статусов.
// Всё про «какие бывают заявки» — здесь, в одном месте.

const TYPES = {
  study_certificate: {
    get label() { return tr('requestTypes.spravka_ob_obuchenii'); },
    get hint() { return tr('requestTypes.podtverzhdaet_chto_vy_uchites'); },
    kind: 'document',
    electronic: true,
  },
  enrollment_certificate: {
    get label() { return tr('requestTypes.spravka_o_zachislenii'); },
    get hint() { return tr('requestTypes.podtverzhdaet_datu_i_prikaz'); },
    kind: 'document',
    electronic: false,
  },
  order_extract: {
    get label() { return tr('requestTypes.vypiska_iz_prikaza'); },
    get hint() { return tr('requestTypes.o_zachislenii_perevode_otpuske'); },
    kind: 'document',
    electronic: false,
    needsOrder: true,
  },
  appeal: {
    get label() { return tr('requestTypes.obraschenie_v_dekanat'); },
    get hint() { return tr('requestTypes.vopros_prosba_ili_problema'); },
    kind: 'appeal',
    electronic: false,
  },
};

// Подсказки, чтобы заполнять форму касанием, а не набором текста.
const purposeHints = () => [tr('requestTypes.po_mestu_trebovaniya'), tr('requestTypes.v_vizovyy_tsentr'), tr('requestTypes.po_mestu_raboty_roditeley'), tr('requestTypes.v_voenkomat'), tr('requestTypes.v_bank')];
const orderHints = () => [tr('requestTypes.o_zachislenii'), tr('requestTypes.o_perevode_na_sleduyuschiy'), tr('requestTypes.o_naznachenii_stipendii'), tr('requestTypes.ob_akademicheskom_otpuske')];

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
      return appeal ? tr('requestTypes.prinyato') : tr('requestTypes.prinyata');
    case 'in_progress':
      return tr('requestTypes.v_rabote');
    case 'ready':
      return req.format === 'electronic' ? tr('requestTypes.gotova') : tr('requestTypes.gotova_k_vydache');
    case 'issued':
      return tr('requestTypes.vydana');
    case 'answered':
      return tr('requestTypes.otvet_dan');
    case 'rejected':
      return appeal ? tr('requestTypes.otkloneno') : tr('requestTypes.otklonena');
    default:
      return status;
  }
}

// Пояснение к шагу на «трекере».
function statusHint(status, req) {
  switch (status) {
    case 'accepted':
      return tr('requestTypes.dekanat_poluchil_zayavku');
    case 'in_progress':
      return req.type === 'appeal' ? tr('requestTypes.sotrudnik_razbiraetsya_s_voprosom') : tr('requestTypes.sotrudnik_gotovit_dokument');
    case 'ready':
      return req.format === 'electronic' ? tr('requestTypes.spravka_dostupna_v_lichnom') : tr('requestTypes.mozhno_zabrat_v_dekanate');
    case 'issued':
      return tr('requestTypes.dokument_vydan');
    case 'answered':
      return tr('requestTypes.otvet_v_perepiske_nizhe');
    case 'rejected':
      return tr('requestTypes.prichina_ukazana_nizhe');
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

// Где и когда забирать бумажные документы — в деканате своего факультета (см. src/faculties.js).
function pickupFor(faculty) {
  const dean = deanOffice(faculty);
  return { place: dean.office, hours: dean.hours };
}

// Для браузера: список типов с подсказками.
function publicTypes() {
  return Object.entries(TYPES).map(([id, t]) => ({ id, ...t }));
}

module.exports = {
  TYPES,
  purposeHints,
  orderHints,
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
