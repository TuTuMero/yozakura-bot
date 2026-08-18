const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const supabase = require('../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config-verificacion')
        .setDescription('Configura los parámetros del sistema de verificación por Roblox.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal de texto donde los usuarios se verificarán')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('rol-verificado')
                .setDescription('Rol que se le asignará al usuario tras verificarse')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('rol-no-verificado')
                .setDescription('Rol que se le retirará al usuario tras verificarse (Opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('Mensaje personalizado para la tarjeta de verificación')
                .setRequired(false)),

    async execute(interaction) {
        // Responder inmediatamente para evitar el tiempo de espera
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('canal');
            const verifiedRole = interaction.options.getRole('rol-verificado');
            const unverifiedRole = interaction.options.getRole('rol-no-verificado');
            const customMessage = interaction.options.getString('mensaje');

            if (!channel && !verifiedRole && !unverifiedRole && !customMessage) {
                return interaction.editReply({
                    content: '⚠️ Debes seleccionar al menos una opción para actualizar la configuración.'
                });
            }

            // 1. Consultar la configuración previa en Supabase
            const { data: existingConfig, error: selectError } = await supabase
                .from('verification_config')
                .select('*')
                .eq('guild_id', interaction.guild.id)
                .maybeSingle();

            if (selectError) {
                console.error('❌ Error al consultar Supabase en config-verificacion:', selectError.message);
            }

            // 2. Preparar el objeto para guardar
            const updateData = {
                guild_id: interaction.guild.id,
                channel_id: channel ? channel.id : (existingConfig?.channel_id || null),
                verified_role_id: verifiedRole ? verifiedRole.id : (existingConfig?.verified_role_id || null),
                unverified_role_id: unverifiedRole ? unverifiedRole.id : (existingConfig?.unverified_role_id || null),
                custom_message: customMessage || (existingConfig?.custom_message || 'Haz clic en el botón de abajo para vincular tu cuenta de Roblox y acceder al servidor.')
            };

            // 3. Guardar o actualizar (Upsert) en Supabase
            const { error: upsertError } = await supabase
                .from('verification_config')
                .upsert(updateData, { onConflict: 'guild_id' });

            if (upsertError) {
                console.error('❌ Error al guardar en Supabase:', upsertError.message);
                return interaction.editReply({
                    content: `❌ Error al guardar en la base de datos: \`${upsertError.message}\``
                });
            }

            // 4. Crear Embed con el nombre dinámico del servidor
            const embed = new EmbedBuilder()
                .setColor(0xFFB7C5)
                .setTitle('⚙️ Configuración de Verificación Guardada')
                .setDescription(`Los datos han sido registrados exitosamente en la base de datos de **${interaction.guild.name}**.`)
                .addFields(
                    { name: '📌 Canal de Verificación', value: updateData.channel_id ? `<#${updateData.channel_id}>` : '`No configurado`', inline: true },
                    { name: '✅ Rol Verificado', value: updateData.verified_role_id ? `<@&${updateData.verified_role_id}>` : '`No configurado`', inline: true },
                    { name: '❌ Rol No Verificado', value: updateData.unverified_role_id ? `<@&${updateData.unverified_role_id}>` : '`Ninguno`', inline: true },
                    { name: '💬 Mensaje', value: updateData.custom_message, inline: false }
                )
                .setFooter({ text: 'Guardado permanentemente en Supabase • Panel Admin' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('❌ Error no controlado en config-verificacion:', err);
            return interaction.editReply({ 
                content: '❌ Ocurrió un error inesperado al procesar el comando.' 
            });
        }
    }
};