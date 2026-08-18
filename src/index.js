// ==========================================
// CÓDIGO CORREGIDO: index.js (Sistema de Tickets Funcional y Robusto)
// ==========================================
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder 
} = require('discord.js');
const supabase = require('./database/supabase');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Inicializar el cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// ==========================================
// CARGA DINÁMICA DE COMANDOS (SLASH COMMANDS)
// ==========================================
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Comando registrado en memoria: /${command.data.name}`);
        } else {
            console.log(`⚠️ [ADVERTENCIA] Al comando en ${filePath} le falta "data" o "execute".`);
        }
    }
} else {
    console.error(`❌ La carpeta 'commands' no existe en: ${commandsPath}`);
}

// ==========================================
// 1. EVENTO: BOT LISTO / CONECTADO
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`\n==========================================`);
    console.log(`🤖 Bot iniciado exitosamente como: ${client.user.tag}`);

    let dbConnected = false;
    let dbStatusText = '❌ Sin conexión';

    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error al conectar con Supabase:', error.message);
            dbStatusText = `❌ Error: ${error.message}`;
        } else {
            console.log('⚡ Conexión a Supabase (PostgreSQL) establecida correctamente.');
            dbConnected = true;
            dbStatusText = '🟢 Conectado y Operativo (PostgreSQL)';
        }
    } catch (err) {
        console.error('❌ Excepción al verificar Supabase:', err);
        dbStatusText = '❌ Error inesperado de red/configuración';
    }

    console.log(`==========================================\n`);

    const statusEmbed = new EmbedBuilder()
        .setColor(dbConnected ? 0xFFB7C5 : 0xFF3333)
        .setTitle('🌸 夜桜高校 | Instituto Yozakura — Sistema Online')
        .setDescription('El bot principal del servidor de roleplay se ha iniciado y está listo para recibir peticiones.')
        .addFields(
            { 
                name: '🤖 Estado del Bot', 
                value: `\`\`\`yaml\nNombre: ${client.user.tag}\nID:${client.user.id}\nEstado: Online 🟢\n\`\`\``, 
                inline: false 
            },
            { 
                name: '⚡ Base de Datos (Supabase)', 
                value: `\`\`\`yaml\n${dbStatusText}\n\`\`\``, 
                inline: false 
            }
        )
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Instituto Yozakura RP • Mayo 2007', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    client.guilds.cache.forEach(async (guild) => {
        const targetChannel = guild.channels.cache.find(
            c => (c.name === 'bot-status' || c.name === 'general' || c.name === 'comandos') && c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages')
        ) || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages'));

        if (targetChannel) {
            try {
                await targetChannel.send({ embeds: [statusEmbed] });
                console.log(`📢 Mensaje de estado enviado al servidor "${guild.name}" en #${targetChannel.name}`);
            } catch (err) {
                console.error(`❌ No se pudo enviar el mensaje en ${guild.name}:`, err.message);
            }
        }
    });

    // ==========================================
    // BUCLE DE ACTUALIZACIÓN DEL PANEL Y NOTIFICACIONES (CADA 15 SEGUNDOS)
    // ==========================================
    const fichasProcesadasNotificadas = new Set();

    try {
        const { data: fichasHistoricas } = await supabase
            .from('fichas')
            .select('id')
            .in('estado', ['aceptada', 'negada', 'rechazada']);
        
        if (fichasHistoricas) {
            fichasHistoricas.forEach(f => fichasProcesadasNotificadas.add(f.id));
            console.log(`🧹 Se han ignorado ${fichasHistoricas.length} fichas históricas ya resueltas para evitar spam al reiniciar.`);
        }
    } catch (e) {
        console.error("⚠️ Error precargando fichas históricas:", e);
    }

    setInterval(async () => {
        try {
            // --- PARTE A: ACTUALIZACIÓN DEL PANEL DE CONTROL ---
            const { data: config, error: configError } = await supabase
                .from('config_panel')
                .select('*')
                .eq('id', 1)
                .maybeSingle();

            if (!configError && config && config.channel_id && config.message_id) {
                const canal = await client.channels.fetch(config.channel_id).catch(() => null);
                if (canal) {
                    const mensaje = await canal.messages.fetch(config.message_id).catch(() => null);
                    if (mensaje) {
                        const { count: pendientes } = await supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
                        const { count: revision } = await supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('estado', 'en_revision');
                        const { count: revisadas } = await supabase.from('fichas').select('*', { count: 'exact', head: true }).in('estado', ['aceptada', 'negada', 'rechazada']);

                        const embedActualizado = new EmbedBuilder()
                            .setTitle('📊 Panel de Control y Estado de Fichas')
                            .setDescription('Estado actual de las admisiones en el Instituto Yozakura.')
                            .setColor('#ff65a3')
                            .addFields(
                                { name: '📥 Sin revisar (Pendientes)', value: `\`${pendientes || 0}\``, inline: true },
                                { name: '🔄 En revisión', value: `\`${revision || 0}\``, inline: true },
                                { name: '✅ Revisadas (Total)', value: `\`${revisadas || 0}\``, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: 'Instituto Yozakura • Actualización automática cada 15 seg' });

                        const urlBaseWeb = 'https://fluffy-mooncake-ef27e0.netlify.app/';
                        const rowPanel = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('🔍 Ver Fichas Detalladas (Panel Web)')
                                .setStyle(ButtonStyle.Link)
                                .setURL(`${urlBaseWeb}?discord_id=${client.user.id}&username=Staff`)
                        );

                        await mensaje.edit({ embeds: [embedActualizado], components: [rowPanel] });
                    }
                }
            }

            // --- PARTE B: NOTIFICACIÓN DE FICHAS RESUELTAS Y DM AL USUARIO ---
            const { data: fichasResueltas, error: errResueltas } = await supabase
                .from('fichas')
                .select('*')
                .in('estado', ['aceptada', 'negada', 'rechazada']);

            if (!errResueltas && fichasResueltas && fichasResueltas.length > 0) {
                const { data: fichaConfig } = await supabase.from('fichas_config').select('*').limit(1).maybeSingle();
                const channelId = fichaConfig?.canal_notificaciones_id;

                if (channelId) {
                    const canalNotif = await client.channels.fetch(channelId).catch(() => null);
                    if (canalNotif && canalNotif.isTextBased()) {
                        for (const ficha of fichasResueltas) {
                            if (!fichasProcesadasNotificadas.has(ficha.id)) {
                                fichasProcesadasNotificadas.add(ficha.id);

                                const esAceptada = ficha.estado === 'aceptada';
                                const colorEmbed = esAceptada ? '#00FF00' : '#FF0000';
                                const tituloEmbed = esAceptada ? '✅ ¡Ficha Aceptada Oficialmente!' : '❌ Ficha Rechazada / Requiere Cambios';
                                
                                const razonTexto = ficha.razon_negacion || ficha.razon || ficha.motivo || ficha.observaciones || 'No se especificó un motivo.';
                                let staffTexto = ficha.firma_by || ficha.staff_name || ficha.revisando_por_tag || 'Staff del Instituto';
                                const urlFichaCompleta = `https://fluffy-mooncake-ef27e0.netlify.app/?id=${ficha.id}&discord_id=${client.user.id}&username=Staff`;

                                const embedNotificacion = new EmbedBuilder()
                                    .setColor(colorEmbed)
                                    .setTitle(tituloEmbed)
                                    .setDescription(esAceptada 
                                        ? `La ficha **#${ficha.id}** de <@${ficha.discord_id}> ha sido **aceptada**.`
                                        : `La ficha **#${ficha.id}** de <@${ficha.discord_id}> ha sido **rechazada**. Debes corregir los detalles indicados y volver a enviarla.`
                                    )
                                    .addFields(
                                        { name: '👤 Postulante', value: `<@${ficha.discord_id}>`, inline: true },
                                        { name: '🛡️ Revisado por', value: `\`${staffTexto}\``, inline: true },
                                        { name: '📝 Razones / Observaciones', value: `\`\`\`\n${razonTexto}\n\`\`\``, inline: false }
                                    )
                                    .setTimestamp()
                                    .setFooter({ text: 'Instituto Yozakura • Sistema de Admisiones' });

                                const rowFicha = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setLabel('📂 Ver Ficha Completa')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(urlFichaCompleta)
                                );

                                await canalNotif.send({ 
                                    content: esAceptada 
                                        ? `🎉 **¡Buenas noticias!** Se ha aprobado una nueva admisión para <@${ficha.discord_id}>.` 
                                        : `⚠️ **Notificación de Admisión:** La ficha de <@${ficha.discord_id}> no fue aprobada.`, 
                                    embeds: [embedNotificacion],
                                    components: [rowFicha]
                                }).catch(e => console.log("⚠️ Error enviando notificación al canal:", e));

                                try {
                                    const usuarioDiscord = await client.users.fetch(ficha.discord_id);
                                    if (usuarioDiscord) {
                                        const embedDM = new EmbedBuilder()
                                            .setColor(colorEmbed)
                                            .setTitle(esAceptada ? '🎉 ¡Tu ficha ha sido Aceptada!' : '⚠️ Tu ficha necesita correcciones (Rechazada)')
                                            .setDescription(esAceptada 
                                                ? '¡Felicidades! Tu postulación para el **Instituto Yozakura** fue aprobada exitosamente. Ya puedes formar parte del rol.'
                                                : 'Hola, hemos revisado tu ficha de admisión y lamentablemente no cumple con todos los requisitos actuales o necesita correcciones.'
                                            )
                                            .addFields(
                                                { name: '📌 Estado', value: esAceptada ? '`Aceptada ✅`' : '`Rechazada / Debe Rehacerse ❌`', inline: true },
                                                { name: '🛡️ Evaluado por', value: `\`${staffTexto}\``, inline: true },
                                                { name: '💬 Comentarios del Staff', value: `\`\`\`\n${razonTexto}\n\`\`\``, inline: false }
                                            )
                                            .setFooter({ text: 'Instituto Yozakura • Sistema de Admisiones' })
                                            .setTimestamp();

                                        await usuarioDiscord.send({ 
                                            content: esAceptada ? '¡Felicidades por tu ingreso! 🌸' : 'Hola, por favor revisa el estado de tu ficha para saber qué debes corregir. 🛑',
                                            embeds: [embedDM],
                                            components: [rowFicha]
                                        });
                                        console.log(`✉️ DM enviado exitosamente al usuario ${usuarioDiscord.tag}`);
                                    }
                                } catch (dmErr) {
                                    console.log(`⚠️ No se pudo enviar el DM al usuario ${ficha.discord_id}.`);
                                }
                            }
                        }
                    }
                }
            }

            // --- PARTE C: ALERTAS DE NUEVAS FICHAS ENTRANTES ---
            const { data: configNotif } = await supabase
                .from('fichas_config')
                .select('canal_notificaciones_id, notificaciones_activas')
                .eq('notificaciones_activas', true)
                .maybeSingle();

            if (configNotif && configNotif.canal_notificaciones_id) {
                const { data: fichasNuevas, error: errNuevas } = await supabase
                    .from('fichas')
                    .select('*')
                    .eq('estado', 'pendiente')
                    .or('notificada_pendiente.eq.false,notificada_pendiente.is.null');

                if (!errNuevas && fichasNuevas && fichasNuevas.length > 0) {
                    const canalAlertas = await client.channels.fetch(configNotif.canal_notificaciones_id).catch(() => null);

                    if (canalAlertas && canalAlertas.isTextBased()) {
                        const { data: rolesRevisores } = await supabase.from('roles_revisores').select('role_id');
                        const menciones = rolesRevisores && rolesRevisores.length > 0
                            ? rolesRevisores.map(r => `<@&${r.role_id}>`).join(' ')
                            : '@here';

                        for (const ficha of fichasNuevas) {
                            const embedNovedad = new EmbedBuilder()
                                .setColor('#FFB7C5')
                                .setTitle('📥 ¡Nueva Ficha Recibida!')
                                .setDescription(`Se ha registrado una nueva solicitud de admisión **#${ficha.id}**.`)
                                .addFields(
                                    { name: '👤 Postulante', value: ficha.discord_id ? `<@${ficha.discord_id}>` : '`Desconocido`', inline: true },
                                    { name: '📜 Nombre PJ', value: `\`${ficha.nombre_pj || ficha.nombre || 'Sin Nombre'}\``, inline: true },
                                    { name: '⏳ Estado', value: '`Pendiente de Revisión`', inline: true }
                                )
                                .setTimestamp()
                                .setFooter({ text: 'Instituto Yozakura • Alerta de Revisión' });

                            await canalAlertas.send({
                                content: `🔔 ${menciones} ¡Hay una nueva ficha pendiente de revisión!`,
                                embeds: [embedNovedad]
                            }).catch(e => console.error("⚠️ Error al enviar alerta:", e));

                            await supabase.from('fichas').update({ notificada_pendiente: true }).eq('id', ficha.id);
                        }
                    }
                }
            }

        } catch (err) {
            console.error('❌ Error en el bucle de actualización automática:', err);
        }
    }, 15000);
});

