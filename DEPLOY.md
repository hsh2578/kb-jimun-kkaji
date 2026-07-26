# 배포 — 심사 전 반드시 해야 하는 단 하나의 작업

프록시(`api/`)를 배포하지 않으면 심사위원 화면에서 **L2 조회·L3 실행이 전부 동작하지 않습니다.**
모든 발화가 L1(메뉴 위치 안내)로만 응답합니다.

소요 시간 2분. 아래를 순서대로 실행하세요.

---

## 왜 자동화해두지 않았는가

Vercel MCP에는 **환경변수를 설정하는 기능이 없습니다**(`deploy_to_vercel`에 env 파라미터가 없고 별도 도구도 없음).
키 없이 배포하면 프록시가 500만 반환하므로, 배포와 키 설정은 반드시 함께 이뤄져야 합니다.

또한 이 URL 뒤에는 **과금되는 OpenAI 키**가 있습니다. 공개 엔드포인트가 되는 순간부터
비용이 발생할 수 있으므로, 지켜볼 수 있을 때 켜는 것이 안전합니다.

---

## 1. 배포

```bash
cd "C:/Users/hsh/Desktop/공모전/kb-jimun-kkaji"
npx vercel@latest --prod
```

- 처음 실행하면 프로젝트 이름을 묻습니다 → `kb-jimun-kkaji`
- **기존 `im-ai-bank-demo` / `im-ai-bank-hsh2578` 프로젝트를 고르지 마세요.** iM 공모전 제출물입니다.
- 배포 URL이 출력됩니다. 예: `https://kb-jimun-kkaji.vercel.app`

## 2. 환경변수 두 개 설정

```bash
# OpenAI 키 — .env 에서 그대로 가져옵니다
grep '^OPENAI_KEY=' .env | cut -d= -f2- | tr -d '\r' | npx vercel@latest env add OPENAI_KEY production

# CORS 허용 출처 — 배포 URL을 그대로 넣습니다 (기본값이 닫혀 있어 반드시 필요)
echo "https://kb-jimun-kkaji.vercel.app" | npx vercel@latest env add ALLOW_ORIGIN production
```

## 3. 환경변수를 반영하기 위해 재배포

```bash
npx vercel@latest --prod
```

## 4. 프록시가 살아있는지 확인

```bash
curl -s -X POST https://kb-jimun-kkaji.vercel.app/api/embed \
  -H "Content-Type: application/json" \
  -d '{"input":"테스트"}' | head -c 120
```

`{"embedding":[...]}` 가 나오면 성공입니다.
`{"error":"OPENAI_KEY 미설정"}` 이면 2번을 다시 하세요.

## 5. 프론트엔드를 프록시에 연결

같은 Vercel 배포에 정적 파일도 함께 올라가므로 **같은 출처**입니다.

```bash
cp config.example.js config.local.js
```

`config.local.js` 를 열어 아래처럼 바꿉니다.

```js
window.KB_CONFIG = {
  mode: "proxy",
  proxyUrl: "/api",     // 같은 출처이므로 상대 경로면 충분합니다
};
```

그리고 다시 `npx vercel@latest --prod`.

> `config.local.js` 는 `.gitignore` 에 있어 커밋되지 않습니다.
> Vercel 배포에는 로컬 파일이 그대로 올라가므로 이 방식으로 동작합니다.

## 6. 브라우저에서 확인

배포 URL을 열고 아래를 차례로 입력하세요. `docs/demo-script.md` 의 시연 순서와 같습니다.

| 입력 | 기대 결과 |
|---|---|
| `내 연금 어디 들어가 있지?` | 3사(은행·증권·라이프) 금액이 함께 표시 |
| `통신비 자동으로 나가는 거 그만하고 싶어` | 해지 대상·금액 표시 + 정지 경고 + 🔒 버튼 |
| `이번 달 카드 얼마나 더 써야 혜택 받아?` | 8만원 남았다는 계산 |
| `환율 우대 어디서 받아?` | 메뉴 위치 안내 (L1) |

우측 「AI 판단 로그」에 LLM 전송 내용과 개인정보 마스킹 여부가 함께 보여야 합니다.

---

## 심사 종료 후

공개 엔드포인트를 계속 열어둘 이유가 없습니다.

```bash
npx vercel@latest env rm OPENAI_KEY production
```

또는 Vercel 대시보드에서 프로젝트를 삭제하고, OpenAI 대시보드에서 키를 회전하세요.
