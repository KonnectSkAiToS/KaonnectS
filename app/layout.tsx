import type { Metadata } from "next";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { AuthProvider } from "@/lib/client";
import { Shell } from "@/components/Shell";
import { AppTheme, THEME_SCRIPT, type Brand } from "@/components/AppTheme";

export const metadata: Metadata = { title: "Admin", description: "Agency admin portal: shifts, rota, compliance, attendance and timesheets" };

// Neutral branding until the agency's own loads after sign-in (then it's kept in the persisted store).
// ponytail: pre-sign-in branding per custom domain needs a public branding endpoint keyed by host.
const DEFAULT_BRAND: Brand = { name: "Staffing Platform", brandColor: "indigo" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppTheme initialBrand={DEFAULT_BRAND}>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </AppTheme>
      </body>
    </html>
  );
}
