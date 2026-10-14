# MaggyBot para Discord

Bot custom del server. Los comandos funcionan de dos formas: con prefijo
(`maggy ping`) y como slash commands (`/ping`).

Se levanta con Docker. Requiere **Node.js 22.12 o superior**, que es lo que trae
la imagen; correrlo con `npm start` sobre un Node menor funciona para todo
menos el comando de voz.

## Instalación con Docker

```bash
cp .env.example .env               # completar los valores (ver abajo)
docker compose build
docker compose run --rm deploy     # registra los slash commands (una vez)
docker compose up -d
docker compose logs -f bot
```

Para actualizar después de cambiar código:

```bash
docker compose up -d --build
```

Si cambiaste el `name`, la `description` o las `options` de algún comando,
volvé a correr `docker compose run --rm deploy`.

Las respuestas aprendidas viven en el volumen `bot-data` y sobreviven a
rebuilds. Para verlas o sacar una copia:

```bash
docker compose exec bot cat /app/data/respuestas.json
```

Si preferís tenerlas como archivo en el host, cambiá el volumen en
`docker-compose.yml` por un bind mount:

```yaml
    volumes:
      - ./data:/app/data
```

y en Linux creá la carpeta con el dueño correcto antes de levantar
(el contenedor corre como usuario `node`, uid 1000):

```bash
mkdir -p data && sudo chown -R 1000:1000 data
```

El contenedor tiene `restart: unless-stopped`. Si el token está mal, el bot
sale con error y Docker lo reintenta en loop: mirá los logs antes de asumir
que es otra cosa.

## Instalación con Node directo

```bash
npm install
cp .env.example .env    # completar los valores (ver abajo)
npm run deploy          # registra los slash commands en Discord
npm start               # o "npm run dev" para recarga automática
```

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

| Variable            | Obligatoria | Para qué                                           |
| ------------------- | ----------- | -------------------------------------------------- |
| `DISCORD_TOKEN`     | sí          | Token del bot                                      |
| `DISCORD_CLIENT_ID` | sí          | Application ID, para registrar los slash commands  |
| `DISCORD_GUILD_ID`  | no          | Server de pruebas: los slash aparecen al instante  |
| `PREFIX`            | sí          | Prefijo de los comandos de texto (`maggy`)         |
| `WEATHERAPI`        | no          | API key de weatherapi.com, solo para `clima`       |

### Dónde sacar cada dato

**`DISCORD_TOKEN` y `DISCORD_CLIENT_ID`** — <https://discord.com/developers/applications>

1. Entrá con la cuenta que creó el bot y abrí la aplicación.
2. `General Information` → copiá **Application ID** → ese es `DISCORD_CLIENT_ID`.
3. `Bot` → **Reset Token** → copiá el token → ese es `DISCORD_TOKEN`.
   El token se muestra una sola vez; si lo perdés hay que resetearlo (eso
   invalida el anterior y desconecta al bot hasta que actualices el `.env`).

**Intent obligatorio.** En la misma pantalla `Bot`, sección
**Privileged Gateway Intents**, activá **MESSAGE CONTENT INTENT** y guardá.
Sin eso Discord no manda el texto de los mensajes y **ningún comando de prefijo
responde** (los slash sí funcionan igual). Es gratis mientras el bot esté en
menos de 100 servidores.

**`DISCORD_GUILD_ID`** — en Discord: Ajustes de usuario → Avanzado → activá
**Modo desarrollador**; después click derecho sobre el servidor → *Copiar ID*.

**`WEATHERAPI`** — cuenta gratis en <https://www.weatherapi.com>, la key está
en el dashboard.

### Invitar el bot a un servidor

En el Developer Portal → `OAuth2` → `URL Generator`: marcá los scopes **`bot`**
y **`applications.commands`** (este segundo es el que habilita los slash
commands), elegí los permisos y abrí la URL que genera.

Permisos mínimos: `Send Messages`, `Read Message History`, `Embed Links`,
`Add Reactions`, y `Connect` + `Speak` si querés usar `di`.

