import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <Link to="/" className="text-[10px] text-text-tertiary hover:text-foreground mb-6 inline-block">← 돌아가기</Link>

        <h1 className="text-[18px] font-bold mb-1">개인정보처리방침</h1>
        <p className="text-[10px] text-text-tertiary mb-8">최종 수정: 2026년 3월 24일</p>

        <div className="space-y-6 text-[11px] leading-[1.8] text-text-secondary">
          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">1. 개인정보 수집 항목</h2>
            <p>회사는 서비스 제공을 위해 다음 개인정보를 수집합니다.</p>
            <table className="w-full mt-2 border border-border text-[10px]">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">구분</th>
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">수집 항목</th>
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">수집 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border px-3 py-1.5">필수</td>
                  <td className="border border-border px-3 py-1.5">이메일, 이름 (Google 계정 정보)</td>
                  <td className="border border-border px-3 py-1.5">Google OAuth 로그인</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-1.5">결제 시</td>
                  <td className="border border-border px-3 py-1.5">결제 정보 (카드번호 등)</td>
                  <td className="border border-border px-3 py-1.5">PG사를 통한 수집 (회사 미보관)</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-1.5">자동 수집</td>
                  <td className="border border-border px-3 py-1.5">서비스 이용 기록, 접속 로그</td>
                  <td className="border border-border px-3 py-1.5">서비스 이용 시 자동 생성</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">2. 수집 목적</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>서비스 회원 관리 및 본인 확인</li>
              <li>유료 서비스 결제 처리</li>
              <li>서비스 이용 통계 및 개선</li>
              <li>고객 문의 대응</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">3. 보유 및 이용 기간</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>회원 정보</strong>: 회원 탈퇴 후 30일간 보관 후 파기</li>
              <li><strong>결제 기록</strong>: 전자상거래법에 따라 5년 보관</li>
              <li><strong>접속 로그</strong>: 통신비밀보호법에 따라 3개월 보관</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">4. 제3자 제공</h2>
            <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>결제 처리를 위한 PG사 제공 (결제 정보에 한함)</li>
              <li>법령에 의한 요청이 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">5. 개인정보 처리 위탁</h2>
            <table className="w-full mt-2 border border-border text-[10px]">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">수탁업체</th>
                  <th className="border border-border px-3 py-1.5 text-left font-semibold">위탁 업무</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border px-3 py-1.5">Supabase Inc.</td>
                  <td className="border border-border px-3 py-1.5">회원 인증 및 데이터 저장</td>
                </tr>
                <tr>
                  <td className="border border-border px-3 py-1.5">Cloudflare Inc.</td>
                  <td className="border border-border px-3 py-1.5">웹사이트 호스팅</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">6. 이용자의 권리</h2>
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>개인정보 열람, 정정, 삭제 요청</li>
              <li>개인정보 처리 정지 요청</li>
              <li>회원 탈퇴 (서비스 내 탈퇴 기능 이용)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">7. 개인정보 보호 조치</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>개인정보는 암호화하여 저장 및 전송합니다.</li>
              <li>접근 권한을 최소한으로 제한합니다.</li>
              <li>결제 정보는 회사 서버에 저장하지 않으며, PG사가 안전하게 처리합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">8. 쿠키</h2>
            <p>서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">9. 개인정보 보호책임자</h2>
            <p>개인정보 관련 문의는 아래로 연락해 주시기 바랍니다.</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li>이메일: iiiaha.lab@gmail.com</li>
              <li>인스타그램: @iiiaha.lab</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-foreground mb-2">10. 변경 고지</h2>
            <p>본 방침이 변경되는 경우, 시행일 7일 전에 서비스 내 공지합니다.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
