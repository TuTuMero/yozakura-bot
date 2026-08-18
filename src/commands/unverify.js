const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const supabase = require('../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unverify')
        .setDescription('Desvincula la cuenta de Roblox de un usuario del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames) // Solo miembros con permiso para gestionar apodos/staff
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('El usuario de Discord al que deseas desverificar')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 }); // Respuesta solo visible para el staff

        const targetUser = interaction.options.getUser('usuario');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        try {
            // 1. Buscar al usuario en la base de datos Supabase
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('discord_id', targetUser.id)
                .maybeSingle();

            if (fetchError) {
                console.error('❌ Error al consultar Supabase:', fetchError);
                return await interaction.editReply({
                    content: '❌ Ocurrió un error al consultar la base de datos.'
                });
            }

            if (!userData) {
                return await interaction.editReply({
                    content: `⚠️ El usuario **${targetUser.tag}** no se encuentra registrado ni verificado en la base de datos.`
                });
            }

            const robloxName = userData.roblox_username;

            // 2. Eliminar el registro de Supabase (Liberar cuenta de Roblox)
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('discord_id', targetUser.id);

            if (deleteError) {
                console.error('❌ Error al eliminar de Supabase:', deleteError);
                return await interaction.editReply({
                    content: '❌ Ocurrió un error al intentar eliminar el registro de la base de datos.'
                });
            }

            // 3. Gestionar Roles y Apodo si el miembro sigue en el servidor
            if (targetMember) {
                // Obtener configuración del servidor (ID de roles)
                const { data: config } = await supabase
                    .from('verification_config')
                    .select('*')
                    .eq('guild_id', interaction.guild.id)
                    .maybeSingle();

                // Quitar rol verificado
                if (config?.verified_role_id) {
                    await targetMember.roles.remove(config.verified_role_id).catch(err => {
                        console.log(`⚠️ No se pudo quitar el rol verificado: ${err.message}`);
                    });
                }

                // Devolver rol no verificado
                if (config?.unverified_role_id) {
                    await targetMember.roles.add(config.unverified_role_id).catch(err => {
                        console.log(`⚠️ No se pudo asignar el rol no verificado: ${err.message}`);
                    });
                }

                // Resetear el apodo al nombre original de Discord
                try {
                    await targetMember.setNickname(null);
                } catch (nickErr) {
                    console.log(`⚠️ No se pudo resetear el apodo: ${nickErr.message}`);
                }
            }

            // 4. Confirmación visual
            const embed = new EmbedBuilder()
                .setColor('#FF3333')
                .setTitle('🔓 Usuario Desverificado')
                .setDescription(`Se ha desvinculado la cuenta con éxito.`)
                .addFields(
                    { name: '👤 Discord', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                    { name: '🎮 Roblox Liberado', value: `\`${robloxName}\``, inline: true },
                    { name: '🛠️ Staff Responsable', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setFooter({ text: 'Sistema de Verificación • Instituto Yozakura' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error en el comando /unverify:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un fallo inesperado al procesar el comando.'
            });
        }
    }
};