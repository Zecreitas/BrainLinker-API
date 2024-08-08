const bcrypt = require('bcryptjs');

const password = 'password123'; // Senha original
const saltRounds = 10; // Número de salt rounds

// Gerar um novo hash para a senha
bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) throw err;
    console.log('Novo Hash:', hash);

    // Comparar com o hash gerado
    bcrypt.compare(password, hash, (err, result) => {
        if (err) throw err;
        console.log('Senhas correspondem:', result); // Deve ser 'true'
    });
});
