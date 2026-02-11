FROM node:18.19.1-alpine
WORKDIR /home/ethan/Desktop/nodedock_test

COPY . .

RUN npm install

EXPOSE 3000

CMD ["node", "build/hello.js"]
