const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-fichas')
        .setDescription('Manda el panel de inscripción de ficha de admisión de Yozakura.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Responder al admin para confirmar la publicación
        await interaction.reply({ content: '✅ Panel de fichas publicado correctamente.', flags: 64 });

        const embed = new EmbedBuilder()
            .setColor('#FFB7C5')
            .setTitle('╭── ✦ ✦ ── \n Pasos de Inscripción \n 夜桜高校 \n╰── ✦ ✦ ──╯')
            .setDescription(
                '1️⃣ **Completa los datos del alumno**\n\n' +
                '2️⃣ **Crea el perfil de tu personaje**\n\n' +
                '3️⃣ **Agrega su historia / Lore**\n\n' +
                '4️⃣ **Coloca tus datos de usuario** *(Autocompletado)*\n\n' +
                '5️⃣ **Espera la revisión del staff**'
            )
            .setFooter({ text: 'Instituto Yozakura RP • Sistema de Admisión' });

        // Botón interactivo (no link directo)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_abrir_ficha') // 👈 Escuchar este ID en index.js
                .setLabel('📝 Llenar Ficha de Admisión')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};