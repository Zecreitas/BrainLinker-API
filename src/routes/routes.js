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
const Message = require('../modal/message');

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

      // Hash da senha
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user = new User({
        name,
        email,
        password: hashedPassword,
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
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


router.post('/upload-midia', authenticate, upload.single('file'), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' });
  }

  const { tipo, descricao, remetenteId } = req.body;

  try {
    const remetente = await User.findById(remetenteId).populate('connections');
    if (!remetente) {
      return res.status(404).json({ message: 'Remetente não encontrado.' });
    }

    const cuidadores = remetente.connections.filter(conn => conn.userType === 'cuidador');
    const midiasParaSalvar = cuidadores.map(cuidador => ({
      tipo,
      caminho: req.file.path,
      descricao,
      remetente: remetenteId,
      destinatario: cuidador._id,
      dataEnvio: Date.now()
    }));

    const midiasSalvas = await Midia.insertMany(midiasParaSalvar);

    res.status(200).json({ message: 'Mídia enviada com sucesso para todos os cuidadores', midias: midiasSalvas });
  } catch (err) {
    console.error('Erro no servidor:', err.message);
    res.status(500).send('Erro no servidor');
  }
});



// Rota para obter todas as mídias relacionadas ao usuário autenticado
router.get('/midias', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const midias = await Midia.find({
      $or: [
        { remetente: userId },
        { destinatario: userId }
      ]
    })
    .populate('remetente', 'name relation nascDate')
    .populate('destinatario', 'name relation nascDate')
    .sort({ dataEnvio: -1 }); 

    if (!midias || midias.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mídia encontrada' });
    }

    res.status(200).json(midias);
  } catch (error) {
    console.error('Erro ao carregar as mídias:', error);
    res.status(500).json({ message: 'Erro ao carregar as mídias' });
  }
});


// Rota para obter informações de um usuário
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

