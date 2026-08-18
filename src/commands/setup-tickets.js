// commands/setup-tickets.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Envía el panel interactivo para abrir tickets.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#FFB7C5')
            .setTitle('🎫 Centro de Soporte y Reportes — Instituto Yozakura')
            .setDescription('¿Necesitas ayuda con tu ficha, reportar un problema o contactar al Staff?\n\nHaz clic en el botón de abajo para **crear un ticket privado** rellenando un breve formulario.')
            .setFooter({ text: 'Instituto Yozakura • Sistema de Tickets' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_abrir_modal_ticket')
                .setLabel('Crear Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ Panel de tickets enviado con éxito en este canal.', flags: 64 });
    }
};