## Comandos

| Comando     | Qué hace                                              |
| ----------- | ----------------------------------------------------- |
| `caracola`  | Bola 8 mágica                                          |
| `carcel`    | Te vas a pudrir en la cárcel                           |
| `chiste`    | Un chiste de jokeapi.dev                               |
| `clima`     | Pronóstico del tiempo (necesita `WEATHERAPI`)          |
| `define`    | Resumen de Wikipedia en español                        |
| `di`        | Texto a voz en tu canal de voz                         |
| `error`     | Gatito HTTP (`error 404`)                              |
| `help`      | Lista los comandos                                     |
| `marcelo`   | Agachate y conocelo                                    |
| `mata`      | Matá a alguien                                         |
| `meme`      | Meme random en español                                 |
| `ping`      | Pong + latencia                                        |
| `play`      | Tema por nombre o link; playlist de YouTube o Spotify |
| `randomcat` | Un gatito random                                       |
| `roll`      | Tirada de dado (`roll 20`)                             |
| `status`    | Uptime y cantidad de servidores                        |

NSFW (solo responden en canales marcados como NSFW): `ass`, `boobs`, `hentai`,
`pgif`, `pimg`, `pussy`.

### Respuestas aprendidas

Si le escribís algo con el prefijo que no es un comando, el bot pregunta cómo
debería responder y guarda la respuesta en `data/respuestas.json` para la
próxima vez. Ese archivo es datos de runtime y está fuera de git.

## Agregar un comando

Un archivo en `commands/` que exporte esto:

```js
module.exports = {
	name: 'saludo',
	description: 'Saluda',
	// nsfw: true,        -> solo en canales NSFW
	// guildOnly: true,   -> no funciona por privado
	options: [
		{
			name: 'a_quien',
			description: 'A quién saludar',
			type: 3,       // 3 = STRING, 4 = INTEGER
			required: true,
			rest: true,    // con prefijo, junta todas las palabras restantes
		},
	],
	async run(ctx) {
		await ctx.reply(`Hola ${ctx.arg('a_quien')}`);
	},
};
```

`ctx` es el mismo objeto venga de prefijo o de slash, así que el comando se
escribe una sola vez. Métodos: `reply()`, `send()`, `react()`, `dm()`,
`defer()` (avisar que la respuesta tarda), `arg(nombre)`, y las propiedades
`args`, `user`, `member`, `guild`, `channel`, `isNsfw`, `isSlash`.

Después de agregar o cambiar el `name`, la `description` o las `options` de un
comando hay que correr `npm run deploy` para que Discord lo actualice.

## Scripts

| Script                  | Qué hace                                 |
| ----------------------- | ---------------------------------------- |
| `npm start`          | Levanta el bot                           |
| `npm run dev`        | Igual, con recarga automática (nodemon)  |
| `npm run deploy`     | Registra los slash commands              |
| `npm run undeploy`   | Borra todos los slash commands           |
| `npm run docker:up`  | `docker compose up -d`                   |
| `npm run docker:logs`| `docker compose logs -f bot`             |
| `npm run docker:deploy` | Registra los slash desde el contenedor |
| `npm run docker:down`| Baja el contenedor                       |

## Notas

- La voz necesita `@discordjs/voice` >= `0.19`, porque Discord ahora exige el
  protocolo DAVE (cifrado punta a punta). Con versiones anteriores el gateway
  cierra la conexión con `4017 E2EE/DAVE protocol required`: el bot entra al
  canal pero no se escucha nada. Esa versión pide Node 22.12+.
- `VOICE_DEBUG=1` en el `.env` loguea el handshake de voz completo (estados de
  conexión, player y códigos de cierre del websocket).
- La voz (`di`) usa `opusscript` y `ffmpeg-static`: JS puro y binario
  precompilado, no hace falta compilador ni instalar ffmpeg aparte.

## Soporte

marcos@nibiru.com.uy
