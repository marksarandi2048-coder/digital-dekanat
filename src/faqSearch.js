'use strict';
// Поиск по базе ответов без ИИ и без библиотек. Понимает формы слов (простое отсечение
// русских окончаний), опечатки (расстояние между словами) и синонимы из живой речи.
const { FAQ, POPULAR } = require('./faq');

// Служебные слова и общие глаголы: сами по себе они ничего не говорят о теме вопроса.
const STOP = new Set('взять заказать найти оформить получить сделать сменить узнать а без бы в вы где да для до если же за и из или к как какая какие какой когда кто ли мне мой можно на надо не нет нужно о об от по при про с со сколько так то у уже что чтобы это я'.split(' '));

// Слова одной строки считаются одним понятием.
const SYNONYMS = [
  'академ академка академотпуск академический',
  'общага общежитие кампус',
  'стипуха степуха стипа стипендия',
  'пересдача пересдать пересдавать хвост долг задолженность незачет завалил двойка',
  'военкомат военник воинский военный',
  'армия призыв отсрочка',
  'студак студбилет студенческий',
  'перевод перевестись перейти',
  'надбавка доплата',
  'пароль логин',
  'прием очередь',
  'виза посольство консульство',
];

const ENDINGS = ['иями', 'ями', 'ами', 'иях', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ешь', 'ишь', 'ать', 'ять', 'ить', 'еть', 'ыть', 'уть', 'ала', 'ила', 'ыла', 'ают', 'яют', 'ует', 'ют', 'ут', 'ат', 'ят', 'ах', 'ях', 'ов', 'ев', 'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ие', 'ые', 'ам', 'ям', 'ом', 'ем', 'им', 'ым', 'ую', 'юю', 'ии', 'ия', 'ию', 'ья', 'ью', 'а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю', 'ь', 'й'].sort((a, b) => b.length - a.length);

function stem(word) {
  let w = word;
  if ((w.endsWith('ся') || w.endsWith('сь')) && w.length > 5) w = w.slice(0, -2);
  const ending = ENDINGS.find((e) => w.endsWith(e) && w.length - e.length >= 3);
  return ending ? w.slice(0, -ending.length) : w;
}

const normalize = (text) => text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
const toToken = (word) => ({ word, stem: stem(word) });
const tokens = (text) => normalize(text).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(toToken);

// Расстояние между словами: вставка, удаление, замена и перестановка соседних букв.
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row[j] = v;
    }
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

const PREFIX_MIN = 5;
const startsEither = (a, b) => a.length >= PREFIX_MIN && b.length >= PREFIX_MIN && (a.startsWith(b) || b.startsWith(a));
const typosAllowed = (length) => (length < 5 ? 0 : length < 8 ? 1 : 2);

// Насколько слова совпали: 1 — одна основа, 0,85 — начало слова, 0,7 — опечатка, 0 — разные.
function match(q, f) {
  if (q.stem === f.stem || q.word === f.word) return 1;
  if (startsEither(q.word, f.word) || startsEither(q.stem, f.stem)) return 0.85;
  // Допуск считается отдельно для основ и для целых слов: короткие основы слишком похожи.
  const stemTypos = typosAllowed(Math.min(q.stem.length, f.stem.length));
  const wordTypos = typosAllowed(Math.min(q.word.length, f.word.length));
  if ((stemTypos && distance(q.stem, f.stem) <= stemTypos) || (wordTypos && distance(q.word, f.word) <= wordTypos)) return 0.7;
  return 0;
}

const GROUPS = SYNONYMS.map((line) => line.split(' ').map(toToken));
function expand(token) {
  const out = [{ token, weight: 1 }];
  for (const group of GROUPS) {
    if (group.some((g) => match(token, g) > 0)) {
      for (const g of group) out.push({ token: g, weight: 0.9 });
    }
  }
  return out;
}

const INDEX = FAQ.map((item) => ({
  item,
  phrase: normalize(item.question),
  fields: [
    { weight: 6, tokens: tokens(item.question) },
    { weight: 5, tokens: tokens(item.keywords) },
    { weight: 1, tokens: tokens(item.answer) },
  ],
}));

const MIN_SCORE = 3;
const MIN_COVERAGE = 0.5;
const RELATIVE_CUTOFF = 0.45;
const MAX_RESULTS = 5;

function publicItem(item) {
  return { id: item.id, category: item.category, question: item.question, answer: item.answer, action: item.action };
}

function search(rawQuery) {
  const query = tokens(rawQuery);
  if (!query.length) return [];
  const expanded = query.map(expand);
  const phrase = normalize(rawQuery);

  const scored = INDEX.map(({ item, phrase: itemPhrase, fields }) => {
    let score = 0;
    let matched = 0;
    for (const variants of expanded) {
      let best = 0;
      for (const { token, weight } of variants) {
        for (const field of fields) {
          for (const f of field.tokens) {
            const value = match(token, f) * weight * field.weight;
            if (value > best) best = value;
          }
        }
      }
      score += best;
      if (best > 0) matched += 1;
    }
    if (query.length >= 2 && itemPhrase.includes(phrase)) score += 3;
    if (POPULAR.includes(item.id)) score += 0.5; // при равенстве — самый частый вопрос
    return { item, score, coverage: matched / expanded.length };
  }).filter((r) => r.score >= MIN_SCORE && r.coverage >= MIN_COVERAGE).sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter((r) => r.score >= top * RELATIVE_CUTOFF).slice(0, MAX_RESULTS).map((r) => publicItem(r.item));
}

function popular() {
  return POPULAR.map((id) => FAQ.find((f) => f.id === id)).map((f) => ({ id: f.id, question: f.question }));
}

module.exports = { search, popular };
