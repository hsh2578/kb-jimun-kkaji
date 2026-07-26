# 기획서 슬라이드를 PNG 로 내보낸다. 레이아웃을 눈으로 확인하기 위함이다.
#
# 텍스트만 갈아끼우면 글자 길이가 달라져 도형 밖으로 넘치거나 줄이 깨진다.
# XML 만 봐서는 알 수 없으므로 실제로 렌더링해서 본다.
#
# 실행: powershell -File scripts/export-slides.ps1 [pptx경로] [출력폴더]
param(
  [string]$Deck = "",
  [string]$OutDir = "$env:TEMP\kbslides"
)

if (-not $Deck) {
  $Deck = (Get-ChildItem "C:\Users\hsh\Desktop\공모전" -Filter "KB_기술설명서*.pptx" |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
if (-not (Test-Path $Deck)) { throw "기획서를 찾을 수 없습니다: $Deck" }

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
try {
  # ReadOnly 로 연다 — 사용자가 같은 파일을 열어두고 있어도 부딪히지 않게.
  $pres = $ppt.Presentations.Open($Deck, $true, $false, $false)
  $pres.SaveCopyAs($OutDir + "\slide.png", 18)  # 18 = ppSaveAsPNG (슬라이드별로 쪼개 저장)
  $pres.Close()
} finally {
  $ppt.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
}

# PowerPoint 는 하위 폴더에 넣기도 한다 — 어디에 떨어졌든 모아서 알려준다.
$files = Get-ChildItem $OutDir -Recurse -Filter "*.PNG" -ErrorAction SilentlyContinue
if (-not $files) { $files = Get-ChildItem $OutDir -Recurse -Filter "*.png" -ErrorAction SilentlyContinue }
Write-Output "내보낸 슬라이드: $($files.Count)장"
Write-Output "폴더: $OutDir"
$files | Select-Object -First 3 | ForEach-Object { Write-Output "  $($_.FullName)" }
