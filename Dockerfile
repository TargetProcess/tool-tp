FROM node:6.3.0

WORKDIR  /tool-tp

RUN  npm install pm2 -g

COPY  .  /tool-tp

RUN  npm i


EXPOSE  3010

ENV NODE_ENV=production


CMD [ "npm", "start" ]
