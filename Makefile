.PHONY: dev build start test test-watch test-slow test-coverage lint format migrate seed verify e2e e2e-seed e2e-report

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm run test

test-watch:
	npm run test:watch

test-slow:
	npm run test:slow

test-coverage:
	npm run test:coverage

lint:
	npm run lint

format:
	npm run format

# 開発 DB の既定値。シェルの環境変数 DATABASE_URL が設定済みならそちらを優先する
# (本番サーバーと各開発者ローカルで接続先が異なるため、ターゲット内にハードコードしない)
DATABASE_URL ?= postgresql://ubuntu@localhost/drone_school

migrate:
	DATABASE_URL=$(DATABASE_URL) npx prisma migrate dev

seed:
	DATABASE_URL=$(DATABASE_URL) npx prisma db seed

verify: build lint test

# E2E は開発 DB と分離した専用 DB を使う。接続先は playwright.config.ts /
# e2e:seed が .env.test.local から解決し、fail-closed ガードで誤接続を拒否する。
# ここで DATABASE_URL を注入すると開発 DB を向いてしまうため指定しない。
e2e-seed:
	npm run e2e:seed

e2e:
	npm run e2e

e2e-report:
	npm run e2e:report
