// 뉴리의창고 공통 설정
// api: 구글 앱스 스크립트 웹 앱 주소 (backend/README.md 참고). 비어 있으면 댓글·좋아요는 숨기고,
//      뉴리펫 메일은 메일 앱으로 대신 보낸다.
window.NYURI = {
  api: "https://script.google.com/macros/s/AKfycbxgRPj5bTNPfiabtl3ocTHTbbgN0AztWspZKrva9CEwBYv9DkggVhuMA217pTYWZ1bC/exec",
  site: "https://imvely.github.io/nyuri-garden/",
}

// 백엔드로 보낼 때 함께 붙이는 기록용 정보 (관리 시트에만 남고 화면엔 IP 앞 두 자리만 보인다)
;(() => {
  let ipPromise = null
  // 방문자의 공개 IP (ipify). 실패하면 빈 값.
  window.NYURI.ip = () => {
    if (!ipPromise) {
      ipPromise = fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((j) => String(j.ip || ""))
        .catch(() => "")
    }
    return ipPromise
  }
  // 방문자 식별값(브라우저마다 하나, 좋아요 중복 방지와 기록용)
  window.NYURI.clientId = () => {
    try {
      let id = localStorage.getItem("nyuri-client")
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now()
        localStorage.setItem("nyuri-client", id)
      }
      return id
    } catch {
      return ""
    }
  }
  // 요청 본문에 덧붙일 기록 정보
  // IP 가 늦으면(1.2초) 기다리지 않고 빈 값으로 보낸다. 보통은 페이지를 열 때 미리 받아 둔다.
  const ipQuick = () => Promise.race([window.NYURI.ip(), new Promise((r) => setTimeout(() => r(""), 1200))])
  window.NYURI.meta = async () => ({
    ip: await ipQuick(),
    ua: navigator.userAgent.slice(0, 300),
    clientId: window.NYURI.clientId(),
    referrer: document.referrer.slice(0, 300),
  })
})()
