// commands/ticket-config.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-config')
        .setDescription('Configura el sistema de tickets del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('categoria')
                .setDescription('Categoría donde se crearán los canales de tickets')
                .setRequired(true))
        .addRoleOption(option => 
            option.setName('rol_staff_1')
                .setDescription('Primer rol a mencionar al abrir un ticket')
                .setRequired(false))
        .addRoleOption(option => 
            option.setName('rol_staff_2')
                .setDescription('Segundo rol a mencionar (opcional)')
                .setRequired(false)),

    async execute(interaction, supabase) {
        await interaction.deferReply({ flags: 64 });

        const categoria = interaction.options.getChannel('categoria');
        const rol1 = interaction.options.getRole('rol_staff_1');
        const rol2 = interaction.options.getRole('rol_staff_2');

        const rolesArray = [];
        if (rol1) rolesArray.push(rol1.id);
        if (rol2) rolesArray.push(rol2.id);

        const { error } = await supabase
            .from('tickets_config')
            .upsert({
                guild_id: interaction.guild.id,
                categoria_id: categoria.id,
                roles_mencion_ids: rolesArray
            }, { onConflict: 'guild_id' });

        if (error) {
            console.error('Error guardando config de tickets:', error);
            return interaction.editReply({ content: '❌ Ocurrió un error al guardar la configuración en Supabase.' });
        }

        const embed = new EmbedBuilder()
            .setColor('#FFB7C5')
            .setTitle('⚙️ Configuración de Tickets Actualizada')
            .setDescription('Los ajustes del sistema se han guardado correctamente.')
            .addFields(
                { name: '📂 Categoría destino', value: `<#${categoria.id}>`, inline: false },
                { name: '🛡️ Roles a mencionar', value: rolesArray.length > 0 ? rolesArray.map(r => `<@&${r}>`).join(', ') : '`Ninguno`', inline: false }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};