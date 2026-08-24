import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DEBATENIGHT — 술자리에서 시작해서 새벽까지 가는 토론 게임",
  description:
    "친구 2~8명이 방 하나 만들어서 시작하는 실시간 토론 게임. 진행자 없이 앱이 사회를 봅니다.",
  applicationName: "DEBATENIGHT",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DEBATENIGHT" },
  openGraph: {
    title: "DEBATENIGHT",
    description: "술자리에서 시작해서 새벽까지 가는 토론 게임",
    type: "website",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06060B",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="aurora antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#141622",
              border: "1px solid #262A3C",
              color: "#F7F7FB",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
