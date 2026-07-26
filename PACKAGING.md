# 제출 패키징 체크리스트

⚠️ **zip은 `.gitignore`를 따르지 않습니다.** 그냥 폴더를 압축하면 API 키가 들어갑니다.

## 1. 제출용 사본 만들기 (원본을 건드리지 말 것)

```bash
cd "C:/Users/hsh/Desktop/공모전"
rm -rf submit && git clone kb-jimun-kkaji submit
rm -rf submit/.git
```

`git clone`은 추적된 파일만 가져오므로 `.env`, `config.local.js`, `data/raw/`가 자동으로 빠집니다.

## 2. 키가 없는지 확인

```bash
grep -rn "sk-proj-\|sk-or-v1-" submit/ && echo "⚠️ 키 발견 — 중단" || echo "✅ 키 없음"
ls -a submit/ | grep -E "^\.env$" && echo "⚠️ .env 있음 — 삭제" || echo "✅ .env 없음"
```

## 3. 압축

```bash
cd submit && zip -r ../지문까지_제출본.zip . && cd ..
```

## 4. 함께 넣을 것

- 참가신청서 (서명·스캔)
- 참가 서약서 (서명·스캔)
- 개인정보 수집·이용 동의서 (서명·스캔)
- 기술설명서 PPT
- 데모 영상 (선택이나 강력 권장)

## 5. 마감 직전

- [ ] `npm test` 전부 통과
- [ ] GitHub 최종 커밋 후 태그: `git tag -a submit-2026-08-03 -m "제출본" && git push --tags`
- [ ] **2026-08-03 16:00 이후 커밋 금지** — 대회 FAQ: "접수기간 이후 수정·변경 이력 확인 시 심사 대상 제외"
- [ ] Vercel에 `api/` 배포 + `OPENAI_KEY` 환경변수 설정 (심사위원이 L2/L3를 보려면 필수)
- [ ] `config.local.js`를 만들어 `mode:"proxy"`로 두되 **zip에는 넣지 않음** (gitignore됨)
