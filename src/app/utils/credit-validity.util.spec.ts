import {
  CREDIT_EXPIRY_ALERT_WINDOW_DAYS,
  getCreditExpiryPriority,
  isCreditOrderExpired,
} from './credit-validity.util';

describe('credit expiry dashboard criteria', () => {
  it('includes orders expiring within the 90-day dashboard window', () => {
    expect(CREDIT_EXPIRY_ALERT_WINDOW_DAYS).toBe(90);
  });

  it('assigns priority at the documented day thresholds', () => {
    expect(getCreditExpiryPriority(7)).toBe('critical');
    expect(getCreditExpiryPriority(8)).toBe('high');
    expect(getCreditExpiryPriority(14)).toBe('high');
    expect(getCreditExpiryPriority(15)).toBe('medium');
    expect(getCreditExpiryPriority(30)).toBe('medium');
    expect(getCreditExpiryPriority(31)).toBe('low');
    expect(getCreditExpiryPriority(90)).toBe('low');
  });

  it('treats the validity date as active through the end of that day', () => {
    const validityDate = new Date('2026-10-10T00:00:00');
    expect(
      isCreditOrderExpired(validityDate, new Date('2026-10-10T23:59:59'))
    ).toBe(false);
    expect(
      isCreditOrderExpired(validityDate, new Date('2026-10-11T00:00:00'))
    ).toBe(true);
  });
});
