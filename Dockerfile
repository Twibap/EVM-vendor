FROM node:8

# 앱 경로 생성
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# 필요 모듈 설치
COPY package*.json ./
RUN npm install

# 앱 복사
COPY . .

EXPOSE 8080
CMD ["npm","start"]
