import Decimal from 'decimal.js';

/**
 * Precision-First Money Handling — Zero Float Math
 * 
 * WHY: 0.1 + 0.2 !== 0.3 in JavaScript. In financial systems,
 * floating-point errors break ledger reconciliation.
 * 
 * RULES:
 * - DB stores as NUMERIC(19,4)
 * - API passes amounts as STRINGS
 * - All math uses decimal.js (arbitrary precision)
 * - JavaScript `number` is NEVER used for money
 */

// Configure decimal.js for financial precision
Decimal.set({
  precision: 28,      // Sufficient for NUMERIC(19,4)
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding — industry standard
  toExpNeg: -19,
  toExpPos: 19,
});

export class Money {
  private value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  /**
   * Create Money from a string representation.
   * Rejects non-numeric or invalid formats.
   */
  static from(amount: string): Money {
    if (typeof amount !== 'string') {
      throw new Error('Money amounts must be provided as strings');
    }

    const trimmed = amount.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      throw new Error(`Invalid money amount: "${amount}"`);
    }

    const decimal = new Decimal(trimmed);
    
    // Validate range — NUMERIC(19,4) max is 10^15 - 1
    if (decimal.abs().greaterThan(new Decimal('999999999999999.9999'))) {
      throw new Error('Amount exceeds maximum precision (NUMERIC 19,4)');
    }

    return new Money(decimal);
  }

  /**
   * Create Money from zero
   */
  static zero(): Money {
    return new Money(new Decimal(0));
  }

  /**
   * Add two money values
   */
  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  /**
   * Subtract money value
   */
  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  /**
   * Multiply by a factor (e.g., tax rate)
   */
  multiply(factor: string | number): Money {
    return new Money(this.value.times(factor));
  }

  /**
   * Compare: returns -1, 0, or 1
   */
  compare(other: Money): number {
    return this.value.comparedTo(other.value);
  }

  /**
   * Check if positive
   */
  isPositive(): boolean {
    return this.value.isPositive();
  }

  /**
   * Check if zero
   */
  isZero(): boolean {
    return this.value.isZero();
  }

  /**
   * Check if negative
   */
  isNegative(): boolean {
    return this.value.isNeg();
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    return new Money(this.value.abs());
  }

  /**
   * Return as DB-safe string with 4 decimal places
   */
  toFixed(): string {
    return this.value.toFixed(4);
  }

  /**
   * Return as API string representation
   */
  toString(): string {
    return this.value.toFixed(4);
  }

  /**
   * Return raw Decimal for advanced operations
   */
  toDecimal(): Decimal {
    return this.value;
  }
}

/**
 * Validate that a string is a valid money amount.
 * Use in Joi custom validators.
 */
export function isValidMoneyAmount(amount: string): boolean {
  try {
    Money.from(amount);
    return true;
  } catch {
    return false;
  }
}
