import { strict as assert } from 'assert';

export class TestUtils {
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static assertEqual(actual, expected, message) {
    assert.strictEqual(actual, expected, message);
  }

  static assertExists(value, message) {
    assert.ok(value, message || 'Value should exist');
  }

  static assertArrayIncludes(array, value, message) {
    assert.ok(array.includes(value), message || `Array should include ${value}`);
  }
}
