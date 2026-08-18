// commands/notificacion-ficha.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notificacion-ficha')
        .setDescription('Configura las notificaciones de nuevas fichas entrantes para los revisores.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('configurar')
                .setDescription('Activa/desactiva las notificaciones y establece el canal.')
                .addBooleanOption(option =>
                    option
                        .setName('estado')
                        .setDescription('¿Activar o desactivar las alertas de nuevas fichas?')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal donde se enviarán las alertas de nuevas fichas.')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('estado')
                .setDescription('Muestra la configuración actual de las notificaciones.')
        ),

    async execute(interaction, supabase) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'configurar') {
            await interaction.deferReply({ flags: 64 });

            const estado = interaction.options.getBoolean('estado');
            const canal = interaction.options.getChannel('canal');

            // Buscar configuración existente
            const { data: configExistente } = await supabase
                .from('fichas_config')
                .select('*')
                .eq('guild_id', guildId)
                .maybeSingle();

            let canalIdFinal = configExistente?.canal_notificaciones_id;

            if (estado && canal) {
                canalIdFinal = canal.id;
            } else if (estado && !canalIdFinal) {
                return await interaction.editReply({
                    content: '⚠️ Para activar las notificaciones debes especificar un canal la primera vez.'
                });
            }

            // Guardar o actualizar en Supabase
            const payload = {
                guild_id: guildId,
                notificaciones_activas: estado,
                canal_notificaciones_id: canalIdFinal
            };

            const { error } = await supabase
                .from('fichas_config')
                .upsert(payload, { onConflict: 'guild_id' });

            if (error) {
                console.error('❌ Error guardando configuración:', error);
                return await interaction.editReply({ content: '❌ Ocurrió un error al guardar la configuración en la BD.' });
            }

            const embed = new EmbedBuilder()
                .setColor(estado ? '#00FF00' : '#FF0000')
                .setTitle('⚙️ Notificaciones de Fichas Entrantes')
                .setDescription(`Las alertas de nuevas fichas ahora están **${estado ? 'ACTIVADAS 🟢' : 'DESACTIVADAS 🔴'}**.`)
                .addFields(
                    { name: '📢 Canal Destino', value: canalIdFinal ? `<#${canalIdFinal}>` : '`No configurado`', inline: true },
                    { name: '🔔 Menciones', value: 'Se mencionará a todos los roles registrados en `roles_revisores`.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Instituto Yozakura • Admisiones' });

            return await interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'estado') {
            await interaction.deferReply({ flags: 64 });

            const { data: config } = await supabase
                .from('fichas_config')
                .select('*')
                .eq('guild_id', guildId)
                .maybeSingle();

            const { data: roles } = await supabase
                .from('roles_revisores')
                .select('role_id');

            const listaRoles = roles && roles.length > 0 
                ? roles.map(r => `<@&${r.role_id}>`).join(', ') 
                : '`Ningún rol registrado`';

            const embed = new EmbedBuilder()
                .setColor('#FFB7C5')
                .setTitle('📊 Estado de Notificaciones de Fichas')
                .addFields(
                    { name: '🔘 Estado', value: config?.notificaciones_activas ? '🟢 Activado' : '🔴 Desactivado', inline: true },
                    { name: '📢 Canal', value: config?.canal_notificaciones_id ? `<#${config.canal_notificaciones_id}>` : '`No asignado`', inline: true },
                    { name: '🛡️ Roles Revisores a Mencionar', value: listaRoles, inline: false }
                )
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }
    }
};