# Build stage
FROM node:18 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

RUN npm run build
COPY . .

# Production stage
FROM nginx:stable-alpine

# Copy React build to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Copy SSL config and certificates
COPY ssl.conf /etc/nginx/conf.d/ssl.conf
COPY certs /etc/nginx/certs

# Change ownership of necessary directories to www-data
RUN chown -R www-data:www-data /usr/share/nginx/html \
    && chown -R www-data:www-data /var/cache/nginx \
    && chown -R www-data:www-data /var/log/nginx \
    && chown -R www-data:www-data /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R www-data:www-data /var/run/nginx.pid

# Switch to the www-data user
USER www-data

# Expose HTTP and HTTPS ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
