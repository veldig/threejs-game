FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm i -g http-server
EXPOSE 8080
CMD ["http-server", "-p", "8080", "."]
