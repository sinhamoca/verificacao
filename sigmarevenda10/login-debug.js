const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function testarLogin() {
    console.log('═══════════════════════════════════════════════════');
    console.log('      LOGIN DEBUG - API GES OFFICE');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('⚠️  IMPORTANTE: Execute com proxychains4!');
    console.log('   Comando: proxychains4 node login-debug.js\n');

    // Perguntar credenciais
    console.log('📝 Digite suas credenciais:\n');
    const username = await question('Username: ');
    const password = await question('Password: ');
    
    console.log('\n───────────────────────────────────────────────────');
    console.log('📤 DADOS QUE SERÃO ENVIADOS:');
    console.log('───────────────────────────────────────────────────');
    
    const loginData = {
        username: username.trim(),
        password: password.trim(),
        code: ""
    };
    
    console.log(JSON.stringify(loginData, null, 2));
    console.log('');
    
    console.log('Caracteres especiais na senha:');
    for (let i = 0; i < password.length; i++) {
        const char = password[i];
        const code = char.charCodeAt(0);
        console.log(`   [${i}] '${char}' = código ${code} (0x${code.toString(16)})`);
    }
    console.log('');

    const continuar = await question('Continuar com o login? (s/n): ');
    
    if (continuar.toLowerCase() !== 's') {
        console.log('\nLogin cancelado.');
        rl.close();
        return;
    }

    console.log('\n🔐 Enviando requisição...\n');

    try {
        const response = await axios.post('https://gesapioffice.com/api/login', loginData, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 30000,
            validateStatus: () => true
        });

        console.log('📡 RESPOSTA RECEBIDA:');
        console.log('───────────────────────────────────────────────────');
        console.log(`Status: ${response.status}`);
        console.log(`Status Text: ${response.statusText}`);
        console.log('');
        console.log('Headers da resposta:');
        console.log(JSON.stringify(response.headers, null, 2));
        console.log('');
        console.log('Body da resposta:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('───────────────────────────────────────────────────\n');

        if (response.status === 200 && response.data.access_token) {
            console.log('✅✅✅ LOGIN BEM-SUCEDIDO! ✅✅✅\n');
            console.log('Token:', response.data.access_token);
            console.log('User ID:', response.data.id);
            console.log('Username:', response.data.username);
        } else if (response.status === 500) {
            console.log('❌ Erro 500 - Credenciais inválidas\n');
            console.log('💡 DICAS:');
            console.log('   1. Verifique se a senha tem espaços no início/fim');
            console.log('   2. Verifique caracteres especiais');
            console.log('   3. Tente fazer login manual no site e capture novamente');
            console.log('   4. A senha pode ter mudado recentemente');
        } else {
            console.log('❌ Login falhou com status:', response.status);
        }

    } catch (error) {
        console.log('❌ ERRO NA REQUISIÇÃO:');
        console.log('───────────────────────────────────────────────────');
        console.log('Mensagem:', error.message);
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Dados:', error.response.data);
        }
        
        if (error.code) {
            console.log('Código:', error.code);
        }
        console.log('───────────────────────────────────────────────────');
    }

    rl.close();
}

testarLogin().catch(error => {
    console.error('Erro fatal:', error);
    rl.close();
    process.exit(1);
});
