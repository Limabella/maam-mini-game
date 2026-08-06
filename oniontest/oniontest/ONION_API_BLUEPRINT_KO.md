# Onion Test Unreal API 연결

이 프로젝트는 Unreal Engine 5.8의 기본 `HttpBlueprint`와
`JsonBlueprintUtilities` 플러그인을 사용해 ONN-C API를 호출한다. 별도의
Marketplace 플러그인이나 C++ 컴파일 환경은 필요하지 않다.

## 첫 번째 수직 흐름

첫 목표는 JSON을 모두 해석하는 것이 아니라 다음 왕복을 확인하는 것이다.

```text
Unreal 입력
-> POST /v1/conversations/respond
-> onn-c.v1 JSON
-> 화면에 원시 응답 표시
```

### 1. 테스트 Widget 생성

`/Game/Onion/UI/WBP_OnionChat` Widget Blueprint를 만들고 다음 위젯을 둔다.

- `Input_Message`: Editable Text Box
- `Button_Send`: Button
- `Text_Response`: 여러 줄 Text Block
- `Text_Status`: 상태 표시용 Text Block

버튼과 입력창은 화면 아래쪽, 응답은 그 위에 배치한다. 첫 시험에서는
캐릭터나 AR Blueprint를 수정하지 않는다.

### 2. HTTP 요청 연결

`Button_Send.OnClicked`에서 `Http Post Request` 노드를 추가한다.

- Url: `http://127.0.0.1:8765/v1/conversations/respond`
- Verb: `Post`
- Header: `Make Request Header`의 `Json Request`
- Body: 아래 JSON 문자열

```json
{"session_id":"ue-local","message":"안녕하세요","use_nvidia":false}
```

실제 입력을 연결할 때는 문자열을 다음 세 부분으로 조합한다.

```text
{"session_id":"ue-local","message":"
+ Input_Message.Text
+ ","use_nvidia":false}
```

문자열 직접 조합은 첫 연결 확인에만 사용한다. 따옴표와 줄바꿈이 포함된
입력을 안전하게 처리하기 위해 다음 단계에서는 Blueprint Struct를 Body
핀에 직접 연결해 엔진의 JSON 직렬화를 사용한다.

### 3. 결과 표시

- `On Success`: `Result Body`를 `Text_Response`에 표시하고 상태를 `Connected`로 변경
- `On Error`: 상태를 `Request failed`로 변경
- 요청 시작 직후: 상태를 `Waiting`으로 변경하고 Send 버튼을 잠시 비활성화
- 성공 또는 실패 후: Send 버튼을 다시 활성화

응답에 `"schema_version":"onn-c.v1"`과 `dialogue`, `character`, `safety`,
`feedback`이 보이면 첫 연결은 성공이다.

## 두 번째 단계

왕복을 확인한 뒤 Blueprint Struct를 만들어 `Http Post Request`의 Body와
Result Body 핀에 직접 연결한다. UE 5.8의 Http Blueprint 노드는 Struct를
자동으로 JSON 문자열로 직렬화하고 응답 JSON을 Struct로 역직렬화한다.

필수 요청 필드:

| Blueprint 변수 | JSON 필드 | 타입 |
|---|---|---|
| `session_id` | `session_id` | String |
| `message` | `message` | String |
| `use_nvidia` | `use_nvidia` | Boolean |

첫 응답 Struct에서 우선 연결할 필드:

| 경로 | 용도 |
|---|---|
| `dialogue.onn_c` | ONN-C 대사 |
| `dialogue.mnd_n` | MND-N 안내 |
| `character.stage` | bright, mixed, guarded, dark, recovering, safety |
| `character.animation` | 애니메이션 매핑 키 |
| `safety.triggered` | 일반 연출 중단 여부 |
| `feedback.notice` | AI 오류 가능성 안내 |
| `turn_id` | 응답 신고 연결 ID |

## 실행 전 확인

ONN-C 서버가 먼저 실행되어야 한다.

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

에디터 테스트에서는 `127.0.0.1`을 사용한다. 모바일 기기에서는 같은 Wi-Fi에
연결된 개발 PC의 사설 IPv4 주소와 포트 `8765`를 사용한다. 모바일 연결과
방화벽 설정은 에디터 왕복이 성공한 뒤 진행한다.
