# Copy Review

Generated: 2026-04-06T22:15:53.026Z

이 문서는 `npm run generate:copy-review`로 생성됩니다.
화면 문구, 시스템 메시지, 샘플/참조 라벨을 파일별로 모아 검토할 수 있게 정리했습니다.

## UI & Screen Copy

사용자가 화면에서 직접 보게 되는 문구입니다.

### src/app/layout.tsx

- L9: 여기 근데
- L10: 한마디 할게요

### src/app/not-found.tsx

- L22: 여기 근데
- L31: 요청하신 화면을 찾지 못했어요.

### src/components/common/empty-state.tsx

- L14: 아직 이 지역의 목소리가 없어요
- L15: 첫 번째 목소리를 남겨보세요.

### src/components/common/error-state.tsx

- L13: 문제가 발생했어요. 잠시 후 다시 시도해주세요.

### src/components/common/loading-state.tsx

- L13: 불러오는 중입니다

### src/components/home/compose-permission-dialog.tsx

- L55: 글을 작성하려면 위치 권한 허용이 필요해요.
- L78: 닫기
- L94: 다시 시도

### src/components/home/dong-posts-feed-content.tsx

- L42: 더 보기
- L100: 불러오는 중

### src/components/home/dong-posts-feed-veil.tsx

- L6: 서비스 이용을 위해 위치 권한을 허용해주세요.

### src/components/home/dong-posts-feed.tsx

- L72: 메뉴 닫기
- L89: 목록을 불러오는 중

### src/components/home/home-report-dialogs.tsx

- L76: 운영자가 확인할 예정입니다.
- L93: 확인
- L138: 이 글을 신고할까요?
- L166: 닫기
- L185: 처리 중..
- L185: 예

### src/components/home/pending-feed-updates-button.tsx

- L46: 새 글 {count}개 이어보기

### src/components/home/use-home-shell-state.ts

- L19: 우리 동네
- L21: Supabase 환경변수가 아직 설정되지 않아 샘플 데이터를 보여주고 있어요.

### src/components/post/post-compose-experience.tsx

- L81: 글쓰기 닫기
- L138: 닫기
- L156: 여기 남기기
- L176: 등록 중...
- L176: 등록
- L192: 지금 여기에서 글을 남겨보세요.
- L248: 같은 내용의 글이 이미 있어요. 내용을 조금 수정해 다시 시도해주세요.

### src/components/post/use-compose-location.ts

- L26: 현재 위치를 확인하는 중이에요.
- L51: 저장된 동네 정보를 다시 확인하는 중이에요.
- L97: 가장 최근에 확인한 동네를 표시하고 있어요.

### src/components/sheet/post-list-item-card.tsx

- L131: 신고 메뉴 열기

### src/components/sheet/post-list-item-menu.tsx

- L47: 신고하기

### src/lib/content/home-copy.ts

- L15: 여기 근데
- L16: 한마디 할게요
- L18: 아직 이 근처엔 올라온 이야기가 없어요
- L22: 여기
- L24: 인데요

## System & API Messages

에러, 검증, 등록/요청 실패 등 시스템 응답 문구입니다.

### src/app/api/device/register/route.ts

- L15: anonymousDeviceId가 필요합니다.

### src/app/api/location/resolve/route.ts

- L21: 유효한 위치 좌표가 필요해요.
- L34: 유효한 위치 좌표가 필요해요.
- L35: 현재 위치를 확인하지 못했어요.

### src/app/api/posts/[postId]/agree/toggle/route.ts

- L22: anonymousDeviceId가 필요합니다.

### src/app/api/posts/route.ts

- L26: anonymousDeviceId가 필요합니다.
- L36: 유효한 위치 좌표가 필요해요.
- L50: 현재 위치를 확인하지 못했어요.
- L85: 글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.

### src/components/home/home-feed-api.ts

- L104: 동네 글을 불러오지 못했습니다.
- L119: 피드 갱신에 실패했습니다.
- L135: 맞아요 상태를 갱신하지 못했습니다.
- L150: 전역 피드를 불러오지 못했습니다.

### src/components/home/home-feed-bootstrap.ts

- L62: 브라우저에서 디바이스를 준비하지 못했습니다.
- L160: 피드를 불러오지 못했습니다.

### src/components/home/home-post-api.ts

- L22: 맞아요 상태를 반영하지 못했습니다.
- L36: 신고를 접수하지 못했습니다.
- L45: 신고를 접수하지 못했습니다.

### src/components/home/use-home-agree-actions.ts

- L88: 맞아요 상태를 반영하지 못했습니다.

### src/components/home/use-home-compose-flow.ts

- L126: 등록 후 목록을 새로고침하지 못했습니다.

### src/components/home/use-home-feed-list-actions.ts

- L105: 목록을 더 불러오지 못했습니다.

### src/components/home/use-home-report-actions.ts

- L115: 신고가 접수되었어요.
- L119: 신고를 접수하지 못했습니다.

### src/components/post/use-compose-submit.ts

- L65: 실시간으로 글을 등록하려면 Supabase 연결이 필요해요.
- L73: 위치 확인이 끝난 뒤에 글을 등록할 수 있어요.
- L91: 글을 등록하지 못했어요.
- L114: 글을 등록하지 못했어요.

### src/lib/device/browser-device.ts

