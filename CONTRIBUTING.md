# Как вносить изменения в RestaurantOS

Перед началом прочитайте [CLAUDE.md](CLAUDE.md) (жёсткие правила), [контракт](respos-contracts/CONVENTIONS.md) и [бизнес-правила](docs/requirements/BUSINESS_RULES.md).

## 1. Ветки

- `main` всегда в рабочем состоянии, деплоится в production. Прямые push в `main` запрещены, всё идёт через Pull Request.
- Рабочие ветки: `feat/<module>-<кратко>`, `fix/<кратко>`, `docs/<кратко>`, `chore/<кратко>`, `refactor/<кратко>`.
  Примеры: `feat/orders-send-to-kitchen`, `fix/kds-reconnect-refetch`.
- Одна ветка — одна небольшая задача: один use case, модуль, миграция или пользовательский сценарий (ТЗ §18.3).
- Перед PR сделайте rebase на свежий `main`. Squash-merge — по договорённости команды.

## 2. Коммиты

Используем [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <что сделано, в повелительном наклонении>

feat(orders): add partial send to kitchen
fix(payments): reject amount above remaining due
docs(adr): add ADR-0012 order number sequence
```

- `type`: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`.
- `scope`: модуль (`auth`, `orders`, `kitchen`, `inventory`, `payments`, `admin`, `landing`, `contracts`, `db`, ...).
- Миграции БД оформляйте отдельным коммитом с понятным именем миграции.
- Изменение контракта (`respos-contracts/`) — отдельный коммит с записью в `respos-contracts/CHANGELOG.md`.

## 3. Правило 500 строк (ТЗ §8.3)

- Любой вручную написанный файл исходного кода (`.cs .ts .tsx .js .jsx .css .scss .sql` и т. п.) — **не длиннее 500 строк**.
- Ориентиры: 100–250 строк — норма; около 400 — пора подумать о разделении; 500 — абсолютный максимум.
- Делите по ответственности: DTO, validators, handlers, hooks, components, styles, constants. Перенести весь код в соседний «файл-свалку» — это не разделение.
- Исключения: автосгенерированные EF-миграции (`Migrations/`), lock-файлы, vendor, `*.d.ts`. Вручную их не правят.
- Проверка: `node scripts/check-file-length.mjs`. Она же выполняется в CI (job `500-line rule`).

## 4. Код

- Clean Architecture: `Api → Application → Domain`, Infrastructure реализует абстракции. DbContext в контроллерах и бизнес-правила в контроллерах или React запрещены.
- Деньги — только `decimal`/`numeric(18,2)`, количества — `numeric(18,3)`.
- Tenant scope и права проверяются на backend (`[HasPermission]`, global query filters, проверка `X-Branch-Id`).
- Хелперы не дублируются: один api client, один `formatCurrency`, один `hasPermission`, один каталог прав на каждой стороне.
- Все UI-строки идут через i18n (ru, uz-Latn). Демо и mock-интеграции помечаются в UI («Демо», «Не подключено»).
- Секретов в коде, в `VITE_*` и в логах быть не должно.
- Новая зависимость или абстракция требует обоснования в PR. Архитектурные решения фиксируются в ADR (`docs/architecture/ADR/`).

## 5. Pull Request

В описании PR укажите:
1. Что сделано и зачем (ссылка на задачу или раздел ТЗ).
2. Какие решения приняты (ADR, если нужно) и какие допущения сделаны (вопросы владельцу добавьте в `User-Todo.md`).
3. Какие команды проверки запускали и с каким результатом. Не пишите, что команда прошла, если вы её не запускали.
4. Скриншоты для изменений UI (desktop и tablet/mobile).

CI должен быть зелёным. Нужен минимум один ревьюер.

## 6. Definition of Done (ТЗ §16)

Функция готова, когда выполнено всё из списка:

- [ ] use case реализован;
- [ ] права (RBAC) и tenant scope проверены на backend;
- [ ] входные данные валидируются, ошибка показывается рядом с полем;
- [ ] ошибки обработаны (ProblemDetails, без stack trace), есть состояния loading/empty/error/success;
- [ ] тесты добавлены (unit / integration / frontend по [TEST_PLAN](docs/testing/TEST_PLAN.md));
- [ ] соблюдена Clean Architecture;
- [ ] ни один файл не длиннее 500 строк;
- [ ] в коде, конфиге и логах нет секретов;
- [ ] документация обновлена (контракт, BUSINESS_RULES, ERD, ADR — что затронуто);
- [ ] build, lint и tests фактически запущены и проходят.
