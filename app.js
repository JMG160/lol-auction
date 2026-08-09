let ws = null;
let uid = null;
let code = null;

const $ = id => document.getElementById(id);

function 연결하다(onOpen) {
  // 이미 연결되어 있으면 그대로 사용
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (onOpen) onOpen();
    return;
  }

  const protocol = location.protocol === "https:" ? "wss://" : "ws://";

  ws = new WebSocket(protocol + location.host);

  ws.onopen = () => {
    console.log("WebSocket 연결 완료");

    if (onOpen) {
      onOpen();
    }
  };

  ws.onmessage = e => {
    try {
      const m = JSON.parse(e.data);

      if (m.type === "joined") {
        uid = m.uid;
        code = m.code;

        if ($("join")) $("join").hidden = true;
        if ($("game")) $("game").hidden = false;
        if ($("roomcode")) $("roomcode").textContent = code;
        if ($("joinmsg")) $("joinmsg").textContent = "";
      }

      if (m.type === "오류") {
        alert(m.메시지);
      }

      if (m.type === "상태") {
        렌더링(m.수);
      }
    } catch (err) {
      console.error("메시지 처리 오류:", err);
    }
  };

  ws.onerror = e => {
    console.error("WebSocket 오류:", e);
  };

  ws.onclose = () => {
    console.log("WebSocket 연결 종료");
    ws = null;
  };
}

function 보내세요(x) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("WebSocket이 아직 연결되지 않았습니다.");
    return false;
  }

  ws.send(JSON.stringify(x));
  return true;
}

function 만들다() {
  연결하다(() => {
    보내세요({
      type: "create",
      이름: $("이름").value || "플레이어 1"
    });
  });
}

function 합류하다() {
  연결하다(() => {
    보내세요({
      type: "join",
      code: $("코드").value,
      name: $("이름").value || "플레이어 2"
    });
  });
}

function 그리기() {
  보내세요({
    type: "draw"
  });
}

function startUnsold() {
  보내세요({
    type: "startUnsold"
  });
}

function 입찰() {
  const s = Number($("입찰 금액").value);

  if (!Number.isFinite(s)) {
    alert("입찰 금액을 입력하세요.");
    return;
  }

  보내세요({
    type: "bid",
    amount: s
  });
}

function win() {
  보내세요({
    type: "win"
  });
}

function 렌더링(s) {
  if (!s) return;

  const active = s.current || s.unsoldCurrent;

  if ($("phase")) {
    $("phase").textContent =
      s.phase === "auction"
        ? "경매 중"
        : s.phase === "unsoldAuction"
        ? "미낙찰 재경매"
        : s.phase === "finished"
        ? "종료"
        : "대기";
  }

  if ($("remain")) {
    $("remain").textContent = s.remaining ?? "";
  }

  if ($("current")) {
    if (active) {
      $("current").innerHTML = `
        <div class="pos">${active.player?.position || ""}</div>
        <div class="player">${active.player?.name || ""}</div>
      `;
    } else {
      $("current").innerHTML = "대기 중";
    }
  }

  if ($("draw")) {
    $("draw").disabled =
      !active ||
      !s.users ||
      s.users.length < 2 ||
      s.phase === "finished";
  }

  if ($("startUnsold")) {
    $("startUnsold").disabled =
      !s.unsold ||
      s.unsold.length === 0;
  }

  if ($("unsoldList")) {
    $("unsoldList").innerHTML = (s.unsold || [])
      .map(
        p =>
          `<span class="tag">${p.position} ${p.name}</span>`
      )
      .join("");
  }

  if (active && $("bidbox")) {
    $("bidbox").hidden = false;

    if ($("bidamount")) {
      $("bidamount").value = active.bid || "";
    }

    if ($("bidder")) {
      $("bidder").textContent =
        active.bidderName
          ? `현재 최고: ${active.bidderName}`
          : "아직 입찰 없음";
    }
  }

  if ($("users")) {
    $("users").innerHTML = (s.users || [])
      .map(
        u => `
          <div class="user">
            <b>${u.name}</b>
            <span>${u.points}P</span>
            <span>보유 ${u.roster?.length || 0}명</span>
            <div>
              ${(u.roster || [])
                .map(
                  p =>
                    `${p.position} ${p.name} ${p.price || ""}`
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("");
  }

  if ($("history")) {
    $("history").innerHTML = (s.history || [])
      .map(
        h => `
          <div class="historyrow">
            <span>${h.player?.position || ""}</span>
            <span>${h.player?.name || ""}</span>
            <span>${h.bidder || ""}</span>
            <span>
              ${h.price === 0 ? "미낙찰" : h.price}
            </span>
          </div>
        `
      )
      .join("");
  }

  if ($("remaining")) {
    $("remaining").textContent =
      s.phase === "finished" ? "경매 종료" : "";
  }
}

function 제거(i) {
  보내세요({
    type: "reroll",
    index: i
  });
}
