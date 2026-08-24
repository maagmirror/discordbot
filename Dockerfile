FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# ffmpeg-static baja su binario en el postinstall, por eso no se usa --ignore-scripts
RUN npm ci --omit=dev && npm cache clean --force


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js deploy-commands.js mensajes.txt ./
COPY lib ./lib
COPY commands ./commands

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

CMD ["node", "index.js"]
