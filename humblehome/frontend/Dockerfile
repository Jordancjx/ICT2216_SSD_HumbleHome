# Build stage
FROM node:18 AS build

# Create the www-data user if it doesn't already exist (www-data group apparently already exists in the node image)
# Ensures that if the www-data user already exists, it won't throw an error and will simply skip that step
RUN useradd -r -g www-data www-data || true 

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy React build to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Copy SSL config and certificates
COPY ssl.conf /etc/nginx/conf.d/ssl.conf
COPY certs /etc/nginx/certs

# Switch to the www-data user
USER www-data

# Expose HTTP and HTTPS ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
