import type { Metadata } from "next";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { RoleProvider } from "@/lib/client";
import { Shell } from "@/components/Shell";
import { AppTheme } from "@/components/AppTheme";

export const metadata: Metadata = {
  title: "Staffing Admin",
  description: "Agency admin portal: shifts, rota, compliance, attendance and timesheets",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppTheme>
          <RoleProvider>
            <Shell>{children}</Shell>
          </RoleProvider>
        </AppTheme>
      </body>
    </html>
  );
}
