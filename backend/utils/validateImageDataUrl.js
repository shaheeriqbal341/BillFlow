const signatures = {
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/webp': Buffer.from('RIFF'),
};

function validateImageDataUrl(value, { allowWebp = true, maxLength = 2_500_000 } = {}) {
  if (typeof value !== 'string' || value.length > maxLength) return false;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || (!allowWebp && match[1] === 'image/webp')) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) return false;
  const signature = signatures[match[1]];
  if (!bytes.subarray(0, signature.length).equals(signature)) return false;
  return match[1] !== 'image/webp' || (bytes.length >= 12 && bytes.subarray(8, 12).toString() === 'WEBP');
}

module.exports = validateImageDataUrl;
