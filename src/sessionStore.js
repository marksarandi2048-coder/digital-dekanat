'use strict';
// Хранилище сессий в памяти сервера: встроенное в express-session, плюс уборка.
// Встроенное удаляет просроченную сессию, только когда к ней обращаются, поэтому сессии ушедших
// посетителей копились бы в памяти (об этом express-session и предупреждает в боевом режиме).
// Здесь раз в 15 минут просроченные удаляются. На диск сессии нарочно не пишутся:
// в них живёт переписка с помощником (см. docs/decisions.md). После перезапуска нужно войти заново.
const session = require('express-session');

const SWEEP_MS = 15 * 60 * 1000;

class SweepingMemoryStore extends session.Store {
  constructor() {
    super();
    this.inner = new session.MemoryStore();
    // all() у встроенного хранилища проходит по всем сессиям и попутно удаляет просроченные
    setInterval(() => this.inner.all(() => {}), SWEEP_MS).unref();
  }

  get(sid, cb) { this.inner.get(sid, cb); }
  set(sid, sess, cb) { this.inner.set(sid, sess, cb); }
  destroy(sid, cb) { this.inner.destroy(sid, cb); }
  touch(sid, sess, cb) { this.inner.touch(sid, sess, cb); }
  all(cb) { this.inner.all(cb); }
  length(cb) { this.inner.length(cb); }
  clear(cb) { this.inner.clear(cb); }
}

module.exports = { SweepingMemoryStore };
