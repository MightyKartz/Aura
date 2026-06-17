import {
  getCharacterThemeSemanticHint,
  getMicrocopyRecentLabel,
  getMicrocopyResumeLabel,
  getMicrocopyCountLabel,
  getMicrocopyTone
} from './character-theme.js';

function truncateLabel(value = '', maxLength = 8) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
}

export function getTopLeftSemanticLabel({ showContext = '', skin = null } = {}) {
  const semanticHint = truncateLabel(getCharacterThemeSemanticHint(skin));
  if (semanticHint) return semanticHint;

  const contextLabel = truncateLabel(showContext);
  if (contextLabel) return contextLabel;

  const firstTag = Array.isArray(skin?.tags) ? skin.tags.find(Boolean) : '';
  const tagLabel = truncateLabel(firstTag);
  if (tagLabel) return tagLabel;

  return truncateLabel(skin?.name);
}

function buildUtilityLabel(utilitySummary = {}, tone = 'gentle') {
  return getMicrocopyResumeLabel(tone, utilitySummary.resumePointLabel)
    || getMicrocopyRecentLabel(tone, utilitySummary.recentMarkLabel)
    || getMicrocopyCountLabel(tone, utilitySummary.markCount)
    || '';
}

export function buildInfoLayerModel({
  skin = null,
  showContext = '',
  prompt = null,
  utilitySummary = null,
  playbackControl = null
} = {}) {
  const normalizedUtilitySummary = utilitySummary || {};
  const latestMark = normalizedUtilitySummary.latestMark || null;
  const latestMarkTimeSec = Number(latestMark?.timeSec);
  const hasLatestMark = Boolean(latestMark?.label) && Number.isFinite(latestMarkTimeSec);
  const canMarkMoment = playbackControl?.canReadTime === true;
  const canReplayLatestMark = hasLatestMark && playbackControl?.canSeek === true;
  const microcopyTone = getMicrocopyTone(skin);
  const feedbackText = String(prompt?.text || '');

  return {
    semanticLabel: getTopLeftSemanticLabel({ showContext, skin }),
    feedbackText,
    feedbackType: String(prompt?.type || ''),
    utilityLabel: buildUtilityLabel(normalizedUtilitySummary, microcopyTone),
    latestMarkLabel: hasLatestMark ? latestMark.label : '',
    latestMarkTimeSec: hasLatestMark
      ? Math.max(0, Math.floor(latestMarkTimeSec))
      : null,
    canMarkMoment,
    canReplayLatestMark,
    microcopyTone
  };
}
