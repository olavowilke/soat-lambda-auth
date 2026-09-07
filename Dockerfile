# Imagem para executar a Lambda localmente com o Runtime Interface Emulator.
#
#   docker build -t oficina-lambda-auth .
#   docker run --rm -p 9000:8080 --env-file .env oficina-lambda-auth
#   curl -s localhost:9000/2015-03-31/functions/function/invocations \
#     -d '{"version":"2.0","headers":{},"body":"{\"cpf\":\"52998224725\"}"}'
FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM public.ecr.aws/lambda/nodejs:22
COPY --from=build /build/dist/ ${LAMBDA_TASK_ROOT}/
CMD ["handler.handler"]
