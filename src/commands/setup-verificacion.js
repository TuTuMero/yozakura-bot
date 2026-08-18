const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verificacion')
        .setDescription('Despliega el mensaje interactivo con el botón para que los usuarios se verifiquen.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Obtener la configuración guardada del servidor en Supabase
            const { data: config, error } = await supabase
                .from('verification_config')
                .select('*')
                .eq('guild_id', interaction.guild.id)
                .maybeSingle();

            if (error || !config || !config.channel_id) {
                return interaction.editReply({
                    content: '⚠️ No has configurado el sistema de verificación aún. Usa primero `/config-verificacion` para definir el canal y los roles.'
                });
            }

            // 2. Buscar el canal asignado
            const targetChannel = interaction.guild.channels.cache.get(config.channel_id);
            if (!targetChannel) {
                return interaction.editReply({
                    content: '❌ No se encontró el canal asignado en la configuración. Vuelve a ejecutar `/config-verificacion`.'
                });
            }

            // 3. Crear el Embed de Verificación
            const embed = new EmbedBuilder()
                .setColor(0xFFB7C5)
                .setTitle('🌸 Vinculación de Cuenta de Roblox')
                .setDescription(config.custom_message || 'Haz clic en el botón de abajo para vincular tu cuenta de Roblox y acceder al servidor.')
                .addFields(
                    { name: '📌 Paso 1', value: 'Haz clic en el botón **Verificar mi Cuenta**.', inline: false },
                    { name: '📌 Paso 2', value: 'Sigue las instrucciones en pantalla para ingresar tu usuario de Roblox.', inline: false }
                )
                .setFooter({ text: `${interaction.guild.name} • Sistema de Verificación`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            // 4. Crear el Botón Interactivo
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_iniciar_verificacion')
                    .setLabel('Verificar mi Cuenta')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎮')
            );

            // 5. Enviar el panel al canal configurado
            await targetChannel.send({ embeds: [embed], components: [row] });

            return interaction.editReply({
                content: `✅ ¡Panel de verificación desplegado con éxito en el canal <#${config.channel_id}>!`
            });

        } catch (err) {
            console.error('❌ Error en setup-verificacion:', err);
            return interaction.editReply({ content: '❌ Ocurrió un error inesperado al desplegar el panel.' });
        }
    }
};