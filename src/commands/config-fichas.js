const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    MessageFlags 
} = require('discord.js');

module.exports = {
    // 1. Configuración del Comando Slash
    data: new SlashCommandBuilder()
        .setName('config-fichas')
        .setDescription('Genera el mensaje interactivo con el panel web para la revisión de fichas.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // 2. Ejecución del Comando
    async execute(interaction) {
        try {
            // Diferimos la respuesta de inmediato para evitar timeouts (3 segundos de Discord)
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // Validar existencia del canal
            if (!interaction.channel) {
                return await interaction.editReply({
                    content: '❌ No se pudo determinar el canal actual para publicar el panel.'
                });
            }

            // Obtener el icono del servidor para usarlo en el diseño
            const guildIcon = interaction.guild?.iconURL({ size: 512 });

            // 3. Construcción del Embed (Diseño elegante y organizado)
            const embedMetricas = new EmbedBuilder()
                .setTitle('🌸 Sistema de Admisiones — Yozakura High')
                .setDescription(
                    'Bienvenido al **Centro Institucional de Gestión y Revisión de Fichas**.\n\n' +
                    'Este panel está reservado **exclusivamente para el Staff autorizado**. ' +
                    'Desde la plataforma web podrás inspeccionar, evaluar, aprobar o rechazar las solicitudes de los nuevos aspirantes.'
                )
                .setColor('#FFB7C5') // Rosa Sakura
                .setThumbnail(guildIcon || null)
                .addFields(
                    { 
                        name: '🛡️ Seguridad & Autenticación', 
                        value: '```text\nEl bot verificará tu ID de Discord y tus roles en tiempo real antes de concederte una sesión de acceso en el panel.\n```', 
                        inline: false 
                    },
                    { 
                        name: '📋 Pasos para Acceder', 
                        value: 
                            '› **Paso 1:** Presiona el botón de abajo (**Acceder al Panel Web**).\n' +
                            '› **Paso 2:** Espera la validación automática de tus permisos.\n' +
                            '› **Paso 3:** Haz clic en el enlace privado temporal generado exclusivamente para ti.', 
                        inline: false 
                    },
                    { 
                        name: '⚠️ Aviso Importante', 
                        value: '> *El enlace generado es personal, contiene un token de sesión de un solo uso y expira tras cierto tiempo. No intentes compartirlo con terceros.*', 
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: 'Yozakura High • Sistema Oficial de Gestión Escolar', 
                    iconURL: guildIcon || null 
                })
                .setTimestamp();

            // 4. Creación del Botón Interactivo
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_solicitar_panel') // Escuchado en index.js
                    .setLabel('Acceder al Panel Web')
                    .setEmoji('🔐')
                    .setStyle(ButtonStyle.Primary)
            );

            // 5. Enviar el panel permanente al canal
            await interaction.channel.send({
                embeds: [embedMetricas],
                components: [row]
            });

            // 6. Confirmación efímera de éxito al Administrador
            await interaction.editReply({
                content: '✨ **¡Panel desplegado con éxito!** El mensaje interactivo ya está disponible en este canal para el equipo de Staff.'
            });

        } catch (error) {
            console.error('❌ Error ejecutando /config-fichas:', error);

            const errorMsg = '❌ Ocurrió un error al publicar el panel. Verifica que el bot tenga permisos para enviar mensajes y embeds en este canal.';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMsg }).catch(() => null);
            } else {
                await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
            }
        }
    },
};