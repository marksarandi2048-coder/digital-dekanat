'use strict';
// Английская версия учебных данных. Сами данные хранятся по-русски; перевод подставляется
// в ответах сервера, когда выбран английский. То, что люди пишут сами, не переводится.
const { currentLang } = require('./i18n');

const DATA_EN = {
  // Факультеты, группы, направления
  'Факультет международных отношений': 'Faculty of International Relations',
  'Факультет международных экономических отношений': 'Faculty of International Economic Relations',
  ФМО: 'FIR',
  МЭО: 'FIER',
  'МО-2-03': 'MO-2-03',
  'МЭО-3-07': 'MEO-3-07',
  'Международные отношения': 'International Relations',
  Экономика: 'Economics',
  // Кураторы: для них в ответе сервера нет отдельного поля с ФИО
  'Воронцова Ирина Павловна': 'Vorontsova Irina Pavlovna',
  'Сергеев Андрей Николаевич': 'Sergeev Andrei Nikolaevich',
  // Семестры
  'Весенний семестр 2025/26': 'Spring semester 2025/26',
  'Осенний семестр 2026/27': 'Fall semester 2026/27',
  // Дисциплины
  'Английский язык': 'English',
  'Бухгалтерский учёт': 'Accounting',
  'Введение в дипломатическую практику': 'Introduction to Diplomatic Practice',
  'Введение в теорию международных отношений': 'Introduction to International Relations Theory',
  Информатика: 'Computer Science',
  'История России': 'Russian History',
  'История международных отношений': 'History of International Relations',
  'История экономических учений': 'History of Economic Thought',
  'Линейная алгебра': 'Linear Algebra',
  Макроэкономика: 'Macroeconomics',
  'Международное право': 'International Law',
  'Международные валютно-кредитные отношения': 'International Monetary and Credit Relations',
  Микроэкономика: 'Microeconomics',
  'Мировая экономика': 'World Economy',
  'Основы права': 'Fundamentals of Law',
  Статистика: 'Statistics',
  'Теория международных отношений': 'International Relations Theory',
  'Физическая культура': 'Physical Education',
  'Финансовые рынки': 'Financial Markets',
  'Французский язык': 'French',
  Эконометрика: 'Econometrics',
  'Экономическая теория': 'Economic Theory',
  // Короткие названия
  Английский: 'English',
  Бухучёт: 'Accounting',
  'Введение в ТМО': 'Intro to IR Theory',
  'Дипл. практика': 'Diplomatic Practice',
  'История МО': 'History of IR',
  'История эк. учений': 'Hist. Econ. Thought',
  'Лин. алгебра': 'Linear Algebra',
  МВКО: 'Intl Finance',
  'Межд. право': 'Intl Law',
  ТМО: 'IR Theory',
  Физкультура: 'Phys. Ed.',
  Французский: 'French',
  'Экон. теория': 'Econ. Theory',
  // Преподаватели, должности
  доцент: 'associate professor',
  преподаватель: 'lecturer',
  профессор: 'professor',
  'старший преподаватель': 'senior lecturer',
  'Специалист по учебно-методической работе': 'Academic Affairs Specialist',
  // Корпуса и аудитории
  'Корпус 1': 'Building 1',
  'Корпус 2': 'Building 2',
  'Корпус 3': 'Building 3',
  Спорткомплекс: 'Sports Complex',
  'Зал 1': 'Hall 1',
  'Зал 2': 'Hall 2',
  'Компьютерный класс 3': 'Computer Lab 3',
  // Причины изменений в расписании
  'Аудитория занята на конференции': 'The room is in use for a conference',
  'В аудитории 312 ремонт проектора': 'The projector in room 312 is being repaired',
  'Замена на время командировки': 'Substitute during a business trip',
  'Лекция будет восполнена позже': 'The lecture will be made up later',
  'Перенос по просьбе преподавателя': 'Moved at the teacher’s request',
  'Преподаватель заболел. Задание — в электронном курсе': 'The teacher is ill. The assignment is in the online course',
  'Преподаватель на конференции': 'The teacher is at a conference',
  'Совпадение с мероприятием факультета': 'Clashes with a faculty event',
  // Деканаты и приём
  'Деканат ФМО — корпус 1, кабинет 213': 'FIR Dean’s Office — Building 1, Room 213',
  'Деканат МЭО — корпус 3, кабинет 405': 'FIER Dean’s Office — Building 3, Room 405',
  'Пн–пт 10:00–17:00, обед 13:00–14:00': 'Mon–Fri 10:00–17:00, lunch 13:00–14:00',
  'Пн–чт 10:00–17:00, пт 10:00–15:00, обед 13:00–14:00': 'Mon–Thu 10:00–17:00, Fri 10:00–15:00, lunch 13:00–14:00',
  'Пн–пт 10:00–17:00': 'Mon–Fri 10:00–17:00',
  'корпус 1, каб. 213': 'Building 1, Room 213',
  'корпус 3, каб. 405': 'Building 3, Room 405',
  'Кабинет уточняйте в учебной части': 'Please check the room with the Academic Office',
  'кабинет уточняйте в учебной части': 'please check the room with the Academic Office',
  'Санитарный день': 'Closed for cleaning',
  // Что взять с собой
  'спортивная форма': 'sportswear',
  'сменная обувь': 'indoor shoes',
  учебник: 'textbook',
  'рабочая тетрадь': 'workbook',
  'флешка с данными': 'USB drive with the data',
  калькулятор: 'calculator',
  'сборник документов': 'collection of documents',
  // Надбавка: возможности и начисления
  'Встреча гостей, навигация и помощь на секциях в течение двух дней.': 'Welcoming guests, giving directions and helping at sessions over two days.',
  'Две тренировки в неделю в течение семестра.': 'Two training sessions a week during the semester.',
  'Деловая игра: подготовка позиции страны и работа в комитете.': 'A simulation game: preparing a country’s position and working in a committee.',
  'Короткий доклад и участие в обсуждении.': 'A short talk and taking part in the discussion.',
  'Помощь в организации конференции.': 'Helping to organize the conference.',
  'Рассказать абитуриентам о факультете и провести их по корпусам.': 'Tell applicants about the faculty and show them around the buildings.',
  'Статья объёмом до 20 страниц по теме своего направления.': 'A paper of up to 20 pages on a topic in your field.',
  'Тренировка раз в неделю и участие во внутреннем турнире.': 'Weekly training and taking part in an in-house tournament.',
  'Тренировки и игры за сборную.': 'Training and playing for the university team.',
  'Клуб международников': 'International Relations Club',
  'Приёмная комиссия': 'Admissions Office',
  'Спортивный клуб': 'Sports Club',
  'Студенческий совет': 'Student Council',
  'Студенческое научное общество': 'Student Research Society',
  'Волонтёр международной студенческой конференции': 'Volunteer at an international student conference',
  'Волонтёр на конференции «Диалог культур»': 'Volunteer at the “Dialogue of Cultures” conference',
  'Конкурс студенческих статей': 'Student paper competition',
  'Круглый стол по мировой экономике': 'Round table on the world economy',
  'Модель ООН': 'Model UN',
  'Помощь на Дне открытых дверей': 'Helping at the Open Day',
  'Сборная МГИМО по баскетболу': 'MGIMO basketball team',
  'Секция настольного тенниса МГИМО': 'MGIMO table tennis club',
  'Секция плавания МГИМО': 'MGIMO swimming club',
  'Волонтёр Дня открытых дверей': 'Open Day volunteer',
  'Доклад на студенческой конференции по экономике': 'Talk at a student economics conference',
  'Секция волейбола МГИМО': 'MGIMO volleyball club',
  'Статья в сборнике студенческих научных работ': 'Paper in a collection of student research',
  // Общественная активность
  'Староста группы': 'Group representative',
  'Участник студенческого научного общества': 'Member of the Student Research Society',
  'Член студенческого научного общества, участник Модели ООН': 'Member of the Student Research Society, Model UN participant',
  // Демо-заявки и переписка
  'Перевод на другое направление': 'Transfer to another degree program',
  'Пересдача по истории МО': 'Retake in History of IR',
  справка: 'certificate',
  'В визовый центр (посольство Франции)': 'For a visa center (Embassy of France)',
  'В визовый центр': 'For a visa center',
  'В банк': 'For a bank',
  'В военкомат': 'For a military registration office',
  'Для работы': 'For work',
  'По месту работы родителей': 'For a parent’s employer',
  'По месту требования': 'Upon request',
  'Не знаю, какой нужен': 'I don’t know which one I need',
  'О назначении стипендии': 'On awarding a scholarship',
  'Нужна с печатью деканата': 'Needs the Dean’s Office stamp',
  'Срок был 31 октября, а в кабинете баллов до сих пор нет. Подскажите, пожалуйста, когда их выставят?': 'The deadline was October 31, but the points are still not in the portal. Could you tell me when they will be posted?',
  'Не выставлены баллы по дисциплине «Международные валютно-кредитные отношения»': 'Points not posted for “International Monetary and Credit Relations”',
  'Здравствуйте! Преподаватель передал ведомость, баллы появятся в кабинете до конца недели. Если не появятся — напишите сюда.': 'Hello! The teacher has submitted the grade sheet, and the points will appear in the portal by the end of the week. If they don’t, please write here.',
  'Не указано, из какого приказа нужна выписка. Подайте, пожалуйста, новую заявку и выберите приказ из списка.': 'You did not specify which order the extract is from. Please submit a new request and choose the order from the list.',
  'Приказ запросили в архиве. Выписка будет готова в течение двух рабочих дней.': 'The order has been requested from the archive. The extract will be ready within two working days.',
  // Справка
  очная: 'full-time',
};

