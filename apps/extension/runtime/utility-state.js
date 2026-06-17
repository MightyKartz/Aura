import { normalizeComparableUrl } from './status.js';

export const MARKS_KEY_PREFIX = 'aura:mvp:marks:';
export const RESUME_KEY_PREFIX = 'aura:mvp:resume:';
export const MAX_MARKS_PER_PAGE = 12;

function encodeUrlKey(url = '') {
  const normalizedUrl = normalizeComparableUrl(url);
  return normalizedUrl ? encodeURIComponent(normalizedUrl) : '';
}

export function createMarksStorageKey(url = '') {
  const encoded = encodeUrlKey(url);
  return encoded ? `${MARKS_KEY_PREFIX}${encoded}` : '';
}

export function createResumeStorageKey(url = '') {
  const encoded = encodeUrlKey(url);
  return encoded ? `${RESUME_KEY_PREFIX}${encoded}` : '';
}

export function formatPlaybackTime(value = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isValidMark(mark) {
  return Boolean(
    mark
      && Number.isFinite(Number(mark.timeSec))
      && typeof mark.label === 'string'
      && mark.label
      && Number.isFinite(Number(mark.createdAt))
  );
}

export function trimMarks(marks = [], maxEntries = MAX_MARKS_PER_PAGE) {
  return marks
    .filter(isValidMark)
    .slice(-maxEntries)
    .map((mark) => ({
      timeSec: Math.max(0, Math.floor(Number(mark.timeSec))),
      label: String(mark.label),
      createdAt: Number(mark.createdAt)
    }));
}

export async function readMarksForUrl(url, storageArea = chrome.storage.local) {
  const key = createMarksStorageKey(url);
  if (!key) return [];
  const result = await storageArea.get(key);
  return trimMarks(result?.[key] ?? []);
}

export async function saveMarkForUrl(url, mark, storageArea = chrome.storage.local) {
  const key = createMarksStorageKey(url);
  if (!key) return [];
  const nextMarks = trimMarks([...(await readMarksForUrl(url, storageArea)), mark]);
  await storageArea.set({ [key]: nextMarks });
  return nextMarks;
}

export function getLatestMark(marks = []) {
  return trimMarks(marks, MAX_MARKS_PER_PAGE).at(-1) ?? null;
}

function isValidResumePoint(value) {
  return Boolean(
    value
      && Number.isFinite(Number(value.timeSec))
      && typeof value.label === 'string'
      && value.label
      && Number.isFinite(Number(value.updatedAt))
  );
}

export async function readResumePointForUrl(url, storageArea = chrome.storage.local) {
  const key = createResumeStorageKey(url);
  if (!key) return null;
  const result = await storageArea.get(key);
  const resumePoint = result?.[key] ?? null;
  if (!isValidResumePoint(resumePoint)) return null;
  return {
    timeSec: Math.max(0, Math.floor(Number(resumePoint.timeSec))),
    label: String(resumePoint.label),
    updatedAt: Number(resumePoint.updatedAt)
  };
}

export async function writeResumePointForUrl(url, resumePoint, storageArea = chrome.storage.local) {
  const key = createResumeStorageKey(url);
  if (!key || !isValidResumePoint(resumePoint)) return null;
  const normalized = {
    timeSec: Math.max(0, Math.floor(Number(resumePoint.timeSec))),
    label: String(resumePoint.label),
    updatedAt: Number(resumePoint.updatedAt)
  };
  await storageArea.set({ [key]: normalized });
  return normalized;
}