- L79: 브라우저에서 디바이스를 준비하지 못했습니다.
- L91: 디바이스 등록에 실패했습니다.

### src/lib/geo/browser-administrative-location-resolver.ts

- L18: 현재 위치를 행정동으로 확인하지 못했습니다.
- L30: 현재 위치를 확인하지 못했어요. 다시 시도해주세요.
- L34: 위치 권한을 허용하면 우리 동네에 글을 남길 수 있어요.
- L38: 위치 확인 시간이 초과됐어요. 다시 시도해주세요.
- L42: 이 브라우저에서는 위치 정보를 사용할 수 없어요.
- L46: 현재 위치를 아직 찾지 못했어요. 다시 시도해주세요.
- L49: 현재 위치를 확인하지 못했어요. 다시 시도해주세요.

### src/lib/posts/mutations.ts

- L61: 같은 내용의 글이 이미 있어요. 내용을 조금 수정해 다시 시도해주세요.
- L88: 알 수 없는 동네
- L90: 방금 전

### src/lib/posts/validators.ts

- L7: 내용은 1자 이상 100자 이하로 입력해 주세요.

## Display Labels

시간, 거리, 상태처럼 공통 표시용 짧은 라벨입니다.

### src/lib/geo/format-bucketed-distance.ts

- L11: 전체 피드
- L19: 거리 미확인
- L23: 100m 이내

### src/lib/utils/datetime.ts

- L9: 방금 전
- L13: ${Math.floor(diffSeconds / 60)}분 전
- L17: ${Math.floor(diffSeconds / 3600)}시간 전
- L20: ${Math.floor(diffSeconds / 86400)}일 전

## Sample & Placeholder Text

샘플 데이터, placeholder, 데모용 텍스트입니다.

### src/components/home/use-compose-dong-flashcard.ts

- L13: 우리 동네
- L16: 역삼1동
- L17: 연남동
- L18: 망원1동
- L19: 서교동
- L20: 삼청동
- L21: 정자동
- L22: 광안2동
- L23: 봉천동
- L24: 평창동
- L25: 효자동
- L26: 송도2동

### src/lib/posts/mock-data.ts

- L11: 횡단보도 신호가 너무 짧아요.
- L12: 서울 강남구 역삼1동
- L14: 3분 전
- L22: 밤길 가로등이 너무 어두워요. 골목 입구가 잘 안 보여요.
- L23: 서울 강남구 역삼2동
- L25: 12분 전
- L33: 쓰레기통이 없어서 사람들이 그냥 두고 가요.
- L34: 서울 강남구 논현1동
- L36: 27분 전
- L44: 불법주정차가 많아서 버스가 자주 막혀요.
- L45: 서울 마포구 서교동
- L47: 8분 전
- L55: 공원 쪽 조명만 조금 더 밝아지면 좋겠어요.
- L56: 서울 마포구 연남동
- L58: 21분 전
- L66: 출근 시간 버스 배차가 조금만 더 촘촘하면 좋겠어요.
- L67: 인천 연수구 송도1동
- L69: 17분 전

## Reference Geographic Labels

행정구역 표시나 동 코드처럼 운영 기준이 되는 명칭 데이터입니다.

### src/lib/geo/data/known-dong-codes.json

- L2: 역삼1동
- L3: 역삼2동
- L4: 논현1동
- L5: 서교동
- L6: 연남동
- L7: 합정동
- L8: 잠실본동
- L9: 방이1동
- L10: 문정1동
- L11: 우1동
- L12: 중1동
- L13: 좌1동
- L14: 남천2동
- L15: 광안1동
- L16: 민락동
- L17: 온천1동
- L18: 명륜동
- L19: 사직1동
- L20: 송도1동
- L21: 동춘1동
- L22: 연수1동
- L23: 부평1동
- L24: 삼산1동
- L25: 갈산1동
- L26: 구월1동
- L27: 논현고잔동
- L28: 만수1동

### src/lib/geo/format-administrative-area.ts

- L36: 서울특별시
- L36: 서울
- L37: 부산광역시
- L37: 부산
- L38: 대구광역시
- L38: 대구
- L39: 인천광역시
- L39: 인천
- L40: 광주광역시
- L40: 광주
- L41: 대전광역시
- L41: 대전
- L42: 울산광역시
- L42: 울산
- L43: 세종특별자치시
- L43: 세종
- L44: 경기도
- L44: 경기
- L45: 강원특별자치도
- L45: 강원
- L46: 강원도
- L46: 강원
- L47: 충청북도
- L47: 충북
- L48: 충청남도
- L48: 충남
- L49: 전북특별자치도
- L49: 전북
- L50: 전라북도
- L50: 전북
- L51: 전라남도
- L51: 전남
- L52: 경상북도
- L52: 경북
- L53: 경상남도
- L53: 경남
- L54: 제주특별자치도
- L54: 제주
- L55: 제주도
- L55: 제주
- L59: 경기
- L60: 경기도
- L61: 강원
- L62: 강원도
- L63: 강원특별자치도
- L64: 충북
- L65: 충청북도
- L66: 충남
- L67: 충청남도
- L68: 전북
- L69: 전라북도
- L70: 전북특별자치도
- L71: 전남
- L72: 전라남도
- L73: 경북
- L74: 경상북도
- L75: 경남
- L76: 경상남도
- L77: 제주
- L78: 제주도
- L79: 제주특별자치도
