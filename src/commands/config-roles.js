const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol-revisor')
        .setDescription('Agrega o quita roles con permisos para revisar fichas')
        .addSubcommand(subcommand =>
            subcommand
                .setName('agregar')
                .setDescription('Agrega un rol de revisor')
                .addRoleOption(option => 
                    option.setName('rol')
                        .setDescription('El rol a autorizar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('quitar')
                .setDescription('Quita un rol de revisor')
                .addRoleOption(option => 
                    option.setName('rol')
                        .setDescription('El rol a remover')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, supabaseClient) {
        const subcommand = interaction.options.getSubcommand();
        const rol = interaction.options.getRole('rol');

        if (subcommand === 'agregar') {
            // Inserta o actualiza el rol en la tabla 'roles_revisores'
            const { error } = await supabaseClient
                .from('roles_revisores')
                .upsert([{ role_id: rol.id }], { onConflict: 'role_id' });

            if (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Ocurrió un error al guardar el rol en la base de datos.', flags: 64 });
            }
            
            return interaction.reply({ content: `✅ El rol **${rol.name}** ha sido autorizado correctamente para revisar fichas.`, flags: 64 });
        } 
        else if (subcommand === 'quitar') {
            // Elimina el rol de la tabla 'roles_revisores'
            const { error } = await supabaseClient
                .from('roles_revisores')
                .delete()
                .eq('role_id', rol.id);

            if (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Ocurrió un error al eliminar el rol de la base de datos.', flags: 64 });
            }
            
            return interaction.reply({ content: `🗑️ El rol **${rol.name}** ya no tiene permisos de revisión.`, flags: 64 });
        }
    }
};