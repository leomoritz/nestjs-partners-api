# Imagem necessária para rodar a aplicação
FROM node:21-slim

## Ferramentas necessárias

RUN apt update && apt install -y openssl procps

RUN npm install -g @nestjs/cli@10.3.2

WORKDIR /home/node/app

# Usuário 'node' equivale ao usuário da máquina
USER node

# Manter sempre o container ativo para que o dev decida quando interrompê-lo
CMD tail -f /dev/null