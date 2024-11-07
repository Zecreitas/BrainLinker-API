const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  remetente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  texto: { type: String, required: true },
  dataEnvio: { type: Date, default: Date.now },
  lida: { type: Boolean, default: false } 
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;