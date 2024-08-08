const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../modal/user');
const router = express.Router();
const { body, validationEmail } = require('express-validator');
const Connection = require('../modal/connection');

// Validação de e-mail
  const validateEmail = (email) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
  };

  router.post('/cadastro',
    [
        body('name').not().isEmpty().withMessage('Coloque seu nome'),
        body('email').isEmail().withMessage('Digite um e-mail válido'),
        body('password').isLength({ min: 6 }).withMessage('A senha precisa ter pelo menos 6 caracteres'),
        body('userType').not().isEmpty().withMessage('Tipo de usuário é obrigatório'),
        body('relation').custom((value, { req }) => {
            if (req.body.userType === 'familiar/amigo' && !value) {
                throw new Error('Uma relação é obrigatória para o tipo de usuário familiar/amigo');
            }
            return true;
        }),
        body('nascDate').custom((value, { req }) => {
            if (req.body.userType === 'familiar/amigo' && !value) {
                throw new Error('Uma data de nascimento é obrigatória para o tipo de usuário familiar/amigo');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const { name, email, password, userType, relation, nascDate } = req.body;
  
        if (!validateEmail(email)) {
            return res.status(400).json({ message: 'Formato de e-mail inválido' });
        }
  
        try {
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ message: 'Usuário já existe' });
            }
  
            user = new User({
                name,
                email,
                password,
                userType,
                relation: userType === 'familiar/amigo' ? relation : undefined,
                nascDate: userType === 'familiar/amigo' ? nascDate : undefined,
            });
  
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
  
            await user.save();
            res.status(201).json({ message: 'Usuário criado' });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server error');
        }
    }
  );
  

  // Rota de login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
        // Verifica se o email foi enviado
        if (!email || !password) {
            return res.status(400).json({ message: 'Email e senha são obrigatórios' });
        }
  
        // Busca o usuário no banco de dados
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log('Usuário não encontrado:', email);
            return res.status(400).json({ message: 'Credenciais inválidas' });
        }
  
        // Comparar a senha fornecida com a senha hashada
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            console.log('Senha inválida para o usuário:', email);
            return res.status(400).json({ message: 'Credenciais inválidas' });
        }
  
        const payload = {
            user: {
                id: user.id,
                name: user.name,
                userType: user.userType 
            }
        };
  
        // Gerar token JWT
        jwt.sign(
            payload,
            'secret',
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    token, 
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        userType: user.userType,
                        connection: user.connections
                    }
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
  });
  
  
  

// Rota para conectar usuários
router.post('/connect', async (req, res) => {
    try {
      const { cuidadorId, familiarId } = req.body;
  
      const cuidador = await User.findById(cuidadorId);
      const familiar = await User.findById(familiarId);
  
      if (!cuidador || !familiar) {
        return res.status(404).send({ message: 'Usuário não encontrado' });
      }
  
      if (cuidador.tipoUsuario !== 'cuidador' || familiar.tipoUsuario !== 'familiar/amigo') {
        return res.status(400).send({ message: 'Tipos de usuário inválidos' });
      }
  
      // Verificar se o familiar já está conectado a um cuidador
      if (familiar.connections.length > 0) {
        return res.status(400).send({ message: 'Familiar já está conectado a um cuidador' });
      }
  
      // Criar a conexão
      const connection = new Connection({ cuidador: cuidador._id, familiar: familiar._id });
      await connection.save();
  
      // Adicionar a conexão aos usuários
      cuidador.connections.push(familiar._id);
      familiar.connections.push(cuidador._id);
  
      await cuidador.save();
      await familiar.save();
  
      res.status(201).send({ message: 'Conexão criada com sucesso!' });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

  // Rota para buscar usuário por email ou nome
router.get('/search', async (req, res) => {
    try {
      const { query } = req.query;
      const users = await User.find({
        $or: [
          { email: new RegExp(query, 'i') },
          { nome: new RegExp(query, 'i') }
        ]
      }).select('nome email tipoUsuario relation nascDate');
  
      res.status(200).send(users);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
  

module.exports = router;
