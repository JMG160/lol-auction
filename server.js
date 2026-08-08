
const http=require('http');
const fs=require('fs');
const path=require('path');
const WebSocket=require('ws');
const crypto=require('crypto');

const PORT=process.env.PORT||3000;
const rooms=new Map();
const players=[{"name": "제우스", "position": "탑"}, {"name": "기인", "position": "탑"}, {"name": "도란", "position": "탑"}, {"name": "퍼팩트", "position": "탑"}, {"name": "시우", "position": "탑"}, {"name": "리치", "position": "탑"}, {"name": "킹겐", "position": "탑"}, {"name": "클리어", "position": "탑"}, {"name": "캐스팅", "position": "탑"}, {"name": "두두", "position": "탑"}, {"name": "오너", "position": "정글"}, {"name": "캐니언", "position": "정글"}, {"name": "루시드", "position": "정글"}, {"name": "카나비", "position": "정글"}, {"name": "스폰지", "position": "정글"}, {"name": "커즈", "position": "정글"}, {"name": "랩터", "position": "정글"}, {"name": "기드온", "position": "정글"}, {"name": "윌러", "position": "정글"}, {"name": "샤벨", "position": "정글"}, {"name": "표식", "position": "정글"}, {"name": "페이커", "position": "미드"}, {"name": "쵸비", "position": "미드"}, {"name": "비디디", "position": "미드"}, {"name": "클로져", "position": "미드"}, {"name": "로머", "position": "미드"}, {"name": "쇼메이커", "position": "미드"}, {"name": "제카", "position": "미드"}, {"name": "빅라", "position": "미드"}, {"name": "유칼", "position": "미드"}, {"name": "스카웃", "position": "미드"}, {"name": "구마유시", "position": "원딜"}, {"name": "태윤", "position": "원딜"}, {"name": "룰러", "position": "원딜"}, {"name": "스매쉬", "position": "원딜"}, {"name": "페이즈", "position": "원딜"}, {"name": "테디", "position": "원딜"}, {"name": "디아블", "position": "원딜"}, {"name": "에이밍", "position": "원딜"}, {"name": "펜니르", "position": "원딜"}, {"name": "덕담", "position": "원딜"}, {"name": "케리아", "position": "서폿"}, {"name": "딜라이트", "position": "서폿"}, {"name": "듀로", "position": "서폿"}, {"name": "피터", "position": "서폿"}, {"name": "안딜", "position": "서폿"}, {"name": "리헨즈", "position": "서폿"}, {"name": "남궁", "position": "서폿"}, {"name": "켈린", "position": "서폿"}, {"name": "커리어", "position": "서폿"}, {"name": "에포트", "position": "서폿"}];

