# syntax=docker/dockerfile:1
# svc-pagos: Worker de cobros

# Etapa 1: instala solo las dependencias de producción
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: imagen final, sin herramientas de compilación ni dependencias de desarrollo
FROM node:24-alpine
ENV NODE_ENV=production \
    SERVICE_NAME=svc-pagos \
    PORT=3005
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=dependencias --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
# Usuario "node" por su UID: Kubernetes necesita un número para verificar runAsNonRoot
USER 1000
EXPOSE 3005
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
