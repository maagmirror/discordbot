"use strict";

const musica = require("../lib/musica");

/** La voz no quedó lista ni reintentando. Una sesión sin nada sonando se cierra. */
async function noConecto(ctx, sesion, error) {
  console.error("[play] conectar:", error.message);
  if (!sesion.actual && sesion.cola.length === 0) {
    sesion.destruir("no pude conectar a la voz");
  }
  const motivo = /aborted/i.test(error.message)
    ? "Discord no completó la conexión a tiempo"
    : error.message;
  await ctx.reply(`No pude entrar al canal de voz (${motivo}). Probá de nuevo en un rato.`);
}

/** Playlist de YouTube o playlist/álbum/tema de Spotify. */
async function reproducirLista(ctx, consulta, canalVoz) {
  let lista;
  try {
    lista = await musica.resolverLista(consulta);
  } catch (error) {
    console.error("[play] lista:", error.message);
    await ctx.reply(`No pude leer esa lista: ${error.message}`);
    return;
  }

  for (const pista of lista.pistas) pista.pedidoPor = ctx.user.username;

  const sesion = musica.crearSesion(ctx.guild, ctx.channel);

  try {
    await sesion.conectar(canalVoz);
  } catch (error) {
    await noConecto(ctx, sesion, error);
    return;
  }

  const agregadas = sesion.agregarVarias(lista.pistas);
  if (agregadas === 0) {
    await ctx.reply(`La cola está llena (${musica.MAX_COLA} temas).`);
    return;
  }

  const sobran = Math.max(0, lista.total - agregadas);
  const nota = sobran > 0 ? ` (${sobran} no entraron)` : "";
  const deSpotify = lista.pistas[0].sitio === "Spotify";
  const texto =
    agregadas === 1
      ? `➕ **${lista.pistas[0].titulo}**`
      : `📃 **${lista.nombre}** — ${agregadas} temas en la cola${nota}`;

  await ctx.reply(
    deSpotify && agregadas > 1
      ? `${texto}\nLos de Spotify los busco en YouTube uno por uno a medida que van sonando.`
      : texto,
  );

  if (!sesion.actual) sesion.siguiente();
  else sesion.precargar();
}

module.exports = {
  name: "play",
  description:
    "reproduce un link (YouTube, playlist de YouTube o Spotify, SoundCloud…) o busca por nombre",
  guildOnly: true,
  grupo: "Música",
  options: [
    {
      name: "tema",
      description: "Link (tema o playlist de YouTube/Spotify) o nombre del tema",
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

    if (musica.esLista(consulta)) {
      await reproducirLista(ctx, consulta, canalVoz);
      return;
    }

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
    } catch (error) {
      await noConecto(ctx, sesion, error);
      return;
    }

    try {
      sesion.agregar(pista);
    } catch (error) {
      await ctx.reply(`No lo pude agregar: ${error.message}`);
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
