import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <Link to="/" className="text-[10px] text-text-tertiary hover:text-foreground mb-6 inline-block">← 돌아가기</Link>

        <h1 className="text-[18px] font-bold mb-1">이용약관</h1>
        <p className="text-[10px] text-text-tertiary mb-8">최종 수정: 2026년 3월 24일</p>

        <div className="space-y-6 text-[11px] leading-[1.8] text-text-secondary">
          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제1조 (목적)</h2>
            <p>본 약관은 Black Magician(이하 "회사")이 제공하는 마감재 라이브러리 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무를 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제2조 (정의)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>"서비스"란 회사가 제공하는 마감재 브라우징, 프리뷰, SketchUp 적용 기능 등 일체의 서비스를 말합니다.</li>
              <li>"이용자"란 본 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
              <li>"Pro 구독"이란 월 정기결제를 통해 무제한 서비스를 이용할 수 있는 유료 플랜을 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제3조 (약관의 효력)</h2>
            <p>본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 회사는 관련 법령에 위배되지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경 시 7일 전에 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제4조 (회원가입 및 계정)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>회원가입은 Google 계정을 통한 OAuth 인증으로 이루어집니다.</li>
              <li>신규 가입 시 3일간 Pro 무료 체험이 제공됩니다.</li>
              <li>이용자는 자신의 계정 정보를 관리할 책임이 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제5조 (서비스 이용)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li><strong>Free 플랜</strong>: 하루 3회 Apply to Bucket 사용 가능</li>
              <li><strong>Pro 플랜</strong>: 월 3,900원, Apply to Bucket 무제한 사용</li>
              <li>서비스 내 마감재 이미지의 저작권은 각 벤더에게 있으며, SketchUp 작업 용도로만 사용할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제6조 (결제 및 환불)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Pro 구독은 월 단위 자동 결제되며, 결제일 기준으로 갱신됩니다.</li>
              <li>구독 해지는 언제든 가능하며, 해지 시 남은 기간까지 서비스를 이용할 수 있습니다.</li>
              <li>결제일로부터 7일 이내에 서비스를 이용하지 않은 경우 전액 환불을 요청할 수 있습니다.</li>
              <li>환불은 결제 수단으로 원복되며, 처리에 영업일 기준 3~5일이 소요될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제7조 (회원 탈퇴)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>이용자는 언제든 서비스 내에서 회원 탈퇴를 할 수 있습니다.</li>
              <li>탈퇴 시 즐겨찾기, 사용 기록 등 부가 데이터는 즉시 삭제됩니다.</li>
              <li>탈퇴 후 30일간 동일 계정으로 재가입이 제한됩니다.</li>
              <li>탈퇴 후 30일이 경과하면 계정 정보가 완전히 삭제됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제8조 (서비스 중단)</h2>
            <p>회사는 시스템 점검, 기술적 장애, 천재지변 등 불가피한 사유로 서비스를 일시 중단할 수 있으며, 이 경우 사전에 공지합니다.</p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제9조 (면책)</h2>
            <ol className="list-decimal pl-4 space-y-1">
              <li>회사는 벤더가 등록한 마감재 정보(가격, 재고, 이미지 등)의 정확성을 보증하지 않습니다.</li>
              <li>이용자가 서비스를 통해 얻은 정보를 활용하여 발생한 손해에 대해 회사는 책임을 지지 않습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">제10조 (준거법 및 관할)</h2>
            <p>본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한 분쟁은 회사 소재지 관할 법원을 전속 관할 법원으로 합니다.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
