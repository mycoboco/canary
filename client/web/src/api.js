const BASE = '/api';
const STORAGE_KEY = 'canary.auth';

let credentials = sessionStorage.getItem(STORAGE_KEY) || '';

export class AuthError extends Error {
  constructor(invalid) {
    super(invalid ? 'Invalid password' : 'Password required');
    this.name = 'AuthError';
    this.invalid = invalid;
  }
}

export function setPassword(password) {
  credentials = btoa(`web:${password}`);
  sessionStorage.setItem(STORAGE_KEY, credentials);
}

export function clearPassword() {
  credentials = '';
  sessionStorage.removeItem(STORAGE_KEY);
}

async function request(path, options = {}) {
  const headers = {...(options.headers || {})};
  const sentCredentials = !!credentials;
  if (sentCredentials) headers.Authorization = `Basic ${credentials}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {...options, headers});
  } catch {
    throw new Error('Cannot connect to server');
  }
  if (res.status === 401) {
    clearPassword();
    throw new AuthError(sentCredentials);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res;
}

function json(path) {
  return request(path).then((res) => res.json());
}

function mutate(method, path, data) {
  const options = {method};
  if (data !== undefined) {
    options.headers = {'Content-Type': 'application/json'};
    options.body = JSON.stringify(data);
  }
  return request(path, options);
}

export const fetchServer = () => json('/server');
export const fetchSongs = () => json('/songs');
export const fetchPlaylists = () => json('/playlists');
export const fetchPlaylistSongs = (id) => json(`/playlists/${id}/songs`);
export const createPlaylist = (data) => mutate('POST', '/playlists', data).then((r) => r.json());
export const updatePlaylist = (id, data) => mutate('PUT', `/playlists/${id}`, data).then((r) => r.json());
export const deletePlaylist = (id) => mutate('DELETE', `/playlists/${id}`);
export const streamUrl = (id) => `${BASE}/songs/${id}/stream`;
export const coverUrl = (id) => `${BASE}/songs/${id}/cover`;
