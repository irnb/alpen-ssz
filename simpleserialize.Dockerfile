FROM node:lts AS build

WORKDIR /usr/src/app
COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
