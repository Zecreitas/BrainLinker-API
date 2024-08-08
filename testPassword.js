const bcrypt = require('bcryptjs');

const testPassword = async () => {
  try {
    const password = 'password123'; // Senha de teste
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('Senha:', password);
    console.log('Hash:', hashedPassword);

    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log('Senhas correspondem:', isMatch);
  } catch (err) {
    console.error('Erro:', err);
  }
};

testPassword();