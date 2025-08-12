# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# use lockfile if present; otherwise fall back to npm install
RUN [ -f package-lock.json ] && npm ci || npm install
COPY . .
# inject API base at build time
ARG VITE_API_BASE=http://backend:8000
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

# serve static with nginx
FROM nginx:1.27-alpine
# remove default nginx site so we don't see the blue welcome page
RUN rm -rf /usr/share/nginx/html/*
# copy Vite build output
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
