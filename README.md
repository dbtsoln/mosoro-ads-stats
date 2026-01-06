# VK Ads Statistics Collection Service

Сервис для автоматического сбора статистики рекламных кампаний из VK Ads API и сохранения в PostgreSQL.

## Возможности

- ✅ **TypeScript** - полная типизация кода
- ✅ **Автоматический сбор** - настраиваемые интервалы для быстрой (по минутам) и накопительной статистики
- ✅ **UPSERT логика** - быстрая статистика обновляется при повторной загрузке
- ✅ **История снапшотов** - накопительная статистика сохраняется как новые записи
- ✅ **Логирование** - детальное логирование всех операций через Winston
- ✅ **Docker** - готовый образ для развертывания
- ✅ **Graceful shutdown** - корректная остановка сервиса

## Структура проекта

```
mosoro-ads-stats/
├── src/
│   ├── config/index.ts                 # Конфигурация из .env
│   ├── types/vk-ads.types.ts          # TypeScript типы
│   ├── services/
│   │   ├── vk-ads-client.ts           # API клиент VK Ads
│   │   ├── logger.ts                  # Winston logger
│   │   └── scheduler.ts               # Cron планировщик
│   ├── database/
│   │   ├── connection.ts              # PostgreSQL Pool
│   │   └── repositories/
│   │       ├── fast-stats.repository.ts    # UPSERT для быстрой статистики
│   │       └── summary-stats.repository.ts # INSERT для накопительной
│   └── index.ts                       # Точка входа
├── migrations/                         # SQL миграции
├── Dockerfile                          # Docker образ
├── docker-compose.yml                  # Docker Compose
└── package.json
```

## Схема базы данных

### `FastStats` - Быстрая статистика (по минутам)

```sql
PRIMARY KEY ("Timestamp", "BannerId")  -- UPSERT по этому ключу
- "Timestamp": TIMESTAMPTZ
- "BannerId": INTEGER
- "Shows": INTEGER
- "Clicks": INTEGER
- "CreatedAt": TIMESTAMPTZ
- "UpdatedAt": TIMESTAMPTZ
```

### `SummaryStats` - Накопительная статистика

```sql
PRIMARY KEY ("Id")  -- Каждый запуск = новая запись
- "Id": BIGSERIAL
- "Timestamp": TIMESTAMPTZ
- "BannerId": INTEGER
- "Shows": INTEGER
- "Clicks": INTEGER
- "Spent": DECIMAL(12, 2)
- "CreatedAt": TIMESTAMPTZ
```

## Установка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Пример `.env`:

