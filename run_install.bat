::получаем curpath:
@for /f %%i in ("%0") do set curpath=%~dp0

::задаем основные переменные окружения
@CALL "%curpath%set_path.bat"
@echo ==================================================
@echo создаем временные каталоги:
mkdir "temp"

@echo ==================================================
@echo установка зависимостей из package.json:
CALL npm install

@echo ==================================================

@copy db/data.db db/data.fdb


@echo все
@pause
