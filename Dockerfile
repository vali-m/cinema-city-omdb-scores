FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY main.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 