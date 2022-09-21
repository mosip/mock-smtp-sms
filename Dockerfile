FROM node:16

WORKDIR /usr/src/app

ENV SERVER_HOST=0.0.0.0

COPY . ./

RUN npm install

RUN npm ci --only=production

EXPOSE 8080
EXPOSE 8081
EXPOSE 8025

CMD [ "node", "app.js" ]