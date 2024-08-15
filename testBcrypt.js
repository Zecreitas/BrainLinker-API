const bcrypt = require('bcrypt');

async function createAndTestUser() {
  // Defina a senha original
  const originalPassword = 'password123';

  // Gere um hash para essa senha
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(originalPassword, saltRounds);
  console.log('Nova hash gerada:', hashedPassword);

  // Agora simule a comparação da senha fornecida pelo usuário com a hash armazenada
  const providedPassword = 'password123'; // A senha que você quer testar
  const isMatch = await bcrypt.compare(providedPassword, hashedPassword);

  console.log('Resultado da comparação:', isMatch); // Deve retornar true
}

createAndTestUser();