// ==========================================
// 2. EVENTO: MANEJADOR DE INTERACCIONES
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
    
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`❌ No se encontró coincidencia para el comando: /${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction, supabase);
        } catch (error) {
            console.error(`❌ Error ejecutando /${interaction.commandName}:`, error);

            const errorPayload = { content: '❌ Ocurrió un error al ejecutar este comando.', flags: 64 };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload);
            } else {
                await interaction.reply(errorPayload);
            }
        }
        return;
    }

    // ==========================================
    // SISTEMA DE TICKETS (MODAL, APERTURA, CIERRE, AUDITORÍA Y TRANSCRIPCIÓN)
    // ==========================================

    // 1. Mostrar Modal al hacer clic en "Crear Ticket" desde el panel
    if (interaction.isButton() && interaction.customId === 'btn_abrir_modal_ticket') {
        const modal = new ModalBuilder()
            .setCustomId('modal_crear_ticket')
            .setTitle('🌸 Instituto Yozakura — Soporte');

        const inputNombre = new TextInputBuilder()
            .setCustomId('ticket_nombre_pj')
            .setLabel('Tu Nombre / Nombre de Personaje')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: Akane Yozakura')
            .setRequired(true);

        const inputRazon = new TextInputBuilder()
            .setCustomId('ticket_razon')
            .setLabel('Motivo o duda del ticket')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Explica brevemente por qué abres el ticket...')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputNombre),
            new ActionRowBuilder().addComponents(inputRazon)
        );

        return await interaction.showModal(modal);
    }

    // 2. Procesar el envío del Modal del Ticket (Crea canal privado y guarda en Supabase)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_crear_ticket') {
        await interaction.deferReply({ flags: 64 });

        const nombrePj = interaction.fields.getTextInputValue('ticket_nombre_pj');
        const razon = interaction.fields.getTextInputValue('ticket_razon');
        const guild = interaction.guild;

        const { data: config } = await supabase
            .from('tickets_config')
            .select('*')
            .eq('guild_id', guild.id)
            .maybeSingle();

        // 🛡️ CORRECCIÓN 1: Soporte estricto para recuperar la categoría configurada por comando
        // Verificamos tanto 'categoria_id' como 'category_id' por compatibilidad con diferentes tablas
        const rawCategoriaId = config?.categoria_id || config?.category_id;
        let categoriaId = null;

        if (rawCategoriaId) {
            const categoriaCanal = guild.channels.cache.get(rawCategoriaId);
            if (categoriaCanal && categoriaCanal.type === 4) { // 4 es GuildCategory en Discord.js
                categoriaId = rawCategoriaId;
            } else {
                console.log(`⚠️ [ADVERTENCIA] La categoría con ID ${rawCategoriaId} no existe o no es válida. Se creará el ticket fuera de ella.`);
            }
        }

        const rolesMencion = config?.roles_mencion_ids || config?.roles_staff || [];

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                parent: categoriaId, // ¡Aquí se aplica correctamente la categoría!
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                    },
                    ...rolesMencion.map(roleId => ({
                        id: roleId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
                    }))
                ]
            });

            await supabase.from('tickets').insert({
                channel_id: ticketChannel.id,
                user_id: interaction.user.id,
                nombre_pj: nombrePj,
                razon: razon,
                estado: 'abierto'
            });

            const textoMenciones = rolesMencion.length > 0 
                ? rolesMencion.map(r => `<@&${r}>`).join(' ') 
                : '';

            const embedTicket = new EmbedBuilder()
                .setColor('#FFB7C5')
                .setTitle('🌸 Ticket de Asistencia Creado')
                .setDescription('Un miembro del staff te atenderá lo más pronto posible. Mantén la paciencia.')
                .addFields(
                    { name: '👤 Solicitante', value: `<@${interaction.user.id}> (\`${nombrePj}\`)`, inline: false },
                    { name: '📝 Motivo', value: `\`\`\`\n${razon}\n\`\`\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Instituto Yozakura • Sistema de Tickets' });

            const rowCerrar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_cerrar_ticket')
                    .setLabel('🔒 Cerrar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `${textoMenciones} 🔔 ¡Nuevo ticket abierto por <@${interaction.user.id}>!`,
                embeds: [embedTicket],
                components: [rowCerrar]
            });

            return await interaction.editReply({
                content: `✅ ¡Tu ticket ha sido creado con éxito! Dirígete aquí: <#${ticketChannel.id}>`
            });

        } catch (err) {
            console.error('❌ Error creando canal de ticket:', err);
            return await interaction.editReply({ content: '❌ Ocurrió un error al intentar crear el canal del ticket.' });
        }
    }

    // 3. Botón para Cerrar Ticket (Validando Rol de Staff + Transcripción + Auditoría Corregidas)
    if (interaction.isButton() && interaction.customId === 'btn_cerrar_ticket') {
        const guild = interaction.guild;
        const channel = interaction.channel;
        const member = interaction.member;

        const { data: config } = await supabase
            .from('tickets_config')
            .select('*')
            .eq('guild_id', guild.id)
            .maybeSingle();

        const rolesPermitidos = config?.roles_mencion_ids || config?.roles_staff || [];
        
        const tienePermiso = member.permissions.has('Administrator') || 
            (rolesPermitidos.length > 0 && member.roles.cache.some(r => rolesPermitidos.includes(r.id)));

        if (!tienePermiso) {
            return interaction.reply({
                content: '❌ **Acceso Denegado:** Solo el Staff autorizado puede cerrar este ticket.',
                flags: 64
            });
        }

        await interaction.deferReply();

        try {
            const { data: ticketData } = await supabase
                .from('tickets')
                .select('*')
                .eq('channel_id', channel.id)
                .maybeSingle();

            let transcriptText = `==========================================\n`;
            transcriptText += `🌸 INSTITUTO YOZAKURA — TRANSCRIPCIÓN DE TICKET\n`;
            transcriptText += `==========================================\n`;
            transcriptText += `Canal: #${channel.name}\n`;
            transcriptText += `Fecha de cierre: ${new Date().toLocaleString()}\n`;
            transcriptText += `Cerrado por: ${interaction.user.tag}\n`;
            transcriptText += `------------------------------------------\n\n`;

            // 🛡️ CORRECCIÓN 2: Obtener y ordenar mensajes de forma segura para la transcripción
            try {
                const messages = await channel.messages.fetch({ limit: 100 });
                const orderedMessages = Array.from(messages.values()).reverse();

                orderedMessages.forEach(m => {
                    const time = new Date(m.createdTimestamp).toLocaleString();
                    const attachmentsInfo = m.attachments.size > 0 ? ` [Archivos: ${m.attachments.map(a => a.url).join(', ')}]` : '';
                    transcriptText += `[${time}] ${m.author.tag}: ${m.content}${attachmentsInfo}\n`;
                });
            } catch (fetchErr) {
                console.error("⚠️ Error obteniendo mensajes para transcripción:", fetchErr);
                transcriptText += `[⚠️ Error al recuperar el historial completo de mensajes del chat]\n`;
            }

            const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
            const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { name: `transcripcion-${channel.name}.txt` });

            await supabase
                .from('tickets')
                .update({ 
                    estado: 'cerrado',
                    cerrado_por_id: interaction.user.id,
                    cerrado_por_tag: interaction.user.tag
                })
                .eq('channel_id', channel.id);

            // 🛡️ CORRECCIÓN 3: Envío seguro al canal de logs con comprobación de permisos de adjuntos
            const canalLogsId = config?.canal_logs_id || config?.log_channel_id;
            if (canalLogsId) {
                const canalLogs = await guild.channels.fetch(canalLogsId).catch(() => null);
                if (canalLogs && canalLogs.isTextBased()) {
                    const embedAuditoria = new EmbedBuilder()
                        .setColor('#FF3366')
                        .setTitle('📊 Auditoría de Ticket Cerrado')
                        .setDescription(`El ticket **${channel.name}** ha sido cerrado y archivado correctamente.`)
                        .addFields(
                            { name: '📥 Abierto por', value: ticketData ? `<@${ticketData.user_id}>` : '`Desconocido`', inline: true },
                            { name: '🔒 Cerrado por', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                            { name: '📜 Personaje / Razón', value: `\`\`\`\nPJ: ${ticketData?.nombre_pj || 'N/A'}\nMotivo: ${ticketData?.razon || 'N/A'}\n\`\`\``, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Instituto Yozakura • Sistema de Auditoría' });

                    await canalLogs.send({
                        embeds: [embedAuditoria],
                        files: [transcriptAttachment]
                    }).catch(e => console.log('⚠️ Error enviando logs de ticket al canal de auditoría:', e));
                }
            }

            await interaction.editReply({ content: '🔒 **Ticket cerrado con éxito.** Generando transcripción, enviando registro y eliminando canal en 5 segundos...' });

            setTimeout(async () => {
                await channel.delete().catch(() => {});
            }, 5000);

        } catch (err) {
            console.error('❌ Error cerrando ticket:', err);
            await interaction.editReply({ content: '❌ Ocurrió un error al procesar el cierre y la transcripción.' });
        }
    }

    // ==========================================
    // FIN DEL SISTEMA DE TICKETS
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'btn_solicitar_panel') {
        await interaction.deferReply({ flags: 64 });

        try {
            const { data: rolesPermitidos, error } = await supabase
                .from('roles_revisores')
                .select('role_id');

            if (error) {
                console.error('❌ Error de Supabase (btn_solicitar_panel):', error);
                return await interaction.editReply({ content: '❌ Error al consultar la base de datos.' });
            }

            if (!rolesPermitidos || rolesPermitidos.length === 0) {
                return await interaction.editReply({
                    content: '⚠️ Aún no se ha configurado ningún rol de revisor. Usa `/rol-revisor agregar` primero.'
                });
            }

            const tienePermiso = interaction.member.roles.cache.some(role =>
                rolesPermitidos.some(r => r.role_id === role.id)
            );

            if (!tienePermiso) {
                return await interaction.editReply({
                    content: '❌ No tienes los permisos necesarios para acceder al panel de revisión de fichas.'
                });
            }

            const userId = interaction.user.id;
            const username = encodeURIComponent(interaction.user.username);
            const panelUrl = `https://fluffy-mooncake-ef27e0.netlify.app/?discord_id=${userId}&username=${username}`;

            return await interaction.editReply({
                content: `🌸 **Panel de Staff - Instituto Yozakura**\n\nHaz clic en el enlace de abajo para revisar las fichas pendientes. Este acceso es único y seguro para ti.\n\n🔗 **[Abrir Panel de Revisión](${panelUrl})**`
            });

        } catch (err) {
            console.error('❌ Error en btn_solicitar_panel:', err);
            return await interaction.editReply({ content: '❌ Ocurrió un error al procesar tu solicitud.' });
        }
    }

    if (interaction.isButton() && interaction.customId === 'btn_iniciar_verificacion') {
        const modal = new ModalBuilder()
            .setCustomId('modal_verificacion_roblox')
            .setTitle('🌸 Vinculación de Cuenta de Roblox');

        const usernameInput = new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel('Usuario de Roblox')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: RobloxPlayer123')
            .setMinLength(3)
            .setMaxLength(20)
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(actionRow);

        return await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_verificacion_roblox') {
        await interaction.deferReply({ flags: 64 });

        const robloxUser = interaction.fields.getTextInputValue('roblox_username');

        try {
            const robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [robloxUser], excludeBannedUsers: true })
            });

            const robloxData = await robloxRes.json();

            if (!robloxData.data || robloxData.data.length === 0) {
                return await interaction.editReply({
                    content: `❌ No se encontró ningún usuario de Roblox llamado **${robloxUser}**. Verifica que esté bien escrito.`
                });
            }

            const robloxId = robloxData.data[0].id;
            const robloxName = robloxData.data[0].name;

            const { data: existingRoblox } = await supabase
                .from('users')
                .select('*')
                .or(`roblox_id.eq.${robloxId},discord_id.eq.${interaction.user.id}`)
                .maybeSingle();

            if (existingRoblox) {
                if (existingRoblox.roblox_id == robloxId) {
                    return await interaction.editReply({
                        content: `⚠️ La cuenta de Roblox **${robloxName}** ya se encuentra vinculada a otro usuario en este servidor.`
                    });
                }
                if (existingRoblox.discord_id === interaction.user.id) {
                    return await interaction.editReply({
                        content: `⚠️ Tu cuenta de Discord ya está vinculada al usuario **${existingRoblox.roblox_username}**.`
                    });
                }
            }

            const verificationCode = `YOZAKURA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const { error: dbError } = await supabase
                .from('pending_verifications')
                .upsert({
                    discord_id: interaction.user.id,
                    roblox_id: robloxId,
                    roblox_username: robloxName,
                    verification_code: verificationCode,
                    created_at: new Date().toISOString()
                }, { onConflict: 'discord_id' });

            if (dbError) {
                console.error('❌ Error Supabase:', dbError);
                return await interaction.editReply({ content: '❌ Error al guardar la verificación pendiente en la BD.' });
            }

            const embed = new EmbedBuilder()
                .setColor('#00FFFF')
                .setTitle('🔑 Código de Verificación Generado')
                .setDescription(`Hola **${interaction.user.username}**, para verificar que eres el dueño de **${robloxName}**, sigue estos pasos:`)
                .addFields(
                    { name: '1️⃣ Copia tu código', value: `\`\`\`${verificationCode}\`\`\``, inline: false },
                    { name: '2️⃣ Pégalo en tu Biografía de Roblox', value: 'Ve a tu Perfil de Roblox ➔ *Editar Perfil* ➔ Pega el código en la **Descripción** y guarda los cambios.', inline: false },
                    { name: '3️⃣ Confirma tu verificación', value: 'Haz clic en el botón de abajo cuando hayas guardado tu biografía.', inline: false }
                )
                .setFooter({ text: 'Sistema de Verificación • Instituto Yozakura' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_confirmar_bio')
                    .setLabel('Ya puse el código en mi bio')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✅')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('❌ Error en verificación:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error inesperado al consultar Roblox.' });
        }
        return;
    }

    if (interaction.isButton() && interaction.customId === 'btn_confirmar_bio') {
        await interaction.deferReply({ flags: 64 });

        try {
            const { data: pending, error: pendingErr } = await supabase
                .from('pending_verifications')
                .select('*')
                .eq('discord_id', interaction.user.id)
                .maybeSingle();

            if (pendingErr || !pending) {
                return await interaction.editReply({ content: '⚠️ No tienes ninguna verificación pendiente. Haz clic en **Verificar mi Cuenta** para iniciar.' });
            }

            const { data: duplicateCheck } = await supabase
                .from('users')
                .select('*')
                .eq('roblox_id', pending.roblox_id)
                .maybeSingle();

            if (duplicateCheck) {
                await supabase.from('pending_verifications').delete().eq('discord_id', interaction.user.id);
                return await interaction.editReply({
                    content: `⚠️ Lo sentimos, la cuenta de Roblox **${pending.roblox_username}** acaba de ser registrada por otro usuario.`
                });
            }

            const bioRes = await fetch(`https://users.roblox.com/v1/users/${pending.roblox_id}`);
            const bioData = await bioRes.json();
            const userBio = bioData.description || '';

            if (!userBio.includes(pending.verification_code)) {
                return await interaction.editReply({
                    content: `❌ **No se encontró el código en tu biografía de Roblox.**\n\nAsegúrate de copiar exactamente \`${pending.verification_code}\` en la biografía de **${pending.roblox_username}**, guardar cambios e intentarlo de nuevo.`
                });
            }

            const { data: config } = await supabase
                .from('verification_config')
                .select('*')
                .eq('guild_id', interaction.guild.id)
                .maybeSingle();

            try {
                await interaction.member.setNickname(pending.roblox_username);
            } catch (nickErr) {
                console.log('⚠️ No se pudo cambiar el apodo (Permisos o Jerarquía de roles).');
            }

            if (config?.verified_role_id) {
                await interaction.member.roles.add(config.verified_role_id).catch(() => {});
            }
            if (config?.unverified_role_id) {
                await interaction.member.roles.remove(config.unverified_role_id).catch(() => {});
            }

            await supabase.from('users').upsert({
                discord_id: interaction.user.id,
                roblox_id: pending.roblox_id,
                roblox_username: pending.roblox_username,
                verified_at: new Date().toISOString()
            });

            await supabase.from('pending_verifications').delete().eq('discord_id', interaction.user.id);

            await interaction.editReply({
                content: `🎉 **¡Verificación Completada Con Éxito!**\nTu cuenta de Discord ahora está vinculada a **${pending.roblox_username}**.`
            });

        } catch (error) {
            console.error('❌ Error al validar biografía:', error);
            await interaction.editReply({ content: '❌ Ocurrió un fallo al comprobar tu biografía de Roblox.' });
        }
        return;
    }

    if (interaction.isButton() && interaction.customId === 'btn_abrir_ficha') {
        const discordId = interaction.user.id;
        const username = encodeURIComponent(interaction.user.username);
        const avatar = encodeURIComponent(interaction.user.displayAvatarURL({ extension: 'png' }));

        const WEB_FORM_URL = `https://singular-peony-0d456a.netlify.app/?discord_id=${discordId}&username=${username}&avatar=${avatar}`;

        const embedRespuesta = new EmbedBuilder()
            .setColor('#FFB7C5')
            .setTitle('🌸 Formulario de Ficha Personalizado')
            .setDescription(`Hola **${interaction.user.username}**, haz clic en el botón de abajo para abrir tu formulario de admisión.\n\n⚠️ *Tus datos de Discord se vincularán automáticamente a tu ficha.*`)
            .setFooter({ text: 'Instituto Yozakura RP' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🔗 Abrir Ficha Web')
                .setStyle(ButtonStyle.Link)
                .setURL(WEB_FORM_URL)
        );

        return await interaction.reply({
            embeds: [embedRespuesta],
            components: [row],
            flags: 64
        });
    }

    if (interaction.isButton() && interaction.customId === 'revisar_ficha_btn') { 
        
        const { data: rolesPermitidos, error } = await supabase
            .from('roles_revisores')
            .select('role_id');

        if (error) {
            console.error('Error de Supabase:', error);
            return interaction.reply({ content: '❌ Error al consultar la base de datos.', flags: 64 });
        }

        if (!rolesPermitidos || rolesPermitidos.length === 0) {
            return interaction.reply({ 
                content: '⚠️ Aún no se ha configurado ningún rol de revisor. Usa `/rol-revisor agregar` primero.', 
                flags: 64 
            });
        }

        const tienePermiso = interaction.member.roles.cache.some(role => 
            rolesPermitidos.some(r => r.role_id === role.id)
        );

        if (!tienePermiso) {
            return interaction.reply({ 
                content: '❌ No tienes los permisos necesarios para acceder al panel de revisión de fichas.', 
                flags: 64 
            });
        }

        const userId = interaction.user.id;
        const username = encodeURIComponent(interaction.user.username);
        
        const panelUrl = `https://fluffy-mooncake-ef27e0.netlify.app/?discord_id=${userId}&username=${username}`;

        return interaction.reply({ 
            content: `🌸 **Panel de Staff - Instituto Yozakura**\n\nHaz clic en el enlace de abajo para revisar las fichas pendientes. Este acceso es único y seguro para ti.\n\n🔗 **[Abrir Panel de Revisión](${panelUrl})**`, 
            flags: 64 
        });
    }

    if (interaction.isButton() && interaction.customId.startsWith('revisar_ficha_')) {
        const fichaId = interaction.customId.replace('revisar_ficha_', '');
        const member = interaction.member;
        const guildId = interaction.guild.id;

        try {
            const { data: config } = await supabase
                .from('fichas_config')
                .select('roles_staff')
                .eq('guild_id', guildId)
                .maybeSingle();

            const tienePermiso = member.permissions.has('Administrator') || 
                                 (config?.roles_staff && config.roles_staff.some(roleId => member.roles.cache.has(roleId)));

            if (!tienePermiso) {
                return interaction.reply({ 
                    content: '🚫 No tienes los roles de Staff autorizados para revisar fichas.', 
                    flags: 64 
                });
            }

            const { data: ficha, error } = await supabase
                .from('fichas')
                .select('*')
                .eq('id', fichaId)
                .maybeSingle();

            if (error || !ficha) {
                return interaction.reply({ content: '❌ La ficha no fue encontrada en la base de datos.', flags: 64 });
            }

            if (ficha.estado === 'aprobada' || ficha.estado === 'rechazada' || ficha.estado === 'verificada' || ficha.estado === 'aceptada' || ficha.estado === 'negada') {
                return interaction.reply({ content: '🔒 Esta ficha ya fue finalizada anteriormente.', flags: 64 });
            }

            if (ficha.estado === 'revision' && ficha.revisando_por_id !== interaction.user.id) {
                return interaction.reply({ 
                    content: `🛑 **Acceso Denegado:** Esta ficha ya está siendo revisada por **${ficha.revisando_por_tag || 'otro miembro del Staff'}**.`, 
                    flags: 64 
                });
            }

            await supabase.from('fichas').update({
                estado: 'revision',
                revisando_por_id: interaction.user.id,
                revisando_por_tag: interaction.user.tag
            }).eq('id', fichaId);

            const staffAvatar = interaction.user.displayAvatarURL({ extension: 'png' });
            const staffName = encodeURIComponent(interaction.user.username);
            const staffRole = encodeURIComponent(member.roles.highest.name);

            const STAFF_WEB_URL = `https://fluffy-mooncake-ef27e0.netlify.app/staff-panel.html?ficha_id=${fichaId}&staff_id=${interaction.user.id}&staff_name=${staffName}&staff_avatar=${encodeURIComponent(staffAvatar)}&staff_role=${staffRole}`;

            return interaction.reply({
                content: `🔎 Has tomado la revisión de la ficha **#${fichaId}**.\n\n🔗 [Haz clic aquí para abrir el Panel de Revisión](${STAFF_WEB_URL})`,
                flags: 64
            });

        } catch (err) {
            console.error('❌ Error en botón de revisión de ficha:', err);
            return interaction.reply({ content: '❌ Ocurrió un error al procesar la revisión.', flags: 64 });
        }
    }
});

