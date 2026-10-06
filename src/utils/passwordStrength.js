// Strong-password rules shared by the Register and Reset-password screens.
// Keep in sync with getPasswordError() in server/validators/authValidators.js
// (the server enforces the same rules - never rely on the frontend alone).
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'Contains uppercase letter', test: (p) => /\p{Lu}/u.test(p) },
  { id: 'lower', label: 'Contains lowercase letter', test: (p) => /\p{Ll}/u.test(p) },
  { id: 'number', label: 'Contains a number', test: (p) => /\d/.test(p) },
  // "Special" = anything that isn't a letter, a digit or whitespace.
  { id: 'special', label: 'Contains special character', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

// How many of the 4 meter segments to fill for each score (rules met, 0-5),
// and the label shown next to "Password strength".
const BARS_BY_SCORE = [0, 1, 1, 2, 3, 4];
const LABEL_BY_SCORE = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];

export function evaluatePassword(password = '') {
  const rules = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
  const metCount = rules.filter((r) => r.met).length;

  // A password shorter than 8 characters can never rate better than "Weak",
  // even if it happens to tick the other boxes (e.g. "Aa1!").
  let score = metCount;
  if (!rules[0].met) score = Math.min(score, 2);
  if (!password) score = 0;

  return {
    rules,
    isValid: metCount === PASSWORD_RULES.length,
    score,
    bars: BARS_BY_SCORE[score],
    label: LABEL_BY_SCORE[score],
  };
}
