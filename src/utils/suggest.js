'use strict';

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 1; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Returns the lexicographically-first candidate within maxDistance of token,
// or null if none qualifies. Returns null for an exact match (distance 0).
function suggestClosest(token, candidates, maxDistance = 2) {
  if (!token || !candidates || candidates.length === 0) return null;
  const t = token.toLowerCase();
  let best = null;
  let bestDist = maxDistance + 1;
  for (const c of candidates) {
    const dist = levenshtein(t, c.toLowerCase());
    if (dist === 0) return null; // exact match — caller should not have errored
    if (dist < bestDist || (dist === bestDist && c < best)) {
      best = c;
      bestDist = dist;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

module.exports = { levenshtein, suggestClosest };
