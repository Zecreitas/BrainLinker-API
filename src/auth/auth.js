const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ message: 'Sem token, autorização negada' });
    }
    try {
        const decoded = jwt.verify(token, 'seuSegredoJwt');
        req.user = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token inválido' });
    }
};