client.on(Events.GuildMemberRemove, async (member) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .delete()
            .eq('discord_id', member.id)
            .select();

        await supabase
            .from('pending_verifications')
            .delete()
            .eq('discord_id', member.id);

        if (data && data.length > 0) {
            console.log(`🧹 El usuario ${member.user.tag} (${member.id}) salió del servidor. Se liberó la cuenta de Roblox "${data[0].roblox_username}".`);
        }
    } catch (err) {
        console.error('❌ Error al eliminar registro de usuario que salió:', err);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const botMention = `<@${client.user.id}>`;
    const botMentionNickname = `<@!${client.user.id}>`;

    if (message.content.includes(botMention) || message.content.includes(botMentionNickname)) {
        const app = await client.application.fetch();
        const owner = app.owner;

        const infoEmbed = new EmbedBuilder()
            .setColor(0xFFB7C5)
            .setTitle('🌸 夜桜高校 | Bot Oficial de Instituto Yozakura')
            .setDescription(
                '¡Hola! Soy el bot exclusivo de gestión de roleplay para la comunidad de **Instituto Yozakura (Gakuran RP)**. ' +
                'Me encargo de administrar las fichas de estudiantes y profesores, la verificación de usuarios y el registro de pandillas/clubes.'
            )
            .addFields(
                { name: '🔒 Estado del Sistema', value: '🔒 **Bot Privado / De uso exclusivo.**', inline: false },
                { name: '👤 Creador / Desarrollador', value: owner ? `<@${owner.id}> (${owner.username})` : '`TuTuMero`', inline: true },
                { name: '🌐 Portafolio Web', value: '[Visitar TuTuMero](https://tutumero.netlify.app/)', inline: true },
                { name: '🛠️ Servidor de Soporte', value: '[Soporte Técnico](https://discord.gg/vFs9mp7zdN)', inline: true },
                { name: '🏰 Servidor Oficial', value: '[Unirse A Instituto Yozakura RP](https://discord.gg/6yRXN4Hfn)', inline: true }
            )
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'Sistema de Roleplay • Yozakura 2026', iconURL: message.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        try {
            await message.reply({ embeds: [infoEmbed] });
        } catch (err) {
            console.error('Error al responder a la mención:', err.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);