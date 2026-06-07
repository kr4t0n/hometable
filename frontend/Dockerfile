# ── build stage ───────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ── serve stage (nginx) ───────────────────────────────────────────────
FROM nginx:1.27-alpine
# Templated at container start via envsubst (BACKEND_HOST / BACKEND_PORT).
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_HOST=backend BACKEND_PORT=8000
EXPOSE 80
