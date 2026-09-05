const {
  hashPassword,
  verifyPassword,
  isValidEmail,
  validateUsername,
  validatePassword,
} = require('../../server/lib/auth');

describe('password hashing', () => {
  test('hashes a password to something other than the plain value', async () => {
    const hash = await hashPassword('password1');
    expect(hash).not.toBe('password1');
    expect(hash.length).toBeGreaterThan(20);
  });

  test('two hashes of the same password are different (salted)', async () => {
    const [a, b] = await Promise.all([hashPassword('password1'), hashPassword('password1')]);
    expect(a).not.toBe(b);
  });

  test('verifyPassword accepts the correct password', async () => {
    const hash = await hashPassword('correct-horse-1');
    await expect(verifyPassword('correct-horse-1', hash)).resolves.toBe(true);
  });

  test('verifyPassword rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-1');
    await expect(verifyPassword('wrong-password-1', hash)).resolves.toBe(false);
  });

  test('verifyPassword rejects when there is no hash on file', async () => {
    await expect(verifyPassword('anything1', null)).resolves.toBe(false);
    await expect(verifyPassword('anything1', undefined)).resolves.toBe(false);
  });
});

describe('isValidEmail', () => {
  test.each([
    'a@b.com',
    'first.last@example.co',
    'user+tag@sub.example.com',
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    'not-an-email',
    'missing-domain@',
    '@missing-local.com',
    'spaces in@email.com',
    'no-dot@example',
    '<script>@evil.com',
    'unclosed"quote@example.com',
    '',
    null,
    undefined,
    123,
  ])('rejects %p', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('validateUsername', () => {
  test.each(['abc', 'harsh_raj', 'user-99', 'A'.repeat(20)])('accepts %p', (username) => {
    expect(validateUsername(username).valid).toBe(true);
  });

  test.each([
    ['ab', 'too short'],
    ['a'.repeat(21), 'too long'],
    ['has space', 'contains a space'],
    ['_startsWithUnderscore', 'starts with underscore'],
    ['<script>', 'contains angle brackets'],
    [null, 'not a string'],
  ])('rejects %p (%s)', (username) => {
    expect(validateUsername(username).valid).toBe(false);
  });
});

describe('validatePassword', () => {
  test.each(['password1', 'Str0ngPassword', '12345678a'])('accepts %p', (password) => {
    expect(validatePassword(password).valid).toBe(true);
  });

  test('rejects passwords under 8 characters', () => {
    const result = validatePassword('abc123');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/8 characters/);
  });

  test('rejects passwords with no letters', () => {
    const result = validatePassword('12345678');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/letter and one number/);
  });

  test('rejects passwords with no numbers', () => {
    const result = validatePassword('abcdefgh');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/letter and one number/);
  });

  test('rejects passwords longer than 72 characters (bcrypt limit)', () => {
    const result = validatePassword(`a1${'x'.repeat(72)}`);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/72 characters/);
  });
});
