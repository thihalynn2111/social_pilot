import "./globals.css";

export const metadata = { title: "Social Autopilot", description: "Schedule and publish to Facebook and TikTok" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
