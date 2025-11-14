import { createHash } from 'crypto';
import { IKeyGenerator } from '../core/interfaces';

/**
 * Generates cache keys from patterns and method arguments
 * Supports expression syntax: #{param}, #{0}, #{user.id}, etc.
 */
export class KeyGenerator implements IKeyGenerator {
  /**
   * Generate cache key from pattern and arguments
   * @param pattern - Key pattern with #{} expressions
   * @param args - Method arguments
   * @param methodName - Method name (fallback)
   */
  generate(pattern: string | undefined, args: any[], methodName: string | symbol): string {
    if (!pattern) {
      return this.defaultKey(methodName, args);
    }

    return this.parseExpression(pattern, args);
  }

  /**
   * Parse expression pattern and replace #{} placeholders
   * Examples:
   * - #{0} -> args[0]
   * - #{id} -> args[0] (assuming first param is named 'id')
   * - #{user.id} -> args[0].id
   * - #{result.id} -> handled in decorator (after execution)
   */
  private parseExpression(pattern: string, args: any[]): string {
    return pattern.replace(/#\{([^}]+)\}/g, (match, expr) => {
      return this.evaluateExpression(expr, args);
    });
  }

  /**
   * Evaluate a single expression
   */
  private evaluateExpression(expr: string, args: any[]): string {
    // Handle positional arguments: #{0}, #{1}
    if (/^\d+$/.test(expr)) {
      const index = parseInt(expr, 10);
      return this.stringify(args[index]);
    }

    // Handle property access: #{user.id}, #{0.name}
    if (expr.includes('.')) {
      return this.evaluatePropertyAccess(expr, args);
    }

    // Handle simple parameter name (assume first arg)
    // This is a simple heuristic - for better support, use metadata
    return this.stringify(args[0]);
  }

  /**
   * Evaluate property access expression
   * Examples: #{0.id}, #{user.name}, #{data.user.id}
   */
  private evaluatePropertyAccess(expr: string, args: any[]): string {
    const parts = expr.split('.');
    let value: any;

    // Check if first part is a number (positional)
    if (/^\d+$/.test(parts[0])) {
      const index = parseInt(parts[0], 10);
      value = args[index];
      parts.shift(); // Remove index from parts
    } else {
      // Assume first argument
      value = args[0];
    }

    // Navigate through properties
    for (const prop of parts) {
      if (value === null || value === undefined) {
        return '';
      }
      value = value[prop];
    }

    return this.stringify(value);
  }

  /**
   * Convert value to string for key
   */
  private stringify(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // For objects, use JSON
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Generate default key when no pattern is provided
   * Uses method name + hash of arguments
   */
  private defaultKey(methodName: string | symbol, args: any[]): string {
    const argsHash = this.hashArgs(args);
    return `${String(methodName)}:${argsHash}`;
  }

  /**
   * Generate hash from arguments
   */
  private hashArgs(args: any[]): string {
    try {
      const str = JSON.stringify(args);
      return createHash('md5').update(str).digest('hex').substring(0, 16);
    } catch {
      // Fallback for non-serializable args
      return createHash('md5')
        .update(String(args.length))
        .digest('hex')
        .substring(0, 16);
    }
  }
}

/**
 * Singleton instance
 */
export const defaultKeyGenerator = new KeyGenerator();
