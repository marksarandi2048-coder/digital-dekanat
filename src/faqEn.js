'use strict';
// «Спроси деканат»: английская версия ответов. Порядок и номера — как в faq.js.
const CONTACTS = [
  'FIR Dean’s Office — Building 1, Room 213, +7 (495) 000-02-13, dekanat-fmo@example.edu',
  'FIER Dean’s Office — Building 3, Room 405, +7 (495) 000-04-05, dekanat-meo@example.edu',
].join('\n');

const ACTION_LABELS = {
  '/requests/new?type=study_certificate': 'Order a certificate',
  '/requests/new?type=enrollment_certificate': 'Order a certificate of admission',
  '/requests/new?type=order_extract': 'Order an extract',
  '/requests/new?type=appeal': 'Contact the Dean’s Office',
  '/appointments': 'Book an appointment',
  '/grades/bonus': 'Where to earn a bonus',
  '/student-card': 'Open student ID',
  '/grades': 'Open grades',
  '/today': 'Open schedule',
};

const FAQ_EN = {
  'certificate-study': {
    category: 'Certificates',
    question: 'How do I order a certificate of enrollment?',
    keywords: 'certificate enrollment proof of study student status letter employer bank work confirmation',
    answer: 'Order the certificate in the “Requests” section: say what it is for and choose electronic or paper. The status is shown in the request; an electronic certificate is usually ready within one working day.',
  },
  'certificate-enrollment': {
    category: 'Certificates',
    question: 'How do I get a certificate of admission?',
    keywords: 'certificate admission admitted freshman first year enrollment order',
    answer: 'Submit a request in the “Requests” section. Paper certificates are picked up at your faculty’s Dean’s Office once the status changes to “Ready for pickup”.',
  },
  'certificate-verify': {
    category: 'Certificates',
    question: 'How can the authenticity of an electronic certificate be checked?',
    keywords: 'electronic certificate qr code verify genuine authentic employer check',
    answer: 'An electronic certificate has a QR code. It opens a page showing whether the certificate is valid. An electronic certificate is valid for 30 days.',
  },
  'certificate-visa': {
    category: 'Certificates',
    question: 'Which certificate do I need for a visa?',
    keywords: 'visa embassy schengen consulate travel abroad certificate in english',
    answer: 'A certificate of enrollment is usually suitable for a visa. Name the embassy or visa center in your request. If you need a translation into a foreign language, say so in the comment.',
  },
  'order-extract': {
    category: 'Certificates',
    question: 'How do I get an extract from an order?',
    keywords: 'extract order scholarship copy of order decree',
    answer: 'Order the extract in the “Requests” section and specify which order you need. The completed extract is issued at your faculty’s Dean’s Office.',
  },
  'leave-apply': {
    category: 'Academic leave',
    question: 'How do I apply for academic leave?',
    keywords: 'academic leave gap year take time off break studies illness family circumstances application',
    answer: 'Book an appointment with the Dean’s Office and bring a document confirming the reason: a medical report or other papers. Academic leave is granted on the basis of an application and an order.',
  },
  'leave-duration': {
    category: 'Academic leave',
    question: 'How long can academic leave last?',
    keywords: 'how long academic leave duration two years extend period',
    answer: 'Academic leave is usually granted for up to two years. Ask at a Dean’s Office appointment whether it can be extended in your case.',
  },
  'leave-return': {
    category: 'Academic leave',
    question: 'How do I return from academic leave?',
    keywords: 'return back from academic leave resume studies come back reinstate continue',
    answer: 'Submit an application to the Dean’s Office two weeks before your academic leave ends. If the curriculum has changed, you will be given a list of differences to make up.',
  },
  'retake-how': {
    category: 'Retakes',
    question: 'How do I retake an exam?',
    keywords: 'retake resit exam pass fail test credit failed did not pass outstanding exams debt',
    answer: 'Retake dates are published in Dean’s Office announcements after the exam session. If there is no date or you have questions, book an appointment and choose the topic “Outstanding exams”.',
  },
  'retake-count': {
    category: 'Retakes',
    question: 'How many times can I retake an exam?',
    keywords: 'how many attempts retake commission third attempt expulsion outstanding exams debts',
    answer: 'There are usually two retake attempts, the second before a commission. If outstanding exams are not cleared on time, the Dean’s Office may consider expulsion.',
  },
  'retake-excused': {
    category: 'Retakes',
    question: 'What should I do if I was ill and missed an exam?',
    keywords: 'missed exam did not come illness sick leave valid reason doctor note medical certificate',
    answer: 'Tell the Dean’s Office as soon as possible and bring a medical certificate. With a valid reason, a new date is set and the attempt is not counted.',
  },
  'transfer-program': {
    category: 'Transfer',
    question: 'How do I transfer to another degree program?',
    keywords: 'transfer switch change faculty another program major specialty',
    answer: 'Transfers are considered at the start of the semester if places are available. Book an appointment with the topic “Transfer”: you will be told the deadlines and the curriculum differences.',
  },
  'transfer-budget': {
    category: 'Transfer',
    question: 'Can I move from a paid place to a state-funded one?',
    keywords: 'transfer contract paid tuition free state funded budget places',
    answer: 'You can move if state-funded places are available and you have good grades and no outstanding exams. Applications are accepted twice a year; deadlines are published in announcements.',
  },
  'scholarship-pay': {
    category: 'Scholarship',
    question: 'When is the scholarship paid, and who receives it?',
    keywords: 'scholarship stipend grant payment when paid money date bank card details',
    answer: 'The scholarship is paid to your card once a month. The academic scholarship is awarded based on exam session results if you have no grades below “good” and no outstanding exams.',
  },
  'scholarship-high': {
    category: 'Scholarship',
    question: 'How do I get an enhanced scholarship?',
    keywords: 'enhanced increased scholarship more money competition achievements research sport volunteering documents',
    answer: 'The enhanced scholarship is awarded competitively for studies, research, sports or community work. A confirmed bonus in the portal helps demonstrate your achievements.',
  },
  'dorm-get': {
    category: 'Dormitory',
    question: 'How do I get a place in a dormitory?',
    keywords: 'dormitory dorm hostel housing accommodation room move in place out of town campus',
    answer: 'Send an inquiry to the Dean’s Office and say whether you need a place next year. Students from other cities get places first if rooms are available.',
  },
  'dorm-pay': {
    category: 'Dormitory',
    question: 'How do I pay for the dormitory and renew my contract?',
    keywords: 'pay dormitory dorm contract renew extend accommodation receipt room fee',
    answer: 'The contract is renewed every academic year at the dormitory’s student office. Payment receipts are issued there too; you can ask questions through an inquiry to the Dean’s Office.',
  },
  'military-certificate': {
    category: 'Military registration desk',
    question: 'How do I get a certificate for the military registration office?',
    keywords: 'military registration office certificate form summons army registration desk',
    answer: 'The certificate is issued by the military registration desk: Building 2, Room 104. Bring your passport and your registration certificate or military ID.',
  },
  'military-deferral': {
    category: 'Military registration desk',
    question: 'How do I get a deferral from military service?',
    keywords: 'deferral deferment army draft conscription service military office studies summons',
    answer: 'A deferral for the period of study is arranged at the military registration office with a certificate from the military registration desk. If your documents or address change, report it within two weeks.',
  },
  'card-where': {
    category: 'Student ID',
    question: 'Where can I find my digital student ID?',
    keywords: 'student id card digital qr code entrance show security guard pass',
    answer: 'Open the ID with the icon in the header on a phone or with “Student ID” in the menu on a computer. This is a concept: the ID is not an official document.',
  },
  'card-lost': {
    category: 'Student ID',
    question: 'What should I do if I lost my student ID?',
    keywords: 'lost stolen missing student id card replace paper duplicate replacement',
    answer: 'Send an inquiry to the Dean’s Office: you will need an application for a duplicate. While it is being made, you can use the digital ID in the portal.',
  },
  'bonus-earn': {
    category: 'Bonus',
    question: 'How can I earn a rating bonus?',
    keywords: 'bonus extra points volunteering sports club research paper model un activities',
    answer: 'A bonus is given for volunteering, sports clubs and research work. Sign up for an activity in the bonus section: once your participation is confirmed, the Dean’s Office will award the points.',
  },
  'bonus-limit': {
    category: 'Bonus',
    question: 'How many bonus points can I get?',
    keywords: 'maximum bonus limit ten points rating how calculated',
    answer: 'No more than +10 bonus points count toward your rating per semester. Anything above that is not counted.',
  },
  'password-reset': {
    category: 'Sign-in',
    question: 'How do I recover my portal password?',
    keywords: 'forgot password username cannot sign in log in login reset recover restore access portal',
    answer: `For now, passwords are restored by your faculty’s Dean’s Office; there is no reset on the site yet. Visit in person or write to:\n${CONTACTS}`,
  },
  appointment: {
    category: 'Dean’s Office',
    question: 'How do I book a Dean’s Office appointment without queuing?',
    keywords: 'appointment book queue schedule office hours dean time when open',
    answer: 'Choose a topic, date and available time on the “Appointments” tab in the “Requests” section. You can reschedule or cancel before the appointment starts.',
  },
};

module.exports = { FAQ_EN, ACTION_LABELS };
