FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]



dfasadfafd
dfa
ad
f
daad
f
dfa
adf
dfas
fds
fdas
fdasfda

daf
fd
afds
adf
dfa
afd
adf
dfa
dfa
dfa
daf
d
fa
fda
daf
daf
dfa
adf
