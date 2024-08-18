const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./src/modal/db');
const userRoutes = require('./src/routes/routes');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Servir arquivos estáticos da pasta 'uploads'
app.use('/uploads', express.static('uploads'));

connectDB();

// Rota principal da API
app.use('/api', userRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server rodando no endpoint ${port}`);
});
