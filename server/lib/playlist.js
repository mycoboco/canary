/*
 *  smart playlist logic
 */

import {logger} from '@hodgepodge-node/server';

import config from '../config.js';
import db from './db.js';

const log = logger.create({
  prefix: 'playlist',
  level: config.debug ? 'info' : 'error',
});

const stringFields = new Set(['title', 'artist', 'album', 'genre']);
const numberFields = new Set(['year']);
const stringOps = new Set(['is', 'contains', 'starts_with', 'ends_with']);
const numberOps = new Set(['is', '>', '>=', '<', '<=']);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validate(body) {
  if (!body || typeof body !== 'object') return 'invalid request body';

  const {
    name,
    match,
    rules,
  } = body;

  if (typeof name !== 'string' || !name.trim()) return 'name is required';
  if (match !== 'all' && match !== 'any') return 'match must be "all" or "any"';
  if (!Array.isArray(rules) || rules.length === 0) return 'rules must be a non-empty array';

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') return 'each rule must be an object';
    const {
      field,
      op,
      value,
    } = rule;

    if (stringFields.has(field)) {
      if (!stringOps.has(op)) return `invalid op "${op}" for string field "${field}"`;
      if (typeof value !== 'string') return `value must be a string for field "${field}"`;
    } else if (numberFields.has(field)) {
      if (!numberOps.has(op)) return `invalid op "${op}" for number field "${field}"`;
      if (typeof value !== 'number' || !isFinite(value)) {
        return `value must be a number for field "${field}"`;
      }
    } else {
      return `unsupported field "${field}"`;
    }
  }

  return null;
}

export function buildQuery(playlist) {
  const conditions = playlist.rules.map((rule) => {
    const {
      field,
      op,
      value,
    } = rule;
    const cond = {};

    if (stringFields.has(field)) {
      const escaped = escapeRegex(value);
      switch (op) {
        case 'is': cond[field] = {$regex: new RegExp(`^${escaped}$`, 'i')}; break;
        case 'contains': cond[field] = {$regex: new RegExp(escaped, 'i')}; break;
        case 'starts_with': cond[field] = {$regex: new RegExp(`^${escaped}`, 'i')}; break;
        case 'ends_with': cond[field] = {$regex: new RegExp(`${escaped}$`, 'i')}; break;
      }
    } else {
      switch (op) {
        case 'is': cond[field] = value; break;
        case '>': cond[field] = {$gt: value}; break;
        case '>=': cond[field] = {$gte: value}; break;
        case '<': cond[field] = {$lt: value}; break;
        case '<=': cond[field] = {$lte: value}; break;
      }
    }

    return cond;
  });

  const op = playlist.match === 'all' ? '$and' : '$or';
  return {[op]: conditions};
}

export async function evaluate(playlist) {
  const query = buildQuery(playlist);
  log.info(`evaluating playlist "${playlist.name}" with query: ${JSON.stringify(query)}`);
  return db.smartpls.query(query);
}

export default {
  validate,
  buildQuery,
  evaluate,
};
