const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectando ao MongoDB com a URI:', process.env.MONGO_URI);

    console.log('Conectado ao MongoDB Atlas com sucesso');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error.message);
    process.exit(1); 
  }
};

module.exports = connectDB;
