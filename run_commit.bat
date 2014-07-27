::получаем curpath:
@for /f %%i in ("%0") do set curpath=%~dp0

::задаем основные переменные окружения
@CALL "%curpath%set_path.bat"

@git add **
@git commit -m "%date% %time%" -a

@cmd
