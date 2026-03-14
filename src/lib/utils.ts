import DOMPurify from 'dompurify';

// Sanitize HTML to prevent XSS
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

// Sanitize plain text input
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Validate and sanitize URL
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

// Generate random alphanumeric code
export function generateCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Mínimo 8 caracteres');
  if (!/[A-Z]/.test(password)) errors.push('Pelo menos uma letra maiúscula');
  if (!/[a-z]/.test(password)) errors.push('Pelo menos uma letra minúscula');
  if (!/[0-9]/.test(password)) errors.push('Pelo menos um número');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('Pelo menos um caractere especial');
  return { valid: errors.length === 0, errors };
}

// Format date for display
export function formatDate(date: string, locale: string = 'pt-BR'): string {
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Categories list
export const CATEGORIES = [
  'Tecnologia da Informação',
  'Administração',
  'Mecânica',
  'Robótica',
  'Redes de Computadores',
  'Segurança da Informação',
  'Multimídia',
  'Jogos Digitais',
  'Outros',
  'Customizar Tipo',
] as const;

// Difficulty levels
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'insane'] as const;

// Badge rarities
export const RARITIES = ['comum', 'cru', 'epico', 'lendario'] as const;

// Rarity colors
export const RARITY_COLORS: Record<string, string> = {
  comum: 'text-gray-400 border-gray-400',
  cru: 'text-blue-400 border-blue-400',
  epico: 'text-purple-400 border-purple-400',
  lendario: 'text-yellow-400 border-yellow-400',
};

// Difficulty colors
export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  hard: 'bg-orange-500/20 text-orange-400',
  expert: 'bg-red-500/20 text-red-400',
  insane: 'bg-purple-500/20 text-purple-400',
};

// Convert Google Drive sharing URLs to direct image URLs
export function toDirectImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  // Format: https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  // Format: https://drive.google.com/uc?id=FILE_ID&export=view
  const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
  if (ucMatch) return `https://lh3.googleusercontent.com/d/${ucMatch[1]}`;
  // Not a Google Drive URL — return as-is
  return url;
}

// Calculate XP progress
export function calculateXpProgress(xp: number): { level: number; current: number; needed: number; percent: number } {
  const level = Math.floor(xp / 100) + 1;
  const current = xp % 100;
  const needed = 100 - current;
  const percent = current;
  return { level, current, needed, percent };
}
