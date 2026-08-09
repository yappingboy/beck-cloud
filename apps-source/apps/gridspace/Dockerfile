FROM node:20-slim
WORKDIR /grid
COPY package.json /grid
COPY app.js /grid
COPY apps /grid/apps
COPY src /grid/src
COPY web /grid/web
COPY bin /grid/bin
RUN apt-get -y update; apt-get -y install curl git
EXPOSE 8080
RUN npm i
# Patch esbuild config to also exclude 'node:module' (manifold-3d dynamic import)
RUN sed -i "s/'module',/'module',\n        'node:module',/" bin/esbuild.config.mjs
RUN npm run webpack-ext
RUN mkdir -p src/pack && npm run webpack-src prod && npm run bundle && rm -rf node_modules/.cache && npm cache clean --force
RUN npm install -g @gridspace/app-server
RUN rm -rf /grid/bin
CMD gs-app-server