// ФИО и номера — транслитерация по правилам загранпаспорта (ICAO).
const LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: 'ie', ы: 'y',
  ь: '', э: 'e', ю: 'iu', я: 'ia',
};

function latin(text) {
  return [...text].map((ch) => {
    const low = ch.toLowerCase();
    if (!Object.hasOwn(LATIN, low)) return ch;
    const out = LATIN[low];
    return ch === low ? out : out.charAt(0).toUpperCase() + out.slice(1);
  }).join('');
}

const lookup = (text) => (Object.hasOwn(DATA_EN, text) ? DATA_EN[text] : text);
const isEnglish = () => currentLang() === 'en';

// Для текстов, которые сервер собирает из нескольких частей.
const dataText = (text) => (isEnglish() && typeof text === 'string' ? lookup(text) : text);
const personName = (text) => (isEnglish() && typeof text === 'string' ? latin(text) : text);

// Поля ответа, где лежат ФИО, инициалы и номера документов.
const LATIN_FIELDS = new Set(['fullName', 'firstName', 'initials', 'teacher', 'oldTeacher', 'author', 'number']);

function translated(value, key) {
  if (typeof value === 'string') return LATIN_FIELDS.has(key) ? latin(value) : lookup(value);
  if (Array.isArray(value)) return value.map((item) => translated(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, translated(v, k)]));
  }
  return value;
}

// Названия групп и факультетов приходят из браузера на том языке, на котором показаны.
const IDENTIFIERS = ['Факультет международных отношений', 'Факультет международных экономических отношений', 'МО-2-03', 'МЭО-3-07'];
const REVERSE = Object.fromEntries(IDENTIFIERS.map((ru) => [DATA_EN[ru], ru]));
const toRussian = (v) => (typeof v === 'string' && Object.hasOwn(REVERSE, v) ? REVERSE[v] : v);

function dataLanguageMiddleware(req, res, next) {
  if (!isEnglish()) return next();
  const query = { ...req.query };
  for (const field of ['group', 'faculty']) if (field in query) query[field] = toRussian(query[field]);
  Object.defineProperty(req, 'query', { value: query, configurable: true });
  if (req.body && typeof req.body === 'object') {
    for (const field of ['group', 'faculty']) if (field in req.body) req.body[field] = toRussian(req.body[field]);
  }
  const send = res.json.bind(res);
  res.json = (body) => send(translated(body));
  return next();
}

// Объявление: английская версия, если сотрудник её заполнил.
const announcementField = (a, field) => (isEnglish() && a[`${field}_en`]) || a[field];

module.exports = { dataText, personName, latin, dataLanguageMiddleware, announcementField };
