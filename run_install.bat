::����砥� curpath:
@for /f %%i in ("%0") do set curpath=%~dp0

::������ �᭮��� ��६���� ���㦥���
@CALL "%curpath%set_path.bat"
@echo ==================================================
@echo ᮧ���� �६���� ��⠫���:
mkdir "temp"

@echo ==================================================
@echo ��⠭���� ����ᨬ��⥩ �� package.json:
CALL npm install

@echo ==================================================

@copy db/data.db db/data.fdb


@echo ��
@pause
