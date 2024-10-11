const jwt = require('jsonwebtoken');

// Middleware para verificar o token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido ou formato inválido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '12131415');
    console.log('Token decodificado:', decoded);

    if (!decoded.user || !decoded.user.id) {
      return res.status(401).json({ message: 'Token inválido: ID do usuário não encontrado' });
    }

    req.user = decoded.user;
    next(); 
  } catch (err) {
    console.error('Erro ao verificar o token:', err.message);
    res.status(401).json({ message: 'Token inválido' });
  }
};

module.exports = authenticate;
