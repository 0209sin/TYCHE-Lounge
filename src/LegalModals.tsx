import { ShieldCheck, Lock, FileText, Mail, Info, AlertTriangle } from 'lucide-react';

export type LegalModalType = 'terms' | 'privacy' | 'about' | null;

export function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="legal-doc-content">
      <div className="legal-banner">
        <FileText size={22} style={{ color: '#6be4c4' }} />
        <div>
          <h3>티케 라운지 서비스 이용약관 (Terms of Service)</h3>
          <p>최종 수정일: 2026년 9월 22일 · 버전: v2.2</p>
        </div>
      </div>

      <div className="legal-section">
        <h4>제 1 조 (목적 및 서비스 개요)</h4>
        <p>
          본 약관은 ‘티케 라운지(TYCHE LOUNGE)’(이하 “서비스”)가 제공하는 웹 브라우저 기반의 아케이드 미니게임 서비스(플링코, 로켓 크래시, 네온 경마, 펭귄 점프 등)의 이용 조건 및 절차에 관한 기본 사항을 규정함을 목적으로 합니다.
        </p>
      </div>

      <div className="legal-section warning-box">
        <div className="warning-title">
          <AlertTriangle size={18} style={{ color: '#ffd15c' }} />
          <strong>제 2 조 (가상 재화 및 현금 환전 불가 명시 - 중요)</strong>
        </div>
        <p>
          1. 본 서비스에서 사용되는 모든 ‘코인’, ‘스킨’, ‘칭호’, ‘아이템’ 등은 게임 내 플레이를 위한 <b>순수 가상 데이터</b>입니다.<br />
          2. 본 서비스 내 모든 가상 재화는 <b>실제 현금 가치가 전혀 없으며</b>, 어떠한 경우에도 실제 통화로 충전, 환전, 매매, 양도 또는 현금화할 수 없습니다.<br />
          3. 본 서비스는 사행성 베팅 또는 도박 사이트가 아니며, 순수 무료 오락을 목적으로 제작된 브라우저 엔터테인먼트 플랫폼입니다.
        </p>
      </div>

      <div className="legal-section">
        <h4>제 3 조 (이용자 데이터 및 브라우저 로컬 저장)</h4>
        <p>
          1. 본 서비스는 별도의 회원가입 없이 이용 가능하며, 이용자의 게임 진행 상태(잔액, 보유 상품 등)는 이용자 기기의 브라우저 로컬 저장소(IndexedDB / LocalStorage)에만 저장됩니다.<br />
          2. 이용자가 브라우저의 캐시, 쿠키 또는 사이트 데이터를 완전히 삭제하거나 기기를 변경할 경우 로컬 데이터가 소실될 수 있으므로, ‘설정과 저장’ 메뉴의 백업 기능을 주기적으로 이용하시기 바랍니다.
        </p>
      </div>

      <div className="legal-section">
        <h4>제 4 조 (면책 조항)</h4>
        <p>
          본 서비스는 무료로 제공되며, 천재지변, 브라우저 환경, 네트워크 장애 등으로 인한 게임 진행 오류나 데이터 유실에 대해 개발자는 법적 책임을 부담하지 않습니다.
        </p>
      </div>

      <div className="legal-modal-foot">
        <button className="primary-button full-width" onClick={onClose}>
          이용약관 내용을 확인했습니다
        </button>
      </div>
    </div>
  );
}

