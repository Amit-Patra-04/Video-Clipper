/**
 * WebVTT Caption Utilities & XSS Sanitization
 */

export function sanitizeCaptionText(text) {
  if (!text) return '';
  // Strip dangerous HTML tags
  const noTags = String(text).replace(/<[^>]*>/g, '');
  // Escape HTML entities to prevent DOM XSS injection
  return noTags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function formatVttTimestamp(seconds) {
  const secs = Math.max(0, Number(seconds) || 0);
  const totalMs = Math.round(secs * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const pad = (num, digits = 2) => String(num).padStart(digits, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(s)}.${pad(ms, 3)}`;
}

export function generateWebVTT(segments = []) {
  const lines = ['WEBVTT', ''];

  segments.forEach((seg, index) => {
    const start = Number(seg.start || 0);
    const end = Number(seg.end || start + 1);
    const rawText = seg.text || '';
    const cleanText = sanitizeCaptionText(rawText);

    if (!cleanText) return;

    lines.push(String(index + 1));
    lines.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    if (seg.speaker) {
      lines.push(`<v ${sanitizeCaptionText(seg.speaker)}>${cleanText}`);
    } else {
      lines.push(cleanText);
    }
    lines.push('');
  });

  return lines.join('\n');
}

export function downloadVTT(segments = [], filename = 'captions.vtt') {
  const vttContent = generateWebVTT(segments);
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.vtt') ? filename : `${filename}.vtt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
