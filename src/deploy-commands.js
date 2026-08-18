const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`📌 Encontrado para deploy: /${command.data.name}`);
        } else {
            console.log(`⚠️ [ADVERTENCIA] Al comando en ${filePath} le falta "data" o "execute".`);
        }
    }
} else {
    console.error(`❌ No se encontró la carpeta de comandos en: ${commandsPath}`);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// ID de tu servidor de pruebas (TuTu Tec)
const GUILD_ID = '1362997353790836858';

(async () => {
    try {
        console.log(`⏳ Registrando ${commands.length} comando(s) instantáneos en el servidor (${GUILD_ID})...`);

        // Obtener el ID del Bot automáticamente
        const currentUser = await rest.get(Routes.user());
        
        // Registrar comandos en el servidor específico (Actualización al instante)
        const data = await rest.put(
            Routes.applicationGuildCommands(currentUser.id, GUILD_ID),
            { body: commands },
        );

        console.log(`⚡ ¡Se registraron exitosamente ${data.length} comando(s) en el servidor!`);
    } catch (error) {
        console.error('❌ Error al registrar los comandos:', error);
    }
})();