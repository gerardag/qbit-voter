FROM node:22-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY public/ ./public/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
