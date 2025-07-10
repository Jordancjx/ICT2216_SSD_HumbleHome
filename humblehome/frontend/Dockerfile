# Build stage
FROM node:18 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
RUN apk add --no-cache openssl

# Copy React build to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Copy SSL config and certificates
COPY 00-rate-limit.conf /etc/nginx/conf.d/00-rate-limit.conf
COPY ssl.conf /etc/nginx/conf.d/ssl.conf

# Expose HTTP and HTTPS ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
