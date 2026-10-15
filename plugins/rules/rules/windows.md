On Windows, Bash is Git Bash (MSYS) and rewrites an argument starting with `/` into a
Windows path. Use PowerShell, or prefix `MSYS_NO_PATHCONV=1` to pass it unchanged.
A path inside code or a string handed to a Windows program such as Python or Node needs
the Windows form, `C:/`, not `/c/`.
