FROM node:20-alpine

RUN adduser -D -u 1000 appuser

USER appuser
WORKDIR /home/appuser/app

COPY --chown=appuser:appuser package.json ./
RUN npm install

COPY --chown=appuser:appuser . .

EXPOSE 7860

CMD ["npm", "start"]
