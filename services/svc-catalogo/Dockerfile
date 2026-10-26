# syntax=docker/dockerfile:1
# svc-catalogo: Catálogo, imágenes y reservas de stock

# Etapa 1: instala solo las dependencias de producción
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: imagen final, sin herramientas de compilación ni dependencias de desarrollo
FROM node:24-alpine
ENV NODE_ENV=production \
    SERVICE_NAME=svc-catalogo \
    PORT=3002
WORKDIR /app
RUN apk add --no-cache tini
# Certificados de Amazon RDS para conectarse con TLS verificado (DB_SSL=verify-full)
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
    /etc/ssl/rds/global-bundle.pem
COPY --from=dependencias --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
# Carpeta de imágenes para el modo local (docker compose la monta como volumen)
RUN mkdir -p /data/media && chown node:node /data/media
# Usuario "node" por su UID: Kubernetes necesita un número para verificar runAsNonRoot
USER 1000
EXPOSE 3002
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