```env
# VK Ads API
VK_ADS_API_TOKEN=your_vk_ads_token

# PostgreSQL
POSTGRES_URI=postgresql://user:password@host:port/database
POSTGRES_SSL=false

# Scheduler (интервалы в минутах)
FAST_STATS_INTERVAL=5
SUMMARY_STATS_INTERVAL=10

# Application
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Запуск миграций

```bash
npm run migrate
```

### 4. Запуск в режиме разработки

```bash
npm run dev
```

### 5. Production билд

```bash
npm run build
npm start
```

## Docker

### Сборка образа

```bash
docker build -t mosoro-ads-stats .
```

или

```bash
npm run docker:build
```

### Запуск контейнера

```bash
docker run --env-file .env mosoro-ads-stats
```

или через docker-compose:

```bash
docker-compose up -d
```

### Просмотр логов

```bash
docker logs -f mosoro-ads-stats
```

## Команды npm

```json
{
  "dev": "tsx src/index.ts",              // Разработка
  "build": "tsc",                         // Компиляция TypeScript
  "start": "node dist/index.js",          // Production запуск
  "migrate": "tsx migrations/run-migrations.ts",  // Миграции БД
  "docker:build": "docker build -t mosoro-ads-stats .",
  "docker:run": "docker run --env-file .env mosoro-ads-stats"
}
```

## Логирование

Сервис логирует:
- ✅ Все API запросы (URL, duration, количество записей)
- ✅ Успешные операции с БД (количество записей, duration)
- ✅ Ошибки с детальной информацией
- ✅ Запуск и остановку scheduled задач

Пример логов:

```
2026-01-05T16:26:10.302Z [info]: Database connection successful
2026-01-05T16:26:15.123Z [info]: Fetching fast stats from VK Ads API { url: '...' }
2026-01-05T16:26:15.456Z [info]: Fast stats fetched successfully { duration: 333, recordsCount: 180, bannersCount: 3 }
2026-01-05T16:26:15.789Z [info]: Fast stats batch upserted { recordsCount: 180, duration: 333 }
```

## Планировщик задач

Сервис использует **node-cron** для автоматического сбора статистики:

- **Быстрая статистика**: каждые N минут (по умолчанию 5)
- **Накопительная статистика**: каждые M минут (по умолчанию 10)

Интервалы настраиваются через переменные окружения `FAST_STATS_INTERVAL` и `SUMMARY_STATS_INTERVAL`.

При запуске сервиса данные собираются сразу, затем по расписанию.

## Graceful Shutdown

Сервис корректно обрабатывает сигналы `SIGTERM` и `SIGINT`:

1. Останавливает все scheduled задачи
2. Закрывает connection pool PostgreSQL
3. Завершает процесс с кодом 0

## Миграции в Docker

Перед запуском контейнера выполните миграции одним из способов:

### 1. Вручную через psql

```bash
psql $POSTGRES_URI -f migrations/001_create_fast_stats_table.sql
psql $POSTGRES_URI -f migrations/002_create_summary_stats_table.sql
```

### 2. Через Docker контейнер с PostgreSQL клиентом

```bash
docker run --rm -v $(pwd)/migrations:/migrations postgres:16-alpine \
  psql $POSTGRES_URI -f /migrations/001_create_fast_stats_table.sql

docker run --rm -v $(pwd)/migrations:/migrations postgres:16-alpine \
  psql $POSTGRES_URI -f /migrations/002_create_summary_stats_table.sql
```

### 3. Локально через npm

```bash
npm run migrate
```

## Технологии

- **TypeScript** 5.3+
- **Node.js** 20+ (Alpine в Docker)
- **PostgreSQL** (через pg driver)
- **Winston** для логирования
- **node-cron** для планирования
- **Docker** для контейнеризации

## Архитектурные решения

### Фильтрация данных

Сохраняются только баннеры с активностью:
- **Fast stats**: записи, где `shows > 0` или `clicks > 0`
- **Summary stats**: только активные баннеры (`banner_status=active`) с показами или кликами

### UPSERT для FastStats

Использует `ON CONFLICT ("Timestamp", "BannerId") DO UPDATE` - при повторной загрузке данных за ту же минуту они перезаписываются.

### INSERT для SummaryStats

Каждый запуск создает новую запись. Позже эти данные будут разбиваться на инкрементальные изменения на уровне БД.

### Connection Pool

Используется pg.Pool с настройками:
- max: 20 подключений
- idleTimeoutMillis: 30000
- connectionTimeoutMillis: 2000

## Разработка

### Добавление новых метрик

1. Обновить типы в `src/types/vk-ads.types.ts`
2. Добавить парсинг в `src/services/vk-ads-client.ts`
3. Создать миграцию в `migrations/`
4. Добавить repository в `src/database/repositories/`

### Тестирование

Проверьте данные в БД:

```sql
SELECT COUNT(*) FROM "FastStats";
SELECT COUNT(*) FROM "SummaryStats";

SELECT * FROM "FastStats" ORDER BY "CreatedAt" DESC LIMIT 10;
SELECT * FROM "SummaryStats" ORDER BY "CreatedAt" DESC LIMIT 10;
```

## Мониторинг

Рекомендации по мониторингу:

1. Проверяйте логи на наличие ошибок API
2. Мониторьте количество записей в БД
3. Отслеживайте duration API запросов
4. Проверяйте успешность scheduled задач

## Производительность

Для больших объемов данных рассмотрите:

1. **Batch INSERT через UNNEST** вместо loop
2. **Партиционирование** таблиц по timestamp
3. **BRIN индексы** для очень больших таблиц
4. **Retention policy** для автоматической очистки старых данных

## Лицензия

ISC