// Rota para atualizar informações de um usuário
router.put('/user/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, relation, connections } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (name) {
      user.name = name;
    }

    if (relation) {
      user.relation = relation;
    }

    if (connections) {
      connections.forEach((connection) => {
        if (!user.connections.includes(connection)) {
          user.connections.push(connection); 
        }
      });
    }

    await user.save();
    res.status(200).json({ message: 'Informações de nome, relação e conexões atualizadas com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar informações do usuário:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


// Rota para enviar mensagens
router.post('/messages', authenticate, async (req, res) => {
  try {
    const { destinatarioId, texto } = req.body;
    const remetenteId = req.user.id; 
    
    if (!destinatarioId || !texto) {
      return res.status(400).json({ message: 'Destinatário e texto são obrigatórios' });
    }

    const novaMensagem = new Message({
      remetente: remetenteId,
      destinatario: destinatarioId,
      texto
    });

    await novaMensagem.save();
    res.status(201).json({ message: 'Mensagem enviada com sucesso', mensagem: novaMensagem });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


// Rota para buscar mensagens
router.get('/messages/:connectionId', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;

    const mensagens = await Message.find({
      $or: [
        { remetente: userId, destinatario: connectionId },
        { remetente: connectionId, destinatario: userId }
      ]
    }).sort({ dataEnvio: 1 });

    if (!mensagens || mensagens.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mensagem encontrada' });
    }

    res.status(200).json(mensagens);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err.message);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para buscar mensagens não lidas
router.get('/mensagens-naolidas/:connectionId?', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType;

    console.log('=== Debugging Informações Iniciais ===');
    console.log('User ID:', userId);
    console.log('User Type:', userType);
    console.log('Connection ID:', connectionId);

    let mensagensNaoLidas;

    if (userType === 'cuidador') {
      console.log('Consultando mensagens para cuidador...');
      mensagensNaoLidas = await Message.find({
        destinatario: userId,
        lida: false,
      }).sort({ dataEnvio: 1 });

      console.log('Mensagens não lidas (cuidador):', mensagensNaoLidas);
    }

    if (userType === 'familiar/amigo') {
      console.log('Consultando mensagens para familiar/amigo...');
      if (!connectionId) {
        console.error('Connection ID não fornecido para familiar/amigo');
        return res.status(400).json({ message: 'Connection ID é necessário' });
      }

      mensagensNaoLidas = await Message.find({
        $or: [
          { remetente: connectionId, destinatario: userId },
          { remetente: userId, destinatario: connectionId },
        ],
        lida: false,
      }).sort({ dataEnvio: 1 });

      console.log('Mensagens não lidas (familiar/amigo):', mensagensNaoLidas);
    }

    if (!mensagensNaoLidas || mensagensNaoLidas.length === 0) {
      console.log('Nenhuma mensagem não lida encontrada');
      return res.status(404).json({ message: 'Nenhuma mensagem não lida encontrada' });
    }

    res.status(200).json(mensagensNaoLidas);
  } catch (err) {
    console.error('Erro ao buscar mensagens não lidas:', err.message);
    res.status(500).send('Erro no servidor');
  }
});



// Marcar mensagens como lidas
router.put('/marcar-como-lida/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;

    const mensagem = await Message.findById(messageId);
    if (!mensagem) {
      return res.status(404).json({ message: 'Mensagem não encontrada' });
    }

    mensagem.lida = true;
    await mensagem.save();

    res.status(200).json({ message: 'Mensagem marcada como lida' });
  } catch (err) {
    console.error('Erro ao marcar mensagem como lida:', err.message);
    res.status(500).send('Erro no servidor');
  }
});

// Marcar mídias como lidas
router.put('/marcar-midia-como-lida/:midiaId', authenticate, async (req, res) => {
  try {
    const { midiaId } = req.params;
    const midia = await Midia.findById(midiaId);
    if (!midia) {
      return res.status(404).json({ message: 'Mídia não encontrada' });
    }

    midia.lida = true;
    await midia.save();

    res.status(200).json({ message: 'Mídia marcada como lida' });
  } catch (err) {
    console.error('Erro ao marcar mídia como lida:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


// Rota para obter as mídias enviadas na última semana
router.get('/midias-semana/:connectionId?', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType;

    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

    let midias;

    if (userType === 'cuidador') {
      midias = await Midia.find({
        destinatario: userId,
        dataEnvio: { $gte: umaSemanaAtras },
      }).populate('remetente', 'name relation nascDate');
    } else {
      midias = await Midia.find({
        $or: [
          { remetente: userId, destinatario: connectionId },
          { remetente: connectionId, destinatario: userId },
        ],
        dataEnvio: { $gte: umaSemanaAtras },
      }).populate('remetente', 'name relation nascDate');
    }

    if (!midias || midias.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mídia encontrada na última semana' });
    }

    res.status(200).json(midias);
  } catch (err) {
    console.error('Erro ao buscar mídias da semana:', err.message);
    res.status(500).send('Erro no servidor');
  }
});


// Rota para familiares/amigos
router.get('/contatos/familiar', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate('connections');
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const cuidadores = user.connections.filter(conn => conn.userType === 'cuidador');
    
    const formattedCuidadores = cuidadores.map((cuidador) => {
      const nascDate = new Date(cuidador.nascDate);
      const age = new Date().getFullYear() - nascDate.getFullYear();
      return {
        _id: cuidador._id,
        name: cuidador.name,
        relation: cuidador.relation,
        age,
      };
    });

    res.json(formattedCuidadores);
  } catch (error) {
    console.error('Erro ao buscar contatos conectados para familiares:', error);
    res.status(500).json({ message: 'Erro ao buscar contatos conectados' });
  }
});

// Rota para cuidadores
router.get('/contatos/cuidador', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const familiares = await User.find({
      userType: { $in: ['familiar/amigo'] },
      connections: userId,
    });

    const formattedFamiliares = familiares.map((familiar) => {
      const nascDate = new Date(familiar.nascDate);
      const age = new Date().getFullYear() - nascDate.getFullYear();
      return {
        _id: familiar._id,
        name: familiar.name,
        relation: familiar.relation,
        age,
      };
    });

    res.json(formattedFamiliares);
  } catch (error) {
    console.error('Erro ao buscar contatos conectados para cuidadores:', error);
    res.status(500).json({ message: 'Erro ao buscar contatos conectados' });
  }
});


// Rota para listar contatos que enviaram mídias
router.get('/contatos-midias', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const midiasRecebidas = await Midia.find({ destinatario: userId }).populate('remetente');
    const remetentesUnicos = Array.from(new Set(midiasRecebidas.map(midia => midia.remetente._id.toString())))
      .map(id => midiasRecebidas.find(midia => midia.remetente._id.toString() === id).remetente);

    const formattedContatos = remetentesUnicos.map(remetente => {
      const nascDate = new Date(remetente.nascDate);
      const age = new Date().getFullYear() - nascDate.getFullYear();
      return {
        _id: remetente._id,
        name: remetente.name,
        relation: remetente.relation,
        age,
      };
    });

    res.json(formattedContatos);
  } catch (error) {
    console.error('Erro ao buscar contatos de mídias:', error);
    res.status(500).json({ message: 'Erro ao buscar contatos de mídias' });
  }
});

// Rota para obter mídias enviadas por um contato específico para o cuidador
router.get('/midias/contato/:contatoId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id; 
    const { contatoId } = req.params;

    const midias = await Midia.find({
      remetente: contatoId, 
      destinatario: userId 
    })
    .populate('remetente', 'name relation nascDate')
    .populate('destinatario', 'name relation nascDate')
    .sort({ dataEnvio: -1 });

    if (!midias || midias.length === 0) {
      return res.status(404).json({ message: 'Nenhuma mídia encontrada para este contato' });
    }

    res.status(200).json(midias);
  } catch (error) {
    console.error('Erro ao carregar as mídias do contato:', error);
    res.status(500).json({ message: 'Erro ao carregar as mídias do contato' });
  }
});

module.exports = router;