export function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="legal-doc-content">
      <div className="legal-banner">
        <Lock size={22} style={{ color: '#6be4c4' }} />
        <div>
          <h3>개인정보처리방침 (Privacy Policy)</h3>
          <p>최종 수정일: 2026년 9월 22일 · Google AdSense 규정 준수</p>
        </div>
      </div>

      <div className="legal-section">
        <h4>1. 개인정보의 수집 항목 및 방법</h4>
        <p>
          티케 라운지(TYCHE LOUNGE)는 별도의 회원가입이나 로그인 절차를 운영하지 않으며, <b>성명, 주민등록번호, 이메일, 전화번호 등 어떠한 개인식별정보(PII)도 서버로 전송하거나 수집·저장하지 않습니다.</b>
        </p>
      </div>

      <div className="legal-section">
        <h4>2. 브라우저 로컬 저장소(IndexedDB) 사용</h4>
        <p>
          이용자의 게임 경험 유지를 위해 코인 잔액, 획득한 스킨, 게임 설정(소리 등)은 전적으로 <b>이용자 본인의 웹 브라우저 로컬 저장소(IndexedDB / LocalStorage)</b>에만 안전하게 보관됩니다. 이 데이터는 외부 서버로 유출되거나 전송되지 않습니다.
        </p>
      </div>

      <div className="legal-section highlight-box">
        <div className="warning-title">
          <ShieldCheck size={18} style={{ color: '#38bdf8' }} />
          <strong>3. Google AdSense 및 제3자 광고 쿠키 정책 안내</strong>
        </div>
        <p>
          본 사이트는 서비스 운영 및 유지를 위해 Google 등의 제3자 공급업체 광고 서비스(Google AdSense)를 이용할 수 있습니다.<br /><br />
          • Google을 포함한 제3자 공급업체는 이용자가 본 웹사이트 또는 다른 웹사이트를 과거에 방문한 기록을 바탕으로 맞춤형 광고를 게재하기 위해 쿠키(Cookie)를 사용합니다.<br />
          • 이용자는 <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>Google 광고 설정</a> 페이지를 방문하여 맞춤형 광고 게재에 사용되는 개인 맞춤 광고 설정을 해제할 수 있습니다.<br />
          • 또한 <a href="https://www.aboutads.info" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>www.aboutads.info</a>를 방문하여 제3자 공급업체의 맞춤형 광고 쿠키 사용을 선택 해제할 수 있습니다.
        </p>
      </div>

      <div className="legal-section">
        <h4>4. 개인정보 보호책임자 및 문의</h4>
        <p>
          개인정보 보호 관련 문의사항이나 건의사항은 사이트 내 ‘문의처’ 항목 또는 공식 GitHub 리포지토리 Issue를 통해 연락 주시면 신속하게 처리해 드리겠습니다.
        </p>
      </div>

      <div className="legal-modal-foot">
        <button className="primary-button full-width" onClick={onClose}>
          개인정보처리방침을 확인했습니다
        </button>
      </div>
    </div>
  );
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="legal-doc-content">
      <div className="legal-banner">
        <Info size={22} style={{ color: '#ffd15c' }} />
        <div>
          <h3>티케 라운지 서비스 소개 및 문의 (About & Contact)</h3>
          <p>TYCHE LOUNGE · 버전: v2.2</p>
        </div>
      </div>

      <div className="legal-section">
        <h4>서비스 소개</h4>
        <p>
          <b>TYCHE LOUNGE (티케 라운지)</b>는 고대 그리스 행운의 여신 ‘티케(Tyche)’의 이름에서 유래된 현대적이고 세련된 네온 사이버펑크 스타일의 웹 오락실 플랫폼입니다.<br />
          플링코(Plinko), 로켓 크래시(Crash), 네온 경마(Race), 펭귄 점프(Penguin Jump) 등 직관적이고 몰입감 넘치는 아케이드 미니게임을 <b>100% 무료 가상 코인</b>으로 즐길 수 있습니다.
        </p>
      </div>

      <div className="legal-section">
        <h4>개발 및 운영 정보</h4>
        <div className="contact-card">
          <div className="contact-row">
            <Mail size={16} />
            <span>공식 문의: <b>0209sin@users.noreply.github.com</b></span>
          </div>
          <div className="contact-row">
            <FileText size={16} />
            <span>오픈소스 & 배포: <b>Vercel & GitHub Pages</b></span>
          </div>
        </div>
      </div>

      <div className="legal-section">
        <h4>책임 있는 가상 플레이 (Responsible Play)</h4>
        <p>
          티케 라운지는 건전한 여가 엔터테인먼트를 지향합니다. 본 게임에 사용되는 코인은 실제 현금 가치가 없으므로 게임 내 결과에 과도하게 몰입하지 마시고, 순수한 오락으로서 즐겨주시기 바랍니다.
        </p>
      </div>

      <div className="legal-modal-foot">
        <button className="primary-button full-width" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
