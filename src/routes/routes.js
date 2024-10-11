const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../modal/user');
const Midia = require('../modal/midia');
const router = express.Router();
const { body, validationEmail } = require('express-validator');
const Connection = require('../modal/connection');
const multer = require('multer');
const path = require('path');
const authenticate = require('../auth/authenticate');

// Configuração do multer para armazenar arquivos na pasta 'uploads'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Função para validar e-mail
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Rota de cadastro
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

      // Criar um novo usuário
      user = new User({
        name,
        email,
        password,
        userType,
        relation: userType === 'familiar/amigo' ? relation : undefined,
        nascDate: userType === 'familiar/amigo' ? nascDate : undefined,
      });

      await user.save();
      res.status(201).json({ message: 'Usuário criado' });
    } catch (err) {
      console.error('Erro ao criar usuário:', err.message);
      res.status(500).send('Erro no servidor');
    }
  }
);

 // Rota de login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    if (user.password !== password) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const payload = {
      user: {
        id: user._id,
        name: user.name,
        userType: user.userType
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || '12131415',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            connection: user.connections
          }
        });
      }
    );
  } catch (err) {
    console.error('Erro durante o login:', err.message);
    res.status(500).send('Erro no servidor');
  }
});
  
// Rota para conectar o usuário ao cuidador
router.post('/conectar', authenticate, async (req, res) => {
  const { emailCuidador } = req.body;

  try {
    const usuarioId = req.user.id; 

    console.log('ID do usuário autenticado:', usuarioId);

    const cuidador = await User.findOne({ email: emailCuidador });
    if (!cuidador) {
      return res.status(400).json({ message: 'Cuidador não encontrado' });
    }

    const usuario = await User.findById(usuarioId); 
    if (!usuario) {
      return res.status(400).json({ message: 'Usuário não encontrado' });
    }

    if (!usuario.connections) {
      usuario.connections = [];
    }

    if (usuario.connections.includes(cuidador._id.toString())) {
      return res.status(400).json({ message: 'Já está conectado com este cuidador' });
    }

    usuario.connections.push(cuidador._id);
    await usuario.save();

    res.status(200).json({
      message: 'Conexão estabelecida com sucesso',
      conexoes: usuario.connections,
    });
  } catch (err) {
    console.error('Erro durante a conexão:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


// Rota para upload de mídia
router.post('/upload-midia', authenticate, upload.single('file'), async (req, res) => {
  console.log('Dados recebidos:', req.body);
  console.log('Arquivo recebido:', req.file);
  try {
    console.log('Chegou na rota de upload de mídia!');
    const { tipo, descricao, remetenteId, destinatarioId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' });
    }

    const remetente = await User.findById(remetenteId);
    if (!remetente) {
      return res.status(404).json({ message: 'Remetente não encontrado.' });
    }

    if (!remetente.connections.includes(destinatarioId)) {
      return res.status(400).json({ message: 'Destinatário não está conectado ao remetente.' });
    }

    const novaMidia = new Midia({
      tipo,
      caminho: req.file.path,
      descricao,
      remetente: remetenteId,
      destinatario: destinatarioId
    });

    await novaMidia.save();
    res.status(200).json({ message: 'Mídia enviada com sucesso', midia: novaMidia });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para obter todas as mídias do cuidador autenticado
router.get('/midias/:connectionId', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id; 
    const midias = await Midia.find({
      $or: [ 
        { remetente: userId, destinatario: connectionId },
        { remetente: connectionId, destinatario: userId }
      ]
    });

    if (!midias || midias.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mídia encontrada' });
    }

    res.status(200).json(midias);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  } 
});

router.get('/user/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }


    const { password, ...userData } = user.toObject(); 
    res.status(200).json(userData);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


module.exports = router;
