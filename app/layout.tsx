import "./globals.css";
import { StoreProvider } from "@/lib/store";
export const metadata = {
  title: "Daymark — A little more clarity",
  description: "Your projects, people, and daily focus in one place.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
