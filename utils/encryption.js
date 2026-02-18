const crypto = require('crypto');

const KEY = process.env.TRAKT_ENCRYPTION_KEY;

// Encrypt a string using AES-256-GCM
const encrypt = (text) => {
  if (!KEY) return text; // No-op if no key configured
  const key = Buffer.from(KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
};

// Decrypt a string encrypted with encrypt()
const decrypt = (encrypted) => {
  if (!KEY) return encrypted;
  try {
    const [ivHex, tagHex, data] = encrypted.split(':');
    const key = Buffer.from(KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption failed:', e.message);
    return null;
  }
};

// Generate a random 32-byte hex key (for setup)
const generateKey = () => crypto.randomBytes(32).toString('hex');

module.exports = { encrypt, decrypt, generateKey };
