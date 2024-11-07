const mongoose = require('mongoose');

const MidiaSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['foto', 'video'],
    required: true
  },
  caminho: {
    type: String,
    required: true
  },
  descricao: {
    type: String
  },
  remetente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  destinatario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dataEnvio: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Midia', MidiaSchema);
