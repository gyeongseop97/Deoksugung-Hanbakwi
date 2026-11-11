# 덕수궁 한바퀴

덕수궁과 정동을 친구와 함께 걷는 3D 게임입니다. 1인칭 전환, 캐릭터 꾸미기, 고양이, 네 면에 그림을 그리는 소원등, 전시품 28점이 있는 미술관을 포함합니다.

Vercel이 게임 화면과 방 API를 제공하고, Turso의 **libSQL** 데이터베이스가 초대코드, 참가자 상태, 좌석과 손잡기 상태를 저장합니다. 같은 Vercel 주소에서 발급한 초대코드로 접속하면 친구와 같은 방에서 만나요. 기존 공개 사이트와 이 배포본은 각각 방을 관리합니다.

## 1. GitHub에 올리기

1. ZIP을 풀고 `package.json`과 `vercel.json`이 있는 폴더를 엽니다.
2. GitHub에서 새 저장소를 만들고 빈 저장소의 **Quick setup → uploading an existing file**을 누릅니다. 파일이 이미 있는 저장소에서는 **Add file → Upload files**를 사용합니다.
3. 압축을 푼 폴더 **안의 파일과 폴더**를 업로드하고 **Commit changes**를 누릅니다. `package.json`, `package-lock.json`, `vercel.json`, `room.mjs`, `api/`, `public/`, `database/`, `server/`, `scripts/`가 저장소의 첫 화면에 있어야 합니다. `.gitignore`와 `.env.example`도 함께 올립니다.

토큰을 입력하는 `.env.local`은 내 컴퓨터에만 둡니다. 웹 업로드는 `.gitignore`를 적용하지 않으므로 업로드 목록을 확인해 주세요. [GitHub 파일 업로드 안내](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

## 2. Turso 데이터베이스 연결

1. [Turso 대시보드](https://app.turso.tech/)에서 프로젝트 전용 데이터베이스를 만듭니다. 엔진을 선택하는 화면에서는 **libSQL**을 고릅니다.
2. 데이터베이스의 연결 화면에서 주소를 복사하고, 이 데이터베이스에 쓰기 권한이 있는 데이터베이스 토큰을 발급합니다. Turso CLI를 이미 사용한다면 `turso db create deoksugung-hanbakwi`, `turso db show --url deoksugung-hanbakwi`, `turso db tokens create deoksugung-hanbakwi`로 같은 작업을 할 수 있습니다. [Turso 시작 안내](https://docs.turso.tech/quickstart), [libSQL 연결 안내](https://docs.turso.tech/sdk/ts/quickstart#remote-libsql-database-libsql-client)
3. Node.js 22.13 이상이 설치된 컴퓨터에서 압축을 푼 폴더를 터미널로 열고, Windows PowerShell에서 아래 명령을 실행합니다.

   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

4. 메모장의 `TURSO_DATABASE_URL`과 `TURSO_AUTH_TOKEN`에 2단계의 값을 붙여 넣고 저장합니다.

   | 이름 | 넣을 값 |
   | --- | --- |
   | `TURSO_DATABASE_URL` | Turso에 표시된 `libsql://`로 시작하는 주소 |
   | `TURSO_AUTH_TOKEN` | 해당 데이터베이스에 쓰기 가능한 토큰 |

5. 같은 폴더에서 실행합니다. `덕수궁 한바퀴 데이터베이스가 준비됐습니다.`가 표시되면 방을 만들 준비가 된 상태입니다. 초기화는 필요한 테이블을 생성하며, 다시 실행해도 기존 행을 지우지 않습니다.

   ```powershell
   npm ci
   npm run db:init
   ```

## 3. Vercel에 배포하기

1. [Vercel](https://vercel.com/)에서 **Add New → Project**를 눌러 위 GitHub 저장소를 **Import**합니다.
2. **Root Directory**는 `package.json`이 있는 폴더를 선택합니다. 제공된 `vercel.json`이 **Other**, 빈 **Build Command**, 출력 폴더 `public`을 지정합니다. **Install Command**는 기본값으로 둡니다. [Vercel 빌드 설정](https://vercel.com/docs/builds/configure-a-build)
3. **Environment Variables**에 위의 두 이름과 값을 넣습니다. 먼저 운영 배포에 연결하려면 **Production**에 적용합니다. 변수는 프로젝트의 서버 설정에 넣습니다.
4. **Deploy**를 누릅니다. 배포 이후에 변수를 등록하거나 바꿨다면 **Deployments → Redeploy**를 실행합니다. [Vercel GitHub 연결](https://vercel.com/docs/git/vercel-for-github), [Vercel 환경 변수](https://vercel.com/docs/environment-variables)
5. Vercel이 준 운영 주소를 두 브라우저나 휴대폰 두 대에서 엽니다. 한쪽에서 **새 방 만들기**, 다른 쪽에서 **초대코드로 입장**을 한 뒤, 두 캐릭터가 서로 보이고 움직임이 전달되는지 확인합니다.

## 컴퓨터에서 먼저 실행

프로젝트 폴더에서 `npm ci` 후 `npm start`를 실행하고 브라우저에서 `http://127.0.0.1:4178`을 엽니다. 이 미리보기는 실행 중인 컴퓨터의 메모리에 방을 저장하므로 Turso 계정 없이 작동하며, 종료하면 테스트 방은 사라집니다. 3D를 보려면 WebGL과 Three.js를 불러올 인터넷 연결이 필요합니다.

## 연결 문제

| 상황 | 확인할 것 |
| --- | --- |
| `TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 설정해 주세요` | Vercel에 두 변수를 추가하고 해당 환경에 다시 배포합니다. |
| 화면은 열리는데 방 만들기가 실패함 | `npm run db:init`이 성공했는지 확인합니다. Vercel과 `.env.local`에 같은 DB 주소를 쓰고, 토큰에 쓰기 권한이 있는지 확인합니다. |
| 친구가 주소에 접속하지 못함 | Vercel의 **운영 주소**를 보냈는지 확인하고, 접속에 Vercel 로그인을 요구한다면 프로젝트의 **Deployment Protection** 설정을 확인합니다. |
| 친구가 방을 찾을 수 없음 | 같은 사이트 주소에서 만든 8자리 코드인지 확인하고 새 방을 만들어 다시 초대합니다. |

`/api/rooms`는 방 만들기와 입장, `/api/room`은 위치와 상호작용 동기화를 담당합니다. 접속 중에는 상태를 짧은 간격으로 주고받아 접속 시간과 인원에 따라 Vercel 함수와 Turso 사용량이 늘어납니다.

동기화 지연을 줄이려면 Vercel의 **Settings → Functions → Function Regions**에서 Turso 데이터베이스와 가까운 지역을 선택한 뒤 다시 배포합니다. [Vercel 함수 지역 설정](https://vercel.com/docs/functions/configuring-functions/region)

## 자료 출처

국가유산청 모델과 전시 자료의 이용 조건은 [자료 출처](ASSET-CREDITS.md)에 정리했습니다. 개별 작품의 원본 링크는 게임의 **작품 설명**에서도 볼 수 있습니다.
