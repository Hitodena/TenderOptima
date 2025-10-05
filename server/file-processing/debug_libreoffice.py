import os
import subprocess
import tempfile

def debug_conversion():
    print("--- НАЧАЛО ОТЛАДКИ КОНВЕРТАЦИИ LIBREOFFICE ---")

    # --- ШАГ 1: ПОИСК SOFFICE.EXE ---
    print("\n[ШАГ 1] Поиск исполняемого файла soffice.exe...")
    soffice_path = None
    possible_paths = [
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ]
    for path in possible_paths:
        print(f"  Проверяю путь: {path}")
        if os.path.exists(path):
            soffice_path = path
            print(f"  УСПЕХ! Файл найден: {soffice_path}")
            break
    
    if not soffice_path:
        print("\n  КРИТИЧЕСКАЯ ОШИБКА: soffice.exe не найден ни по одному из стандартных путей. Дальнейшее выполнение невозможно.")
        return

    # --- ШАГ 2: ПОДГОТОВКА ФАЙЛОВ ---
    print("\n[ШАГ 2] Подготовка тестового файла и временной директории...")
    # Укажите точный путь к вашему проблемному файлу
    doc_path = "../../test.doc"  # Используем файл в корневой директории проекта
    output_dir = tempfile.gettempdir()
    
    print(f"  Входной файл: {doc_path}")
    print(f"  Временная директория: {output_dir}")

    if not os.path.exists(doc_path):
        print(f"\n  КРИТИЧЕСКАЯ ОШИБКА: Тестовый файл не найден по пути: {doc_path}")
        return

    # --- ШАГ 3: ВЫПОЛНЕНИЕ КОМАНДЫ ---
    print("\n[ШАГ 3] Попытка выполнить команду конвертации...")
    command = [
        soffice_path,
        "--headless",
        "--convert-to", "docx",
        "--outdir", output_dir,
        doc_path
    ]
    print(f"  Выполняемая команда: {' '.join(command)}")

    try:
        result = subprocess.run(
            command, 
            check=True,        # Обязательно, чтобы выбросить исключение при ошибке
            timeout=60, 
            capture_output=True, # Захватываем вывод
            text=True            # Декодируем в текст
        )
        print("  УСПЕХ! Команда выполнилась без ошибок.")
        print(f"  Вывод LibreOffice (stdout): {result.stdout or 'пусто'}")
        print(f"  Ошибки LibreOffice (stderr): {result.stderr or 'пусто'}")

    except FileNotFoundError:
        print("\n  КРИТИЧЕСКАЯ ОШИБКА: Система не нашла команду, хотя Python видит файл. Это проблема с правами доступа или окружением.")
        return
    except subprocess.CalledProcessError as e:
        print(f"\n  КРИТИЧЕСКАЯ ОШИБКА: LibreOffice вернул код ошибки {e.returncode}.")
        print(f"  Вывод (stdout): {e.stdout or 'пусто'}")
        print(f"  Ошибки (stderr): {e.stderr or 'пусто'}")
        return
    except Exception as e:
        print(f"\n  КРИТИЧЕСКАЯ ОШИБКА: Произошла непредвиденная ошибка: {e}")
        return

    # --- ШАГ 4: ПРОВЕРКА РЕЗУЛЬТАТА ---
    print("\n[ШАГ 4] Проверка созданного .docx файла...")
    base_name = os.path.basename(doc_path)
    new_name = os.path.splitext(base_name)[0] + ".docx"
    new_path = os.path.join(output_dir, new_name)
    
    if os.path.exists(new_path):
        print(f"  УСПЕХ! Сконвертированный файл найден: {new_path}")
        print(f"  Размер файла: {os.path.getsize(new_path)} байт.")
    else:
        print("  КРИТИЧЕСКАЯ ОШИБКА: Команда отработала, но итоговый файл не был создан. Проверьте вывод LibreOffice на шаге 3.")

    print("\n--- ОТЛАДКА ЗАВЕРШЕНА ---")

if __name__ == "__main__":
    debug_conversion()