function freshState(){
  return {
    phase:"lobby", players:players.map(x=>({...x})), current:null, history:[], unsold:[], unsoldCurrent:null, unsoldMode:false,
    users:[], turn:null, config:{points:30000,minBid:1,increment:100}
  };
}
function publicState(room){
  return {
    phase:room.phase, current:room.current, history:room.history, unsold:room.unsold, unsoldCurrent:room.unsoldCurrent, unsoldMode:room.unsoldMode,
    users:room.users.map(u=>({id:u.id,name:u.name,points:u.points,roster:u.roster})),
    config:room.config, remaining:room.players.length
  };
}
function broadcast(room){
  const msg=JSON.stringify({type:"state",state:publicState(room)});
  room.sockets.forEach(s=>{if(s.readyState===1)s.send(msg)});
}
function getUser(room,id){return room.users.find(u=>u.id===id)}
function maxOwnForPosition(room,pos){
  const total=players.filter(x=>x.position===pos).length;
  return total-3; // 상대가 최소 3명 확보해야 함
}
function canBid(room,u){
  if(!room.current) return false;
  const pos=room.current.player.position;
  const owned=u.roster.filter(x=>x.position===pos).length;
  return owned < maxOwnForPosition(room,pos);
}
function nextPlayer(room){
  if(!room.players.length){room.phase="finished";room.current=null;broadcast(room);return;}
  const i=Math.floor(Math.random()*room.players.length);
  const p=room.players.splice(i,1)[0];
  room.current={player:p, bid:room.config.minBid, bidder:null, bidderName:null};
  room.phase="auction";
  room.turn=null;
  broadcast(room);
}
function settle(room){
  if(!room.current)return;
  const c=room.current;
  if(c.bidder){
    const u=getUser(room,c.bidder);
    if(u && u.points>=c.bid){
      u.points-=c.bid; u.roster.push({...c.player,price:c.bid});
      room.history.unshift({player:c.player,price:c.bid,bidder:u.name,bidderId:u.id});
    }
  } else {
    room.unsold.push({...c.player});
    room.history.unshift({player:c.player,price:0,bidder:"미낙찰",bidderId:null});
  }
  room.current=null; room.phase="lobby"; room.turn=null; broadcast(room);
}
function nextUnsold(room){
  if(!room.unsold.length){room.phase="lobby";room.unsoldMode=false;room.unsoldCurrent=null;broadcast(room);return;}
  const i=Math.floor(Math.random()*room.unsold.length);
  const p=room.unsold.splice(i,1)[0];
  room.unsoldCurrent={player:p,bid:room.config.minBid,bidder:null,bidderName:null};
  room.phase="unsoldAuction";room.unsoldMode=true;broadcast(room);
}
function settleUnsold(room){
  const c=room.unsoldCurrent;if(!c)return;
  if(c.bidder){
    const u=getUser(room,c.bidder);
    if(u && u.points>=c.bid){u.points-=c.bid;u.roster.push({...c.player,price:c.bid});room.history.unshift({player:c.player,price:c.bid,bidder:u.name,bidderId:u.id,unsoldAuction:true});}
  } else {
    room.history.unshift({player:c.player,price:0,bidder:"미낙찰",bidderId:null,unsoldAuction:true});
  }
  room.unsoldCurrent=null;room.phase="lobby";room.unsoldMode=false;broadcast(room);
}
const server=http.createServer((req,res)=>{
  let p=req.url.split('?')[0]; if(p==='/')p='/index.html';
  const file=path.join(__dirname,'public',p);
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')} 
    const ext=path.extname(file); const ct={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'}[ext]||'text/plain';
    res.writeHead(200,{'Content-Type':ct});res.end(d);
  });
});
const wss=new WebSocket.Server({server});
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.type==="create"){
      const code=crypto.randomBytes(3).toString('hex').toUpperCase();
      const room={...freshState(),code,sockets:new Set(),users:[]};
      rooms.set(code,room); room.sockets.add(ws);
      const u={id:crypto.randomUUID(),name:m.name||"플레이어 1",points:room.config.points,roster:[]};
      room.users.push(u); ws.uid=u.id; ws.room=code; ws.send(JSON.stringify({type:"joined",code,uid:u.id}));broadcast(room);
    }
    if(m.type==="join"){
      const room=rooms.get((m.code||"").toUpperCase()); if(!room||room.users.length>=2){ws.send(JSON.stringify({type:"error",msg:"방이 없거나 이미 2명입니다."}));return}
      room.sockets.add(ws); const u={id:crypto.randomUUID(),name:m.name||"플레이어 2",points:room.config.points,roster:[]};
      room.users.push(u);ws.uid=u.id;ws.room=room.code;ws.send(JSON.stringify({type:"joined",code:room.code,uid:u.id}));broadcast(room);
    }
    if(!ws.room)return;
    const room=rooms.get(ws.room); if(!room)return;
    const u=getUser(room,ws.uid);
    if(m.type==="start" && room.users.length===2){room.phase="lobby";nextPlayer(room)}
    if(m.type==="draw" && room.phase==="lobby") nextPlayer(room);
    if(m.type==="startUnsold" && room.phase==="lobby" && room.unsold.length) nextUnsold(room);
    if(m.type==="bid" && (room.phase==="auction" || room.phase==="unsoldAuction") && u){
      const c=room.phase==="auction" ? room.current : room.unsoldCurrent;
      if(!canBid(room,u)) return ws.send(JSON.stringify({type:"error",msg:"이 포지션은 더 이상 입찰할 수 없습니다."}));
      const next=c.bidder ? c.bid+room.config.increment : c.bid;
      const amount=Number(m.amount||next);
      if(amount<c.bid || (c.bidder && amount<c.bid+room.config.increment) || amount>u.points) return;
      c.bid=amount;c.bidder=u.id;c.bidderName=u.name;broadcast(room);
    }
    if(m.type==="pass" && room.phase==="auction" && u && room.current && room.current.bidder===u.id){
      // Current bidder can voluntarily end only after someone else has bid; disallow self-pass for safety.
    }
    if(m.type==="win" && room.phase==="auction" && u && room.current && room.current.bidder===u.id) settle(room);
    if(m.type==="win" && room.phase==="unsoldAuction" && u && room.unsoldCurrent && room.unsoldCurrent.bidder===u.id) settleUnsold(room);
    if(m.type==="reroll" && room.phase==="lobby" && m.index!==undefined){
      const h=room.history[m.index]; if(!h)return;
      room.players.push({...h.player}); room.history.splice(m.index,1);broadcast(room);
    }
  });
  ws.on('close',()=>{if(ws.room){const r=rooms.get(ws.room);if(r){r.sockets.delete(ws)}}});
});
server.listen(PORT,()=>console.log("server on "+PORT));
