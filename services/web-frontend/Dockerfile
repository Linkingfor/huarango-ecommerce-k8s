# syntax=docker/dockerfile:1
# web-frontend: SPA en React + Vite servida por nginx

# Etapa 1: compila la aplicación
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Etapa 2: solo los archivos estáticos sobre nginx sin privilegios de root (usuario 101, puerto 8080)
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 8080
