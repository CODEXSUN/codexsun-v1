$ErrorActionPreference = 'Stop'
$pythonCommand = $env:CODEXSUN_FRAPPE_PYTHON
$pythonOptions = @()
if (-not $pythonCommand) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCommand = 'py'
        $pythonOptions = @('-3')
    } else {
        $pythonCommand = 'python'
    }
}
& $pythonCommand @pythonOptions "$PSScriptRoot/setup.py" @args
exit $LASTEXITCODE
