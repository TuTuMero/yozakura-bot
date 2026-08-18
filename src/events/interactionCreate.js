const { Events } = require('discord.js');
const { supabase } = require('../supabaseClient');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // ==========================================
        // 1. MANEJO DE COMANDOS SLASH (ej: /config-fichas)
        // ==========================================
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error ejecutando ${interaction.commandName}:`, error);
                const replyOptions = { content: '❌ Ocurrió un error al ejecutar este comando.', flags: 64 };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions);
                } else {
                    await interaction.reply(replyOptions);
                }
            }
            return;
        }

        // ==========================================
        // 2. MANEJO DEL BOTÓN "REVISAR FICHA"
        // ==========================================
        if (interaction.isButton() && interaction.customId.startsWith('revisar_ficha_')) {
            const fichaId = interaction.customId.replace('revisar_ficha_', '');
            const member = interaction.member;
            const guildId = interaction.guild.id;

            // A. Verificar roles de Staff con permisos
            const { data: config } = await supabase
                .from('fichas_config')
                .select('roles_staff')
                .eq('guild_id', guildId)
                .single();

            const tienePermiso = member.permissions.has('Administrator') || 
                                 (config?.roles_staff && config.roles_staff.some(roleId => member.roles.cache.has(roleId)));

            if (!tienePermiso) {
                return interaction.reply({ 
                    content: '🚫 No tienes los roles de Staff autorizados para revisar fichas.', 
                    flags: 64 
                });
            }

            // B. Buscar la ficha en Supabase
            const { data: ficha, error } = await supabase
                .from('fichas')
                .select('*')
                .eq('id', fichaId)
                .single();

            if (error || !ficha) {
                return interaction.reply({ content: '❌ La ficha no fue encontrada en la base de datos.', flags: 64 });
            }

            if (ficha.estado === 'aprobada' || ficha.estado === 'rechazada') {
                return interaction.reply({ content: '🔒 Esta ficha ya fue finalizada anteriormente.', flags: 64 });
            }

            // C. BLOQUEO: Verificar si ALGUIEN MÁS la está revisando
            if (ficha.estado === 'revision' && ficha.revisando_por_id !== interaction.user.id) {
                return interaction.reply({ 
                    content: `🛑 **Acceso Denegado:** Esta ficha ya está siendo revisada actualmente por **${ficha.revisando_por_tag}**.`, 
                    flags: 64 
                });
            }

            // D. Cambiar estado a 'revision' y asignar al Staff actual
            await supabase.from('fichas').update({
                estado: 'revision',
                revisando_por_id: interaction.user.id,
                revisando_por_tag: interaction.user.tag
            }).eq('id', fichaId);

            // E. Generar link con parámetros para la web del Staff
            const staffAvatar = interaction.user.displayAvatarURL({ extension: 'png' });
            const staffName = encodeURIComponent(interaction.user.username);
            const staffRole = encodeURIComponent(member.roles.highest.name);

            // Cambia este link por el de tu página web alojada
            const STAFF_WEB_URL = `https://tu-sitio.netlify.app/staff-panel.html?ficha_id=${fichaId}&staff_id=${interaction.user.id}&staff_name=${staffName}&staff_avatar=${encodeURIComponent(staffAvatar)}&staff_role=${staffRole}`;

            return interaction.reply({
                content: `🔎 Has tomado la revisión de la ficha **#${fichaId}**.\n\n🔗 [Haz clic aquí para abrir el Panel de Revisión](${STAFF_WEB_URL})`,
                flags: 64
            });
        }
    },
};