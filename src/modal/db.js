const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://Guilherme:310506gui@brainlinker.dn1zf.mongodb.net/?retryWrites=true&w=majority&appName=BrainLinker', {
        });
        console.log('MongoDB foi conectado');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
