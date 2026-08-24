FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# ffmpeg-static baja su binario en el postinstall, por eso no se usa --ignore-scripts
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-bookworm-slim AS ytdlp

# Binario autocontenido (PyInstaller): no necesita Python en el runtime.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl \
	&& curl -fsSL -o /usr/local/bin/yt-dlp \
		https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
	&& chmod +x /usr/local/bin/yt-dlp \
	&& /usr/local/bin/yt-dlp --version


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

# yt-dlp resuelve HTTPS por su cuenta y necesita los certificados raíz
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=ytdlp /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js deploy-commands.js mensajes.txt ./
COPY lib ./lib
COPY commands ./commands

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

CMD ["node", "index.js"]
