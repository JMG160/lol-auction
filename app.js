let ws,uid,code;
const $=id=>document.getElementById(id);
function connect(){ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host);ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="joined"){uid=m.uid;code=m.code;$("join").hidden=true;$("game").hidden=false;$("roomcode").textContent=code;$("joinmsg").textContent=""}if(m.type==="error")alert(m.msg);if(m.type==="state")render(m.state)}}
function send(x){ws.send(JSON.stringify(x))}
function create(){connect();setTimeout(()=>send({type:"create",name:$("name").value||"플레이어 1"}),150)}
function join(){connect();setTimeout(()=>send({type:"join",code:$("code").value,name:$("name").value||"플레이어 2"}),150)}
function draw(){send({type:"draw"})}
function startUnsold(){send({type:"startUnsold"})}
function bid(){const s=Number($("bidamount").value);send({type:"bid",amount:s})}
function win(){send({type:"win"})}
function render(s){$("phase").textContent=s.phase==="auction"?"경매 중":s.phase==="unsoldAuction"?"미낙찰 재경매":s.phase==="finished"?"종료":"대기";
$("remain").textContent=s.remaining+"명";
$("current").innerHTML=(s.current||s.unsoldCurrent)?`<div class="pos">${(s.current||s.unsoldCurrent).player.position}</div><div class="player">${(s.current||s.unsoldCurrent).player.name}</div>`:"<div class='player'>대기 중</div>";
$("draw").disabled=!!active||s.users.length<2||s.phase==="finished"; $("startUnsold").disabled=!!active||s.unsold.length===0; $("unsoldCount").textContent=s.unsold.length; $("unsoldList").innerHTML=s.unsold.map(p=>`<span class="tag">${p.position} ${p.name}</span>`).join("");
const active=s.current||s.unsoldCurrent; $("bidbox").hidden=!active;
if(active){$("bid").textContent=active.bid;$("bidamount").value=active.bidder?active.bid+s.config.increment:active.bid;$("bidder").textContent=active.bidderName?`현재 최고: ${active.bidderName}`:"아직 입찰 없음";}
$("users").innerHTML=s.users.map(u=>`<div class="user"><b>${u.name}</b> · ${u.points}P · 보유 ${u.roster.length}명<br>${u.roster.map(x=>`<span class="tag">${x.position} ${x.name} ${x.price}P</span>`).join("")}</div>`).join("");
$("history").innerHTML=s.history.length?s.history.map((h,i)=>`<div class="historyrow"><span>${h.player.position} ${h.player.name}</span><span>${h.bidder} ${h.price? h.price+"P":"(미낙찰)"} ${h.price===0?`<button onclick="remove(${i})">기록에서 제거</button>`:""}</span></div>`).join(""):"기록 없음";
$("remaining").innerHTML=s.phase==="finished"?"경매 종료":"";}
function remove(i){send({type:"reroll",index:i})}
