FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_IAM=http://127.0.0.1:3001
ARG VITE_API_CORE=http://127.0.0.1:3000
ARG VITE_API_DATA=http://127.0.0.1:3002
ARG VITE_API_AUDIT=http://127.0.0.1:3003
ENV VITE_API_IAM=$VITE_API_IAM
ENV VITE_API_CORE=$VITE_API_CORE
ENV VITE_API_DATA=$VITE_API_DATA
ENV VITE_API_AUDIT=$VITE_API_AUDIT
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
