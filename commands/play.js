"use strict";

const musica = require("../lib/musica");

module.exports = {
  name: "play",
  description: "reproduce un link (YouTube, SoundCloud…) o busca por nombre",
  guildOnly: true,
  grupo: "Música",
  options: [
    {
      name: "tema",
      description: "Link o nombre del tema",
      type: 3, // STRING
      required: true,
      rest: true,
    },
  ],
  init(client) {
    musica.iniciar(client);
  },
  async run(ctx) {
    const consulta = (ctx.arg("tema") ?? "").trim();

    if (!consulta) {
      await ctx.reply(
        "Pasame un link o el nombre. Ej: `play the strokes - 12:51`",
      );
      return;
    }

    const canalVoz = ctx.member?.voice?.channel;
    if (!canalVoz) {
      await ctx.reply("Metete en un canal de voz primero.");
      return;
    }

    const permisos = canalVoz.permissionsFor(ctx.guild.members.me);
    if (!permisos?.has(["Connect", "Speak"])) {
      await ctx.reply(
        `No tengo permiso para conectarme o hablar en **${canalVoz.name}**.`,
      );
      return;
    }

    await ctx.defer();

    let pista;
    try {
      pista = await musica.resolver(consulta);
    } catch (error) {
      console.error("[play] resolver:", error.message);
      await ctx.reply(`No pude buscar eso: ${error.message}`);
      return;
    }

    pista.pedidoPor = ctx.user.username;

    const sesion = musica.crearSesion(ctx.guild, ctx.channel);

    try {
      await sesion.conectar(canalVoz);
      sesion.agregar(pista);
    } catch (error) {
      console.error("[play] conectar:", error.message);
      await ctx.reply(`No pude entrar al canal de voz: ${error.message}`);
      return;
    }

    const duracion = musica.formatearDuracion(pista.duracion);

    if (!sesion.actual) {
      // La cola estaba vacía: arranca ahora y avisa el propio reproductor.
      await ctx.reply(`Buscando **${pista.titulo}**…`);
      sesion.siguiente();
      return;
    }

    await ctx.reply(
      `➕ **${pista.titulo}** \`${duracion}\` — puesto ${sesion.cola.length} en la cola`,
    );
  },
};
