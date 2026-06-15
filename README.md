# Legal Dashboard

Рабочий проект судебного dashboard с Gridstack-виджетами, готовой картой и сборкой в Windows `.exe`.

## Быстрый запуск в браузере

```bash
npm install
npm run dev
```

Открой:

```text
http://localhost:5173/
```

## Запуск desktop-версии без упаковки

```bash
npm install
npm run desktop:dev
```

Или двойным кликом:

```text
run-desktop-dev.bat
```

## Сборка в Windows .exe

Самый простой способ:

```text
build-exe.bat
```

Или через терминал:

```bash
npm install
npm run dist:win
```

Готовые файлы появятся в папке:

```text
release/
```

Обычно будут созданы:

```text
Legal Dashboard Setup 1.0.0.exe
Legal Dashboard 1.0.0.exe
```

## Что внутри

- Главное меню с Gridstack-виджетами.
- Режим редактирования через кнопку `✎`.
- Добавление, удаление, сохранение и сброс виджетов.
- Разделы:
  - общий перечень дел;
  - контрольные дела;
  - исполнительные производства;
  - календарь;
  - график заседаний;
  - карта.
- Карта подключена из переданного `map.zip`.
- Для desktop-версии добавлен встроенный локальный сервер и proxy для:
  - `/nspd`;
  - `/fg`;
  - `/pkk`;
  - `/pkkros`;
  - `/nominatim`.

## Важно

Для первой сборки нужен интернет, потому что `npm install` скачивает Electron и electron-builder.

После сборки пользователь сможет запускать приложение как обычную Windows-программу без терминала.
