FROM node:8

# 앱 경로 생성
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# 필요 모듈 설치
COPY package*.json ./
RUN npm install

# 앱 복사
COPY . .

# 호스트와 연결할 포트 설정
EXPOSE 8080

# 앱 실행
# docker run -e DATABASE_URL=127.0.0.1 -e DATABASE_PORT=27017 --name evm-vendor -p 3000:3000 -v ~/release:/usr/src/app/release -d twibap/evm-vendor
CMD node app.js -d $DATABASE_URL -p $DATABASE_PORT
