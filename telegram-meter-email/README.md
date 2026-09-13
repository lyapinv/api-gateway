# telegram-meter-email

Бот для Telegram: принимает показания счетчиков в специальном чате и отправляет их на заранее заданный email по шаблону.

## Формат сообщения

```text
гор-123, хол-321
```

Допустимы варианты разделителей (`-`, `:`, пробел; `,` или `;`) и обратный порядок (`хол-…, гор-…`).

## Быстрый старт

```bash
cd telegram-meter-email
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# заполните TELEGRAM_* и SMTP_* в .env
python -m meter_bot
```

Запуск из корня репозитория требует `PYTHONPATH=src` либо установки пакета в editable-режиме:

```bash
pip install -e .
PYTHONPATH=src python -m meter_bot
```

## Конфигурация

См. `.env.example`:

| Переменная | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_CHAT_ID` | ID чата, откуда принимаются показания |
| `TELEGRAM_ALLOWED_USER_IDS` | опциональный whitelist user id |
| `SMTP_*` / `MAIL_*` | SMTP и адреса письма |
| `MAIL_TEMPLATE_PATH` | шаблон тела письма |

Шаблон по умолчанию: `templates/meter_email.txt`.

## Тесты

```bash
PYTHONPATH=src pytest
```

## Архитектура

1. Telegram long polling (`aiogram`) — только заданный `chat_id`
2. Парсер `гор` / `хол`
3. Письмо через SMTP по шаблону
4. Ответ в чат: успех или подсказка формата

Этот репозиторий отделён от `api-gateway` и других проектов.

## Подключение к GitHub

Локальный git уже инициализирован на ветке `main`. После создания пустого репозитория
`lyapinv/telegram-meter-email` на GitHub:

```bash
cd ~/telegram-meter-email
git remote add origin https://github.com/lyapinv/telegram-meter-email.git
git push -u origin main
```

В доступе Cursor GitHub App для нового репозитория должен быть разрешён push.