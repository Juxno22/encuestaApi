const crypto = require('node:crypto');

function stableShuffle(items, seed) {
  return [...items]
    .map((item) => ({
      item,
      rank: crypto.createHash('sha256').update(`${seed}:${item.id}`).digest('hex')
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(({ item }) => item);
}

module.exports = { stableShuffle };
