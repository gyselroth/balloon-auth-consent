FROM node:12.15-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app

ENTRYPOINT npm start

EXPOSE 3000
