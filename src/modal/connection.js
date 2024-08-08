const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  cuidador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  familiar: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Connection', connectionSchema);
