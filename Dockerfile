FROM nginx:alpine

WORKDIR /usr/share/nginx/html

ADD style.css index.html /usr/share/nginx/html/
ADD /assets /usr/share/nginx/html/assets
ADD /libs /usr/share/nginx/html/libs
ADD /src /usr/share/nginx/html/src
