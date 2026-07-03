.PHONY: dev build start test test-watch test-coverage lint format migrate seed verify e2e e2e-seed e2e-report

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
	DATABASE_URL=postgresql://ubuntu@localhost/drone_school npx prisma migrate dev

seed:
	DATABASE_URL=postgresql://ubuntu@localhost/drone_school npx prisma db seed

verify: build lint test

e2e-seed:
	DATABASE_URL=postgresql://ubuntu@localhost/drone_school npm run e2e:seed

e2e:
	DATABASE_URL=postgresql://ubuntu@localhost/drone_school npm run e2e

e2e-report:
	npm run e2e:report
