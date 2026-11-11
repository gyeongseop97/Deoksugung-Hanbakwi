# 덕수궁 한바퀴 자료 출처

시작 화면의 `public/deoksugung-cover.webp`는 이 게임을 위해 생성한 가을 대한문 이미지입니다.

## 국가유산청 3D 자료

국가유산청이 공공데이터포털에 공개한 실측 자료를 웹용 GLB로 변환하고 경량화했습니다. 원본과 제공처의 이용 조건은 각 자료 페이지에서 확인할 수 있습니다.

| 파일 | 원본 자료 | 원본 이용 조건 |
| --- | --- | --- |
| `public/seokjojeon.glb` | [덕수궁 석조전](https://www.data.go.kr/data/15104816/fileData.do) | 이용허락범위 제한 없음 |
| `public/junghwamun.glb` | [덕수궁 중화문](https://www.data.go.kr/data/15104796/fileData.do) | [공공누리 제1유형 출처표시](https://www.kogl.or.kr/info/licenseType1.do) |
| `public/jeonggwanheon.glb` | [덕수궁 정관헌](https://www.data.go.kr/data/15104823/fileData.do) | 이용허락범위 제한 없음 |
| `public/junghwajeon.glb` | [덕수궁 중화전](https://www.data.go.kr/data/15104838/fileData.do) | 이용허락범위 제한 없음 |
| `public/hamnyeongjeon.glb` | [덕수궁 함녕전](https://www.data.go.kr/data/15104840/fileData.do) | 이용허락범위 제한 없음 |
| `public/seogeodang.glb` | [덕수궁 석어당](https://www.data.go.kr/data/15104853/fileData.do) | 이용허락범위 제한 없음 |

경내 길과 구조물은 사용자 제공 지도, [네이버 지도 거리뷰](https://map.naver.com/p?c=17.78,0,0,0,adh&isMini=true&p=yIv6E6e5eIrXaNhAuWpSiA,-89.7,4.57,80,Float)와 [궁능유적본부 관람 배치도](https://royal.khs.go.kr/ROYAL/contents/R701000000.do?schGroupCode=dsg)를 참고해 배치했습니다. 일부 시설의 치수는 지도와 공개 사진을 기준으로 추정했습니다.

## 경복궁 맵

경복궁의 전각 위치와 크기는 공개 지도 좌표와 궁능유적본부 관람 안내도를 참고해 실제 축척으로 배치했습니다. 건물은 이 게임을 위해 직접 모델링했으며 높이와 세부는 추정치입니다. 실측 3D 자료는 포함하지 않았습니다.

## 전시품과 렌더링

`public/art/`의 이미지와 확대 재현한 유물의 원본 URL 및 이용 조건은 [기본 전시 목록](public/museum-catalog.js), [삼국·고려 추가 목록](public/museum-more-early.js), [조선·근대 추가 목록](public/museum-more-late.js)에 있습니다. 이미지들은 게임에서 빠르게 열리도록 크기를 줄여 WebP로 변환했습니다.

렌더링은 CDN으로 [Three.js r180](https://github.com/mrdoob/three.js/tree/r180)을 불러옵니다. [Three.js MIT 라이선스](https://github.com/mrdoob/three.js/blob/r180/LICENSE)
