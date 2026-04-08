.PHONY: dev build start test test-watch test-coverage lint format migrate seed verify

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

test-coverage:
	npm run test:coverage

lint:
	npm run lint

format:
	npm run format

migrate:
	npx prisma migrate dev

seed:
	npx prisma db seed

verify: build lint test
