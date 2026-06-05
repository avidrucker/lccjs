'use strict';

// Unit coverage for GraphQL error detection in findIssueStates (#830).
// Verifies that _parseGqlErrors correctly identifies GraphQL validation errors
// vs. gh-unavailable (null / non-JSON) so the "gh unavailable" message is not
// shown when the real cause is a malformed query.

const { _parseGqlErrors } = require('../../scripts/puzzle-status.js');

describe('_parseGqlErrors', () => {
  test('returns null for empty/null stdout', () => {
    expect(_parseGqlErrors(null)).toBeNull();
    expect(_parseGqlErrors('')).toBeNull();
    expect(_parseGqlErrors('   ')).toBeNull();
  });

  test('returns null for non-JSON stdout (gh not installed / auth error)', () => {
    expect(_parseGqlErrors('gh: command not found')).toBeNull();
    expect(_parseGqlErrors('error: not logged in')).toBeNull();
  });

  test('returns null for JSON without an errors array', () => {
    expect(_parseGqlErrors('{"data":{"repo":{"i1":{"number":1,"state":"OPEN"}}}}')).toBeNull();
  });

  test('returns the errors array for a pagination-missing GraphQL response', () => {
    const body = JSON.stringify({
      data: { repository: null },
      errors: [{
        type: 'MISSING_PAGINATION_BOUNDARIES',
        message: 'You must provide a `first` or `last` value to properly paginate the `issues` connection.',
      }],
    });
    const result = _parseGqlErrors(body);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].message).toMatch(/first.*or.*last/i);
  });

  test('returns null for JSON with an empty errors array', () => {
    expect(_parseGqlErrors('{"errors":[]}')).toBeNull();
  });

  test('returns the errors array when multiple errors are present', () => {
    const body = JSON.stringify({ errors: [{ message: 'err A' }, { message: 'err B' }] });
    expect(_parseGqlErrors(body)).toHaveLength(2);
  });
});
