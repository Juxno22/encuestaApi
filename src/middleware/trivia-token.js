const { verifyTriviaAccessToken } = require('../utils/tokens');
const { UnauthorizedError } = require('../utils/app-error');

function requireTriviaToken(req, _res, next) {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Falta el acceso autorizado a la trivia.'));
  }

  const token = authorization.slice('Bearer '.length).trim();
  req.triviaToken = verifyTriviaAccessToken(token);
  return next();
}

module.exports = { requireTriviaToken };
