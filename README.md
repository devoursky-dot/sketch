# RotoSketch Studio (로토스케치 스튜디오)

> **스케치북 기반 동영상 로토스코핑 & 2D 수작업 애니메이션 제작 스튜디오**  
> 실사 비디오를 트레이싱하여 자연스럽고 생동감 넘치는 2D 드로잉 애니메이션을 완성할 수 있는 데스크톱 전문 도구입니다.

---

## ✨ 주요 기능 (Key Features)

### 1. 비디오 트레이싱 & 캔버스 드로잉
- **비디오 오버레이 & 투명도 조절**: 동영상을 로드한 뒤 0%~100% 투명도로 조절하며 그 위에 정밀하게 트레이싱
- **수작업 드로잉 도구**:
  - 부드러운 필압 지원 펜 (굵기, 불투명도, 색상 팔레트)
  - 정밀 지우개
  - 라쏘(Lasso) 자유 영역 선택
  - 자유 변형(Free Transform: 회전, 스케일, 이동)
- **단독 감상 모드**: 배경 비디오를 감추고 깔끔한 스케치북 종이 위에서 내가 그린 드로잉만 집중 확인

### 2. 전문 애니메이션 타임라인 & 스트립 제어
- **애니메이션 스트립(구간) 관리**: 원하는 구간별로 드로잉 스트립을 생성, 삭제, 구간 루프 재생
- **순수 드로잉 필름스트립**: 영상 배경 없이 **오직 내가 그린 손그림만 렌더링된 썸네일 목록**으로 작업 현황 직관적 파악
- **양방향 어니언 스킨(Onion Skin)**: 이전 프레임(빨강)과 다음 프레임(파랑)의 잔상을 투명하게 비춰 매끄러운 인비트윈(In-between) 작업 지원

### 3. 인체공학적 조작계 & 초고속 미리보기
- **원터치 재생/정지 토글**: `[▶ 재생]` ↔ `[⏸ 정지]` (Space bar 단축키)
- **페어(Pair) 프레임 이동 버튼**:
  - `[◀ -1프레임 | +1프레임 ▶]` (단축키: `←` / `→` 또는 `[` / `]`)
  - `[⏪ -5프레임 | +5프레임 ⏩]` (단축키: `Shift + ←` / `Shift + →`)
  - `[⏮ -1초 | +1초 ⏭]` (단축키: `Ctrl + ←` / `Ctrl + →`)
- **타임라인 호버 썸네일 카드 (Zero Flicker)**: 타임라인 위에 마우스를 올리면 해당 프레임의 비디오+드로잉 썸네일이 실시간으로 팝업

### 4. 고품질 내보내기 (Export)
- **MP4 비디오 내보내기**: 완성된 애니메이션을 H.264 MP4 동영상으로 즉시 렌더링
- **투명 PNG 시퀀스 내보내기**: 타 애니메이션 툴 및 편집 프로그램(Premiere, After Effects, Blender 등) 연계를 위한 ZIP 압축 투명 PNG 시퀀스 추출

---

## 🛠️ 기술 스택 (Tech Stack)

- **Platform**: Electron (윈도우 데스크톱 독립 실행형 앱)
- **Bundler & Dev Server**: Vite
- **Frontend**: Vanilla JavaScript (ES Modules), HTML5 Canvas 2D, Vanilla CSS
- **Media Engine**: HTML5 Video, MediaRecorder API, Web Workers

---

## 🚀 빠른 시작 (Getting Started)

### 1. 의존성 설치
```bash
npm install
```

### 2. 웹 브라우저 개발 모드
```bash
npm run dev
```

### 3. Electron 데스크톱 앱 실행
```bash
npm run electron:dev
```

### 4. 윈도우 독립 실행 파일(.exe) 패키징
```bash
npm run package:exe
```
패키징이 완료되면 `release/RotoSketch Studio-win32-x64/RotoSketch Studio.exe` 파일이 생성됩니다.

---

## ⌨️ 단축키 안내 (Keyboard Shortcuts)

| 기능 | 단축키 |
| :--- | :--- |
| **재생 / 일시정지** | `Space` |
| **1프레임 앞 / 뒤 이동** | `←` / `→` 또는 `[` / `]` |
| **5프레임 앞 / 뒤 이동** | `Shift + ←` / `Shift + →` |
| **1초 앞 / 뒤 이동** | `Ctrl + ←` / `Ctrl + →` |
| **브러시 도구** | `B` |
| **지우개 도구** | `E` |
| **올가미(Lasso) 도구** | `L` |
| **자유 변형(Transform)** | `T` |
| **실행 취소 (Undo)** | `Ctrl + Z` |
| **다시 실행 (Redo)** | `Ctrl + Y` |
| **화면 확대/축소 리셋** | `0` (숫자 0) |

---

## 📄 라이선스 (License)

This project is licensed under the MIT License.
