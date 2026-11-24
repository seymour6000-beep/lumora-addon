FROM node:22-alpine
WORKDIR /app
COPY package.json server.js run.js ./
COPY adapters ./adapters
COPY public ./public
CMD ["node","run.js"]
