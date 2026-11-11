import {bridge,clearSegment,courtAngle,gate,hall,middle,palacePond,pavilions,stoneFountain,stoneHall,walkable} from "./layout.js";
import {fromBuilding} from "./museum.js";
import {isInsideMuseum} from "./visit-layout.js";

const royalTour="https://royal.khs.go.kr/ROYAL/contents/R402000000.do?id=20240313092652267385&schM=view";
const royalBuildings="https://royal.khs.go.kr/ROYAL/contents/R402000000.do?id=20260331093323561530&schM=view";
const palaceRecord="https://digital.khs.go.kr/heri/heriDetail.do?ctptNo=1331101240000&ctptUid=13898859674581300745";
const modernMuseum="https://www.mmca.go.kr/upload/m/data/exhibition/2012/09/14/20120914091758.pdf";
const pavilionByName=Object.fromEntries(pavilions.map(site=>[site.name,site]));
const guideDistance=3.8;

function footprint(site){
  const w=site.w/2,d=site.d/2;
  return site.outline??[[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>fromBuilding(site,x,z));
}

// Read from several sides of a building or pond. Use positions beyond the
// footprint so paths to the sign are checked against the actual collision map.
function perimeterPoints(outline){
  const next=outline.slice(1).concat(outline[0]);
  const direction=Math.sign(outline.reduce((sum,a,i)=>sum+a.x*next[i].y-next[i].x*a.y,0));
  return outline.flatMap((a,i)=>{
    const b=next[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    const count=Math.max(1,Math.ceil(length/3.4));
    const nx=direction*dy/length,ny=-direction*dx/length;
    return Array.from({length:count},(_,index)=>{
      const t=(index+.5)/count;
      return [1.1,2.3].map(offset=>({x:a.x+dx*t+nx*offset,y:a.y+dy*t+ny*offset}));
    }).flat();
  });
}

function localPoints(site,positions){
  return positions.map(([x,z])=>fromBuilding(site,x,z));
}

function guide(id,site,description,source,access=[],title=site.name){
  const outline=site.w?footprint(site):site.outline;
  const points=outline?[...perimeterPoints(outline),...access]:access;
  const radius=Math.max(...points.map(point=>Math.hypot(point.x-site.x,point.y-site.y)))+guideDistance;
  return {site,points,radiusSquared:radius*radius,entry:{id,title,description,source}};
}

const mainGate={...gate,w:14.2,d:8.1,angle:Math.PI/2};
const middleGate={...middle,w:10.9,d:6.9,angle:courtAngle};
const mainHall={...hall,w:18.6,d:17.6,angle:courtAngle};
const stoneBuilding={...stoneHall,w:54.2,d:31};
const fountainEdge=Array.from({length:16},(_,index)=>{
  const angle=index*Math.PI/8;
  return {x:stoneFountain.x+5.7*Math.cos(angle),y:stoneFountain.y+5.7*Math.sin(angle)};
});

const guides=[
  guide("daehanmun",mainGate,
    "덕수궁의 정문이에요. 동쪽에 있던 대안문을 1906년에 고쳐 대한문이라 이름 붙이고 정문으로 삼았습니다.",
    "https://royal.khs.go.kr/ROYAL/contents/R404000000.do?schGroupCode=dsg",localPoints(mainGate,[[0,-6],[0,0],[0,7],[0,12]])),
  guide("geumcheongyo",bridge,
    "대한문을 지나 처음 만나는 돌다리예요. 궁궐 안팎을 가르는 물길 위에 놓였으며, 아래에는 돌로 쌓은 두 개의 아치가 있습니다.",
    "https://heritage.go.kr/heri/gungDetail/gogungDetail.do?detail_code=2&gung_number=4&serial_number=111",
    localPoints(bridge,[[-4,0],[0,0],[4,0],[0,-2],[0,2]])),
  guide("junghwamun",middleGate,
    "중화전 마당으로 들어가는 문이에요. 1904년 화재 뒤 중화전과 함께 다시 지었고, 문 동쪽에는 마당을 둘러싸던 행각의 일부가 남아 있습니다.",
    "https://digital.khs.go.kr/heri/heriDetail.do?ctptUid=13898859671361200471",
    localPoints(middleGate,[[0,-5],[0,0],[0,5]])),
  guide("junghwajeon",mainHall,
    "덕수궁의 중심 전각인 정전이에요. 왕의 즉위식과 신하들의 하례, 외국 사신 접견 같은 공식 행사가 이곳에서 열렸습니다.",
    royalTour,localPoints(mainHall,[[0,28],[0,24],[0,18],[0,-17],[-22,1],[22,1]])),
  guide("gwangmyeongmun",pavilionByName["광명문"],
    "고종의 침전인 함녕전으로 들어가는 문이에요. 일제강점기에 옮겨졌다가 2019년 원래 자리에 돌아왔습니다.",
    "https://www.seouldanurim.net/video-tour/VOD/view/33658"),
  guide("hamnyeongjeon",pavilionByName["함녕전"],
    "고종이 생활하던 침전이에요. 고종이 1919년 세상을 떠난 곳이기도 합니다.",royalTour),
  guide("deokhongjeon",pavilionByName["덕홍전"],
    "명성황후의 신주를 모셨던 경효전 터에 세운 전각이에요. 1912년 건물을 고쳐 덕홍전이라는 이름을 붙였습니다.",modernMuseum),
  guide("seogeodang",pavilionByName["석어당"],
    "덕수궁에 남아 있는 유일한 2층 목조 전각이에요. 단청을 하지 않아 기둥과 처마에서 목재의 빛깔을 볼 수 있습니다.",
    "https://encykorea.aks.ac.kr/Article/E0015361"),
  guide("jeukjodang",pavilionByName["즉조당"],
    "대한제국 초기에 잠시 정전으로 쓰인 전각이에요. 이후에는 임금이 업무를 보던 편전으로 쓰였습니다.",royalTour),
  guide("junmyeongdang",pavilionByName["준명당"],
    "함녕전이 지어지기 전까지 고종의 침전으로 쓰인 전각이에요. 나중에는 고종의 딸 덕혜옹주의 유치원으로도 쓰였습니다.",royalBuildings),
  guide("jeonggwanheon",pavilionByName["정관헌"],
    "전통 지붕과 서양식 기둥이 함께 있는 전각이에요. 처마 아래의 기둥과 난간에서도 서로 다른 건축 양식이 어우러진 모습을 볼 수 있습니다.",
    "https://heritage.go.kr/heri/html/HtmlPage.do?pageNo=3_1_1_0&pg=%2Fpalaces%2FpalacesDeokInfo.jsp"),
  guide("seokjojeon",stoneBuilding,
    "대한제국기에 지은 서양식 석조 건물이에요. 정면의 높은 이오니아식 기둥과 삼각형 지붕 장식에 새긴 오얏꽃 문양이 눈에 띕니다.",
    "https://contents.history.go.kr/mobile/nh/view.do?levelId=nh_046_0040_0020_0030_0020_0010",
    localPoints(stoneBuilding,[[0,20],[0,16],[-10,19],[10,19]])),
  guide("seokjojeon-west",pavilionByName["국립현대미술관 덕수궁관"],
    "1938년 이왕가미술관으로 문을 연 건물이에요. 1998년부터 국립현대미술관 덕수궁관으로 쓰이고 있습니다.",
    "https://www.mmca.go.kr/pr/employmentDetail.do?bdCId=201805030006268&menuId=&searchBmCid=200903020000015",[],"석조전 서관"),
  guide("dondeokjeon",pavilionByName["돈덕전"],
    "고종 즉위 40주년을 계기로 지은 서양식 영빈관이에요. 대한제국의 외교 무대였으며, 복원 후 2023년에 다시 문을 열었습니다.",
    "https://royal.khs.go.kr/ROYAL/contents/R402000000.do?id=20230925142548033336&schM=view"),
  guide("yunganmun",pavilionByName["융안문"],
    "덕홍전 영역으로 들어가는 문이에요. 문과 이어지는 행각도 함께 복원했습니다.",
    "https://www.archives.go.kr/next/newsearch/showDetailPopup.do?rc_code=1310377&rc_rfile_no=201205359212&rc_ritem_no=&sitePage="),
  guide("pyeongseongmun",pavilionByName["평성문"],
    "돈덕전 가까이에서 정동길로 이어지는 덕수궁의 후문이에요. 문 바깥에는 주한 미국대사관저가 있습니다.",
    "https://royal.khs.go.kr/ROYAL/contents/R403000000.do?id=20241128163203827666&schBcid=notice01&schM=view"),
  guide("wolgokmun",pavilionByName["월곡문"],
    "정동 쪽 돌담길에서 볼 수 있는 덕수궁의 문이에요. 국가유산청 기록에는 2005년 문을 해체해 보수한 내역이 남아 있습니다.",palaceRecord),
  guide("palace-pond",palacePond,
    "대한문 안쪽에 있는 연못이에요. 연못 일대는 1960년대에 스케이트장으로 쓰인 적도 있습니다.",modernMuseum,[],"덕수궁 연못 · 연지"),
  guide("seokjojeon-fountain",stoneFountain,
    "석조전 앞에 펼쳐진 서양식 정원이에요. 네 잎 모양 분수를 중심으로 잔디와 화단이 대칭으로 놓여 있습니다.",
    "https://world.seoul.go.kr/deoksugung-palace-2/",fountainEdge)
];

function squaredDistance(a,b){
  return (a.x-b.x)**2+(a.y-b.y)**2;
}

export function nearbyPalaceGuide(position){
  if(isInsideMuseum(position.x,position.y)||!walkable(position.x,position.y))return null;
  let result=null,bestDistance=guideDistance*guideDistance;
  for(const {site,points,radiusSquared,entry} of guides){
    if(squaredDistance(position,site)>radiusSquared)continue;
    for(const point of points){
      const distance=squaredDistance(position,point);
      if(distance<bestDistance&&walkable(point.x,point.y)&&clearSegment(position,point)){
        result=entry;
        bestDistance=distance;
      }
    }
  }
  return result;
}
