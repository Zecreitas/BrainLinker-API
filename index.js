const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./src/modal/db');
const userRoutes = require('./src/routes/routes');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

connectDB();

// rota
app.use('/api', userRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server rodando no endpoint ${port}`);
});
